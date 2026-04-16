import fs from "node:fs";
import path from "node:path";
import { listConvexEnv, runConvexDevOnce, setConvexEnv } from "./convex";
import { mergeEnv, parseEnvFile, readEnvFile, writeEnvFile } from "./envFile";
import { generateJwtKeypair, randomHex } from "./keygen";
import type { Prompter } from "./prompts";
import { REQUIRED_CONVEX_SECRETS, REQUIRED_ENV_FILE_KEYS, validate } from "./validate";

const ENV_LOCAL_PATH = path.resolve(process.cwd(), ".env.local");
const ENV_EXAMPLE_PATH = path.resolve(process.cwd(), ".env.example");
const NVMRC_PATH = path.resolve(process.cwd(), ".nvmrc");

export function stepCheckNodeVersion(): void {
  const wanted = fs.readFileSync(NVMRC_PATH, "utf8").trim();
  const wantedMajor = wanted.split(".")[0];
  const actualMajor = process.versions.node.split(".")[0];

  if (wantedMajor !== actualMajor) {
    console.log(
      `  ⚠ Node ${process.versions.node} (wanted ${wanted} from .nvmrc) - proceeding anyway`,
    );
  } else {
    console.log(`  ✓ Node ${process.versions.node} matches .nvmrc`);
  }
}

export function stepEnsureEnvFile(): void {
  if (fs.existsSync(ENV_LOCAL_PATH)) {
    console.log(`  ✓ .env.local already exists`);
    return;
  }
  if (!fs.existsSync(ENV_EXAMPLE_PATH)) {
    throw new Error(".env.example is missing - cannot create .env.local");
  }
  fs.copyFileSync(ENV_EXAMPLE_PATH, ENV_LOCAL_PATH);
  console.log(`  ✓ Created .env.local from .env.example`);
}

export function stepBootstrapConvex(): void {
  const envContent = readEnvFile(ENV_LOCAL_PATH);
  const env = parseEnvFile(envContent);
  if (env.CONVEX_DEPLOYMENT && !env.CONVEX_DEPLOYMENT.startsWith("dev:your-deployment-name")) {
    console.log(`  ✓ Detected existing deployment: ${env.CONVEX_DEPLOYMENT}`);
    return;
  }
  console.log(`  → Running npx convex dev --once (interactive)...`);
  runConvexDevOnce();
  console.log(`  ✓ Convex deployment ready`);
}

async function promptOverwriteIfSet(
  prompter: Prompter,
  existing: Set<string>,
  key: string,
): Promise<boolean> {
  if (!existing.has(key)) return true;
  return prompter.yesNo(`  ${key} is already set. Overwrite?`, false);
}

export async function stepSetGoogleKey(prompter: Prompter, existing: Set<string>): Promise<void> {
  const shouldSet = await promptOverwriteIfSet(prompter, existing, "GOOGLE_GENERATIVE_AI_API_KEY");
  if (!shouldSet) {
    console.log(`  - Skipped (existing value kept)`);
    return;
  }
  console.log(`  Get an API key from https://aistudio.google.com/app/apikey`);
  const key = await prompter.secret(`  Enter GOOGLE_GENERATIVE_AI_API_KEY: `);
  if (!key.trim()) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is required");
  }
  setConvexEnv("GOOGLE_GENERATIVE_AI_API_KEY", key.trim());
  console.log(`  ✓ Set in Convex`);
}

export async function stepSetRandomHex(
  prompter: Prompter,
  existing: Set<string>,
  key: string,
): Promise<void> {
  const shouldSet = await promptOverwriteIfSet(prompter, existing, key);
  if (!shouldSet) {
    console.log(`  - Skipped (existing value kept)`);
    return;
  }
  const value = randomHex(32);
  setConvexEnv(key, value);
  console.log(`  ✓ Generated and set ${key}`);
}

export async function stepSetJwtKeys(prompter: Prompter, existing: Set<string>): Promise<void> {
  const eitherExists = existing.has("JWT_PRIVATE_KEY") || existing.has("JWKS");
  if (eitherExists) {
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
  console.log(`  ✓ Generated and set JWT_PRIVATE_KEY and JWKS`);
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

export async function stepOptionalIntegrations(prompter: Prompter): Promise<void> {
  for (const integration of OPTIONAL_INTEGRATIONS) {
    const enable = await prompter.yesNo(`  Configure ${integration.label}?`, false);
    if (!enable) continue;

    console.log(`    See: ${integration.helpUrl}`);
    const value = await prompter.secret(`    Enter ${integration.key}: `);
    const trimmed = value.trim();
    if (!trimmed) {
      console.log(`    - Empty input, skipping`);
      continue;
    }

    if (integration.clientSide) {
      const content = readEnvFile(ENV_LOCAL_PATH);
      const updated = mergeEnv(content, { [integration.key]: trimmed });
      writeEnvFile(ENV_LOCAL_PATH, updated);
      console.log(`    ✓ Added to .env.local`);
    } else {
      setConvexEnv(integration.key, trimmed);
      console.log(`    ✓ Set in Convex`);

      if (integration.clientSideMirror) {
        const content = readEnvFile(ENV_LOCAL_PATH);
        const updated = mergeEnv(content, { [integration.clientSideMirror]: trimmed });
        writeEnvFile(ENV_LOCAL_PATH, updated);
        console.log(`    ✓ Mirrored to .env.local as ${integration.clientSideMirror}`);
      }
    }
  }
}

export function stepValidate(): void {
  const convexEnv = listConvexEnv();
  const envFile = parseEnvFile(readEnvFile(ENV_LOCAL_PATH));
  const result = validate(convexEnv, envFile);

  if (result.ok) {
    console.log(`  ✓ All required secrets configured`);
    console.log(`    Convex: ${REQUIRED_CONVEX_SECRETS.join(", ")}`);
    console.log(`    .env.local: ${REQUIRED_ENV_FILE_KEYS.join(", ")}`);
    return;
  }

  const missing: string[] = [];
  if (result.missingConvex.length) {
    missing.push(`Convex: ${result.missingConvex.join(", ")}`);
  }
  if (result.missingEnvFile.length) {
    missing.push(`.env.local: ${result.missingEnvFile.join(", ")}`);
  }
  throw new Error(`Setup incomplete. Missing - ${missing.join(" | ")}`);
}
