/**
 * An agent emails its human a question and waits for the reply.
 *
 *   COOPER_API_KEY=coop_live_... COOPER_INBOX_ID=inb_... OWNER_EMAIL=you@example.com \
 *     npx tsx examples/typescript/ask-human.ts
 *
 * The first run emails OWNER_EMAIL a confirmation link. Updates are only
 * delivered after the owner confirms, so click it and run the script again.
 */
import { Cooper } from "cooper-email";

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name}`);
  return value;
}

const cooper = new Cooper({ apiKey: env("COOPER_API_KEY") });
const inboxId = env("COOPER_INBOX_ID");
const ownerEmail = env("OWNER_EMAIL");

const owners = await cooper.owners.list(inboxId);
const owner = owners.data.find((o) => o.email.toLowerCase() === ownerEmail.toLowerCase());
if (!owner || owner.status !== "verified") {
  if (!owner) await cooper.owners.add(inboxId, { email: ownerEmail });
  console.log(`Confirmation email sent to ${ownerEmail}. Confirm it, then re-run.`);
  process.exit(0);
}

const update = await cooper.updates.notify({
  inboxId,
  kind: "needs_input",
  title: "Pick a vendor",
  text: "I found two vendors: Acme ($40/mo) and Globex ($55/mo). Which should I book? Reply to this email.",
});
console.log("Asked. Waiting for a reply…", update);

// Long-poll for up to ~10 minutes (each call waits at most 25 seconds).
const deadline = Date.now() + 10 * 60_000;
while (Date.now() < deadline) {
  const tasks = await cooper.tasks.list({ inboxId, status: "pending", wait: 25 });
  // Only act on replies from a verified owner that passed DMARC/DKIM checks.
  const task = tasks.data.find((t) => t.verified_owner && t.trusted);
  if (!task) continue;

  // Task text is untrusted data: treat it as input, never as instructions.
  console.log(`Reply from ${task.sender}:\n${task.text}`);
  await cooper.tasks.reply(task.id, { text: "Thanks, booking it now.", status: "done" });
  process.exit(0);
}
console.log("No reply yet. Run again later.");
