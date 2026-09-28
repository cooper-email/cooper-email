import { COOPER_TOOLS, executeCooperTool, type Cooper, type ToolDefinition } from "cooper-email";

export type AnthropicTool = {
  name: string;
  description: string;
  input_schema: ToolDefinition["inputSchema"];
};

/** Tool definitions for the Anthropic Messages API `tools` array. */
export function anthropicTools(): AnthropicTool[] {
  return COOPER_TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
  }));
}

/** Run a `tool_use` block's name and input against Cooper. */
export function runAnthropicTool(client: Cooper, name: string, input: Record<string, unknown>) {
  return executeCooperTool(client, name, input);
}
