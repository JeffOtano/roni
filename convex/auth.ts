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
      // Update path: auth library is linking an existing user (email
      // verification, password reset). Return the existing ID so the
      // authAccount stays pointed at the original user row.
      if (args.existingUserId !== null) {
        return args.existingUserId;
      }

      // Create path: rate-limit before inserting so the auth library
      // rolls back the half-created auth account if the bucket is empty.
      await rateLimiter.limit(ctx, "newSignup", { throws: true });

      return await ctx.db.insert("users", {
        ...(args.profile.email ? { email: args.profile.email } : {}),
        ...(args.profile.name ? { name: args.profile.name as string } : {}),
      });
    },
  },
});
