import { afterEach, describe, expect, it, vi } from "vitest";
import { garminWebhookFailureStatus, verifyGarminWebhookSignature } from "./webhookSignature";

describe("verifyGarminWebhookSignature", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts a non-empty body with the configured query secret", async () => {
    vi.stubEnv("GARMIN_WEBHOOK_SECRET", "secret-1");
    const req = new Request("https://example.com/garmin/webhook/activities?secret=secret-1");

    await expect(verifyGarminWebhookSignature(req, "{}")).resolves.toEqual({ valid: true });
  });

  it("accepts the configured header secret for manual replay tools", async () => {
    vi.stubEnv("GARMIN_WEBHOOK_SECRET", "secret-1");
    const req = new Request("https://example.com/garmin/webhook/activities", {
      headers: { "x-roni-garmin-webhook-secret": "secret-1" },
    });

    await expect(verifyGarminWebhookSignature(req, "{}")).resolves.toEqual({ valid: true });
  });

  it("trims the configured secret before comparing", async () => {
    vi.stubEnv("GARMIN_WEBHOOK_SECRET", " secret-1 ");
    const req = new Request("https://example.com/garmin/webhook/activities?secret=secret-1");

    await expect(verifyGarminWebhookSignature(req, "{}")).resolves.toEqual({ valid: true });
  });

  it("rejects when GARMIN_WEBHOOK_SECRET is unset", async () => {
    const req = new Request("https://example.com/garmin/webhook/activities");
    await expect(verifyGarminWebhookSignature(req, "{}")).resolves.toEqual({
      valid: false,
      reason: "Garmin webhook secret is not configured",
    });
  });

  it("rejects when the provided secret does not match", async () => {
    const req = new Request("https://example.com/garmin/webhook/activities");
    vi.stubEnv("GARMIN_WEBHOOK_SECRET", "secret-1");
    await expect(verifyGarminWebhookSignature(req, "{}")).resolves.toEqual({
      valid: false,
      reason: "Invalid Garmin webhook secret",
    });
  });

  it("allows unsigned dev webhooks only when explicitly enabled and no secret is configured", async () => {
    vi.stubEnv("GARMIN_ALLOW_UNAUTHENTICATED_WEBHOOKS", "true");
    const req = new Request("https://example.com/garmin/webhook/activities");

    await expect(verifyGarminWebhookSignature(req, "{}")).resolves.toEqual({ valid: true });

    vi.stubEnv("GARMIN_WEBHOOK_SECRET", "secret-1");
    await expect(verifyGarminWebhookSignature(req, "{}")).resolves.toEqual({
      valid: false,
      reason: "Invalid Garmin webhook secret",
    });
  });

  it("rejects empty bodies before checking the secret", async () => {
    vi.stubEnv("GARMIN_WEBHOOK_SECRET", "secret-1");
    const req = new Request("https://example.com/garmin/webhook/activities?secret=secret-1");

    await expect(verifyGarminWebhookSignature(req, "")).resolves.toEqual({
      valid: false,
      reason: "Empty Garmin webhook body",
    });
  });

  it("maps malformed empty requests to bad request and auth failures to unauthorized", () => {
    expect(garminWebhookFailureStatus("Empty Garmin webhook body")).toBe(400);
    expect(garminWebhookFailureStatus("Garmin webhook secret is not configured")).toBe(500);
    expect(garminWebhookFailureStatus("Invalid Garmin webhook secret")).toBe(401);
  });
});
