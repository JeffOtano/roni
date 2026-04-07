import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { mcpHandler } from "./mcp/server";

const http = httpRouter();
auth.addHttpRoutes(http);

http.route({
  path: "/mcp",
  method: "POST",
  handler: mcpHandler,
});

export default http;
