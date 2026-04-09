import { describe, expect, it } from "vitest";
import { ALL_SECTIONS, buildInstructions, REFERENCED_TOOLS, SECTION_NAMES } from "./promptSections";
import { coachAgentConfig } from "./coach";

const prompt = buildInstructions();

describe("section completeness", () => {
  it("buildInstructions includes all section headers", () => {
    for (const name of SECTION_NAMES) {
      expect(prompt).toContain(`${name}:`);
    }
  });

  it("buildInstructions produces non-empty output", () => {
    expect(prompt.length).toBeGreaterThan(0);
  });

  it("no duplicate section headers", () => {
    for (const name of SECTION_NAMES) {
      const pattern = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:`, "gm");
      const matches = prompt.match(pattern);
      expect(matches, `"${name}" appears more than once`).toHaveLength(1);
    }
  });

  it("sections are in expected order", () => {
    let lastIndex = -1;
    for (const name of SECTION_NAMES) {
      const index = prompt.indexOf(`${name}:`);
      expect(index, `"${name}" not found or out of order`).toBeGreaterThan(lastIndex);
      lastIndex = index;
    }
  });
});

describe("tool name consistency", () => {
  const registeredTools = Object.keys(coachAgentConfig.tools);

  it("all tool names in prompt match registered tools", () => {
    for (const toolName of REFERENCED_TOOLS) {
      expect(
        registeredTools,
        `prompt references "${toolName}" but it is not a registered tool`,
      ).toContain(toolName);
    }
  });

  it("all registered tools are mentioned in the prompt", () => {
    for (const toolName of registeredTools) {
      expect(prompt, `registered tool "${toolName}" is never mentioned in the prompt`).toContain(
        toolName,
      );
    }
  });
});

describe("schema consistency", () => {
  it("weekPlanPresentation instructs AI not to output JSON", () => {
    const section = prompt.match(/WEEKLY PLAN PRESENTATION:([\s\S]*?)(?=\n[A-Z][A-Z ]+:|$)/);
    expect(section, "WEEKLY PLAN PRESENTATION section not found").toBeTruthy();
    expect(section![1]).toContain("Do NOT output JSON");
    expect(section![1]).not.toContain("```week-plan");
  });
});

describe("structural integrity", () => {
  it("prompt does not exceed 300 lines", () => {
    const lineCount = prompt.split("\n").length;
    expect(lineCount).toBeLessThanOrEqual(300);
  });

  it("each section function returns a non-empty string", () => {
    for (const fn of ALL_SECTIONS) {
      const result = fn();
      expect(result.length, `${fn.name} returned empty string`).toBeGreaterThan(0);
    }
  });

  it("each section starts with its header", () => {
    // Skip role() which has no SECTION_NAMES header
    const sectionsWithHeaders = ALL_SECTIONS.slice(1);
    for (let i = 0; i < sectionsWithHeaders.length; i++) {
      const text = sectionsWithHeaders[i]();
      const expectedHeader = SECTION_NAMES[i];
      expect(
        text.startsWith(`${expectedHeader}:`),
        `${sectionsWithHeaders[i].name}() does not start with "${expectedHeader}:"`,
      ).toBe(true);
    }
  });

  it("no section contains another section's header", () => {
    const sectionsWithHeaders = ALL_SECTIONS.slice(1);
    for (let i = 0; i < sectionsWithHeaders.length; i++) {
      const text = sectionsWithHeaders[i]();
      const ownHeader = SECTION_NAMES[i];
      for (const otherHeader of SECTION_NAMES) {
        if (otherHeader === ownHeader) continue;
        const pattern = new RegExp(`^${otherHeader.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:`, "m");
        expect(
          pattern.test(text),
          `${sectionsWithHeaders[i].name}() contains header "${otherHeader}:"`,
        ).toBe(false);
      }
    }
  });
});
