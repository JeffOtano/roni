import { describe, expect, it } from "vitest";
import {
  getSentryRuntimeConfig,
  isContactFormEnabled,
  shouldUseSentryBuildPlugin,
} from "./deployment";

describe("getSentryRuntimeConfig", () => {
  it("returns null when no DSN is configured", () => {
    expect(getSentryRuntimeConfig({ dsn: "" })).toBeNull();
  });

  it("uses conservative defaults when optional sample rates are missing", () => {
    expect(
      getSentryRuntimeConfig({
        dsn: "https://examplePublicKey@o0.ingest.sentry.io/0",
      }),
    ).toEqual({
      dsn: "https://examplePublicKey@o0.ingest.sentry.io/0",
      tracesSampleRate: 0,
      replaysOnErrorSampleRate: 0,
      replaysSessionSampleRate: 0,
    });
  });

  it("parses valid sample rates and ignores invalid values", () => {
    expect(
      getSentryRuntimeConfig({
        dsn: "https://examplePublicKey@o0.ingest.sentry.io/0",
        tracesSampleRate: "0.25",
        replaysOnErrorSampleRate: "1",
        replaysSessionSampleRate: "2",
      }),
    ).toEqual({
      dsn: "https://examplePublicKey@o0.ingest.sentry.io/0",
      tracesSampleRate: 0.25,
      replaysOnErrorSampleRate: 1,
      replaysSessionSampleRate: 0,
    });
  });
});

describe("isContactFormEnabled", () => {
  it("only enables the contact form for an explicit true flag", () => {
    expect(isContactFormEnabled("true")).toBe(true);
    expect(isContactFormEnabled("false")).toBe(false);
    expect(isContactFormEnabled(undefined)).toBe(false);
  });
});

describe("shouldUseSentryBuildPlugin", () => {
  it("requires auth token, org, and project", () => {
    expect(
      shouldUseSentryBuildPlugin({
        authToken: "token",
        org: "org",
        project: "project",
      }),
    ).toBe(true);

    expect(
      shouldUseSentryBuildPlugin({
        authToken: undefined,
        org: "org",
        project: "project",
      }),
    ).toBe(false);
  });
});
