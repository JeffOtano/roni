"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Bell } from "lucide-react";

/**
 * Bell icon with unread check-in count. Links to check-ins page.
 * User can mute or adjust frequency in Settings.
 */
export function CheckInBell() {
  const unread = useQuery(api.checkIns.listUnread, {});

  if (unread === undefined) return null;
  const count = unread.length;
  if (count === 0) return null;

  return (
    <Link
      href="/check-ins"
      className="group/bell relative flex items-center justify-center rounded-lg p-2 text-muted-foreground transition-all duration-200 hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`${count} unread check-in${count === 1 ? "" : "s"}`}
    >
      <Bell className="size-5 transition-transform duration-200 group-hover/bell:scale-110" />
      <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80 px-1 text-[10px] font-semibold text-primary-foreground shadow-[0_0_8px_rgba(0,200,200,0.3)]">
        <span className="motion-safe:animate-pulse">{count > 9 ? "9+" : count}</span>
      </span>
    </Link>
  );
}
