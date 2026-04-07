"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  CalendarDays,
  LayoutDashboard,
  Loader2,
  MessageSquare,
  Moon,
  Settings,
  Sun,
  TrendingUp,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBanner } from "@/components/StatusBanner";
import { OpenSourceBanner } from "@/components/OpenSourceBanner";
import { CheckInBell } from "@/components/CheckInBell";
import { Button } from "@/components/ui/button";
import { ReconnectModal } from "@/components/ReconnectModal";
import { useTheme } from "@/components/ThemeProvider";

const navLinks: Array<{
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}> = [
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/progress", label: "Progress", icon: TrendingUp },
  { href: "/settings", label: "Settings", icon: Settings },
];

function mobileIsActive(pathname: string, href: string, exact?: boolean) {
  if (href === "/dashboard") return pathname.startsWith("/dashboard");
  return exact ? pathname === href : pathname.startsWith(href);
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="text-muted-foreground transition-colors duration-200 hover:text-foreground"
    >
      {isDark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
    </Button>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const me = useQuery(api.users.getMe, isAuthenticated ? {} : "skip");

  // Dismissed resets when token status changes (successful reconnect or new expiry).
  // The key ensures a fresh dismissed=false whenever tokenExpired flips.
  const tokenExpiredKey = me?.tonalTokenExpired ? "expired" : "valid";
  const [dismissState, setDismissState] = useState({ key: tokenExpiredKey, dismissed: false });
  if (dismissState.key !== tokenExpiredKey) {
    setDismissState({ key: tokenExpiredKey, dismissed: false });
  }
  const reconnectDismissed = dismissState.dismissed;
  const setReconnectDismissed = (v: boolean) =>
    setDismissState({ key: tokenExpiredKey, dismissed: v });

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

  if (me && (!me.hasTonalProfile || !me.onboardingCompleted)) {
    router.replace("/onboarding");
    return null;
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <div className="flex min-h-0 flex-1">
        {/* Desktop sidebar -- darker than main content */}
        <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-sidebar lg:flex">
          <div className="px-5 py-5">
            <span className="text-base font-bold tracking-tight text-foreground drop-shadow-[0_0_12px_var(--primary)]">
              tonal.coach
            </span>
          </div>

          <nav className="flex flex-col gap-1.5 px-3">
            {navLinks.map(({ href, label, icon: Icon, exact }) => {
              const isActive = exact ? pathname === href : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-all duration-200 hover:bg-muted/50 hover:text-foreground",
                    isActive && "bg-gradient-to-r from-primary/10 to-transparent text-foreground",
                  )}
                >
                  {/* Active left border glow */}
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />
                  )}
                  <Icon className="size-[18px]" />
                  <span className="font-medium">{label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Sidebar footer */}
          <div className="mt-auto">
            <div className="mx-4 border-t border-border" />
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-semibold text-primary ring-1 ring-primary/30">
                  {me?.tonalName?.charAt(0)?.toUpperCase() ?? <User className="size-3" />}
                </span>
                {me?.tonalName && (
                  <p className="truncate text-xs font-medium text-muted-foreground">
                    {me.tonalName}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <ThemeToggle />
                <CheckInBell />
              </div>
            </div>
          </div>
        </aside>

        {/* Main area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Mobile header -- frosted glass */}
          <header className="flex shrink-0 items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur-xl lg:hidden">
            <span className="text-base font-bold tracking-tight text-foreground">tonal.coach</span>
            <CheckInBell />
          </header>

          <OpenSourceBanner />
          <StatusBanner />

          {/* Content — min-h-0 constrains flex height so child scroll containers work */}
          <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-20 lg:pb-0">
            {children}
          </main>

          {/* Mobile bottom tabs -- frosted glass */}
          <nav
            className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-border bg-background/80 py-2 backdrop-blur-xl lg:hidden"
            style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
          >
            {navLinks.map(({ href, label, icon: Icon, exact }) => {
              const isActive = mobileIsActive(pathname, href, exact);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex min-w-0 flex-col items-center gap-1 px-2 py-1 text-muted-foreground transition-all duration-200",
                    isActive && "text-primary",
                  )}
                >
                  <Icon className="size-[18px] shrink-0" />
                  <span className="truncate text-[10px] font-medium">{label}</span>
                  {/* Active dot indicator */}
                  {isActive && (
                    <span className="h-1 w-1 rounded-full bg-primary shadow-[0_0_6px_var(--primary)]" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      <ReconnectModal
        open={me?.tonalTokenExpired === true && !!me?.tonalEmail && !reconnectDismissed}
        tonalEmail={me?.tonalEmail ?? ""}
        onDismiss={() => setReconnectDismissed(true)}
      />
    </div>
  );
}
