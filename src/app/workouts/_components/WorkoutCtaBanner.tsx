"use client";

import Link from "next/link";
import { useAnalytics } from "@/lib/analytics";

export function WorkoutCtaBanner({ slug }: { readonly slug: string }) {
  const { track } = useAnalytics();

  return (
    <div className="my-8 rounded-xl border border-blue-500/20 bg-gradient-to-br from-blue-950/50 to-background p-8 text-center">
      <h3 className="mb-3 text-xl font-semibold">Want this personalized for you?</h3>
      <p className="mx-auto mb-6 max-w-lg text-sm leading-relaxed text-muted-foreground">
        This is a template workout. Connect your Tonal and the AI coach adjusts weights to your
        strength scores, swaps exercises around injuries, and progresses you week over week.
      </p>
      <Link
        href="/login"
        className="inline-block rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground hover:bg-primary/90"
        onClick={() => track("workout_cta_clicked", { slug })}
      >
        Start Free with AI Coach
      </Link>
    </div>
  );
}
