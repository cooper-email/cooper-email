import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["packages/*/test/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "cooper-email": path.resolve(__dirname, "./packages/cooper-email/src/index.ts"),
    },
  },
});
