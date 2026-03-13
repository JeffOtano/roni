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
      className="mt-3 block text-xs text-primary hover:underline"
    >
      You haven&apos;t hit {stale.targetArea.toLowerCase()} in {days} days — ask coach &rarr;
    </Link>
  );
}
