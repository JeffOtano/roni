/**
 * Sync shared eval scenarios into a Phoenix Cloud dataset so the Phoenix UI
 * can run experiments against them.
 *
 *   PHOENIX_API_KEY=... npm run ai:dataset
 *
 * Reads PHOENIX_COLLECTOR_ENDPOINT (or PHOENIX_HOST) for the base URL and
 * PHOENIX_PROJECT_NAME for labelling; falls back to sensible defaults.
 */
import { createClient } from "@arizeai/phoenix-client";
import { createOrGetDataset } from "@arizeai/phoenix-client/datasets";
import { EVAL_SCENARIOS } from "../../../convex/ai/evalScenarios";

const DATASET_NAME = process.env.PHOENIX_DATASET_NAME ?? "roni-coach-smoke";
const DATASET_DESCRIPTION =
  "Prompt-level smoke scenarios for the Roni coach. Synced from convex/ai/evalScenarios.ts.";

function requireApiKey(): string {
  const key = process.env.PHOENIX_API_KEY;
  if (!key) {
    throw new Error("PHOENIX_API_KEY is required to build a Phoenix dataset");
  }
  return key;
}

function resolveBaseUrl(): string {
  return (
    process.env.PHOENIX_COLLECTOR_ENDPOINT ??
    process.env.PHOENIX_HOST ??
    "https://app.phoenix.arize.com"
  );
}

async function main(): Promise<void> {
  const apiKey = requireApiKey();
  const baseUrl = resolveBaseUrl();

  const client = createClient({
    options: {
      baseUrl,
      headers: { Authorization: `Bearer ${apiKey}` },
    },
  });

  // Rubric lives only in the TS source (RegExp doesn't roundtrip through JSON).
  // Evaluators look up the scenario by `scenarioName` to apply the real rubric.
  const examples = EVAL_SCENARIOS.map((scenario) => ({
    input: {
      scenarioName: scenario.name,
      userMessage: scenario.userMessage,
      snapshot: scenario.snapshot,
    },
    metadata: {
      capability: scenario.capability,
      description: scenario.description,
    },
    splits: [scenario.capability],
  }));

  const { datasetId } = await createOrGetDataset({
    client,
    name: DATASET_NAME,
    description: DATASET_DESCRIPTION,
    examples,
  });

  console.log(`Phoenix dataset ready: ${DATASET_NAME} (id=${datasetId})`);
  console.log(`  ${EVAL_SCENARIOS.length} scenarios synced`);
}

main().catch((error) => {
  console.error("buildDataset failed:", error);
  process.exit(1);
});
