"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { ThreadSidebar } from "@/components/ThreadSidebar";
import { Button } from "@/components/ui/button";
import { Menu, Loader2 } from "lucide-react";
import { StatusBanner } from "@/components/StatusBanner";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const params = useParams();
  const router = useRouter();
  const activeThreadId = params?.threadId as string | undefined;

  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const me = useQuery(
    api.users.getMe,
    isAuthenticated ? {} : "skip",
  );

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
      <div className="flex flex-1 overflow-hidden">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-200 ease-in-out lg:relative lg:z-auto lg:translate-x-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <ThreadSidebar
          activeThreadId={activeThreadId}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile header */}
        <div className="flex items-center border-b border-border px-4 py-2 lg:hidden">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <Menu className="size-4" />
          </Button>
          <span className="ml-2 text-sm font-semibold">tonal.coach</span>
        </div>

        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
      </div>
    </div>
  );
}
