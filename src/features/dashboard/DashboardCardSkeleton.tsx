"use client";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

function ShimmerBar({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-primary/6", className)} />;
}

export function DashboardCardSkeleton({
  tall,
  wide,
}: {
  tall?: boolean;
  /** Span both columns on the 2-col dashboard grid. */
  wide?: boolean;
}) {
  return (
    <Card
      className={cn(tall ? "min-h-[300px]" : "min-h-[200px]", wide && "sm:col-span-2")}
      role="status"
      aria-label="Loading"
    >
      <CardHeader>
        <ShimmerBar className="h-4 w-32" />
      </CardHeader>
      <CardContent className="space-y-3">
        <ShimmerBar className="h-3 w-full" />
        <ShimmerBar className="h-3 w-3/4" />
        <ShimmerBar className="h-3 w-1/2" />
        {tall && (
          <>
            <ShimmerBar className="h-3 w-5/6" />
            <ShimmerBar className="h-3 w-2/3" />
          </>
        )}
      </CardContent>
    </Card>
  );
}
