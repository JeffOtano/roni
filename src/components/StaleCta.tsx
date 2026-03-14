"use client";

import { useState } from "react";
import Link from "next/link";

interface FrequencyEntry {
  targetArea: string;
  count: number;
  lastTrainedDate?: string;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function StaleCta({ data }: { data: FrequencyEntry[] }) {
  const [now] = useState(() => Date.now());
  const stale = data.find(
    (d) => d.lastTrainedDate && new Date(d.lastTrainedDate).getTime() < now - SEVEN_DAYS_MS,
  );
  if (!stale) return null;
  const days = Math.round(
    (now - new Date(stale.lastTrainedDate!).getTime()) / (1000 * 60 * 60 * 24),
  );
  const prompt = encodeURIComponent(
    `I haven't trained ${stale.targetArea.toLowerCase()} in ${days} days. Can you suggest a workout?`,
  );
  return (
    <Link
      href={`/chat?prompt=${prompt}`}
      className="mt-4 flex items-center gap-2 rounded-lg bg-primary/5 px-3 py-2 text-xs font-medium text-primary ring-1 ring-primary/10 transition-all hover:bg-primary/10 hover:ring-primary/20"
    >
      You haven&apos;t hit {stale.targetArea.toLowerCase()} in {days} days — ask coach &rarr;
    </Link>
  );
}
