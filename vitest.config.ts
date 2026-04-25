import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["lcov", "text", "text-summary"],
      include: ["convex/**/*.ts", "src/**/*.{ts,tsx}"],
      exclude: [
        "convex/_generated/**",
        "src/components/ui/**",
        "**/*.test.{ts,tsx}",
        "**/*.config.{ts,mjs}",
      ],
      thresholds: {
        statements: 23,
        branches: 19,
        functions: 20,
        lines: 23,
      },
    },
    projects: [
      {
        test: {
          name: "backend-integration",
          globals: true,
          environment: "edge-runtime",
          include: [
            "convex/**/backfillIntegration.test.ts",
            "convex/**/backfillNextTonalSyncAt.test.ts",
            "convex/**/historySync.test.ts",
            "convex/**/historySyncMutations.test.ts",
            "convex/**/syncQueries.test.ts",
          ],
        },
      },
      {
        test: {
          name: "backend",
          globals: true,
          environment: "node",
          include: ["convex/**/*.test.ts"],
          exclude: [
            "convex/**/backfillIntegration.test.ts",
            "convex/**/backfillNextTonalSyncAt.test.ts",
            "convex/**/historySync.test.ts",
            "convex/**/historySyncMutations.test.ts",
            "convex/**/syncQueries.test.ts",
          ],
        },
      },
      {
        test: {
          name: "frontend",
          globals: true,
          environment: "jsdom",
          include: ["src/**/*.test.{ts,tsx}"],
          setupFiles: ["src/test-setup.ts"],
        },
        resolve: {
          alias: {
            "@": path.resolve(__dirname, "src"),
          },
        },
      },
      {
        test: {
          name: "scripts",
          globals: true,
          environment: "node",
          include: ["scripts/**/*.test.ts"],
        },
      },
    ],
  },
});
