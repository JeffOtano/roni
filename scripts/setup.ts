import { assertInteractive, createPrompter, type Prompter } from "./setup/prompts";
import { listConvexEnv } from "./setup/convex";
import {
  stepBootstrapConvex,
  stepCheckNodeVersion,
  stepEnsureEnvFile,
  stepOptionalIntegrations,
  stepSetGoogleKey,
  stepSetJwtKeys,
  stepSetRandomHex,
  stepValidate,
} from "./setup/steps";

interface Context {
  prompter: Prompter;
  existing: Map<string, string>;
}

type Step =
  | { label: string; kind: "simple"; run: () => void | Promise<void> }
  | { label: string; kind: "contextual"; run: (ctx: Context) => Promise<void> };

const STEPS: Step[] = [
  { label: "Checking Node version", kind: "simple", run: stepCheckNodeVersion },
  { label: "Checking .env.local", kind: "simple", run: stepEnsureEnvFile },
  { label: "Bootstrapping Convex deployment", kind: "simple", run: stepBootstrapConvex },
  {
    label: "Setting GOOGLE_GENERATIVE_AI_API_KEY",
    kind: "contextual",
    run: ({ prompter, existing }) => stepSetGoogleKey(prompter, existing),
  },
  {
    label: "Setting TOKEN_ENCRYPTION_KEY",
    kind: "contextual",
    run: ({ prompter, existing }) => stepSetRandomHex(prompter, existing, "TOKEN_ENCRYPTION_KEY"),
  },
  {
    label: "Setting EMAIL_CHANGE_CODE_PEPPER",
    kind: "contextual",
    run: ({ prompter, existing }) =>
      stepSetRandomHex(prompter, existing, "EMAIL_CHANGE_CODE_PEPPER"),
  },
  {
    label: "Generating JWT keypair",
    kind: "contextual",
    run: ({ prompter, existing }) => stepSetJwtKeys(prompter, existing),
  },
  {
    label: "Optional integrations (skip any you don't need)",
    kind: "contextual",
    run: ({ prompter, existing }) => stepOptionalIntegrations(prompter, existing),
  },
  { label: "Validating", kind: "simple", run: stepValidate },
];

async function main(): Promise<void> {
  assertInteractive();
  console.log("Tonal Coach setup\n");

  const total = STEPS.length;
  let ctx: Context | null = null;

  try {
    for (const [i, step] of STEPS.entries()) {
      console.log(`${i === 0 ? "" : "\n"}[${i + 1}/${total}] ${step.label}...`);
      if (step.kind === "simple") {
        await step.run();
        continue;
      }
      if (!ctx) ctx = { prompter: createPrompter(), existing: listConvexEnv() };
      await step.run(ctx);
    }
  } finally {
    ctx?.prompter.close();
  }

  console.log("\nSetup complete.\n");
  console.log("Next steps (run in separate terminals):");
  console.log("  Terminal 1: npx convex dev   # Convex backend with hot reload");
  console.log("  Terminal 2: npm run dev      # Next.js dev server");
  console.log("\nThen open http://localhost:3000\n");
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\nSetup failed: ${message}\n`);
  process.exit(1);
});
