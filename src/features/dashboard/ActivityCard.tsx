"use client";

import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ActivityCardProps {
  title: string;
  children: ReactNode;
}

export function ActivityCard({ title, children }: ActivityCardProps) {
  return (
    <Card className="animate-in fade-in duration-300">
      <CardHeader>
        <CardTitle>
          <span className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            {title}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
