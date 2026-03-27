import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { ResendOTP } from "./ResendOTP";

// Must match BETA_SPOT_LIMIT in userProfiles.ts (canSignUp query).
const BETA_SPOT_LIMIT = 50;

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [
    Password({
      reset: ResendOTP(),
    }),
  ],
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      // Allow existing users to sign in
      if (args.existingUserId) return args.existingUserId;

      // Safety net: block new signups when beta is full.
      // The client should check userProfiles:canSignUp BEFORE attempting
      // registration to avoid orphaned authAccounts entries. This check
      // is a last resort - if it throws, @convex-dev/auth has already
      // created an authAccounts entry that becomes orphaned.
      const realUserCount = (await ctx.db.query("userProfiles").collect()).length;
      if (realUserCount >= BETA_SPOT_LIMIT) {
        throw new Error(
          `Beta is full! All ${BETA_SPOT_LIMIT} free spots have been claimed. Sign up for the waitlist at our Discord.`,
        );
      }

      // Default behavior: create the user
      const userId = await ctx.db.insert("users", {
        ...(args.profile.email ? { email: args.profile.email } : {}),
        ...(args.profile.name ? { name: args.profile.name as string } : {}),
      });
      return userId;
    },
  },
});
