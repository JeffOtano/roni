import type { ToolContext, ToolDefinition, ToolHandler } from "../registry";
import { internal } from "../../_generated/api";
import type { Movement } from "../../tonal/types";
import { matchesNameSearch } from "../../tonal/movementSearch";

async function fetchCachedMovements(toolCtx: ToolContext): Promise<Movement[]> {
  return toolCtx.ctx.runQuery(internal.tonal.movementSync.getAllMovements);
}

async function listMovements(
  toolCtx: ToolContext,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const movements = await fetchCachedMovements(toolCtx);
  const summary = movements.map((m) => ({
    id: m.id,
    name: m.name,
    muscleGroups: m.muscleGroups,
    onMachine: m.onMachine,
    skillLevel: m.skillLevel,
    accessory: m.onMachineInfo?.accessory ?? "None",
    trainingTypes: m.trainingTypes ?? [],
  }));
  return {
    content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
  };
}

async function searchMovements(
  toolCtx: ToolContext,
  args: Record<string, unknown>,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  let movements = await fetchCachedMovements(toolCtx);
  const name = args.name as string | undefined;
  const muscleGroup = args.muscleGroup as string | undefined;
  const onMachine = args.onMachine as boolean | undefined;

  if (name) {
    movements = movements.filter((m) => matchesNameSearch(m, name));
  }
  if (muscleGroup) {
    const lower = muscleGroup.toLowerCase();
    movements = movements.filter((m) =>
      m.muscleGroups.some((g) => g.toLowerCase().includes(lower)),
    );
  }
  if (onMachine !== undefined) {
    movements = movements.filter((m) => m.onMachine === onMachine);
  }
  const trainingType = args.trainingType as string | undefined;
  if (trainingType) {
    const t = trainingType.toLowerCase();
    movements = movements.filter((m) => m.trainingTypes?.some((tt) => tt.toLowerCase() === t));
  }

  const results = movements.map((m) => ({
    id: m.id,
    name: m.name,
    muscleGroups: m.muscleGroups,
    onMachine: m.onMachine,
    skillLevel: m.skillLevel,
    accessory: m.onMachineInfo?.accessory ?? "None",
    trainingTypes: m.trainingTypes ?? [],
    descriptionHow: m.descriptionHow,
  }));

  return {
    content: [
      {
        type: "text",
        text:
          results.length > 0
            ? JSON.stringify(results, null, 2)
            : "No movements found matching the criteria.",
      },
    ],
  };
}

async function getMovementsById(
  toolCtx: ToolContext,
  args: Record<string, unknown>,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const movementIds = args.movementIds;
  if (!Array.isArray(movementIds) || movementIds.length === 0 || movementIds.length > 50) {
    return {
      content: [{ type: "text" as const, text: "movementIds must be an array of 1-50 UUIDs." }],
    };
  }
  const movements = await fetchCachedMovements(toolCtx);
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
      accessory: m.onMachineInfo?.accessory ?? "None",
      found: true,
    };
  });

  return {
    content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
  };
}

export const exerciseToolDefinitions: ToolDefinition[] = [
  {
    name: "list_movements",
    description:
      "List all Tonal exercises/movements with IDs and muscle groups. Use search_movements for filtering.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "search_movements",
    description: "Search exercises by name substring and/or muscle group",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Substring to match in exercise name (case-insensitive)",
        },
        muscleGroup: {
          type: "string",
          description: "Muscle group to filter by (e.g. Chest, Back, Quads, Shoulders)",
        },
        onMachine: {
          type: "boolean",
          description: "Filter to on-machine (true) or free-lift (false)",
        },
        trainingType: {
          type: "string",
          description: "Filter by training type: Warm-up, Mobility, Recovery, Yoga, Strength, etc.",
        },
      },
    },
  },
  {
    name: "get_movements_by_id",
    description:
      "Look up exercises by their movement UUID. Returns name, muscle groups, and details.",
    inputSchema: {
      type: "object",
      properties: {
        movementIds: {
          type: "array",
          description: "Array of movement UUIDs to look up (1-50)",
          items: { type: "string" },
        },
      },
      required: ["movementIds"],
    },
  },
];

export const exerciseToolHandlers: Record<string, ToolHandler> = {
  list_movements: (tc) => listMovements(tc),
  search_movements: (tc, args) => searchMovements(tc, args),
  get_movements_by_id: (tc, args) => getMovementsById(tc, args),
};
