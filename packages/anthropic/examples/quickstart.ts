import Anthropic from "@anthropic-ai/sdk";
import { Cooper } from "cooper-email";
import { anthropicTools, runAnthropicTool } from "cooper-email-anthropic";

const anthropic = new Anthropic();
const client = new Cooper({ apiKey: process.env.COOPER_API_KEY });

const message = await anthropic.messages.create({
  model: "claude-sonnet-4-5",
  max_tokens: 1024,
  tools: anthropicTools(),
  messages: [{ role: "user", content: "Create a Cooper inbox named research-bot and tell me the address." }],
});

for (const block of message.content) {
  if (block.type === "tool_use") {
    const result = await runAnthropicTool(client, block.name, block.input as Record<string, unknown>);
    console.log(block.name, result);
  }
}
