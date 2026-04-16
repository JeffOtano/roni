import { assertInteractive, createPrompter } from "./setup/prompts";
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

async function main(): Promise<void> {
  assertInteractive();

  console.log("Tonal Coach setup\n");

  console.log("[1/9] Checking Node version...");
  stepCheckNodeVersion();

  console.log("\n[2/9] Checking .env.local...");
  stepEnsureEnvFile();

  console.log("\n[3/9] Bootstrapping Convex deployment...");
  stepBootstrapConvex();

  const existing = listConvexEnv();
  const prompter = createPrompter();

  try {
    console.log("\n[4/9] Setting GOOGLE_GENERATIVE_AI_API_KEY...");
    await stepSetGoogleKey(prompter, existing);

    console.log("\n[5/9] Setting TOKEN_ENCRYPTION_KEY...");
    await stepSetRandomHex(prompter, existing, "TOKEN_ENCRYPTION_KEY");

    console.log("\n[6/9] Setting EMAIL_CHANGE_CODE_PEPPER...");
    await stepSetRandomHex(prompter, existing, "EMAIL_CHANGE_CODE_PEPPER");

    console.log("\n[7/9] Generating JWT keypair...");
    await stepSetJwtKeys(prompter, existing);

    console.log("\n[8/9] Optional integrations (skip any you don't need)...");
    await stepOptionalIntegrations(prompter);

    console.log("\n[9/9] Validating...");
    stepValidate();

    console.log("\nSetup complete.\n");
    console.log("Next steps:");
    console.log("  Terminal 1: npx convex dev");
    console.log("  Terminal 2: npm run dev");
    console.log("\nThen open http://localhost:3000\n");
  } finally {
    prompter.close();
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\nSetup failed: ${message}\n`);
  process.exit(1);
});
