// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { getSentryRuntimeConfig } from "./src/lib/deployment";

const sentryConfig = getSentryRuntimeConfig({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.SENTRY_TRACES_SAMPLE_RATE,
});

if (sentryConfig) {
  Sentry.init({
    ...sentryConfig,
    enableLogs: false,
    sendDefaultPii: false,
  });
}
