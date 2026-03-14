"use client";

import { ArrowRight } from "lucide-react";
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
    <Card className="mb-6">
      <CardContent className="p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Your journey
        </p>
        <div className="flex items-center gap-4">
          <div className="flex-1 text-center">
            <div className="mx-auto size-28 overflow-hidden rounded-lg bg-muted sm:size-36">
              {/* eslint-disable-next-line @next/next/no-img-element -- base64 data URL */}
              <img
                src={`data:image/jpeg;base64,${earliestThumb}`}
                alt=""
                className="size-full object-cover"
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{formatDate(earliest.createdAt)}</p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <ArrowRight className="size-5 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">{daysBetween}d</span>
          </div>
          <div className="flex-1 text-center">
            <div className="mx-auto size-28 overflow-hidden rounded-lg bg-muted sm:size-36">
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
