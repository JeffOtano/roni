import type { EnvMap } from "./envFile";

export const REQUIRED_CONVEX_SECRETS = [
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "TOKEN_ENCRYPTION_KEY",
  "EMAIL_CHANGE_CODE_PEPPER",
  "JWT_PRIVATE_KEY",
  "JWKS",
] as const;

export const REQUIRED_ENV_FILE_KEYS = ["CONVEX_DEPLOYMENT", "NEXT_PUBLIC_CONVEX_URL"] as const;

export interface ValidationResult {
  ok: boolean;
  missingConvex: string[];
  missingEnvFile: string[];
}

export function validate(convexEnv: Set<string>, envFile: EnvMap): ValidationResult {
  const missingConvex = REQUIRED_CONVEX_SECRETS.filter((key) => !convexEnv.has(key));
  const missingEnvFile = REQUIRED_ENV_FILE_KEYS.filter((key) => !envFile[key]);

  return {
    ok: missingConvex.length === 0 && missingEnvFile.length === 0,
    missingConvex,
    missingEnvFile,
  };
}
