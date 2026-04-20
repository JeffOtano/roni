import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { ResendOTP } from "./ResendOTP";
import { rateLimiter } from "./rateLimits";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

type CreateOrUpdateUserArgs = {
  existingUserId: Id<"users"> | null;
  profile: Record<string, unknown> & { email?: string; name?: string };
};

/**
 * Called by `@convex-dev/auth` whenever the library needs to resolve a user
 * for an auth event (sign-up, email-OTP verification, password reset). On the
 * update path (`existingUserId !== null`) we MUST return that existing ID —
 * otherwise the auth library re-points the authAccount at a freshly-inserted
 * row and the user loses access to their data. See #228 for the incident.
 */
export async function createOrUpdateUser(
  ctx: MutationCtx,
  args: CreateOrUpdateUserArgs,
): Promise<Id<"users">> {
  if (args.existingUserId !== null) {
    return args.existingUserId;
  }

  await rateLimiter.limit(ctx, "newSignup", { throws: true });

  return await ctx.db.insert("users", {
    ...(args.profile.email ? { email: args.profile.email } : {}),
    ...(args.profile.name ? { name: args.profile.name } : {}),
  });
}

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [
    Password({
      reset: ResendOTP(),
    }),
  ],
  callbacks: {
    createOrUpdateUser,
  },
});
