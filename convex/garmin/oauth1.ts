/**
 * OAuth 1.0a HMAC-SHA1 request signing (RFC 5849).
 *
 * Garmin Connect Training API and Activity API require every request to
 * be signed with the consumer secret + user access token secret. There is
 * no refresh flow; access tokens do not expire. Revocations surface as
 * 401/403 on API calls.
 *
 * Runs in the default Convex runtime — uses Web Crypto, no Node built-ins.
 */

export interface OAuth1Credentials {
  consumerKey: string;
  consumerSecret: string;
  /** User access token. Omitted for the request-token step. */
  token?: string;
  /** User access token secret. Empty string for the request-token step. */
  tokenSecret?: string;
}

export interface SignRequestOptions {
  method: string;
  /** Full URL including query string. Query params participate in the signature. */
  url: string;
  /**
   * Additional params that participate in the signature base string but
   * are not part of the query string. Use for OAuth extras like
   * `oauth_callback`, `oauth_verifier`, or `application/x-www-form-urlencoded`
   * body params. JSON bodies contribute no params.
   *
   * Keys starting with `oauth_` are also emitted in the Authorization header.
   */
  extraSignableParams?: Record<string, string>;
  /** Override for deterministic tests. */
  nonce?: string;
  /** Unix seconds as a string. Override for deterministic tests. */
  timestamp?: string;
}

export interface SignedRequest {
  /** Authorization header value, e.g. `OAuth oauth_consumer_key="...", ...`. */
  authorizationHeader: string;
}

const UNRESERVED = /[A-Za-z0-9\-._~]/;
const RESERVED_OAUTH_PARAM_NAMES = new Set([
  "oauth_consumer_key",
  "oauth_nonce",
  "oauth_signature_method",
  "oauth_timestamp",
  "oauth_version",
  "oauth_token",
]);

/**
 * RFC 3986 percent-encoding. `encodeURIComponent` is close but leaves
 * `!*'()` unencoded and encodes some chars differently from OAuth's
 * expectation, so we post-process.
 */
export function rfc3986Encode(input: string): string {
  let out = "";
  for (const ch of input) {
    if (ch.length === 1 && UNRESERVED.test(ch)) {
      out += ch;
    } else {
      for (const byte of new TextEncoder().encode(ch)) {
        out += "%" + byte.toString(16).toUpperCase().padStart(2, "0");
      }
    }
  }
  return out;
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function generateNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

function toArrayBuffer(src: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(src);
  const buf = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buf).set(bytes);
  return buf;
}

async function hmacSha1Base64(key: string, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(key),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, toArrayBuffer(message));
  return bufferToBase64(sig);
}

/**
 * Build the signature base string and Authorization header for an OAuth
 * 1.0a HMAC-SHA1 request. Returned `authorizationHeader` is meant to be
 * sent as-is in the `Authorization` HTTP header.
 */
export async function signOAuth1Request(
  creds: OAuth1Credentials,
  opts: SignRequestOptions,
): Promise<SignedRequest> {
  const upperMethod = opts.method.toUpperCase();
  const parsed = new URL(opts.url);
  const baseUrl = `${parsed.protocol}//${parsed.host.toLowerCase()}${parsed.pathname}`;

  const params: [string, string][] = [
    ["oauth_consumer_key", creds.consumerKey],
    ["oauth_nonce", opts.nonce ?? generateNonce()],
    ["oauth_signature_method", "HMAC-SHA1"],
    ["oauth_timestamp", opts.timestamp ?? Math.floor(Date.now() / 1000).toString()],
    ["oauth_version", "1.0"],
  ];
  if (creds.token) params.push(["oauth_token", creds.token]);
  for (const [k, v] of Object.entries(opts.extraSignableParams ?? {})) {
    if (RESERVED_OAUTH_PARAM_NAMES.has(k)) {
      throw new Error(`OAuth parameter ${k} is managed by signOAuth1Request`);
    }
    params.push([k, v]);
  }
  for (const [k, v] of parsed.searchParams.entries()) {
    params.push([k, v]);
  }

  const encoded = params.map(([k, v]) => [rfc3986Encode(k), rfc3986Encode(v)] as const);
  encoded.sort((a, b) =>
    a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0,
  );
  const paramString = encoded.map(([k, v]) => `${k}=${v}`).join("&");

  const signatureBaseString = `${upperMethod}&${rfc3986Encode(baseUrl)}&${rfc3986Encode(paramString)}`;
  const signingKey = `${rfc3986Encode(creds.consumerSecret)}&${rfc3986Encode(
    creds.tokenSecret ?? "",
  )}`;
  const signature = await hmacSha1Base64(signingKey, signatureBaseString);

  const headerEntries: [string, string][] = [];
  for (const [k, v] of params) {
    if (k.startsWith("oauth_")) headerEntries.push([k, v]);
  }
  headerEntries.push(["oauth_signature", signature]);
  headerEntries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

  const headerParams = headerEntries
    .map(([k, v]) => `${rfc3986Encode(k)}="${rfc3986Encode(v)}"`)
    .join(", ");

  return { authorizationHeader: `OAuth ${headerParams}` };
}
