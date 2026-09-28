import { COOPER_TOOLS, executeCooperTool, type Cooper, type ToolDefinition } from "cooper-email";

export type MastraToolDefinition = {
  id: string;
  description: string;
  inputSchema: ToolDefinition["inputSchema"];
  execute: (input: Record<string, unknown>) => Promise<unknown>;
};

function argsFrom(input: Record<string, unknown> | { context?: Record<string, unknown> }) {
  if (input && typeof input === "object" && "context" in input && input.context && typeof input.context === "object") {
    return input.context;
  }
  return input as Record<string, unknown>;
}

/** Mastra-shaped tools. `execute` accepts either the raw arguments or `{ context }`. */
export function mastraTools(client: Cooper): MastraToolDefinition[] {
  return COOPER_TOOLS.map((tool) => ({
    id: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    execute: (input) => executeCooperTool(client, tool.name, argsFrom(input ?? {})),
  }));
}

export function runTool(client: Cooper, name: string, input: Record<string, unknown>) {
  return executeCooperTool(client, name, input);
}

export async function loadMastraTools(client: Cooper) {
  const mastraName = "@mastra/core/tools";
  const zodName = "zod";
  const mastra = await import(mastraName).catch(() => null);
  const zod = await import(zodName).catch(() => null);
  if (!mastra?.createTool || !zod?.z) {
    throw new Error("Install @mastra/core and zod to use loadMastraTools (npm install @mastra/core zod).");
  }
  return mastraTools(client).map((tool) =>
    mastra.createTool({
      id: tool.id,
      description: tool.description,
      inputSchema: zod.z.object({}).passthrough(),
      execute: async ({ context }: { context: Record<string, unknown> }) => tool.execute(context ?? {}),
    }),
  );
}
