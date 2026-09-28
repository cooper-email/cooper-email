import { COOPER_TOOLS, executeCooperTool, type Cooper, type ToolDefinition } from "cooper-email";

export type VercelToolDefinition = {
  description: string;
  inputSchema: ToolDefinition["inputSchema"];
  execute: (input: Record<string, unknown>) => Promise<unknown>;
};

/** Definitions you pass to the Vercel AI SDK `tool()` helper. */
export function vercelToolSet(client: Cooper): Record<string, VercelToolDefinition> {
  return Object.fromEntries(
    COOPER_TOOLS.map((tool) => [
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema,
        execute: (input: Record<string, unknown>) => executeCooperTool(client, tool.name, input ?? {}),
      },
    ]),
  );
}

export function runTool(client: Cooper, name: string, input: Record<string, unknown>) {
  return executeCooperTool(client, name, input);
}

/** Wrap the definitions with `tool()` and `jsonSchema()` from the `ai` package. */
export async function loadAiTools(client: Cooper) {
  const aiName = "ai";
  const ai = await import(aiName).catch(() => null);
  if (!ai?.tool || !ai?.jsonSchema) {
    throw new Error("Install the Vercel AI SDK to use loadAiTools (npm install ai).");
  }
  const set = vercelToolSet(client);
  return Object.fromEntries(
    Object.entries(set).map(([name, def]) => [
      name,
      ai.tool({
        description: def.description,
        inputSchema: ai.jsonSchema(def.inputSchema as Parameters<typeof ai.jsonSchema>[0]),
        execute: def.execute,
      }),
    ]),
  );
}
