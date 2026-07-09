import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    exclude: [
      "tests/e2e/**",
      "**/tests/e2e/**",
      "**/node_modules/**",
      "**/.git/**",
      "**/.worktrees/**",
    ],
    globals: true,
    passWithNoTests: true,
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
