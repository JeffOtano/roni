import { describe, expect, it, vi } from "vitest";
import { TonalApiError } from "./client";
import { fetchProjectedFormattedSummary } from "./proxyProjected";

describe("fetchProjectedFormattedSummary", () => {
  it("returns null when Tonal reports a missing formatted summary", async () => {
    const fetchRaw = vi.fn(async () => {
      throw new TonalApiError(404, '{"message":"workout summary does not exist","status":404}');
    });

    const result = await fetchProjectedFormattedSummary(fetchRaw);

    expect(result).toBeNull();
    expect(fetchRaw).toHaveBeenCalledTimes(1);
  });

  it("projects formatted summary payloads", async () => {
    const fetchRaw = vi.fn(async () => ({
      ignored: "field",
      movementSets: [
        { movementId: "movement-1", totalVolume: 1200, extra: "ignored" },
        { movementId: "movement-2", totalVolume: 800 },
      ],
    }));

    const result = await fetchProjectedFormattedSummary(fetchRaw);

    expect(result).toEqual({
      movementSets: [
        { movementId: "movement-1", totalVolume: 1200 },
        { movementId: "movement-2", totalVolume: 800 },
      ],
    });
  });

  it("propagates Tonal errors that are not missing summaries", async () => {
    const error = new TonalApiError(500, "Internal Server Error");
    const fetchRaw = vi.fn(async () => {
      throw error;
    });

    await expect(fetchProjectedFormattedSummary(fetchRaw)).rejects.toBe(error);
  });

  it("propagates non-Tonal errors", async () => {
    const error = new TypeError("fetch failed");
    const fetchRaw = vi.fn(async () => {
      throw error;
    });

    await expect(fetchProjectedFormattedSummary(fetchRaw)).rejects.toBe(error);
  });
});
