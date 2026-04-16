import { spawnSync } from "node:child_process";

const CONVEX_ENV_LIST_LINE = /^([A-Z_][A-Z0-9_]*)=(.*)$/;

/**
 * Run `npx convex env list` and return a map of variable name -> value.
 * Asserts that every non-blank line matches the documented `KEY=value` shape
 * so a CLI output-format change fails loud instead of silently returning a
 * partial view.
 */
export function listConvexEnv(): Map<string, string> {
  const result = spawnSync("npx", ["convex", "env", "list"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    throw new Error(
      `npx convex env list failed (exit ${result.status}): ${result.stderr || "no stderr"}`,
    );
  }

  const env = new Map<string, string>();
  for (const line of result.stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(CONVEX_ENV_LIST_LINE);
    if (!match) {
      throw new Error(
        `npx convex env list returned unexpected line format; ` +
          `setup cannot safely inspect the deployment. Line: ${JSON.stringify(trimmed)}`,
      );
    }
    env.set(match[1], match[2]);
  }
  return env;
}

/**
 * Set a single Convex environment variable.
 * Throws on failure. Deliberately does NOT include stderr in the error
 * message because Convex CLI may echo the submitted value back on
 * validation errors, which would leak the secret into logs.
 */
export function setConvexEnv(key: string, value: string): void {
  const result = spawnSync("npx", ["convex", "env", "set", key, value], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    throw new Error(
      `npx convex env set ${key} failed (exit ${result.status}). ` +
        `Re-run with 'npx convex env set ${key} <value>' to see the CLI error directly.`,
    );
  }
}

/**
 * Run `npx convex dev --once` with inherited stdio so the user sees the
 * Convex CLI prompts and can log in / pick a project.
 */
export function runConvexDevOnce(): void {
  const result = spawnSync("npx", ["convex", "dev", "--once"], {
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(
      `npx convex dev --once failed (exit ${result.status}). ` +
        "Make sure you are logged in (npx convex login) and try again.",
    );
  }
}
