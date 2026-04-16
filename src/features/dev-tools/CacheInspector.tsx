"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { JsonViewer } from "./JsonViewer";
import type { Id } from "../../../convex/_generated/dataModel";

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const absDiff = Math.abs(diff);
  const future = diff < 0;
  const minutes = Math.floor(absDiff / 60_000);
  const hours = Math.floor(minutes / 60);

  if (minutes < 1) return future ? "in <1 min" : "<1 min ago";
  if (minutes < 60) return future ? `in ${minutes}m` : `${minutes}m ago`;
  return future ? `in ${hours}h ${minutes % 60}m` : `${hours}h ${minutes % 60}m ago`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function CacheInspector() {
  const entries = useQuery(api.devTools.listCacheEntries);
  const deleteEntry = useMutation(api.devTools.deleteCacheEntry);
  const purgeAll = useMutation(api.devTools.purgeUserCache);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (entries === undefined) {
    return <div className="py-4 text-sm text-muted-foreground">Loading cache entries...</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{entries.length} entries</span>
        {entries.length > 0 && (
          <Button variant="destructive" size="sm" onClick={() => purgeAll({})}>
            Purge All
          </Button>
        )}
      </div>

      {entries.length === 0 && (
        <div className="py-8 text-center text-sm text-muted-foreground">No cache entries</div>
      )}

      <div className="space-y-1">
        {entries.map((entry) => (
          <div key={entry._id} className="rounded-md border border-border">
            <div className="flex items-center gap-3 px-3 py-2">
              <button
                type="button"
                onClick={() => setExpandedId(expandedId === entry._id ? null : entry._id)}
                className="flex-1 text-left"
              >
                <span className="font-mono text-sm">{entry.dataType}</span>
              </button>

              <Badge
                variant={entry.status === "fresh" ? "default" : "destructive"}
                className="text-xs"
              >
                {entry.status}
              </Badge>

              <span
                className="text-xs text-muted-foreground"
                title={new Date(entry.fetchedAt).toISOString()}
              >
                {formatRelativeTime(entry.fetchedAt)}
              </span>

              <span className="text-xs text-muted-foreground">{formatBytes(entry.sizeBytes)}</span>

              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() =>
                  deleteEntry({
                    entryId: entry._id as Id<"tonalCache">,
                  })
                }
              >
                Delete
              </Button>
            </div>

            {expandedId === entry._id && (
              <div className="border-t border-border p-3">
                <div className="mb-2 flex gap-4 text-xs text-muted-foreground">
                  <span>Fetched: {new Date(entry.fetchedAt).toLocaleString()}</span>
                  <span>
                    Expires: {new Date(entry.expiresAt).toLocaleString()} (
                    {formatRelativeTime(entry.expiresAt)})
                  </span>
                </div>
                <JsonViewer data={entry.data} label="Cached Data" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
