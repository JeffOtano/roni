import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "convex/_generated/**"]),
  {
    files: ["**/*.{ts,tsx,js,jsx,mjs}"],
    rules: {
      // File and function size limits (from clean-code-patterns-report)
      "max-lines": ["warn", { max: 300, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": ["warn", { max: 60, skipBlankLines: true, skipComments: true }],

      // Cyclomatic complexity cap
      complexity: ["warn", 10],

      // Max nesting depth (red flag: >3 levels)
      "max-depth": ["warn", 3],

      // Max function parameters (decision tree: >3 positional -> use options object)
      "max-params": ["warn", 4],

      // Enforce consistent import ordering
      "sort-imports": [
        "warn",
        {
          ignoreCase: true,
          ignoreDeclarationSort: true,
          ignoreMemberSort: false,
        },
      ],
    },
  },
]);

export default eslintConfig;
