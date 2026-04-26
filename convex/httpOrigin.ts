type AppOriginEnv = {
  GARMIN_OAUTH_POST_REDIRECT_URL?: string;
  NODE_ENV?: string;
  SITE_URL?: string;
  VERCEL_URL?: string;
  VERCEL_ENV?: string;
};

export const LOCAL_DEV_APP_ORIGIN = "http://localhost:3000";

function isProductionEnv(env: AppOriginEnv): boolean {
  return env.NODE_ENV === "production" || Boolean(env.VERCEL_ENV);
}

function resolveVercelOrigin(env: AppOriginEnv): string | null {
  const raw = env.VERCEL_URL?.trim();
  if (!raw) return null;
  const url = raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
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

  const vercelOrigin = resolveVercelOrigin(env);
  if (vercelOrigin) return vercelOrigin;

  if (isProductionEnv(env)) {
    throw new Error("GARMIN_OAUTH_POST_REDIRECT_URL, SITE_URL, or VERCEL_URL must be configured");
  }

  return LOCAL_DEV_APP_ORIGIN;
}
