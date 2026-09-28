import { COOPER_TOOLS, executeCooperTool, type Cooper, type ToolDefinition } from "cooper-email";

export type LangChainTool = {
  name: string;
  description: string;
  schema: ToolDefinition["inputSchema"];
  func: (input: Record<string, unknown>) => Promise<unknown>;
};

/** Toolkit entries. `func` calls the Cooper API. No LangChain install required. */
export function cooperLangChainTools(client: Cooper): LangChainTool[] {
  return COOPER_TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    schema: tool.inputSchema,
    func: (input) => executeCooperTool(client, tool.name, input ?? {}),
  }));
}

export function runTool(client: Cooper, name: string, input: Record<string, unknown>) {
  return executeCooperTool(client, name, input);
}

/** Build `DynamicStructuredTool`s. Requires `@langchain/core` and `zod`. */
export async function loadLangChainTools(client: Cooper) {
  const toolsName = "@langchain/core/tools";
  const zodName = "zod";
  const tools = await import(toolsName).catch(() => null);
  const zod = await import(zodName).catch(() => null);
  if (!tools?.DynamicStructuredTool || !zod?.z) {
    throw new Error("Install @langchain/core and zod to use loadLangChainTools (npm install @langchain/core zod).");
  }
  const { DynamicStructuredTool } = tools;
  const { z } = zod;
  return cooperLangChainTools(client).map(
    (tool) =>
      new DynamicStructuredTool({
        name: tool.name,
        description: tool.description,
        schema: z.object({}).passthrough(),
        func: async (input: unknown) => {
          const result = await tool.func((input ?? {}) as Record<string, unknown>);
          return typeof result === "string" ? result : JSON.stringify(result);
        },
      }),
  );
}
