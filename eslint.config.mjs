import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // Base Next.js + TypeScript config
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  // Project overrides
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      // You attempted to disable this in .eslintrc.js, but flat config (this file) takes precedence.
      "@typescript-eslint/no-explicit-any": "off",
      // Make unused vars less noisy; allow prefix _ to intentionally ignore
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }
      ],
    },
  },
];

export default eslintConfig;
