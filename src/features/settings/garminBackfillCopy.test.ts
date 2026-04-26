import { describe, expect, it } from "vitest";
import { formatGarminBackfillNotice } from "./garminBackfillCopy";

describe("formatGarminBackfillNotice", () => {
  it("formats accepted summaries as a success notice", () => {
    const notice = formatGarminBackfillNotice(30, {
      accepted: ["activities", "dailies", "sleeps"],
      rejected: [],
    });

    expect(notice).toEqual({
      kind: "success",
      message:
        "Queued 30d Garmin sync for activities, daily wellness, sleep. Data will arrive over the next few minutes.",
    });
  });

  it("formats rate-limited recovery details as a warning without calling them rejected", () => {
    const notice = formatGarminBackfillNotice(30, {
      accepted: ["activities", "dailies", "sleeps"],
      rateLimited: [
        { summaryType: "stressDetails", retryAfterSeconds: 75 },
        { summaryType: "hrv" },
      ],
      rejected: [],
    });

    expect(notice.kind).toBe("warning");
    expect(notice.message).toContain("Queued 30d Garmin sync");
    expect(notice.message).toContain("Garmin rate-limited stress, HRV");
    expect(notice.message).toContain("in about 2m");
    expect(notice.message).not.toContain("Rejected");
  });

  it("reports hard failures as errors when nothing queued", () => {
    const notice = formatGarminBackfillNotice(30, {
      accepted: [],
      rejected: [{ summaryType: "activities", status: 500 }],
    });

    expect(notice).toEqual({
      kind: "error",
      message: "Could not queue activities (500).",
    });
  });
});
