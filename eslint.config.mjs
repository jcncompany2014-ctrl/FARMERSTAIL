import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Claude Design handoff bundles — reference prototypes, not source code.
    // They intentionally ship unescaped entities and use globals like
    // IOSDevice from a sibling <script> tag. Linting them is noise.
    ".claude-design/**",
  ]),
]);

export default eslintConfig;
