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
      className="relative flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:text-foreground"
      aria-label={`${count} unread check-in${count === 1 ? "" : "s"}`}
    >
      <Bell className="size-5" />
      <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
        {count > 9 ? "9+" : count}
      </span>
    </Link>
  );
}
