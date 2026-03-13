"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Dumbbell } from "lucide-react";
import { cn } from "@/lib/utils";

const CHAT_PROMPT_FIRST_SESSION =
  "Program my first session based on my preferences (goals, days per week, and any injuries I mentioned).";

export function PreferenceFlowDone() {
  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-primary" />
            <CardTitle className="text-lg">You&apos;re all set</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Your preferences are saved. Get your first AI-programmed workout on Tonal by asking the
            coach below.
          </p>
        </CardHeader>
        <CardContent>
          <Link
            href={`/chat?prompt=${encodeURIComponent(CHAT_PROMPT_FIRST_SESSION)}`}
            className={cn(buttonVariants({ size: "lg" }), "inline-flex w-full justify-center")}
          >
            <Dumbbell className="mr-2 size-4" />
            Program your first session
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
