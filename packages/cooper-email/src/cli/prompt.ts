import { createInterface } from "node:readline/promises";

export interface Io {
  readonly interactive: boolean;
  out(line?: string): void;
  err(line?: string): void;
  ask(question: string): Promise<string>;
}

export const systemIo = (): Io => ({
  interactive: Boolean(process.stdin.isTTY && process.stdout.isTTY),
  out: (line = "") => process.stdout.write(`${line}\n`),
  err: (line = "") => process.stderr.write(`${line}\n`),
  ask: async (question) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
      return (await rl.question(question)).trim();
    } finally {
      rl.close();
    }
  },
});

export const confirm = async (io: Io, question: string, defaultYes = false): Promise<boolean> => {
  const answer = (await io.ask(`${question} ${defaultYes ? "[Y/n]" : "[y/N]"} `)).toLowerCase();
  if (answer === "") return defaultYes;
  return answer === "y" || answer === "yes";
};
