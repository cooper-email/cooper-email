import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { Cooper } from "cooper-email";
import { mastraTools } from "cooper-email-mastra";

const client = new Cooper({ apiKey: process.env.COOPER_API_KEY });

export const tools = Object.fromEntries(
  mastraTools(client).map((def) => [
    def.id,
    createTool({
      id: def.id,
      description: def.description,
      inputSchema: z.object({}).passthrough(),
      execute: async ({ context }) => def.execute(context),
    }),
  ]),
);
