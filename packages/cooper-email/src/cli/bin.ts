import { run } from "./main.js";

run({ argv: process.argv.slice(2), env: process.env }).then(
  (code) => {
    process.exitCode = code;
  },
  (cause: unknown) => {
    process.stderr.write(`cooper-email: ${(cause as Error).message}\n`);
    process.exitCode = 1;
  },
);
