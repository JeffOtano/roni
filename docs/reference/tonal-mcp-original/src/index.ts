import { createServer } from "./server.js";

const mode = process.argv.includes("--stdio") ? "stdio" : "http";

// Only load dotenv for HTTP mode — in stdio mode, Claude Desktop passes env vars directly
// and dotenv's stdout banner would corrupt the JSON-RPC stream
if (mode === "http") {
  const { config } = await import("dotenv");
  const { dirname, resolve } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const __dirname = dirname(fileURLToPath(import.meta.url));
  config({ path: resolve(__dirname, "..", ".env") });
}

if (mode === "stdio") {
  // Stdio transport — used by Claude Desktop
  const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[tonal-mcp] Running in stdio mode");
} else {
  // Streamable HTTP transport — used by Claude Code and direct clients
  const { randomUUID } = await import("node:crypto");
  const { default: express } = await import("express");
  const { StreamableHTTPServerTransport } =
    await import("@modelcontextprotocol/sdk/server/streamableHttp.js");

  const PORT = parseInt(process.env.PORT || "3888", 10);
  const app = express();
  app.use(express.json());

  const sessions = new Map<
    string,
    {
      transport: InstanceType<typeof StreamableHTTPServerTransport>;
      server: ReturnType<typeof createServer>;
    }
  >();

  app.all("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (req.method === "DELETE") {
      if (sessionId && sessions.has(sessionId)) {
        const session = sessions.get(sessionId)!;
        await session.transport.close();
        sessions.delete(sessionId);
      }
      res.status(200).end();
      return;
    }

    if (sessionId && sessions.has(sessionId)) {
      const session = sessions.get(sessionId)!;
      await session.transport.handleRequest(req, res, req.body);
      return;
    }

    if (req.method === "POST") {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
      });

      const server = createServer();
      await server.connect(transport);

      const newSessionId = transport.sessionId;
      if (newSessionId) {
        sessions.set(newSessionId, { transport, server });
        transport.onclose = () => {
          if (newSessionId) sessions.delete(newSessionId);
        };
      }

      await transport.handleRequest(req, res, req.body);
      return;
    }

    res.status(400).json({ error: "Invalid or missing session ID" });
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", sessions: sessions.size });
  });

  app.listen(PORT, "127.0.0.1", () => {
    console.log(`Tonal MCP server running at http://127.0.0.1:${PORT}/mcp`);
  });
}
