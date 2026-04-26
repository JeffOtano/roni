/// <reference types="vite/client" />
import { readFileSync } from "node:fs";
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "./_generated/api";
import { JSON_EXPORT_SECTION_KEYS, USER_DATA_TABLES } from "./userData";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

function getLocalUserScopedTables() {
  const schemaSource = readFileSync(new URL("./schema.ts", import.meta.url), "utf8");
  const lines = schemaSource.split("\n");
  const tableBlocks = new Map<string, string[]>();
  let currentTable: string | null = null;

  for (const line of lines) {
    const tableMatch = line.match(/^  ([a-zA-Z][a-zA-Z0-9]*): defineTable\(/);
    if (tableMatch) {
      currentTable = tableMatch[1];
      tableBlocks.set(currentTable, [line]);
      continue;
    }

    if (currentTable) {
      tableBlocks.get(currentTable)?.push(line);
    }
  }

  return [...tableBlocks.entries()]
    .filter(([, blockLines]) => {
      const block = blockLines.join("\n");
      return (
        block.includes('userId: v.id("users")') ||
        block.includes('userId: v.optional(v.id("users"))')
      );
    })
    .map(([table]) => table)
    .sort();
}

describe("USER_DATA_TABLES", () => {
  test("classifies every local schema table with a typed userId", () => {
    const registeredTables = USER_DATA_TABLES.map((entry) => entry.table).sort();

    expect(registeredTables).toEqual(expect.arrayContaining(getLocalUserScopedTables()));
  });

  test("collectUserData returns every registered JSON export section", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => ctx.db.insert("users", {}));

    const data = await t.query(internal.dataExport.collectUserData, { userId });

    expect(Object.keys(data)).toEqual(
      expect.arrayContaining(["exportedAt", "user", ...JSON_EXPORT_SECTION_KEYS]),
    );
  });

  test("collectUserData exports Garmin wellness rows without Convex metadata", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("users", {});
      await ctx.db.insert("garminWellnessDaily", {
        userId: id,
        calendarDate: "2026-04-24",
        sleepDurationSeconds: 25_200,
        hrvLastNightAvg: 58,
        avgStress: 31,
        bodyBatteryHighestValue: 84,
        bodyBatteryLowestValue: 22,
        avgSpo2: 97,
        avgRespirationRate: 14.4,
        skinTempDeviationCelsius: 0.3,
        lastIngestedAt: 1_714_000_000_000,
      });
      return id;
    });

    const data = await t.query(internal.dataExport.collectUserData, { userId });

    expect(data.garminWellnessDaily).toEqual([
      {
        calendarDate: "2026-04-24",
        sleepDurationSeconds: 25_200,
        hrvLastNightAvg: 58,
        avgStress: 31,
        bodyBatteryHighestValue: 84,
        bodyBatteryLowestValue: 22,
        avgSpo2: 97,
        avgRespirationRate: 14.4,
        skinTempDeviationCelsius: 0.3,
        lastIngestedAt: 1_714_000_000_000,
      },
    ]);
    expect(data.garminWellnessDaily[0]).not.toHaveProperty("_id");
    expect(data.garminWellnessDaily[0]).not.toHaveProperty("_creationTime");
    expect(data.garminWellnessDaily[0]).not.toHaveProperty("userId");
  });
});
