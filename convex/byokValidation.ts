import { encrypt } from "./tonal/encryption";

export type GeminiValidationResult =
  | { valid: true }
  | {
      valid: false;
      reason: "invalid_key" | "quota_exceeded" | "network_error" | "unknown";
    };

const GEMINI_LIST_MODELS_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_KEY_VALIDATION_TIMEOUT_MS = 5_000;

export async function validateGeminiKeyAgainstGoogle(
  key: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GeminiValidationResult> {
  let response: Response;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GEMINI_KEY_VALIDATION_TIMEOUT_MS);
  try {
    const url = `${GEMINI_LIST_MODELS_URL}?key=${encodeURIComponent(key)}`;
    response = await fetchImpl(url, { signal: controller.signal });
  } catch {
    // Bare catch: undici fetch errors can include the request URL (which contains the key).
    return { valid: false, reason: "network_error" };
  } finally {
    clearTimeout(timeoutId);
  }

  if (response.ok) {
    return { valid: true };
  }

  if (response.status === 401 || response.status === 403) {
    return { valid: false, reason: "invalid_key" };
  }

  if (response.status === 429) {
    return { valid: false, reason: "quota_exceeded" };
  }

  return { valid: false, reason: "unknown" };
}

const GEMINI_KEY_FORMAT = /^AIza[A-Za-z0-9_-]{35}$/;

export async function prepareGeminiKeyForStorage(
  apiKey: string,
  encryptionKey: string,
): Promise<{ encrypted: string; addedAt: number }> {
  const trimmed = apiKey.trim();
  if (!GEMINI_KEY_FORMAT.test(trimmed)) {
    throw new Error(
      "Invalid Gemini API key format. Keys start with 'AIza' and are 39 characters long.",
    );
  }
  const encrypted = await encrypt(trimmed, encryptionKey);
  return { encrypted, addedAt: Date.now() };
}

export function maskGeminiKey(decrypted: string): string {
  return decrypted.slice(-4);
}
