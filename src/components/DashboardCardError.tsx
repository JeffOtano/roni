"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorAlert } from "@/components/ErrorAlert";

export function DashboardCardError({ title, onRetry }: { title: string; onRetry: () => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ErrorAlert message="Failed to load data." onRetry={onRetry} />
        <p className="text-xs text-muted-foreground">
          If this keeps happening, try{" "}
          <Link
            href="/connect-tonal"
            className="font-medium text-primary underline underline-offset-2 transition-colors duration-200 hover:text-primary/80"
          >
            reconnecting your Tonal
          </Link>
          .
        </p>
      </CardContent>
    </Card>
  );
}
