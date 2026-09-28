import { Agent, tool } from "@openai/agents";
import { z } from "zod";
import { Cooper } from "cooper-email";
import { openaiAgentTools } from "cooper-email-openai-agents";

const client = new Cooper({ apiKey: process.env.COOPER_API_KEY });

const tools = openaiAgentTools(client).map((def) =>
  tool({
    name: def.name,
    description: def.description,
    parameters: z.object({}).passthrough(),
    execute: async (input) => def.execute(input as Record<string, unknown>),
  }),
);

export const mailAgent = new Agent({
  name: "Cooper mail",
  instructions: "Use Cooper Email tools to send, read, and search mail.",
  tools,
});
