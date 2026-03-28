import type { KnipConfig } from "knip";

const config: KnipConfig = {
  entry: ["src/app/**/page.tsx", "src/app/**/layout.tsx", "convex/**/*.ts", "e2e/**/*.spec.ts"],
  project: ["src/**/*.{ts,tsx}", "convex/**/*.ts", "e2e/**/*.ts"],
  ignore: ["src/components/ui/**"],
  ignoreDependencies: [
    "tw-animate-css",
    "shadcn", // CLI tool for adding components
    "tailwindcss", // used via @tailwindcss/postcss
    "postcss", // used via postcss.config.mjs (Knip can't trace)
    // TODO: remove these unused deps from package.json
    "@ai-sdk/anthropic",
    "@ai-sdk/openai",
  ],
};

export default config;
