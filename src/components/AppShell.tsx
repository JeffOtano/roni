"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  Bell,
  CalendarDays,
  ImageIcon,
  LayoutDashboard,
  Loader2,
  MessageSquare,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBanner } from "@/components/StatusBanner";
import { CheckInBell } from "@/components/CheckInBell";

const navLinks: Array<{
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}> = [
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/week", label: "Week", icon: CalendarDays },
  { href: "/progress", label: "Progress", icon: ImageIcon },
  { href: "/check-ins", label: "Check-ins", icon: Bell },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const me = useQuery(api.users.getMe, isAuthenticated ? {} : "skip");

  if (authLoading || (isAuthenticated && me === undefined)) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    router.replace("/login");
    return null;
  }

  if (me && !me.hasTonalProfile) {
    router.replace("/connect-tonal");
    return null;
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border lg:flex">
        <div className="p-4">
          <span className="text-sm font-bold text-foreground">tonal.coach</span>
        </div>
        <nav className="flex flex-col gap-1 px-2">
          {navLinks.map(({ href, label, icon: Icon, exact }) => {
            const isActive = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground",
                  isActive && "bg-primary/10 text-primary",
                )}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mx-4 my-2 border-t border-border" />
        <div className="mt-auto flex items-center justify-between p-4">
          {me?.tonalName && (
            <p className="truncate text-xs text-muted-foreground">{me.tonalName}</p>
          )}
          <CheckInBell />
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3 lg:hidden">
          <span className="text-sm font-bold text-foreground">tonal.coach</span>
          <CheckInBell />
        </header>

        <StatusBanner />

        {/* Content */}
        <main className="flex-1 overflow-auto pb-16 lg:pb-0">{children}</main>

        {/* Mobile bottom tabs */}
        <nav
          className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-border bg-background py-2 lg:hidden"
          style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
        >
          {navLinks.map(({ href, label, icon: Icon, exact }) => {
            const isActive = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex min-w-0 flex-col items-center gap-0.5 px-2 py-1 text-muted-foreground transition-colors",
                  isActive && "text-primary",
                )}
              >
                <Icon className="size-5 shrink-0" />
                <span className="truncate text-[10px] font-medium">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
