import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { ResendOTP } from "./ResendOTP";

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [
    Password({
      reset: ResendOTP(),
    }),
  ],
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      // The 50-user beta capacity check was removed with the BYOK open-source
      // release. New users bring their own Gemini key, so there is no cost
      // ceiling to enforce at signup time.
      const userId = await ctx.db.insert("users", {
        ...(args.profile.email ? { email: args.profile.email } : {}),
        ...(args.profile.name ? { name: args.profile.name as string } : {}),
      });
      return userId;
    },
  },
});
