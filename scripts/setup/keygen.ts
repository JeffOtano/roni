import crypto from "node:crypto";

/** Generate a cryptographically random hex string of the specified byte length. */
export function randomHex(byteLength: number): string {
  return crypto.randomBytes(byteLength).toString("hex");
}

/** Generate an RSA-2048 keypair for @convex-dev/auth JWT signing. */
export function generateJwtKeypair(): { privateKeyPem: string; jwks: string } {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });

  const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const publicJwk = publicKey.export({ format: "jwk" });
  const kid = crypto.randomUUID();

  const jwks = JSON.stringify({
    keys: [{ ...publicJwk, kid, use: "sig", alg: "RS256" }],
  });

  return { privateKeyPem, jwks };
}
