"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Search, ShieldAlert, UserCheck } from "lucide-react";

export function ImpersonateUserPicker() {
  const status = useQuery(api.admin.getImpersonationStatus);
  // null return means non-admin or unauthenticated -- skip the users query
  const users = useQuery(api.admin.listUsers, status !== null ? {} : "skip");
  const startImpersonating = useMutation(api.admin.startImpersonating);
  const [search, setSearch] = useState("");
  const [startingId, setStartingId] = useState<string | null>(null);

  // null = not admin or not authenticated
  if (!status) {
    return null;
  }

  async function handleSelect(targetUserId: Id<"users">) {
    setStartingId(targetUserId);
    try {
      await startImpersonating({ targetUserId });
    } finally {
      setStartingId(null);
    }
  }

  const currentTargetId = status.impersonatingUser?._id ?? null;

  return (
    <section className="mb-10">
      <h2 className="mb-3 border-l-2 border-primary/40 pl-3 text-sm font-semibold text-muted-foreground">
        Admin
      </h2>
      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
            <ShieldAlert className="size-4 text-amber-400" />
            Impersonate User
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            View the app as another user. All queries will return their data.
          </p>

          {/* Search input */}
          <div className="relative mb-3">
            <Label htmlFor="impersonate-search" className="sr-only">
              Search users
            </Label>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="impersonate-search"
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* User list */}
          <UserList
            users={users}
            search={search}
            startingId={startingId}
            currentTargetId={currentTargetId}
            onSelect={handleSelect}
          />
        </CardContent>
      </Card>
    </section>
  );
}

function UserList({
  users,
  search,
  startingId,
  currentTargetId,
  onSelect,
}: {
  readonly users:
    | readonly {
        _id: Id<"users">;
        name: string | undefined;
        email: string | undefined;
      }[]
    | undefined;
  readonly search: string;
  readonly startingId: string | null;
  readonly currentTargetId: string | null;
  readonly onSelect: (id: Id<"users">) => void;
}) {
  const filtered = useMemo(() => {
    if (!users) return [];
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q),
    );
  }, [users, search]);

  if (users === undefined) {
    return (
      <div className="flex items-center justify-center py-6 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <p className="py-4 text-center text-xs text-muted-foreground">
        {search.trim() ? "No users match your search." : "No users found."}
      </p>
    );
  }

  return (
    <ul
      className="max-h-60 overflow-y-auto rounded-lg border border-border"
      role="listbox"
      aria-label="Users"
    >
      {filtered.map((user) => {
        const isActive = user._id === currentTargetId;
        const isLoading = user._id === startingId;

        return (
          <li key={user._id} role="option" aria-selected={isActive}>
            <button
              type="button"
              onClick={() => onSelect(user._id)}
              disabled={isLoading || isActive}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors duration-150 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50 disabled:opacity-60"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{user.name ?? "Unnamed"}</p>
                {user.email && (
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                )}
              </div>
              {isLoading && (
                <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
              )}
              {isActive && <UserCheck className="size-3.5 shrink-0 text-amber-400" />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
