"use client";

import { use } from "react";
import { ChatThread } from "@/components/ChatThread";

export default function ThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = use(params);

  return <ChatThread threadId={threadId} />;
}
