"use client";

import { Card, CardContent } from "@/components/ui/card";

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

interface Photo {
  readonly id: string;
  readonly createdAt: number;
}

interface ProgressComparisonProps {
  readonly earliest: Photo;
  readonly latest: Photo;
  readonly earliestThumb: string;
  readonly latestThumb: string;
}

export function ProgressComparison({
  earliest,
  latest,
  earliestThumb,
  latestThumb,
}: ProgressComparisonProps) {
  const daysBetween = Math.round((latest.createdAt - earliest.createdAt) / (1000 * 60 * 60 * 24));

  return (
    <Card className="relative mb-6 overflow-hidden">
      {/* Subtle gradient backdrop */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-transparent to-primary/[0.02]" />
      <CardContent className="relative p-4">
        <p className="mb-4 text-xs font-semibold tracking-widest text-primary uppercase">
          Your journey
        </p>
        <div className="flex items-center gap-3 sm:gap-5">
          <div className="flex-1 text-center">
            <div className="mx-auto size-32 overflow-hidden rounded-xl ring-1 ring-white/[0.1] sm:size-40">
              {/* eslint-disable-next-line @next/next/no-img-element -- base64 data URL */}
              <img
                src={`data:image/jpeg;base64,${earliestThumb}`}
                alt=""
                className="size-full object-cover"
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{formatDate(earliest.createdAt)}</p>
          </div>
          {/* Days-between indicator */}
          <div className="flex flex-col items-center gap-1.5">
            <div className="h-8 w-px bg-gradient-to-b from-transparent via-primary/50 to-transparent" />
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary ring-1 ring-primary/20">
              {daysBetween}d
            </span>
            <div className="h-8 w-px bg-gradient-to-b from-transparent via-primary/50 to-transparent" />
          </div>
          <div className="flex-1 text-center">
            <div className="mx-auto size-32 overflow-hidden rounded-xl ring-1 ring-white/[0.1] sm:size-40">
              {/* eslint-disable-next-line @next/next/no-img-element -- base64 data URL */}
              <img
                src={`data:image/jpeg;base64,${latestThumb}`}
                alt=""
                className="size-full object-cover"
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{formatDate(latest.createdAt)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
