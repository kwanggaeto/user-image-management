import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextVitals,
  ...nextTypescript,
  {
    ignores: [
      ".next/**",
      ".worktrees/**",
      ".open-next/**",
      ".wrangler/**",
      "cloudflare-env.d.ts",
      "node_modules/**",
      "playwright-report/**",
      "test-results/**"
    ],
  },
];

export default eslintConfig;
