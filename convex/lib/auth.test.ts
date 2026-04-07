import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock @convex-dev/auth/server before importing the module under test so the
// mock is in place when getEffectiveUserId reaches for getAuthUserId.
const getAuthUserIdMock = vi.fn();
vi.mock("@convex-dev/auth/server", () => ({
  getAuthUserId: (...args: unknown[]) => getAuthUserIdMock(...args),
}));

// Import after the mock is registered.
import { getEffectiveUserId } from "./auth";

// ---------------------------------------------------------------------------
// Test ctx builder
// ---------------------------------------------------------------------------

type FakeUser = {
  _id: string;
  isAdmin?: boolean;
  impersonatingUserId?: string;
};

function makeCtx(user: FakeUser | null) {
  return {
    db: {
      get: vi.fn(async () => user),
    },
  } as unknown as Parameters<typeof getEffectiveUserId>[0];
}

// ---------------------------------------------------------------------------
// getEffectiveUserId
// ---------------------------------------------------------------------------

describe("getEffectiveUserId", () => {
  beforeEach(() => {
    getAuthUserIdMock.mockReset();
  });

  it("returns null when there is no authenticated user", async () => {
    getAuthUserIdMock.mockResolvedValue(null);
    const ctx = makeCtx(null);

    const result = await getEffectiveUserId(ctx);

    expect(result).toBeNull();
  });

  it("returns the authenticated user's own id for a normal user", async () => {
    getAuthUserIdMock.mockResolvedValue("user-normal");
    const ctx = makeCtx({ _id: "user-normal" });

    const result = await getEffectiveUserId(ctx);

    expect(result).toBe("user-normal");
  });

  it("returns the admin's own id even when impersonatingUserId is set (impersonation removed)", async () => {
    // Regression guard for the open-source release: the admin impersonation
    // backdoor was removed from getEffectiveUserId. Even if a stale row in the
    // users table still carries impersonatingUserId, we must return the
    // authenticated admin's own id, never the impersonated id.
    getAuthUserIdMock.mockResolvedValue("user-admin");
    const ctx = makeCtx({
      _id: "user-admin",
      isAdmin: true,
      impersonatingUserId: "user-victim",
    });

    const result = await getEffectiveUserId(ctx);

    expect(result).toBe("user-admin");
    expect(result).not.toBe("user-victim");
  });

  it("returns the admin's own id when isAdmin is true with no impersonation set", async () => {
    getAuthUserIdMock.mockResolvedValue("user-admin");
    const ctx = makeCtx({ _id: "user-admin", isAdmin: true });

    const result = await getEffectiveUserId(ctx);

    expect(result).toBe("user-admin");
  });
});
