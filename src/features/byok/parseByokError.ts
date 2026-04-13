import type { FailureReason } from "./FailureBanner";

const BYOK_ERROR_CODES: readonly FailureReason[] = [
  "byok_key_invalid",
  "byok_quota_exceeded",
  "byok_safety_blocked",
  "byok_unknown_error",
  "byok_key_missing",
  "byok_model_missing",
  "house_key_quota_exhausted",
] as const;

export function parseByokError(err: unknown): FailureReason | null {
  const message = err instanceof Error ? err.message : String(err);
  return BYOK_ERROR_CODES.find((code) => message.includes(code)) ?? null;
}
