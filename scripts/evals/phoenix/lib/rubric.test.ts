import { describe, expect, it } from "vitest";
import type { Rubric } from "../../../../convex/ai/evalScenarios";
import { checkBannedPhrases, checkRubric, normalizeEvalText } from "./rubric";

describe("rubric helpers", () => {
  it("normalizes response text by removing thinking sections and appending tool names", () => {
    const text = normalizeEvalText(
      "**Thinking Process:** hidden chain\nReady to help",
      "search_exercises",
    );

    expect(text).toBe("Ready to help\nsearch_exercises");
  });

  it("returns actionable notes for missing, forbidden, pattern, and length failures", () => {
    const rubric: Rubric = {
      mustContain: ["bench"],
      mustNotContain: ["disclaimer"],
      patterns: [/strength/i],
      maxLength: 20,
    };

    expect(checkRubric("disclaimer text that is much too long", rubric)).toEqual([
      'missing term: "bench"',
      'forbidden term present: "disclaimer"',
      "pattern missing: /strength/i",
      "response too long: 37 > 20",
    ]);
  });

  it("checks banned phrases independently from scenario rubrics", () => {
    expect(checkBannedPhrases("As an AI language model, I cannot provide that")).toEqual([
      'banned phrase present: "as an ai language model"',
      'banned phrase present: "i cannot provide"',
    ]);
  });
});
