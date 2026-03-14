"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function WeekViewSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-1 h-3 w-36" />
      </CardHeader>
      <CardContent>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
          {DAY_LABELS.map((label) => (
            <li key={label} className="rounded-xl border border-white/6 bg-muted/30 p-3.5">
              <div className="mb-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                {label}
              </div>
              <Skeleton className="h-5 w-16" />
              <Skeleton className="mt-2 h-3 w-10" />
              <Skeleton className="mt-2.5 h-5 w-14 rounded-full" />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
