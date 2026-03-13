import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { tonal } from "../api-client.js";
import { cache, MOVEMENTS_TTL } from "../cache.js";
import type { Movement } from "../types.js";

const MOVEMENTS_CACHE_KEY = "/v6/movements";

async function getMovements(): Promise<Movement[]> {
  let movements = cache.get<Movement[]>(MOVEMENTS_CACHE_KEY);
  if (!movements) {
    movements = await tonal.get<Movement[]>(MOVEMENTS_CACHE_KEY);
    cache.set(MOVEMENTS_CACHE_KEY, movements, MOVEMENTS_TTL);
  }
  return movements;
}

export function registerExerciseTools(server: McpServer) {
  server.tool(
    "list_movements",
    "List all Tonal exercises/movements with IDs and muscle groups. Use search_movements for filtering.",
    {},
    async () => {
      const movements = await getMovements();
      const summary = movements.map((m) => ({
        id: m.id,
        name: m.name,
        muscleGroups: m.muscleGroups,
        onMachine: m.onMachine,
        skillLevel: m.skillLevel,
      }));
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(summary, null, 2),
          },
        ],
      };
    },
  );

  server.tool(
    "search_movements",
    "Search exercises by name substring and/or muscle group",
    {
      name: z
        .string()
        .optional()
        .describe("Substring to match in exercise name (case-insensitive)"),
      muscleGroup: z
        .string()
        .optional()
        .describe(
          "Muscle group to filter by (e.g. Chest, Back, Quads, Shoulders, Biceps, Triceps, Abs, Glutes, Hamstrings, Calves)",
        ),
      onMachine: z
        .boolean()
        .optional()
        .describe("Filter to only on-machine exercises (true) or free-lift (false)"),
    },
    async ({ name, muscleGroup, onMachine }) => {
      let movements = await getMovements();

      if (name) {
        const lower = name.toLowerCase();
        movements = movements.filter((m) => m.name.toLowerCase().includes(lower));
      }

      if (muscleGroup) {
        const lower = muscleGroup.toLowerCase();
        movements = movements.filter((m) =>
          m.muscleGroups.some((g) => typeof g === "string" && g.toLowerCase().includes(lower)),
        );
      }

      if (onMachine !== undefined) {
        movements = movements.filter((m) => m.onMachine === onMachine);
      }

      const results = movements.map((m) => ({
        id: m.id,
        name: m.name,
        muscleGroups: m.muscleGroups,
        onMachine: m.onMachine,
        skillLevel: m.skillLevel,
        descriptionHow: m.descriptionHow,
      }));

      return {
        content: [
          {
            type: "text" as const,
            text:
              results.length > 0
                ? JSON.stringify(results, null, 2)
                : "No movements found matching the criteria.",
          },
        ],
      };
    },
  );

  server.tool(
    "get_movements_by_id",
    "Look up one or more exercises by their movement UUID. Returns name, muscle groups, and details for each ID.",
    {
      movementIds: z
        .array(z.string().uuid())
        .min(1)
        .max(50)
        .describe("Array of movement UUIDs to look up"),
    },
    async ({ movementIds }) => {
      const movements = await getMovements();
      const byId = new Map(movements.map((m) => [m.id, m]));
      const results = movementIds.map((id) => {
        const m = byId.get(id);
        if (!m) return { id, found: false };
        return {
          id: m.id,
          name: m.name,
          muscleGroups: m.muscleGroups,
          onMachine: m.onMachine,
          skillLevel: m.skillLevel,
          found: true,
        };
      });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    },
  );
}

/** Build a Map<movementId, name> for resolving UUIDs to human-readable names */
async function getMovementNames(): Promise<Map<string, string>> {
  const movements = await getMovements();
  return new Map(movements.map((m) => [m.id, m.name]));
}

// Exported for use by resources, prompts, and other tools
export { getMovements, getMovementNames };
