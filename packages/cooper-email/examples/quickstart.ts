/**
 * Quick start. Run after `npm run build` with COOPER_API_KEY set,
 * or onboard first and keep the returned api_key.
 *
 *   import { Cooper, verifyWebhookSignature } from "cooper-email";
 */
import { Cooper, verifyWebhookSignature } from "../src/index";

const cooper = new Cooper({ apiKey: process.env.COOPER_API_KEY });

const onboard = await cooper.onboard({ username: "research-bot", displayName: "Research" });
const authed = new Cooper({ apiKey: onboard.api_key ?? process.env.COOPER_API_KEY });

const sent = await authed.messages.send(onboard.inbox.id, {
  to: ["ada@example.com"],
  subject: "Hello",
  text: "Tuesday works.",
  clientId: "send-1",
});

const messages = await authed.messages.list(onboard.inbox.id);
const found = await authed.search("tuesday");
const threads = await authed.threads.list(onboard.inbox.id);

const payload = JSON.stringify({ id: "evt_1", type: "message.received", data: sent });
const trusted = verifyWebhookSignature({
  secret: process.env.COOPER_WEBHOOK_SECRET ?? "",
  payload,
  signature: process.env.COOPER_WEBHOOK_SIGNATURE,
});

console.log({ sent: sent.id, count: messages.data.length, hits: found.data.length, threads: threads.data.length, trusted });
