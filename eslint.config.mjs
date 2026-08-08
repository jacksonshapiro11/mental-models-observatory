import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "scripts/**",
      "temp-*.json",
      "test-*.html",
      "_to_delete/**",
      "_to_delete2/**",
      ".worktrees/**",
      ".next-old/**",
      ".readback/**",
      "*.bak-*",
      "content/**",
      "daily-briefs/**",
      "daily-intelligence/**",
      "docs/**",
      "blog/**",
      "examples/**",
      "data/**",
      "public/**",
      "marketing-content/**",
      "tweets/**",
      "tweet-queue/**",
      ".backup-before-merge/**",
      ".tmp-verify/**",
      ".tmp-probe/**",
      "ui-staging/**",
      "tsx-501/**",
      "zz_Old/**",
      "*.md",
      "temp-*.json",
      "daily-update-*.jsx",
      "mockup-*",
      "test-*",
      "reptest.mjs",
      "_tmp_*",
      ".eslintrc.json",
      ".github/**",
      "*-results.json",
      "highlight-audit-report.json",
      "factcheck.json",
      "problematic-domains.json",
      "eslint.config.mjs",
      "next.config.ts",
      "postcss.config.mjs",
      "tailwind.config.ts",
      "tsconfig*.json",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off", 
      "react/no-unescaped-entities": "off",
      "@next/next/no-img-element": "off",
      "react-hooks/exhaustive-deps": "off",
      "import/no-anonymous-default-export": "off",
    },
  },
];

export default eslintConfig;
