"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Settings } from "lucide-react";

function isUnread(
  c: { readAt?: number; createdAt: number },
  readAllBeforeAt: number | undefined,
): boolean {
  return c.readAt === undefined && c.createdAt > (readAllBeforeAt ?? 0);
}

export default function CheckInsPage() {
  const list = useQuery(api.checkIns.list, {});
  const prefs = useQuery(api.checkIns.getPreferences, {});
  const markAllRead = useMutation(api.checkIns.markAllRead);
  const markRead = useMutation(api.checkIns.markRead);

  const readAllBeforeAt = prefs?.readAllBeforeAt;
  const unreadCount = list?.filter((c) => isUnread(c, readAllBeforeAt)).length ?? 0;

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Check-ins</h1>
        <Link href="/settings#check-ins">
          <Button variant="ghost" size="sm">
            <Settings className="mr-1.5 size-4" />
            Adjust in Settings
          </Button>
        </Link>
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        Proactive messages from your coach. You can mute or change how often we check in from{" "}
        <Link
          href="/settings#check-ins"
          className="font-medium text-primary underline underline-offset-2"
        >
          Settings
        </Link>
        .
      </p>

      {unreadCount > 0 && (
        <Button variant="outline" size="sm" className="mb-4" onClick={() => markAllRead({})}>
          Mark all read
        </Button>
      )}

      {list === undefined ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No check-ins yet. When we have something for you, it’ll show up here.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {list.map((checkIn) => (
            <li key={checkIn._id}>
              <Card className={isUnread(checkIn, readAllBeforeAt) ? "border-primary/30" : ""}>
                <CardContent className="p-4">
                  <p className="text-sm text-foreground">{checkIn.message}</p>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {new Date(checkIn.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    {isUnread(checkIn, readAllBeforeAt) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => markRead({ checkInId: checkIn._id })}
                      >
                        Mark read
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
