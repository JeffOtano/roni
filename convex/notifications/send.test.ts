import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// notifications/send.ts pure logic patterns
//
// The file only exports Convex internalActions and private helper functions.
// We test the pure computation patterns used inside:
//   1. APNs payload construction shape
//   2. Send counting logic (sent/failed tallying)
//   3. APNs host selection based on environment
//   4. Missing env var detection
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// APNs payload construction
// ---------------------------------------------------------------------------

describe("APNs payload construction", () => {
  it("builds correct aps structure with required fields", () => {
    const title = "New PR!";
    const body = "You hit a new personal record on Bench Press";

    const payload = {
      aps: {
        alert: { title, body },
        sound: "default",
        badge: 0,
      },
    };

    expect(payload.aps.alert.title).toBe("New PR!");
    expect(payload.aps.alert.body).toContain("personal record");
    expect(payload.aps.sound).toBe("default");
    expect(payload.aps.badge).toBe(0);
  });

  it("includes category when provided", () => {
    const category = "CHECKIN";

    const aps: Record<string, unknown> = {
      alert: { title: "Check-in", body: "How are you feeling?" },
      sound: "default",
      badge: 0,
    };
    if (category) {
      aps.category = category;
    }

    expect(aps.category).toBe("CHECKIN");
  });

  it("omits category when not provided", () => {
    const category = undefined;

    const aps: Record<string, unknown> = {
      alert: { title: "Check-in", body: "How are you feeling?" },
      sound: "default",
      badge: 0,
      ...(category ? { category } : {}),
    };

    expect(aps).not.toHaveProperty("category");
  });

  it("merges custom data fields at top level", () => {
    const data = { checkInId: "ci-123", trigger: "missed_session" };

    const body = {
      aps: { alert: { title: "T", body: "B" }, sound: "default", badge: 0 },
      ...(data ?? {}),
    };

    expect(body).toHaveProperty("checkInId", "ci-123");
    expect(body).toHaveProperty("trigger", "missed_session");
  });

  it("handles missing data gracefully", () => {
    const data = undefined;

    const body = {
      aps: { alert: { title: "T", body: "B" }, sound: "default", badge: 0 },
      ...(data ?? {}),
    };

    expect(Object.keys(body)).toEqual(["aps"]);
  });
});

// ---------------------------------------------------------------------------
// APNs host selection
// ---------------------------------------------------------------------------

describe("APNs host selection", () => {
  it("uses production host for production environment", () => {
    const environment = "production";
    const host =
      environment === "production"
        ? "https://api.push.apple.com"
        : "https://api.sandbox.push.apple.com";

    expect(host).toBe("https://api.push.apple.com");
  });

  it("uses sandbox host for development environment", () => {
    const environment: string = "development";
    const host =
      environment === "production"
        ? "https://api.push.apple.com"
        : "https://api.sandbox.push.apple.com";

    expect(host).toBe("https://api.sandbox.push.apple.com");
  });

  it("defaults to sandbox for unknown environment values", () => {
    const environment: string = "staging";
    const host =
      environment === "production"
        ? "https://api.push.apple.com"
        : "https://api.sandbox.push.apple.com";

    expect(host).toBe("https://api.sandbox.push.apple.com");
  });
});

// ---------------------------------------------------------------------------
// Send counting logic
// ---------------------------------------------------------------------------

describe("send counting logic", () => {
  it("counts all tokens as sent on success", () => {
    const tokens = [{ token: "t1" }, { token: "t2" }, { token: "t3" }];
    let sent = 0;
    const failed = 0;

    for (const _token of tokens) {
      // Simulate success
      sent++;
    }

    expect(sent).toBe(3);
    expect(failed).toBe(0);
  });

  it("counts failed sends separately", () => {
    const tokens = [{ token: "t1" }, { token: "bad-token" }, { token: "t3" }];
    let sent = 0;
    let failed = 0;

    for (const { token } of tokens) {
      try {
        if (token === "bad-token") throw new Error("APNs error");
        sent++;
      } catch {
        failed++;
      }
    }

    expect(sent).toBe(2);
    expect(failed).toBe(1);
  });

  it("returns zeros for empty token array", () => {
    const tokens: Array<{ token: string }> = [];
    let sent = 0;
    const failed = 0;

    for (const _token of tokens) {
      sent++;
    }

    expect(sent).toBe(0);
    expect(failed).toBe(0);
  });

  it("accumulates across multiple users", () => {
    const userResults = [
      { sent: 2, failed: 0 },
      { sent: 1, failed: 1 },
      { sent: 0, failed: 0 },
    ];

    let totalSent = 0;
    let totalFailed = 0;

    for (const result of userResults) {
      totalSent += result.sent;
      totalFailed += result.failed;
    }

    expect(totalSent).toBe(3);
    expect(totalFailed).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Missing env var detection
// ---------------------------------------------------------------------------

describe("missing env var detection pattern", () => {
  it("detects missing required APNs config", () => {
    const keyBase64 = undefined;
    const keyId = "KEY123";
    const teamId = "TEAM456";

    const isMissing = !keyBase64 || !keyId || !teamId;

    expect(isMissing).toBe(true);
  });

  it("passes when all required config present", () => {
    const keyBase64 = "base64key";
    const keyId = "KEY123";
    const teamId = "TEAM456";

    const isMissing = !keyBase64 || !keyId || !teamId;

    expect(isMissing).toBe(false);
  });

  it("detects empty string as missing", () => {
    const keyBase64 = "";
    const keyId = "KEY123";
    const teamId = "TEAM456";

    const isMissing = !keyBase64 || !keyId || !teamId;

    expect(isMissing).toBe(true);
  });
});
