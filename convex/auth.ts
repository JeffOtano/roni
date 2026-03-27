import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { ResendOTP } from "./ResendOTP";
import { shouldBlockSignup } from "./betaConfig";

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [
    Password({
      reset: ResendOTP(),
    }),
  ],
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      // Safety net: block new signups when beta is full.
      // The client should check userProfiles:canSignUp BEFORE attempting
      // registration to avoid orphaned authAccounts entries. This check
      // is a last resort - if it throws, @convex-dev/auth has already
      // created an authAccounts entry that becomes orphaned.
      const profileCount = (await ctx.db.query("userProfiles").collect()).length;
      const blocked = shouldBlockSignup(args.existingUserId, profileCount);
      if (blocked) throw new Error(blocked);

      // Default behavior: create the user
      const userId = await ctx.db.insert("users", {
        ...(args.profile.email ? { email: args.profile.email } : {}),
        ...(args.profile.name ? { name: args.profile.name as string } : {}),
      });
      return userId;
    },
  },
});
