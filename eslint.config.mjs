import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

const config = [
  {
    ignores: [
      ".next/**",
      // `npx vercel` leaves a compiled copy of the app here. It is build
      // output, not source, and linting it reported 474 errors in bundled
      // vendor code that no one can act on.
      ".vercel/**",
      "node_modules/**",
      "data/**",
      "public/draco/**",
      "next-env.d.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];

export default config;
