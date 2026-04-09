import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { ResendOTP } from "./ResendOTP";
import { rateLimiter } from "./rateLimits";

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [
    Password({
      reset: ResendOTP(),
    }),
  ],
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      // Blunt abuse deterrent. Only run on actual account creation, not on
      // updates to an existing user. If the global bucket is empty, the
      // caller sees a clear rate-limit error and the auth library rolls
      // back the half-created auth account (which is why we throw before
      // inserting the users row).
      if (args.existingUserId === null) {
        await rateLimiter.limit(ctx, "newSignup", { throws: true });
      }

      const userId = await ctx.db.insert("users", {
        ...(args.profile.email ? { email: args.profile.email } : {}),
        ...(args.profile.name ? { name: args.profile.name as string } : {}),
      });
      return userId;
    },
  },
});
