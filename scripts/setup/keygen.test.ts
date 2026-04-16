import { describe, expect, it } from "vitest";
import { generateJwtKeypair, randomHex } from "./keygen";

describe("randomHex", () => {
  it("returns a 64-character hex string when given 32 bytes", () => {
    const result = randomHex(32);

    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns different values across calls", () => {
    const a = randomHex(32);
    const b = randomHex(32);

    expect(a).not.toBe(b);
  });

  it("returns the requested byte length doubled (hex encoding)", () => {
    expect(randomHex(16)).toHaveLength(32);
    expect(randomHex(8)).toHaveLength(16);
  });
});

describe("generateJwtKeypair", () => {
  it("returns a PKCS8 PEM private key", () => {
    const { privateKeyPem } = generateJwtKeypair();

    expect(privateKeyPem).toMatch(/^-----BEGIN PRIVATE KEY-----/);
    expect(privateKeyPem).toMatch(/-----END PRIVATE KEY-----\n?$/);
  });

  it("returns a JWKS string containing the public key with required fields", () => {
    const { jwks } = generateJwtKeypair();
    const parsed = JSON.parse(jwks);

    expect(parsed).toHaveProperty("keys");
    expect(parsed.keys).toHaveLength(1);
    const key = parsed.keys[0];
    expect(key.kty).toBe("RSA");
    expect(key.use).toBe("sig");
    expect(key.alg).toBe("RS256");
    expect(typeof key.kid).toBe("string");
    expect(key.kid.length).toBeGreaterThan(0);
    expect(typeof key.n).toBe("string");
    expect(typeof key.e).toBe("string");
  });

  it("generates unique keypairs across calls", () => {
    const a = generateJwtKeypair();
    const b = generateJwtKeypair();

    expect(a.privateKeyPem).not.toBe(b.privateKeyPem);
    expect(a.jwks).not.toBe(b.jwks);
  });
});
