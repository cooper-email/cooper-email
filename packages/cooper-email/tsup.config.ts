import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "tsup";
import { sdkPackage } from "../tsup.shared";

const dir = path.dirname(fileURLToPath(import.meta.url));

// Both builds share dist/. The SDK build only cleans its own files so it can
// never delete cli.js while the two configs run in parallel.
export default [
  { ...sdkPackage(dir), clean: ["index.*"] },
  defineConfig({
    entry: { cli: path.join(dir, "src/cli/bin.ts") },
    outDir: path.join(dir, "dist"),
    format: ["esm"],
    platform: "node",
    target: "node20",
    dts: false,
    clean: false,
    sourcemap: false,
    tsconfig: path.join(dir, "tsconfig.json"),
    banner: { js: "#!/usr/bin/env node" },
  }),
];
