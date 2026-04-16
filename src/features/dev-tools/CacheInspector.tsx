"use client";

import { useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { JsonViewer } from "./JsonViewer";
import type { Id } from "../../../convex/_generated/dataModel";

const PAGE_SIZE = 10;

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
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function CacheInspector() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.devTools.listCacheEntries,
    {},
    { initialNumItems: PAGE_SIZE },
  );
  const deleteEntry = useMutation(api.devTools.deleteCacheEntry);
  const purgeBatch = useMutation(api.devTools.purgeUserCacheBatch);
  const [expandedId, setExpandedId] = useState<Id<"tonalCache"> | null>(null);
  const [purging, setPurging] = useState(false);

  const expandedData = useQuery(
    api.devTools.getCacheEntryData,
    expandedId ? { entryId: expandedId } : "skip",
  );

  async function handlePurgeAll() {
    setPurging(true);
    try {
      let hasMore = true;
      while (hasMore) {
        const result = await purgeBatch({});
        hasMore = result.hasMore;
      }
    } finally {
      setPurging(false);
    }
  }

  if (status === "LoadingFirstPage") {
    return <div className="py-4 text-sm text-muted-foreground">Loading cache entries...</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {results.length} {status === "CanLoadMore" ? "loaded" : "entries"}
        </span>
        {results.length > 0 && (
          <Button variant="destructive" size="sm" onClick={handlePurgeAll} disabled={purging}>
            {purging ? "Purging..." : "Purge All"}
          </Button>
        )}
      </div>

      {results.length === 0 && (
        <div className="py-8 text-center text-sm text-muted-foreground">No cache entries</div>
      )}

      <div className="space-y-1">
        {results.map((entry) => {
          const isExpanded = expandedId === entry._id;
          return (
            <div key={entry._id} className="rounded-md border border-border">
              <div className="flex items-center gap-3 px-3 py-2">
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : entry._id)}
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

                <span className="text-xs text-muted-foreground">
                  {formatBytes(entry.sizeBytes)}
                </span>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => deleteEntry({ entryId: entry._id })}
                >
                  Delete
                </Button>
              </div>

              {isExpanded && (
                <div className="border-t border-border p-3">
                  <div className="mb-2 flex gap-4 text-xs text-muted-foreground">
                    <span>Fetched: {new Date(entry.fetchedAt).toLocaleString()}</span>
                    <span>
                      Expires: {new Date(entry.expiresAt).toLocaleString()} (
                      {formatRelativeTime(entry.expiresAt)})
                    </span>
                  </div>
                  {expandedData === undefined ? (
                    <div className="py-2 text-xs text-muted-foreground">Loading data...</div>
                  ) : expandedData === null ? (
                    <div className="py-2 text-xs text-muted-foreground">
                      Entry no longer exists.
                    </div>
                  ) : (
                    <JsonViewer data={expandedData.data} label="Cached Data" />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {status === "CanLoadMore" && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" size="sm" onClick={() => loadMore(PAGE_SIZE)}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
