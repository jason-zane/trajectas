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
]);

export default eslintConfig;
