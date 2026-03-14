"use client";

import type { UIMessage } from "@convex-dev/agent/react";
import { ChatMessage } from "./ChatMessage";
import { DateDivider } from "./DateDivider";

function isDifferentDay(a: number, b: number | null): boolean {
  if (!b) return true;
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getDate() !== db.getDate() ||
    da.getMonth() !== db.getMonth() ||
    da.getFullYear() !== db.getFullYear()
  );
}

export function MessageList({
  messages,
  userInitial,
}: {
  messages: UIMessage[];
  userInitial?: string;
}) {
  return (
    <>
      {messages.map((message, i) => {
        const prev = i > 0 ? messages[i - 1] : null;
        const showDateDivider = isDifferentDay(message._creationTime, prev?._creationTime ?? null);
        // Group consecutive messages from the same role (unless separated by a date)
        const isGrouped = !showDateDivider && prev?.role === message.role;

        return (
          <div key={message.key}>
            {showDateDivider && <DateDivider timestamp={message._creationTime} />}
            <ChatMessage message={message} userInitial={userInitial} isGrouped={isGrouped} />
          </div>
        );
      })}
    </>
  );
}
