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
  ]),
  // Guard: prevent new local definitions of formatting helpers outside src/lib/formatting.ts
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    ignores: ["src/lib/formatting.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "FunctionDeclaration[id.name=/^(formatDate|formatDateTime|formatDateRange|statusBadgeVariant)$/]",
          message:
            "Do not define formatDate, formatDateTime, formatDateRange, or statusBadgeVariant locally. Import from '@/lib/formatting' instead.",
        },
        {
          selector:
            "VariableDeclarator[id.name=/^(formatDate|formatDateTime|formatDateRange|statusBadgeVariant)$/]",
          message:
            "Do not define formatDate, formatDateTime, formatDateRange, or statusBadgeVariant locally. Import from '@/lib/formatting' instead.",
        },
      ],
    },
  },
  {
    files: ["src/app/actions/**/*.ts", "src/app/api/**/*.ts"],
    rules: {
      "no-empty": ["error", { allowEmptyCatch: false }],
    },
  },
  // Disable the legacy `no-html-link-for-pages` rule. It only guards links to a
  // `pages/` directory (which this App-Router-only project does not have) and it
  // crashes when building its URL list from app-dir paths that combine a route
  // group with a dynamic segment (e.g. `(dashboard)/campaigns/[id]/compare`):
  // the plugin's greedy `/\[.*\]/g` replace mangles the escaped `\[id\]` into an
  // unmatched-paren regex. Adding loading.tsx files surfaced the crash.
  {
    rules: {
      "@next/next/no-html-link-for-pages": "off",
    },
  },
]);

export default eslintConfig;
