import { describe, expect, it } from "vitest";
import { classifyIntent } from "./router";

describe("classifyIntent", () => {
  it("classifies workout programming requests", () => {
    expect(classifyIntent("Program my week")).toBe("programming");
    expect(classifyIntent("Can you make me a push day?")).toBe("programming");
    expect(classifyIntent("I want to change Wednesday to a pull day")).toBe("programming");
    expect(classifyIntent("Swap bench press for incline")).toBe("programming");
  });

  it("classifies data and recovery queries", () => {
    expect(classifyIntent("What are my strength scores?")).toBe("data");
    expect(classifyIntent("How's my muscle readiness?")).toBe("data");
    expect(classifyIntent("Show me my workout history")).toBe("data");
    expect(classifyIntent("What did I do in my last session?")).toBe("data");
  });

  it("classifies coaching conversations", () => {
    expect(classifyIntent("I hurt my shoulder")).toBe("coaching");
    expect(classifyIntent("RPE was 9 and I'd rate it 4")).toBe("coaching");
    expect(classifyIntent("Set a goal to bench 100 lbs")).toBe("coaching");
    expect(classifyIntent("Should I take a deload?")).toBe("coaching");
  });

  it("defaults to general for ambiguous messages", () => {
    expect(classifyIntent("Hey")).toBe("general");
    expect(classifyIntent("Thanks")).toBe("general");
    expect(classifyIntent("What do you think?")).toBe("general");
  });

  it("routes data over programming when keywords overlap", () => {
    // "workout history" matches both data and programming — data wins ties
    expect(classifyIntent("program my workout history")).toBe("data");
    expect(classifyIntent("show me last week workout plan")).toBe("data");
    expect(classifyIntent("delete my workout and show stats")).toBe("data");
  });

  it("uses word-boundary matching for short keywords", () => {
    // "pr" should match standalone but not inside "program"
    expect(classifyIntent("pr on deadlift")).toBe("data");
    expect(classifyIntent("program a push day")).toBe("programming");
  });

  it("routes coaching when injury/pain keywords dominate", () => {
    expect(classifyIntent("I have back pain, should I skip my session?")).toBe("coaching");
    expect(classifyIntent("what exercises should I do for my goal?")).toBe("coaching");
  });
});
