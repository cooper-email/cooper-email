import { Cooper } from "cooper-email";
import { cooperLangChainTools, loadLangChainTools } from "cooper-email-langchain";

const client = new Cooper({ apiKey: process.env.COOPER_API_KEY });
const toolkit = cooperLangChainTools(client);
const send = toolkit.find((tool) => tool.name === "cooper_send_message");
await send?.func({ inbox_id: "inb_1", to: ["ada@example.com"], subject: "Hello", text: "Tuesday works." });

// When @langchain/core and zod are installed:
const structured = await loadLangChainTools(client);
console.log(structured.map((tool) => tool.name));
