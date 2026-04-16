"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronRight, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

interface JsonViewerProps {
  data: unknown;
  label?: string;
  defaultExpanded?: boolean;
}

export function JsonViewer({ data, label, defaultExpanded = false }: JsonViewerProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);

  const jsonStr = JSON.stringify(data, null, 2);
  const preview = JSON.stringify(data)?.slice(0, 80);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(jsonStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-md border border-border bg-muted/30">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-mono hover:bg-muted/50"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0" />
        )}
        {label && <span className="font-sans font-medium text-muted-foreground">{label}</span>}
        {!expanded && <span className="truncate text-xs text-muted-foreground">{preview}</span>}
      </button>
      {expanded && (
        <div className="relative border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="absolute right-2 top-2 h-7 w-7 p-0"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </Button>
          <pre className="overflow-auto p-3 text-xs leading-relaxed">{jsonStr}</pre>
        </div>
      )}
    </div>
  );
}
