import { describe, expect, it } from "vitest";
import { TonalApiError } from "./client";
import { enrichPushErrorMessage } from "./mutations";

function simulatePushErrorResult(
  err: unknown,
  title: string,
  movementIds: string[],
): { error: string } {
  if (err instanceof TonalApiError && err.status === 401) throw err;
  const errMsg = err instanceof Error ? err.message : String(err);
  return { error: enrichPushErrorMessage(errMsg, title, movementIds) };
}

describe("pushWorkoutToTonal error handling", () => {
  it("still throws TonalApiError 401 so withTokenRetry can refresh the token", () => {
    const original = new TonalApiError(401, "token is expired by 33s");

    expect(() => simulatePushErrorResult(original, "Full body", ["m1"])).toThrow(TonalApiError);
    expect(() => simulatePushErrorResult(original, "Full body", ["m1"])).toThrow(
      expect.objectContaining({ status: 401 }),
    );
  });

  it("returns structured errors for non-401 Tonal failures", () => {
    const original = new TonalApiError(500, '{"message":"","status":500}');

    const result = simulatePushErrorResult(original, "Leg Day", ["m1"]);

    expect(result).not.toBeInstanceOf(Error);
    expect(result.error).toContain("Leg Day");
    expect(result.error).toContain("500");
  });
});
