import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listConvexEnv, runConvexDevOnce, setConvexEnv } from "./convex";
import { mergeEnv, parseEnvFile, readEnvFile, writeEnvFile } from "./envFile";
import { generateJwtKeypair, randomHex } from "./keygen";
import type { Prompter } from "./prompts";
import { REQUIRED_CONVEX_SECRETS, REQUIRED_ENV_FILE_KEYS, validate } from "./validate";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..", "..");
const ENV_LOCAL_PATH = path.join(REPO_ROOT, ".env.local");
const ENV_EXAMPLE_PATH = path.join(REPO_ROOT, ".env.example");
const NVMRC_PATH = path.join(REPO_ROOT, ".nvmrc");

const PLACEHOLDER_DEPLOYMENT_PREFIX = "dev:your-deployment-name";

export function stepCheckNodeVersion(): void {
  let wanted: string;
  try {
    wanted = fs.readFileSync(NVMRC_PATH, "utf8").trim();
  } catch {
    console.log(`  [WARN] could not read .nvmrc - skipping Node version check`);
    return;
  }
  const wantedMajor = wanted.split(".")[0];
  const actualMajor = process.versions.node.split(".")[0];

  if (wantedMajor !== actualMajor) {
    throw new Error(
      `Node ${process.versions.node} does not match .nvmrc (wanted ${wanted}). ` +
        `Switch Node versions (e.g. 'nvm use') and re-run setup.`,
    );
  }
  console.log(`  [OK] Node ${process.versions.node} matches .nvmrc`);
}

export function stepEnsureEnvFile(): void {
  if (fs.existsSync(ENV_LOCAL_PATH)) {
    console.log(`  [OK] .env.local already exists`);
    return;
  }
  if (!fs.existsSync(ENV_EXAMPLE_PATH)) {
    throw new Error(".env.example is missing - cannot create .env.local");
  }
  const template = fs.readFileSync(ENV_EXAMPLE_PATH, "utf8");
  writeEnvFile(ENV_LOCAL_PATH, template);
  console.log(`  [OK] Created .env.local from .env.example (mode 0600)`);
}

export function stepBootstrapConvex(): void {
  const env = parseEnvFile(readEnvFile(ENV_LOCAL_PATH));
  const current = env.CONVEX_DEPLOYMENT ?? "";
  const looksConfigured = current && !current.startsWith(PLACEHOLDER_DEPLOYMENT_PREFIX);

  if (looksConfigured) {
    console.log(`  [OK] Detected existing deployment: ${current}`);
    return;
  }
  console.log(`  -> Running npx convex dev --once (interactive)...`);
  runConvexDevOnce();
  console.log(`  [OK] Convex deployment ready`);
}

async function promptOverwriteIfSet(
  prompter: Prompter,
  existing: Map<string, string> | Set<string>,
  key: string,
): Promise<boolean> {
  if (!existing.has(key)) return true;
  return prompter.yesNo(`  ${key} is already set. Overwrite?`, false);
}

/** Loop prompter.secret() until the user gives a non-empty answer or
 *  explicitly opts out by typing "skip". Prevents accidental Enter from
 *  being silently treated as "skip this integration." */
async function promptRequiredSecret(prompter: Prompter, question: string): Promise<string> {
  while (true) {
    const value = (await prompter.secret(question)).trim();
    if (value) return value;
    console.log(`    Empty input - type 'skip' to skip this integration, or enter a value.`);
    const next = (await prompter.secret(question)).trim();
    if (next.toLowerCase() === "skip") return "";
    if (next) return next;
  }
}

export async function stepSetGoogleKey(
  prompter: Prompter,
  existing: Map<string, string>,
): Promise<void> {
  const shouldSet = await promptOverwriteIfSet(prompter, existing, "GOOGLE_GENERATIVE_AI_API_KEY");
  if (!shouldSet) {
    console.log(`  - Skipped (existing value kept)`);
    return;
  }
  console.log(`  Get an API key from https://aistudio.google.com/app/apikey`);
  const key = await promptRequiredSecret(prompter, `  Enter GOOGLE_GENERATIVE_AI_API_KEY: `);
  if (!key) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is required");
  if (!/^AIza[A-Za-z0-9_-]{20,}$/.test(key)) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY does not match the expected 'AIza...' format");
  }
  setConvexEnv("GOOGLE_GENERATIVE_AI_API_KEY", key);
  console.log(`  [OK] Set in Convex`);
}

export async function stepSetRandomHex(
  prompter: Prompter,
  existing: Map<string, string>,
  key: string,
): Promise<void> {
  const shouldSet = await promptOverwriteIfSet(prompter, existing, key);
  if (!shouldSet) {
    console.log(`  - Skipped (existing value kept)`);
    return;
  }
  setConvexEnv(key, randomHex(32));
  console.log(`  [OK] Generated and set ${key}`);
}

