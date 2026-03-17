/**
 * Procedural memory: extract and store coaching observations from conversations.
 * Runs as background process after conversations end, not during real-time chat.
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";

// ---------------------------------------------------------------------------
// Signal extraction (pure, testable)
// ---------------------------------------------------------------------------

interface Message {
  role: string;
  content: string;
}

interface CoachingSignal {
  content: string;
  category: "preference" | "avoidance" | "response_style" | "pattern" | "insight";
}

const AVOIDANCE_PATTERNS = [
  /(?:don'?t like|hate|avoid|skip|no more)\s+(.+?)(?:\.|$)/i,
  /(?:not a fan of|can't stand)\s+(.+?)(?:\.|$)/i,
];

const STYLE_PATTERNS = [
  /(?:just (?:give|show) me (?:the )?(?:numbers|data|stats))/i,
  /(?:don'?t need (?:the )?(?:motivation|encouragement|pep talk))/i,
  /(?:more detail|explain more|break it down)/i,
];

export function extractCoachingSignals(messages: Message[]): CoachingSignal[] {
  const signals: CoachingSignal[] = [];

  for (const msg of messages) {
    if (msg.role !== "user") continue;
    const text = msg.content;

    for (const pattern of AVOIDANCE_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        signals.push({
          category: "avoidance",
          content: `User dislikes/avoids: ${match[1].trim()}`,
        });
      }
    }

    for (const pattern of STYLE_PATTERNS) {
      if (pattern.test(text)) {
        signals.push({
          category: "response_style",
          content:
            text.includes("number") || text.includes("data") || text.includes("stats")
              ? "User prefers data-driven feedback over motivational language"
              : text.includes("detail") || text.includes("explain")
                ? "User prefers detailed explanations"
                : "User has specific communication preferences",
        });
        break;
      }
    }
  }

  return signals;
}

// ---------------------------------------------------------------------------
// Convex mutations/queries
// ---------------------------------------------------------------------------

export const saveNote = internalMutation({
  args: {
    userId: v.id("users"),
    content: v.string(),
    category: v.union(
      v.literal("preference"),
      v.literal("avoidance"),
      v.literal("response_style"),
      v.literal("pattern"),
      v.literal("insight"),
    ),
    confidence: v.union(v.literal("observed"), v.literal("confirmed")),
    sourceThreadId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("coachingNotes")
      .withIndex("by_userId_category", (q) =>
        q.eq("userId", args.userId).eq("category", args.category),
      )
      .collect();

    const isDuplicate = existing.some(
      (note) => note.content.toLowerCase() === args.content.toLowerCase(),
    );
    if (isDuplicate) return null;

    return await ctx.db.insert("coachingNotes", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const getNotesForUser = internalQuery({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { userId, limit }) => {
    const notes = await ctx.db
      .query("coachingNotes")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    notes.sort((a, b) => {
      const aRef = a.lastReferencedAt ?? a.createdAt;
      const bRef = b.lastReferencedAt ?? b.createdAt;
      return bRef - aRef;
    });

    return limit ? notes.slice(0, limit) : notes;
  },
});
