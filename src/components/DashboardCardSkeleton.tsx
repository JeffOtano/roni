"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";

function ShimmerBar({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-primary/6 ${className ?? ""}`} />;
}

export function DashboardCardSkeleton({ tall }: { tall?: boolean }) {
  return (
    <Card className={tall ? "min-h-[300px]" : "min-h-[200px]"} role="status" aria-label="Loading">
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
