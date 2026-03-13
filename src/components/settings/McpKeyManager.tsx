"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Check, Copy, Key, Loader2, Plus, Trash2 } from "lucide-react";

export function McpKeyManager() {
  const keys = useQuery(api.mcp.keys.listMcpApiKeys);
  const generateKey = useMutation(api.mcp.keys.generateMcpApiKey);
  const revokeKey = useMutation(api.mcp.keys.revokeMcpApiKey);

  const [newKey, setNewKey] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const mcpUrl = deriveMcpUrl();

  async function handleGenerate() {
    setIsGenerating(true);
    try {
      const result = await generateKey({ label: label || undefined });
      setNewKey(result.key);
      setLabel("");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleRevoke(keyId: Id<"mcpApiKeys">) {
    await revokeKey({ keyId });
  }

  async function handleCopy(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard API not available (e.g. insecure context)
    }
  }

  if (keys === undefined) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (newKey) {
    const configSnippet = buildConfigSnippet(mcpUrl, newKey);

    return (
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3">
            <p className="text-sm font-medium text-foreground">
              Save this key now — it will not be shown again.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-muted px-3 py-2 text-xs">{newKey}</code>
            <Button variant="ghost" size="icon" onClick={() => handleCopy(newKey, "newKey")}>
              {copied === "newKey" ? (
                <Check className="size-4 text-green-500" />
              ) : (
                <Copy className="size-4" />
              )}
            </Button>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Claude Desktop / Claude Code config:
            </p>
            <div className="relative">
              <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">{configSnippet}</pre>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-1 right-1"
                onClick={() => handleCopy(configSnippet, "config")}
              >
                {copied === "config" ? (
                  <Check className="size-4 text-green-500" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={() => setNewKey(null)} className="w-full">
            Done
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        {/* Generate new key */}
        <div className="flex items-center gap-2">
          <Input
            placeholder="Key label (optional)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="text-sm"
          />
          <Button size="sm" onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <Plus className="mr-1.5 size-3.5" />
            )}
            Generate
          </Button>
        </div>

        {/* Existing keys */}
        {keys.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-2">
            No API keys yet. Generate one to connect Claude.
          </p>
        ) : (
          <ul className="space-y-2">
            {keys.map((k) => (
              <li
                key={k._id}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Key className="size-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{k.label ?? "Untitled key"}</p>
                    <p className="text-xs text-muted-foreground">
                      Created {new Date(k.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRevoke(k._id)}
                  className="shrink-0 text-destructive hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function deriveMcpUrl(): string {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? "";
  return convexUrl.replace(/\.cloud\/?$/, ".site") + "/mcp";
}

function buildConfigSnippet(mcpUrl: string, key: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        "tonal-coach": {
          type: "streamable-http",
          url: mcpUrl,
          headers: {
            Authorization: `Bearer ${key}`,
          },
        },
      },
    },
    null,
    2,
  );
}
