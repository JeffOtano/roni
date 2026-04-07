// Cap was 50 users; removed for the BYOK open-source release.

export function computeBetaCapacity(): {
  allowed: boolean;
  spotsLeft: number;
} {
  return {
    allowed: true,
    spotsLeft: Number.POSITIVE_INFINITY,
  };
}
