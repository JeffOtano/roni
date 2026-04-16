"use client";

import { Suspense, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ApiExplorer } from "@/features/dev-tools/ApiExplorer";
import { CacheInspector } from "@/features/dev-tools/CacheInspector";
import { TokenHealth } from "@/features/dev-tools/TokenHealth";
import { WorkoutPushDebugger } from "@/features/dev-tools/WorkoutPushDebugger";
import { AgentToolTrace } from "@/features/dev-tools/AgentToolTrace";

const TABS = [
  { id: "api-explorer", label: "API Explorer" },
  { id: "cache", label: "Cache Inspector" },
  { id: "token", label: "Token Health" },
  { id: "push", label: "Push Debugger" },
  { id: "agent", label: "Agent Trace" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function PanelContent({ tab }: { tab: TabId }) {
  switch (tab) {
    case "api-explorer":
      return <ApiExplorer />;
    case "cache":
      return <CacheInspector />;
    case "token":
      return <TokenHealth />;
    case "push":
      return <WorkoutPushDebugger />;
    case "agent":
      return <AgentToolTrace />;
  }
}

export default function DevToolsPage() {
  return (
    <Suspense>
      <DevToolsPageInner />
    </Suspense>
  );
}

function DevToolsPageInner() {
  const [activeTab, setActiveTab] = useState<TabId>("api-explorer");

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <h1 className="text-xl font-semibold">Dev Tools</h1>

      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {TABS.map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveTab(tab.id)}
            className="text-xs"
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-4">
          <Suspense
            fallback={
              <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>
            }
          >
            <PanelContent tab={activeTab} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