export async function stepSetJwtKeys(
  prompter: Prompter,
  existing: Map<string, string>,
): Promise<void> {
  const hasPrivate = existing.has("JWT_PRIVATE_KEY");
  const hasJwks = existing.has("JWKS");
  if (hasPrivate && !hasJwks) {
    console.log(`  [WARN] JWT_PRIVATE_KEY is set but JWKS is missing - regenerating both.`);
  } else if (hasJwks && !hasPrivate) {
    console.log(`  [WARN] JWKS is set but JWT_PRIVATE_KEY is missing - regenerating both.`);
  } else if (hasPrivate && hasJwks) {
    const overwrite = await prompter.yesNo(
      `  JWT_PRIVATE_KEY/JWKS already set. Overwrite both?`,
      false,
    );
    if (!overwrite) {
      console.log(`  - Skipped (existing values kept)`);
      return;
    }
  }
  const { privateKeyPem, jwks } = generateJwtKeypair();
  setConvexEnv("JWT_PRIVATE_KEY", privateKeyPem);
  setConvexEnv("JWKS", jwks);
  console.log(`  [OK] Generated and set JWT_PRIVATE_KEY and JWKS`);
}

interface OptionalIntegration {
  key: string;
  label: string;
  helpUrl: string;
  /** If true, write to .env.local instead of Convex. */
  clientSide?: boolean;
  /** Additional key to write to .env.local (e.g. NEXT_PUBLIC_* mirror). */
  clientSideMirror?: string;
}

const OPTIONAL_INTEGRATIONS: OptionalIntegration[] = [
  {
    key: "AUTH_RESEND_KEY",
    label: "Resend API key (for password reset emails)",
    helpUrl: "https://resend.com",
  },
  {
    key: "DISCORD_CONTACT_WEBHOOK",
    label: "Discord contact form webhook",
    helpUrl: "https://support.discord.com/hc/en-us/articles/228383668",
  },
  {
    key: "DISCORD_WEBHOOK_URL",
    label: "Discord operator notifications webhook",
    helpUrl: "https://support.discord.com/hc/en-us/articles/228383668",
  },
  {
    key: "POSTHOG_PROJECT_TOKEN",
    label: "PostHog project token (server + client analytics)",
    helpUrl: "https://posthog.com",
    clientSideMirror: "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN",
  },
  {
    key: "NEXT_PUBLIC_SENTRY_DSN",
    label: "Sentry DSN (browser error reporting)",
    helpUrl: "https://sentry.io",
    clientSide: true,
  },
];

function writeToEnvLocal(key: string, value: string): void {
  const content = readEnvFile(ENV_LOCAL_PATH);
  writeEnvFile(ENV_LOCAL_PATH, mergeEnv(content, { [key]: value }));
}

async function runOneIntegration(
  prompter: Prompter,
  existing: Map<string, string>,
  integration: OptionalIntegration,
): Promise<void> {
  const alreadySet = existing.has(integration.key);
  const promptLabel = alreadySet
    ? `  Overwrite ${integration.label}?`
    : `  Configure ${integration.label}?`;
  const enable = await prompter.yesNo(promptLabel, false);
  if (!enable) return;

  console.log(`    See: ${integration.helpUrl}`);
  const value = await promptRequiredSecret(prompter, `    Enter ${integration.key}: `);
  if (!value) {
    console.log(`    - Skipped (user opted out)`);
    return;
  }

  if (integration.clientSide) {
    writeToEnvLocal(integration.key, value);
    console.log(`    [OK] Added to .env.local`);
    return;
  }
  setConvexEnv(integration.key, value);
  console.log(`    [OK] Set in Convex`);
  if (integration.clientSideMirror) {
    writeToEnvLocal(integration.clientSideMirror, value);
    console.log(`    [OK] Mirrored to .env.local as ${integration.clientSideMirror}`);
  }
}

export async function stepOptionalIntegrations(
  prompter: Prompter,
  existing: Map<string, string>,
): Promise<void> {
  const failures: Array<{ integration: string; message: string }> = [];
  for (const integration of OPTIONAL_INTEGRATIONS) {
    try {
      await runOneIntegration(prompter, existing, integration);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`    [WARN] ${integration.key} failed: ${message}`);
      failures.push({ integration: integration.key, message });
    }
  }
  if (failures.length > 0) {
    const summary = failures.map((f) => `${f.integration} (${f.message})`).join("; ");
    throw new Error(`Some optional integrations failed: ${summary}`);
  }
}

export function stepValidate(): void {
  const convexEnv = listConvexEnv();
  const envFile = parseEnvFile(readEnvFile(ENV_LOCAL_PATH));
  const result = validate(convexEnv, envFile);

  if (result.ok) {
    console.log(`  [OK] All required secrets configured`);
    console.log(`    Convex: ${REQUIRED_CONVEX_SECRETS.join(", ")}`);
    console.log(`    .env.local: ${REQUIRED_ENV_FILE_KEYS.join(", ")}`);
    return;
  }

  const parts: string[] = [];
  if (result.missingConvex.length) parts.push(`Convex missing: ${result.missingConvex.join(", ")}`);
  if (result.invalidConvex.length) {
    parts.push(`Convex invalid format: ${result.invalidConvex.join(", ")}`);
  }
  if (result.missingEnvFile.length) {
    parts.push(`.env.local missing: ${result.missingEnvFile.join(", ")}`);
  }
  throw new Error(`Setup incomplete. ${parts.join(" | ")}`);
}
