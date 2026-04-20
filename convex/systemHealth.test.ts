/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");
const SUCCESS_NOW = 1_700_000_000_000;

describe("systemHealth.recordSuccess", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(SUCCESS_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("inserts the first row when service has never been recorded", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.systemHealth.recordSuccess, { service: "tonal" });

    const row = await t.run((ctx) =>
      ctx.db
        .query("systemHealth")
        .withIndex("by_service", (q) => q.eq("service", "tonal"))
        .unique(),
    );

    expect(row).not.toBeNull();
    expect(row?.circuitOpen).toBe(false);
    expect(row?.consecutiveFailures).toBe(0);
    expect(row?.lastSuccessAt).toBe(SUCCESS_NOW);
  });

  test("skips the write when the circuit is closed (steady state)", async () => {
    const t = convexTest(schema, modules);
    const initialId = await t.run((ctx) =>
      ctx.db.insert("systemHealth", {
        service: "tonal",
        consecutiveFailures: 0,
        circuitOpen: false,
        lastSuccessAt: 1000,
      }),
    );

    await t.mutation(internal.systemHealth.recordSuccess, { service: "tonal" });

    const row = await t.run((ctx) => ctx.db.get(initialId));
    expect(row?.lastSuccessAt).toBe(1000);
  });

  test("skips the write during transient blips (circuit closed, counter non-zero)", async () => {
    const t = convexTest(schema, modules);
    const id = await t.run((ctx) =>
      ctx.db.insert("systemHealth", {
        service: "tonal",
        consecutiveFailures: 3,
        circuitOpen: false,
        lastFailureAt: 500,
      }),
    );

    await t.mutation(internal.systemHealth.recordSuccess, { service: "tonal" });

    const row = await t.run((ctx) => ctx.db.get(id));
    expect(row?.consecutiveFailures).toBe(3);
  });

  test("closes the circuit when it was open", async () => {
    const t = convexTest(schema, modules);
    const id = await t.run((ctx) =>
      ctx.db.insert("systemHealth", {
        service: "tonal",
        consecutiveFailures: 5,
        circuitOpen: true,
        circuitOpenedAt: 100,
      }),
    );

    await t.mutation(internal.systemHealth.recordSuccess, { service: "tonal" });

    const row = await t.run((ctx) => ctx.db.get(id));
    expect(row?.circuitOpen).toBe(false);
    expect(row?.consecutiveFailures).toBe(0);
    expect(row?.lastSuccessAt).toBe(SUCCESS_NOW);
  });
});
