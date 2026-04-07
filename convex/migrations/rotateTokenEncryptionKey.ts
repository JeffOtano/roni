/**
 * TOKEN_ENCRYPTION_KEY rotation migration.
 *
 * One-shot internal mutation run manually on launch day. Walks every row in
 * userProfiles and re-encrypts the Tonal OAuth tokens, Google Calendar OAuth
 * tokens, and BYOK Gemini API keys with a new TOKEN_ENCRYPTION_KEY.
 *
 * Operator procedure:
 *
 * 1. Back up the prod Convex database first: `npx convex export --path <file>.zip`
 * 2. Set the OLD key in Convex env:
 *    `npx convex env set TOKEN_ENCRYPTION_KEY_OLD <current-key>`
 * 3. Set the NEW key in Convex env:
 *    `npx convex env set TOKEN_ENCRYPTION_KEY <new-key>`
 * 4. Run the migration:
 *    `npx convex run migrations/rotateTokenEncryptionKey:run`
 * 5. Verify the output: `{ rotated: <n>, skipped: 0, errors: [] }`
 * 6. Smoke test: log in as a user and verify their Tonal data loads (tests
 *    that their token decrypted successfully with the new key).
 * 7. Unset the OLD key: `npx convex env remove TOKEN_ENCRYPTION_KEY_OLD`
 *
 * PROGRESS_PHOTOS_ENCRYPTION_KEY is rotated separately via Task 5.2's
 * migration. This one only handles the TOKEN_ENCRYPTION_KEY domain.
 */
import { internalMutation } from "../_generated/server";
import { decrypt, encrypt } from "../tonal/encryption";

type EncryptedProfileFields = {
  tonalToken: string;
  tonalRefreshToken?: string;
  googleCalendarToken?: string;
  googleCalendarRefreshToken?: string;
  geminiApiKeyEncrypted?: string;
};

/**
 * Pure helper: takes the encrypted fields from a profile row and returns the
 * re-encrypted fields. Throws on decrypt failure so the caller can decide
 * whether to swallow (the migration below counts it as a skipped row).
 */
export async function rotateProfileFields(
  fields: EncryptedProfileFields,
  oldKey: string,
  newKey: string,
): Promise<EncryptedProfileFields> {
  const tonalPlain = await decrypt(fields.tonalToken, oldKey);
  const result: EncryptedProfileFields = {
    tonalToken: await encrypt(tonalPlain, newKey),
  };

  if (fields.tonalRefreshToken !== undefined) {
    const plain = await decrypt(fields.tonalRefreshToken, oldKey);
    result.tonalRefreshToken = await encrypt(plain, newKey);
  }
  if (fields.googleCalendarToken !== undefined) {
    const plain = await decrypt(fields.googleCalendarToken, oldKey);
    result.googleCalendarToken = await encrypt(plain, newKey);
  }
  if (fields.googleCalendarRefreshToken !== undefined) {
    const plain = await decrypt(fields.googleCalendarRefreshToken, oldKey);
    result.googleCalendarRefreshToken = await encrypt(plain, newKey);
  }
  if (fields.geminiApiKeyEncrypted !== undefined) {
    const plain = await decrypt(fields.geminiApiKeyEncrypted, oldKey);
    result.geminiApiKeyEncrypted = await encrypt(plain, newKey);
  }

  return result;
}

export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    const oldKey = process.env.TOKEN_ENCRYPTION_KEY_OLD;
    const newKey = process.env.TOKEN_ENCRYPTION_KEY;

    if (!oldKey) {
      throw new Error("TOKEN_ENCRYPTION_KEY_OLD must be set for rotation");
    }
    if (!newKey) {
      throw new Error("TOKEN_ENCRYPTION_KEY must be set for rotation");
    }
    if (oldKey === newKey) {
      throw new Error("TOKEN_ENCRYPTION_KEY_OLD and TOKEN_ENCRYPTION_KEY must differ");
    }

    const profiles = await ctx.db.query("userProfiles").collect();
    let rotated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const profile of profiles) {
      try {
        const newFields = await rotateProfileFields(
          {
            tonalToken: profile.tonalToken,
            tonalRefreshToken: profile.tonalRefreshToken,
            googleCalendarToken: profile.googleCalendarToken,
            googleCalendarRefreshToken: profile.googleCalendarRefreshToken,
            geminiApiKeyEncrypted: profile.geminiApiKeyEncrypted,
          },
          oldKey,
          newKey,
        );
        await ctx.db.patch(profile._id, newFields);
        rotated += 1;
      } catch (err) {
        skipped += 1;
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`${profile._id}: ${message}`);
      }
    }

    return { rotated, skipped, errors };
  },
});
