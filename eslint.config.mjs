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
    // Storybook config — main.ts / preview.ts 는 tsconfig include 밖이라
    // projectService 가 parse 못 함. stories 자체는 정상.
    ".storybook/**",
    "storybook-static/**",
  ]),
  // audit #83: floating promise 차단. `await` 누락 / `.catch()` 누락 시 silent fail.
  // 외부 호출 많은 lib/payments, lib/email, lib/commerce, app/api 에서 데이터
  // 유실 위험 큼. nextTs preset 은 type-aware 룰 비활성이라 projectService 를
  // 직접 활성화. fire-and-forget 패턴은 명시적 void op 또는 .catch(() => {}) 로
  // 의도 표시.
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": [
        "warn",
        {
          ignoreVoid: true,
          ignoreIIFE: true,
        },
      ],
    },
  },
  // node:test 의 describe()/it() 는 sync API 처럼 보이지만 Promise 반환 →
  // floating promise 로 잡힘. 의도된 라이브러리 패턴이라 test 파일만 예외.
  {
    files: ["**/*.test.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-floating-promises": "off",
    },
  },
]);

export default eslintConfig;
