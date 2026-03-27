import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { ResendOTP } from "./ResendOTP";

const BETA_SPOT_LIMIT = 100;

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

      // Block new signups when beta is full.
      // Count userProfiles (real onboarded users), not the users table
      // which is inflated by @convex-dev/auth system entries.
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
