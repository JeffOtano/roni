"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MessageSquarePlus, X } from "lucide-react";

interface ThreadSidebarProps {
  activeThreadId?: string;
  onClose?: () => void;
}

export function ThreadSidebar({ activeThreadId, onClose }: ThreadSidebarProps) {
  const router = useRouter();

  const handleNewChat = () => {
    router.push("/chat");
    onClose?.();
  };

  return (
    <div className="flex h-full flex-col border-r border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Chats</h2>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleNewChat}
            aria-label="New chat"
          >
            <MessageSquarePlus className="size-4" />
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              className="lg:hidden"
              aria-label="Close sidebar"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {activeThreadId && (
          <div
            className={cn(
              "rounded-lg px-3 py-2 text-sm",
              "bg-accent text-accent-foreground"
            )}
          >
            Current conversation
          </div>
        )}

        {!activeThreadId && (
          <p className="px-3 py-2 text-xs text-muted-foreground">
            Start a new conversation to begin.
          </p>
        )}
      </div>
    </div>
  );
}
