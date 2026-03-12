"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  LayoutDashboard,
  MessageSquare,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBanner } from "@/components/StatusBanner";

const navLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const me = useQuery(api.users.getMe, isAuthenticated ? {} : "skip");

  // Auth loading or fetching user profile
  if (authLoading || (isAuthenticated && me === undefined)) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Not authenticated -> login
  if (!isAuthenticated) {
    router.replace("/login");
    return null;
  }

  // Authenticated but no Tonal profile -> connect
  if (me && !me.hasTonalProfile) {
    router.replace("/connect-tonal");
    return null;
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <StatusBanner />
      {/* Desktop header */}
      <header className="hidden shrink-0 items-center justify-between border-b border-border px-4 py-2 sm:flex">
        <span className="text-sm font-semibold text-foreground">
          tonal.coach
        </span>
        <nav className="flex items-center gap-1">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Button
              key={href}
              variant="ghost"
              size="sm"
              className={cn(
                pathname === href &&
                  "bg-muted text-foreground",
              )}
              render={<Link href={href} />}
            >
              <Icon className="size-3.5" />
              <span>{label}</span>
            </Button>
          ))}
        </nav>
      </header>

      {/* Mobile header */}
      <header className="flex shrink-0 items-center border-b border-border px-4 py-2 sm:hidden">
        <span className="text-sm font-semibold text-foreground">
          tonal.coach
        </span>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-auto pb-16 sm:pb-0">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-border bg-background py-2 sm:hidden">
        {navLinks.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-col items-center gap-0.5 px-3 py-1 text-muted-foreground transition-colors",
              pathname === href && "text-foreground",
            )}
          >
            <Icon className="size-5" />
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
