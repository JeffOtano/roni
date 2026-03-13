import { decrypt, encrypt } from "./encryption";

const TONAL_AUTH0_DOMAIN = "tonal.auth0.com";
const TONAL_AUTH0_CLIENT_ID = "ERCyexW-xoVG_Yy3RDe-eV4xsOnRHP6L";

interface TonalTokenResult {
  idToken: string;
  refreshToken?: string;
  expiresAt: number;
}

/**
 * Obtain a Tonal API token via Auth0 password-realm grant.
 * The password is NOT stored — only the resulting JWT is encrypted and persisted.
 */
export async function obtainTonalToken(email: string, password: string): Promise<TonalTokenResult> {
  const res = await fetch(`https://${TONAL_AUTH0_DOMAIN}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "http://auth0.com/oauth/grant-type/password-realm",
      username: email,
      password,
      realm: "Username-Password-Authentication",
      client_id: TONAL_AUTH0_CLIENT_ID,
      scope: "openid profile email offline_access",
    }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error_description: "Unknown error" }));
    throw new Error(error.error_description || "Invalid Tonal credentials");
  }

  const data = await res.json();
  const expiresAt = parseJwtExpiry(data.id_token);

  return {
    idToken: data.id_token,
    refreshToken: data.refresh_token,
    expiresAt,
  };
}

/**
 * Refresh an existing Tonal token using the refresh_token grant.
 */
export async function refreshTonalToken(refreshToken: string): Promise<TonalTokenResult> {
  const res = await fetch(`https://${TONAL_AUTH0_DOMAIN}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: TONAL_AUTH0_CLIENT_ID,
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    throw new Error("Tonal token refresh failed — user must re-authenticate");
  }

  const data = await res.json();
  const expiresAt = parseJwtExpiry(data.id_token);

  return {
    idToken: data.id_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt,
  };
}

export async function encryptToken(token: string, encryptionKey: string): Promise<string> {
  return encrypt(token, encryptionKey);
}

export async function decryptToken(encrypted: string, encryptionKey: string): Promise<string> {
  return decrypt(encrypted, encryptionKey);
}

/**
 * Parse JWT exp claim to get expiry timestamp in milliseconds.
 * Falls back to 24 hours from now if parsing fails.
 */
function parseJwtExpiry(jwt: string): number {
  try {
    const payload = JSON.parse(atob(jwt.split(".")[1]));
    if (payload.exp) {
      return payload.exp * 1000;
    }
  } catch {
    // Fall through to default
  }
  return Date.now() + 24 * 60 * 60 * 1000;
}
