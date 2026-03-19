"use client";

import Link from "next/link";
import { useConvexAuth } from "convex/react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DISCORD_URL, useBetaFull } from "./BetaCounter";

/**
 * Auth-aware CTA button. Shows "Get Started" / "Sign In" for guests,
 * "Go to Chat" for authenticated users, or "Join Discord" when beta is full.
 *
 * Kept as a thin client island so the landing page can be a server component.
 */
export function AuthCta({ variant }: { variant: "hero" | "bottom" | "nav" }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const betaFull = useBetaFull();

  const showDiscord = !isAuthenticated && betaFull === true;
  const href = isAuthenticated ? "/chat" : showDiscord ? DISCORD_URL : "/login";
  const isExternal = showDiscord;

  if (variant === "nav") {
    return isExternal ? (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors duration-300 hover:text-foreground"
      >
        Join Discord
      </a>
    ) : (
      <Link
        href={href}
        className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors duration-300 hover:text-foreground"
      >
        {isAuthenticated ? "Go to Chat" : "Sign In"}
      </Link>
    );
  }

  const label = isAuthenticated
    ? "Go to Chat"
    : showDiscord
      ? "Join Discord for Waitlist"
      : "Get Started";
  const linkProps = isExternal
    ? { href, target: "_blank" as const, rel: "noopener noreferrer" }
    : { href };
  const renderEl = isExternal ? <a {...linkProps} /> : <Link href={href} />;

  if (variant === "hero") {
    return (
      <Button
        size="lg"
        className="h-12 px-8 text-base shadow-lg shadow-primary/25 transition-all duration-300 hover:shadow-xl hover:shadow-primary/40"
        nativeButton={false}
        render={renderEl}
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
        render={renderEl}
        disabled={isLoading}
      >
        {isLoading ? "Loading..." : label}
        <ArrowRight className="ml-2 size-5" data-icon="inline-end" />
      </Button>
    </div>
  );
}
