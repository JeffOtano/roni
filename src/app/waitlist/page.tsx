"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "convex/react";
import { ArrowRight, Check, Mail } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DISCORD_URL } from "../_components/BetaCounter";

export default function WaitlistPage() {
  const joinWaitlist = useMutation(api.waitlist.join);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "already">("idle");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatus("submitting");

    try {
      const result = await joinWaitlist({ email });
      setStatus(result.alreadyOnList ? "already" : "done");
    } catch {
      setError("Something went wrong. Please try again.");
      setStatus("idle");
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <nav className="flex items-center justify-between px-4 py-6 sm:px-8 lg:px-12">
        <Link href="/" className="text-xl font-bold tracking-tight text-foreground">
          tonal.coach
        </Link>
      </nav>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
        <div className="mx-auto max-w-md">
          <div
            className="mb-6 inline-flex size-16 items-center justify-center rounded-2xl"
            style={{ background: "oklch(0.78 0.154 195 / 12%)" }}
          >
            <Mail className="size-8 text-primary" />
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Beta is full
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            All 50 free beta spots have been claimed. Drop your email and we&apos;ll let you know
            the moment a spot opens up.
          </p>

          {status === "done" || status === "already" ? (
            <div className="mt-8 rounded-xl bg-card p-6 ring-1 ring-border">
              <div
                className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full"
                style={{ background: "oklch(0.78 0.154 195 / 15%)" }}
              >
                <Check className="size-5 text-primary" />
              </div>
              <p className="font-medium text-foreground">
                {status === "already" ? "You're already on the list!" : "You're on the waitlist!"}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                We&apos;ll email you when a spot opens up.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 flex gap-3">
              <Input
                type="email"
                required
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 flex-1"
                disabled={status === "submitting"}
              />
              <Button
                type="submit"
                size="lg"
                className="h-12 px-6"
                disabled={status === "submitting"}
              >
                {status === "submitting" ? "Joining..." : "Join Waitlist"}
              </Button>
            </form>
          )}

          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

          <div className="mt-10 rounded-xl bg-card p-6 ring-1 ring-border">
            <p className="text-sm font-medium text-foreground">Want to stay in the loop?</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Join our Discord to chat with beta testers, share feedback, and get early updates.
            </p>
            <a
              href={DISCORD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-foreground"
            >
              Join Discord
              <ArrowRight className="size-4" />
            </a>
          </div>

          <p className="mt-8 text-sm text-muted-foreground">
            <Link href="/" className="underline underline-offset-2 hover:text-foreground">
              &larr; Back to home
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
