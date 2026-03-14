"use client";

import Link from "next/link";
import { ArrowRight, Check, Dumbbell, LayoutDashboard, MessageSquare } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const CHAT_PROMPT_FIRST_SESSION =
  "Program my first session based on my preferences (goals, days per week, and any injuries I mentioned).";

export function ReadyStep({ firstName }: { readonly firstName: string | undefined }) {
  const displayName = firstName ?? "there";

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-primary/10">
            <Dumbbell className="size-6 text-primary" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">
            You&apos;re all set, {displayName}!
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your coach is ready. Here&apos;s what you can do:
          </p>
        </div>

        <ul className="mb-6 space-y-3 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" />
            Get AI-programmed workouts tailored to your goals
          </li>
          <li className="flex items-start gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" />
            Track strength trends and muscle readiness
          </li>
          <li className="flex items-start gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" />
            Ask anything about your training data
          </li>
        </ul>

        <div className="flex flex-col gap-3">
          <Link
            href={`/chat?prompt=${encodeURIComponent(CHAT_PROMPT_FIRST_SESSION)}`}
            className={cn(buttonVariants({ size: "lg" }), "w-full justify-center")}
          >
            <MessageSquare className="size-4" />
            Start chatting
            <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/dashboard"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "w-full justify-center",
            )}
          >
            <LayoutDashboard className="size-4" />
            Explore dashboard
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
