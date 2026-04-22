/**
 * Garmin OAuth 1.0a app-level credentials + per-user token encryption.
 *
 * Consumer key/secret are issued by Garmin's Developer Portal and held
 * in env vars. Per-user access token + access token secret are encrypted
 * with the same `TOKEN_ENCRYPTION_KEY` used for Tonal — AES-GCM 256.
 */

import { decrypt, encrypt } from "../tonal/encryption";

export interface GarminAppConfig {
  consumerKey: string;
  consumerSecret: string;
  /** Garmin redirects here at the end of the 3-legged handshake. */
  callbackUrl: string;
}

/**
 * Read Garmin app credentials from env. Throws at call time (not module
 * load) so workspaces without Garmin configured can still import Garmin
 * code paths that are never exercised.
 */
export function getGarminAppConfig(): GarminAppConfig {
  const consumerKey = process.env.GARMIN_CONSUMER_KEY;
  const consumerSecret = process.env.GARMIN_CONSUMER_SECRET;
  const callbackUrl = process.env.GARMIN_OAUTH_CALLBACK_URL;
  if (!consumerKey || !consumerSecret || !callbackUrl) {
    throw new Error(
      "Garmin is not configured: set GARMIN_CONSUMER_KEY, GARMIN_CONSUMER_SECRET, GARMIN_OAUTH_CALLBACK_URL",
    );
  }
  return { consumerKey, consumerSecret, callbackUrl };
}

function getEncryptionKey(): string {
  const keyHex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!keyHex) throw new Error("TOKEN_ENCRYPTION_KEY env var is not set");
  return keyHex;
}

export async function encryptGarminSecret(plaintext: string): Promise<string> {
  return encrypt(plaintext, getEncryptionKey());
}

export async function decryptGarminSecret(ciphertext: string): Promise<string> {
  return decrypt(ciphertext, getEncryptionKey());
}
