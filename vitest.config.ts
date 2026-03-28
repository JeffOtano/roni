import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
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
      thresholds: {
        statements: 20,
        branches: 15,
        functions: 17,
        lines: 20,
      },
    },
    projects: [
      {
        test: {
          name: "backend",
          globals: true,
          environment: "node",
          include: ["convex/**/*.test.ts"],
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
    ],
  },
});
