"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dumbbell, Loader2, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";

interface CatalogEntry {
  id: string;
  name: string;
  muscleGroups: string[];
  skillLevel: number;
  thumbnailMediaUrl?: string;
  onMachine: boolean;
}

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: CatalogEntry[] }
  | { status: "error" };

const MIN_SEARCH_CHARS = 2;

export function ExerciseExclusions() {
  const exclusions = useQuery(api.exerciseExclusions.listMine, {});
  const searchCatalog = useAction(api.workoutDetail.getExerciseCatalog);
  const addExclusion = useMutation(api.exerciseExclusions.addMine);
  const removeExclusion = useMutation(api.exerciseExclusions.removeMine);

  const [search, setSearch] = useState("");
  const [state, setState] = useState<SearchState>({ status: "idle" });
  const [pendingMovementIds, setPendingMovementIds] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRevisionRef = useRef(0);

  const excludedIds = useMemo(
    () => new Set((exclusions ?? []).map((exclusion) => exclusion.movementId)),
    [exclusions],
  );

  const fetchResults = useCallback(
    (value: string) => {
      const revision = searchRevisionRef.current;
      const term = value.trim();
      if (term.length < MIN_SEARCH_CHARS) {
        setState({ status: "idle" });
        return;
      }

      setState({ status: "loading" });
      searchCatalog({ search: term }).then(
        (data: CatalogEntry[]) => {
          if (revision === searchRevisionRef.current) {
            setState({ status: "success", data });
          }
        },
        () => {
          if (revision === searchRevisionRef.current) {
            setState({ status: "error" });
          }
        },
      );
    },
    [searchCatalog],
  );

  function handleSearchChange(value: string) {
    searchRevisionRef.current += 1;
    setSearch(value);
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchResults(search), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchResults, search]);

  async function handleAdd(movementId: string) {
    setPendingMovementIds((prev) => new Set(prev).add(movementId));
    try {
      await addExclusion({ movementId });
      toast.success("Exercise excluded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not exclude exercise");
    } finally {
      setPendingMovementIds((prev) => {
        const next = new Set(prev);
        next.delete(movementId);
        return next;
      });
    }
  }

  async function handleRemove(movementId: string) {
    setPendingMovementIds((prev) => new Set(prev).add(movementId));
    try {
      await removeExclusion({ movementId });
      toast.success("Exercise restored");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not restore exercise");
    } finally {
      setPendingMovementIds((prev) => {
        const next = new Set(prev);
        next.delete(movementId);
        return next;
      });
    }
  }

  const isLoadingExclusions = exclusions === undefined;
  const searchResults =
    state.status === "success"
      ? state.data.filter((movement) => !excludedIds.has(movement.id)).slice(0, 8)
      : [];
  const emptySearchMessage =
    state.status === "success" && searchResults.length === 0
      ? state.data.length > 0 && state.data.every((movement) => excludedIds.has(movement.id))
        ? "All matching exercises are excluded."
        : "No matching exercises."
      : null;

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search exercises to exclude"
            placeholder="Search exercises"
            value={search}
            onChange={(event) => handleSearchChange(event.target.value)}
            className="pl-10"
          />
        </div>

        <div className="space-y-2">
          {state.status === "loading" ? (
            <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Searching
            </div>
          ) : null}

          {state.status === "error" ? (
            <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2">
              <p className="text-sm text-destructive">Search failed.</p>
              <Button size="sm" variant="outline" onClick={() => fetchResults(search)}>
                Retry
              </Button>
            </div>
          ) : null}

          {searchResults.map((movement) => (
            <div
              key={movement.id}
              className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
            >
              <ExerciseSummary name={movement.name} muscleGroups={movement.muscleGroups} />
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Exclude ${movement.name}`}
                disabled={pendingMovementIds.has(movement.id)}
                onClick={() => handleAdd(movement.id)}
              >
                {pendingMovementIds.has(movement.id) ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
              </Button>
            </div>
          ))}

          {emptySearchMessage ? (
            <p className="py-2 text-sm text-muted-foreground">{emptySearchMessage}</p>
          ) : null}
        </div>

        <div className="border-t pt-4">
          <h3 className="mb-3 text-sm font-medium text-foreground">Excluded</h3>
          {isLoadingExclusions ? (
            <div className="h-8 animate-pulse rounded-md bg-muted" />
          ) : exclusions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No excluded exercises.</p>
          ) : (
            <div className="space-y-2">
              {exclusions.map((exclusion) => (
                <div
                  key={exclusion.movementId}
                  className="flex items-center justify-between gap-3 rounded-md bg-muted/50 px-3 py-2"
                >
                  <ExerciseSummary
                    name={exclusion.movementName}
                    muscleGroups={exclusion.muscleGroups}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Remove ${exclusion.movementName}`}
                    disabled={pendingMovementIds.has(exclusion.movementId)}
                    onClick={() => handleRemove(exclusion.movementId)}
                  >
                    {pendingMovementIds.has(exclusion.movementId) ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <X className="size-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ExerciseSummary({
  name,
  muscleGroups,
}: {
  name: string;
  muscleGroups: readonly string[];
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
        <Dumbbell className="size-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{name}</p>
        {muscleGroups.length > 0 ? (
          <div className="mt-1 flex flex-wrap gap-1">
            {muscleGroups.slice(0, 3).map((group) => (
              <Badge key={group} variant="secondary" className="text-xs">
                {group}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
