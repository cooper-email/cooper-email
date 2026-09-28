import path from "node:path";
import { defineConfig } from "tsup";

export function sdkPackage(dir: string, external: string[] = []) {
  return defineConfig({
    entry: [path.join(dir, "src/index.ts")],
    outDir: path.join(dir, "dist"),
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    sourcemap: true,
    target: "es2022",
    tsconfig: path.join(dir, "tsconfig.json"),
    external,
    outExtension({ format }) {
      return { js: format === "cjs" ? ".cjs" : ".js" };
    },
  });
}
