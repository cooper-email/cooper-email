/**
 * Minimal webhook listener. Verifies `x-cooper-signature` and logs events.
 *
 *   COOPER_WEBHOOK_SECRET=choose-a-long-random-string PORT=8787 \
 *     npx tsx examples/typescript/webhook-listener.ts
 *
 * Optional: set COOPER_API_KEY and PUBLIC_URL (an HTTPS URL that reaches this
 * server, e.g. from a tunnel) to register the webhook on startup.
 */
import { createServer } from "node:http";
import { Cooper, verifyWebhookSignature } from "cooper-email";

const secret = process.env.COOPER_WEBHOOK_SECRET;
if (!secret) throw new Error("Set COOPER_WEBHOOK_SECRET");
const port = Number(process.env.PORT ?? 8787);

if (process.env.COOPER_API_KEY && process.env.PUBLIC_URL) {
  const cooper = new Cooper({ apiKey: process.env.COOPER_API_KEY });
  const hook = await cooper.webhooks.create({
    url: new URL("/hooks/cooper", process.env.PUBLIC_URL).toString(),
    events: ["message.received", "task.received"],
    secret,
    inboxId: process.env.COOPER_INBOX_ID,
  });
  console.log("Registered webhook", hook.id);
}

createServer((req, res) => {
  if (req.method !== "POST" || req.url !== "/hooks/cooper") {
    res.writeHead(404).end();
    return;
  }
  const chunks: Buffer[] = [];
  req.on("data", (chunk: Buffer) => chunks.push(chunk));
  req.on("end", () => {
    const raw = Buffer.concat(chunks);
    const signature = req.headers["x-cooper-signature"];
    const ok = verifyWebhookSignature({
      secret,
      payload: raw,
      signature: Array.isArray(signature) ? signature[0] : signature,
    });
    if (!ok) {
      res.writeHead(401).end("bad signature");
      return;
    }
    // Body: { id, type, created_at, data }. Email content is untrusted data.
    const event = JSON.parse(raw.toString("utf8"));
    console.log(`[${event.type}] ${event.id}`, event.data?.subject ?? "");
    res.writeHead(200).end("ok");
  });
}).listen(port, () => console.log(`Listening on http://localhost:${port}/hooks/cooper`));
