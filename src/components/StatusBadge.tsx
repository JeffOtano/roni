"use client";

import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Trash2 } from "lucide-react";

export function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "draft":
      return (
        <Badge variant="outline" className="text-xs">
          <Clock className="mr-1 size-3" />
          Preview
        </Badge>
      );
    case "pushed":
      return (
        <Badge className="border-primary/30 bg-primary/10 text-xs text-primary shadow-sm shadow-primary/10">
          <CheckCircle2 className="mr-1 size-3" />
          Pushed to Tonal
        </Badge>
      );
    case "completed":
      return (
        <Badge className="border-emerald-500/30 bg-emerald-500/15 text-xs text-emerald-400">
          <CheckCircle2 className="mr-1 size-3" />
          Completed
        </Badge>
      );
    case "deleted":
      return (
        <Badge variant="secondary" className="text-xs text-muted-foreground">
          <Trash2 className="mr-1 size-3" />
          Removed
        </Badge>
      );
    default:
      return null;
  }
}
