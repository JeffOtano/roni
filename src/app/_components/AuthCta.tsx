"use client";

import Link from "next/link";
import { useConvexAuth } from "convex/react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AuthCta({ variant }: { variant: "hero" | "bottom" | "nav" }) {
  const { isAuthenticated, isLoading } = useConvexAuth();

  const href = isAuthenticated ? "/chat" : "/login";

  if (variant === "nav") {
    return (
      <Link
        href={href}
        className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors duration-300 hover:text-foreground"
      >
        {isAuthenticated ? "Go to Chat" : "Sign In"}
      </Link>
    );
  }

  const label = isAuthenticated ? "Go to Chat" : "Get Started";

  if (variant === "hero") {
    return (
      <Button
        size="lg"
        className="h-12 px-8 text-base shadow-lg shadow-primary/25 transition-all duration-300 hover:shadow-xl hover:shadow-primary/40"
        nativeButton={false}
        render={<Link href={href} />}
        disabled={isLoading}
      >
        {isLoading ? "Loading..." : label}
        <ArrowRight className="ml-2 size-5" data-icon="inline-end" />
      </Button>
    );
  }

  // variant === "bottom"
  return (
    <div
      className="inline-block rounded-xl p-[1px]"
      style={{
        background: "linear-gradient(135deg, oklch(0.78 0.154 195), oklch(0.6 0.22 300))",
      }}
    >
      <Button
        size="lg"
        variant="ghost"
        className="h-12 rounded-[11px] bg-card px-8 text-base font-semibold text-foreground transition-all duration-300 hover:bg-card/80"
        nativeButton={false}
        render={<Link href={href} />}
        disabled={isLoading}
      >
        {isLoading ? "Loading..." : label}
        <ArrowRight className="ml-2 size-5" data-icon="inline-end" />
      </Button>
    </div>
  );
}
