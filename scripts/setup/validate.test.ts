import { describe, expect, it } from "vitest";
import { validate } from "./validate";

function convex(entries: Record<string, string>): Map<string, string> {
  return new Map(Object.entries(entries));
}

const VALID_JWKS = JSON.stringify({ keys: [{ kty: "RSA", n: "x", e: "AQAB" }] });
const VALID_PEM = "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----";
const VALID_HEX = "a".repeat(64);
const VALID_GOOGLE = "AIza" + "X".repeat(35);

function validConvexEnv(): Map<string, string> {
  return convex({
    GOOGLE_GENERATIVE_AI_API_KEY: VALID_GOOGLE,
    TOKEN_ENCRYPTION_KEY: VALID_HEX,
    EMAIL_CHANGE_CODE_PEPPER: VALID_HEX,
    JWT_PRIVATE_KEY: VALID_PEM,
    JWKS: VALID_JWKS,
  });
}

describe("validate", () => {
  const validEnvFile = {
    CONVEX_DEPLOYMENT: "dev:happy-otter-123",
    NEXT_PUBLIC_CONVEX_URL: "https://happy-otter-123.convex.cloud",
  };

  it("returns ok when all required secrets are present and well-formed", () => {
    const result = validate(validConvexEnv(), validEnvFile);

    expect(result.ok).toBe(true);
    expect(result.missingConvex).toEqual([]);
    expect(result.invalidConvex).toEqual([]);
    expect(result.missingEnvFile).toEqual([]);
  });

  it("flags a missing Convex secret", () => {
    const env = validConvexEnv();
    env.delete("JWT_PRIVATE_KEY");

    const result = validate(env, validEnvFile);

    expect(result.ok).toBe(false);
    expect(result.missingConvex).toContain("JWT_PRIVATE_KEY");
  });

  it("flags a Google key that does not match the AIza prefix", () => {
    const env = validConvexEnv();
    env.set("GOOGLE_GENERATIVE_AI_API_KEY", "sk-wrong-provider-key");

    const result = validate(env, validEnvFile);

    expect(result.ok).toBe(false);
    expect(result.invalidConvex).toContain("GOOGLE_GENERATIVE_AI_API_KEY");
  });

  it("flags a TOKEN_ENCRYPTION_KEY with wrong length", () => {
    const env = validConvexEnv();
    env.set("TOKEN_ENCRYPTION_KEY", "short");

    const result = validate(env, validEnvFile);

    expect(result.invalidConvex).toContain("TOKEN_ENCRYPTION_KEY");
  });

  it("flags JWKS that is not valid JSON", () => {
    const env = validConvexEnv();
    env.set("JWKS", "not json");

    const result = validate(env, validEnvFile);

    expect(result.invalidConvex).toContain("JWKS");
  });

  it("flags JWKS that is valid JSON but missing a keys array", () => {
    const env = validConvexEnv();
    env.set("JWKS", JSON.stringify({ wrong: "shape" }));

    const result = validate(env, validEnvFile);

    expect(result.invalidConvex).toContain("JWKS");
  });

  it("flags JWT_PRIVATE_KEY that is not a PEM", () => {
    const env = validConvexEnv();
    env.set("JWT_PRIVATE_KEY", "whatever");

    const result = validate(env, validEnvFile);

    expect(result.invalidConvex).toContain("JWT_PRIVATE_KEY");
  });

  it("flags CONVEX_DEPLOYMENT left as the placeholder", () => {
    const result = validate(validConvexEnv(), {
      ...validEnvFile,
      CONVEX_DEPLOYMENT: "dev:your-deployment-name-here",
    });

    expect(result.ok).toBe(false);
    expect(result.missingEnvFile).toContain("CONVEX_DEPLOYMENT");
  });

  it("flags an empty-string secret as invalid", () => {
    const env = validConvexEnv();
    env.set("TOKEN_ENCRYPTION_KEY", "");

    const result = validate(env, validEnvFile);

    expect(result.invalidConvex).toContain("TOKEN_ENCRYPTION_KEY");
  });
});
