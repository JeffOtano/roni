// See spike-findings.md "Operator runbook: encryption key rotation" for the full procedure.
import { internalMutation } from "../_generated/server";
import { decrypt, encrypt } from "../tonal/encryption";

type EncryptedProfileFields = {
  tonalToken: string;
  tonalRefreshToken?: string;
  geminiApiKeyEncrypted?: string;
};

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
