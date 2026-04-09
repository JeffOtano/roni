/** SHA-256 hash of a plaintext API key, returned as hex. Uses Web Crypto API. */
export async function hashApiKey(plaintext: string): Promise<string> {
  const encoded = new TextEncoder().encode(plaintext);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Generate a cryptographically random base64url key string (32 bytes). */
export function generateKeyString(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
