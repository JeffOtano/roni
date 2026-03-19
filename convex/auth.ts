import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { ResendOTP } from "./ResendOTP";

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

      // Block new signups when beta is full
      const userCount = (await ctx.db.query("users").collect()).length;
      if (userCount >= BETA_SPOT_LIMIT) {
        throw new Error(
          "Beta is full! All 50 free spots have been claimed. Sign up for the waitlist at our Discord.",
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
