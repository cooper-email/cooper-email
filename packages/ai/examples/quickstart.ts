import { jsonSchema, tool } from "ai";
import { Cooper } from "cooper-email";
import { vercelToolSet } from "cooper-email-ai";

const client = new Cooper({ apiKey: process.env.COOPER_API_KEY });
const defs = vercelToolSet(client);

export const tools = Object.fromEntries(
  Object.entries(defs).map(([name, def]) => [
    name,
    tool({
      description: def.description,
      inputSchema: jsonSchema(def.inputSchema),
      execute: def.execute,
    }),
  ]),
);
