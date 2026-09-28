import { COOPER_TOOLS, executeCooperTool, type Cooper, type ToolDefinition } from "cooper-email";

export type OpenAIAgentTool = {
  name: string;
  description: string;
  parameters: ToolDefinition["inputSchema"];
  execute: (input: Record<string, unknown>) => Promise<unknown>;
};

/** Function tools for the OpenAI Agents SDK JavaScript package. */
export function openaiAgentTools(client: Cooper): OpenAIAgentTool[] {
  return COOPER_TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.inputSchema,
    execute: (input) => executeCooperTool(client, tool.name, input ?? {}),
  }));
}

export function runTool(client: Cooper, name: string, input: Record<string, unknown>) {
  return executeCooperTool(client, name, input);
}

/** Wrap tools with `tool()` from `@openai/agents`. Requires `zod`. */
export async function loadOpenAIAgentTools(client: Cooper) {
  const agentsName = "@openai/agents";
  const zodName = "zod";
  const agents = await import(agentsName).catch(() => null);
  const zod = await import(zodName).catch(() => null);
  if (!agents?.tool || !zod?.z) {
    throw new Error("Install @openai/agents and zod to use loadOpenAIAgentTools (npm install @openai/agents zod).");
  }
  return openaiAgentTools(client).map((def) =>
    agents.tool({
      name: def.name,
      description: def.description,
      parameters: zod.z.object({}).passthrough(),
      execute: async (input: Record<string, unknown>) => def.execute(input ?? {}),
    }),
  );
}
