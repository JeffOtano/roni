"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare, Settings } from "lucide-react";
import { buildChatPrompt, TRIGGER_LABELS, TRIGGER_SUBTITLES } from "./check-in-prompts";

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
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Check-ins</h1>
        <Link href="/settings#check-ins">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <Settings className="size-4" />
            Settings
          </Button>
        </Link>
      </div>

      <p className="mb-5 text-sm text-muted-foreground">
        Proactive messages from your coach. You can mute or change how often we check in from{" "}
        <Link
          href="/settings#check-ins"
          className="font-medium text-primary underline underline-offset-2 transition-colors duration-200 hover:text-primary/80"
        >
          Settings
        </Link>
        .
      </p>

      {unreadCount > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="mb-5 transition-all duration-200 hover:border-primary/40"
          onClick={() => markAllRead({})}
        >
          Mark all read ({unreadCount})
        </Button>
      )}

      {list === undefined ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="space-y-2.5">
                  <div className="h-4 w-3/4 animate-pulse rounded-md bg-muted/50" />
                  <div className="h-4 w-1/2 animate-pulse rounded-md bg-muted/50" />
                  <div className="h-3 w-1/4 animate-pulse rounded-md bg-muted/40" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No check-ins yet. When we have something for you, it&apos;ll show up here.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {list.map((checkIn) => {
            const unread = isUnread(checkIn, readAllBeforeAt);
            return (
              <li key={checkIn._id}>
                <Card
                  className={
                    unread
                      ? "border-l-2 border-l-primary shadow-[inset_2px_0_8px_-4px_rgba(0,200,200,0.15)]"
                      : ""
                  }
                >
                  <CardContent className="p-4">
                    {TRIGGER_SUBTITLES[checkIn.trigger] && (
                      <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                        {TRIGGER_SUBTITLES[checkIn.trigger]}
                      </p>
                    )}
                    <p className="text-sm leading-relaxed text-foreground">{checkIn.message}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground">
                      <span>
                        {new Date(checkIn.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      <span className="rounded-md bg-primary/[0.08] px-2 py-0.5 text-xs font-medium text-primary/80 ring-1 ring-primary/10">
                        {TRIGGER_LABELS[checkIn.trigger] ?? checkIn.trigger}
                      </span>
                      <Link href={`/chat?prompt=${encodeURIComponent(buildChatPrompt(checkIn))}`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1 px-2.5 text-xs font-medium text-primary hover:bg-primary/10 hover:text-primary"
                        >
                          <MessageSquare className="size-3" />
                          Ask about this
                        </Button>
                      </Link>
                      {unread && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-auto h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => markRead({ checkInId: checkIn._id })}
                        >
                          Mark read
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {/* Related pages */}
      <div className="mt-8 flex flex-wrap gap-2">
        <Link
          href="/dashboard"
          className="rounded-full bg-muted/50 px-4 py-2 text-xs text-muted-foreground ring-1 ring-border transition-all hover:bg-muted/80 hover:text-foreground"
        >
          Dashboard &rarr;
        </Link>
        <Link
          href="/stats"
          className="rounded-full bg-muted/50 px-4 py-2 text-xs text-muted-foreground ring-1 ring-border transition-all hover:bg-muted/80 hover:text-foreground"
        >
          View stats &rarr;
        </Link>
        <Link
          href="/strength"
          className="rounded-full bg-muted/50 px-4 py-2 text-xs text-muted-foreground ring-1 ring-border transition-all hover:bg-muted/80 hover:text-foreground"
        >
          Strength trends &rarr;
        </Link>
      </div>
    </div>
  );
}
