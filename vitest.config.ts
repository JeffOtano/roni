import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary"],
      include: ["convex/**/*.ts", "src/**/*.{ts,tsx}"],
      exclude: [
        "convex/_generated/**",
        "src/components/ui/**",
        "**/*.test.{ts,tsx}",
        "**/*.config.{ts,mjs}",
      ],
    },
  },
});
