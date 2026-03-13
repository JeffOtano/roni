const AUTH0_DOMAIN = "https://tonal.auth0.com";
const CLIENT_ID = "ERCyexW-xoVG_Yy3RDe-eV4xsOnRHP6L";
const REALM = "Username-Password-Authentication";

interface Auth0TokenResponse {
  access_token: string;
  id_token?: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

let cachedToken: string | null = null;
let tokenExpiresAt = 0;
let refreshToken: string | null = null;

function getCredentials(): { email: string; password: string } | null {
  const email = process.env.TONAL_EMAIL;
  const password = process.env.TONAL_PASSWORD;
  if (email && password) return { email, password };
  return null;
}

function getStaticToken(): string | null {
  const staticToken = process.env.TONAL_API_TOKEN;
  if (!staticToken) return null;
  try {
    const payload = JSON.parse(Buffer.from(staticToken.split(".")[1], "base64url").toString());
    const expiresIn = payload.exp ? payload.exp - Math.floor(Date.now() / 1000) : 36000;
    if (expiresIn <= 0) {
      console.warn("[auth] Static TONAL_API_TOKEN is expired");
      return null;
    }
    // Cache with correct expiry
    cachedToken = staticToken;
    tokenExpiresAt = Date.now() + expiresIn * 1000;
    return staticToken;
  } catch {
    cachedToken = staticToken;
    tokenExpiresAt = Date.now() + 36000 * 1000;
    return staticToken;
  }
}

async function auth0TokenRequest(body: Record<string, string>): Promise<Auth0TokenResponse> {
  const res = await fetch(`${AUTH0_DOMAIN}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Auth0 token request failed (${res.status}): ${text}`);
  }

  return (await res.json()) as Auth0TokenResponse;
}

async function requestToken(): Promise<string> {
  const credentials = getCredentials();

  if (!credentials) {
    const token = getStaticToken();
    if (token) return token;
    throw new Error(
      "No Tonal credentials configured. Set TONAL_EMAIL + TONAL_PASSWORD, or TONAL_API_TOKEN.",
    );
  }

  // Try refresh token first
  if (refreshToken) {
    try {
      const resp = await auth0TokenRequest({
        grant_type: "refresh_token",
        client_id: CLIENT_ID,
        refresh_token: refreshToken,
      });
      // Tonal API uses the id_token (JWT) as bearer, not the opaque access_token
      const token = resp.id_token ?? resp.access_token;
      if (resp.refresh_token) refreshToken = resp.refresh_token;
      return token;
    } catch {
      refreshToken = null;
    }
  }

  // Auth0 password-realm grant — works on Tonal's tenant (standard ROPG does not)
  try {
    const resp = await auth0TokenRequest({
      grant_type: "http://auth0.com/oauth/grant-type/password-realm",
      client_id: CLIENT_ID,
      username: credentials.email,
      password: credentials.password,
      realm: REALM,
      scope: "openid profile email offline_access",
    });

    // Tonal API expects the id_token (RS256 JWT), not the access_token (JWE)
    const token = resp.id_token ?? resp.access_token;
    if (resp.refresh_token) refreshToken = resp.refresh_token;
    console.log(`[auth] Obtained token via password-realm (expires in ${resp.expires_in}s)`);
    return token;
  } catch (err) {
    console.warn(
      `[auth] password-realm failed (${err instanceof Error ? err.message : err}), trying static token fallback`,
    );
    const token = getStaticToken();
    if (token) return token;
    throw err;
  }
}

/**
 * Returns a valid bearer token for the Tonal API, auto-refreshing as needed.
 * Uses Auth0 password-realm grant with TONAL_EMAIL/TONAL_PASSWORD,
 * falling back to TONAL_API_TOKEN if credentials aren't set.
 */
export async function getAccessToken(): Promise<string> {
  const bufferMs = 5 * 60 * 1000; // refresh 5 minutes before expiry

  if (cachedToken && Date.now() < tokenExpiresAt - bufferMs) {
    return cachedToken;
  }

  const token = await requestToken();
  cachedToken = token;

  // Parse JWT expiry if possible, otherwise use default
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    if (payload.exp) {
      tokenExpiresAt = payload.exp * 1000;
    } else {
      tokenExpiresAt = Date.now() + 86400 * 1000; // 24h default
    }
  } catch {
    tokenExpiresAt = Date.now() + 86400 * 1000;
  }

  return cachedToken;
}

/**
 * Clears the cached token, forcing a re-fetch on next call.
 */
export function invalidateToken(): void {
  cachedToken = null;
  tokenExpiresAt = 0;
}
