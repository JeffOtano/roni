type OptionalString = string | undefined;

type SentryRuntimeConfig = {
  dsn: string;
  tracesSampleRate: number;
  replaysOnErrorSampleRate: number;
  replaysSessionSampleRate: number;
};

function hasValue(value: OptionalString): value is string {
  return value !== undefined && value.trim().length > 0;
}

function parseSampleRate(value: OptionalString, fallback: number): number {
  if (!hasValue(value)) return fallback;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    return fallback;
  }

  return parsed;
}

export function getSentryRuntimeConfig(options: {
  dsn: OptionalString;
  tracesSampleRate?: OptionalString;
  replaysOnErrorSampleRate?: OptionalString;
  replaysSessionSampleRate?: OptionalString;
}): SentryRuntimeConfig | null {
  if (!hasValue(options.dsn)) return null;

  return {
    dsn: options.dsn,
    tracesSampleRate: parseSampleRate(options.tracesSampleRate, 0),
    replaysOnErrorSampleRate: parseSampleRate(options.replaysOnErrorSampleRate, 0),
    replaysSessionSampleRate: parseSampleRate(options.replaysSessionSampleRate, 0),
  };
}

export function isContactFormEnabled(value: OptionalString): boolean {
  return value === "true";
}

export function shouldUseSentryBuildPlugin(options: {
  authToken: OptionalString;
  org: OptionalString;
  project: OptionalString;
}): boolean {
  return hasValue(options.authToken) && hasValue(options.org) && hasValue(options.project);
}
