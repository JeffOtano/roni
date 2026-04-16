import type { EnvMap } from "./envFile";

export const REQUIRED_CONVEX_SECRETS = [
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "TOKEN_ENCRYPTION_KEY",
  "EMAIL_CHANGE_CODE_PEPPER",
  "JWT_PRIVATE_KEY",
  "JWKS",
] as const;

export const REQUIRED_ENV_FILE_KEYS = ["CONVEX_DEPLOYMENT", "NEXT_PUBLIC_CONVEX_URL"] as const;

const PLACEHOLDER_DEPLOYMENT_PREFIX = "dev:your-deployment-name";

interface ValidationResult {
  ok: boolean;
  missingConvex: string[];
  missingEnvFile: string[];
  invalidConvex: string[];
}

/** Shape check for required Convex secret values — catches the common
 *  "pasted the wrong string" class of bug before it becomes a runtime 403. */
function isInvalidFormat(key: string, value: string): boolean {
  if (!value.trim()) return true;
  switch (key) {
    case "GOOGLE_GENERATIVE_AI_API_KEY":
      return !/^AIza[A-Za-z0-9_-]{20,}$/.test(value);
    case "TOKEN_ENCRYPTION_KEY":
    case "EMAIL_CHANGE_CODE_PEPPER":
      return !/^[0-9a-f]{64}$/.test(value);
    case "JWT_PRIVATE_KEY":
      return !value.includes("-----BEGIN") || !value.includes("PRIVATE KEY-----");
    case "JWKS":
      try {
        const parsed: unknown = JSON.parse(value);
        return (
          typeof parsed !== "object" ||
          parsed === null ||
          !Array.isArray((parsed as { keys?: unknown }).keys)
        );
      } catch {
        return true;
      }
    default:
      return false;
  }
}

export function validate(convexEnv: Map<string, string>, envFile: EnvMap): ValidationResult {
  const missingConvex = REQUIRED_CONVEX_SECRETS.filter((key) => !convexEnv.has(key));
  const invalidConvex = REQUIRED_CONVEX_SECRETS.filter(
    (key) => convexEnv.has(key) && isInvalidFormat(key, convexEnv.get(key) ?? ""),
  );
  const missingEnvFile = REQUIRED_ENV_FILE_KEYS.filter((key) => {
    const value = envFile[key];
    if (!value) return true;
    return key === "CONVEX_DEPLOYMENT" && value.startsWith(PLACEHOLDER_DEPLOYMENT_PREFIX);
  });
  return {
    ok: missingConvex.length === 0 && invalidConvex.length === 0 && missingEnvFile.length === 0,
    missingConvex,
    missingEnvFile,
    invalidConvex,
  };
}
