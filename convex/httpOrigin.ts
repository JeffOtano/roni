type AppOriginEnv = {
  GARMIN_OAUTH_POST_REDIRECT_URL?: string;
  NODE_ENV?: string;
  SITE_URL?: string;
  VERCEL_ENV?: string;
};

function isProductionEnv(env: AppOriginEnv): boolean {
  return env.NODE_ENV === "production" || env.VERCEL_ENV === "production";
}

/**
 * Resolve the Next.js app origin (e.g. `http://localhost:3000`) from
 * configured post-oauth redirect URLs.
 */
export function resolveAppOrigin(env: AppOriginEnv = process.env): string {
  const redirects = [env.GARMIN_OAUTH_POST_REDIRECT_URL, env.SITE_URL];
  for (const redirect of redirects) {
    if (!redirect) continue;
    try {
      return new URL(redirect).origin;
    } catch {
      // Try the next configured URL.
    }
  }

  if (isProductionEnv(env)) {
    throw new Error("GARMIN_OAUTH_POST_REDIRECT_URL or SITE_URL must be configured");
  }

  return "http://localhost:3000";
}
