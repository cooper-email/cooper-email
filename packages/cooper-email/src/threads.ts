import type { Message, Thread } from "./types";

/**
 * Group messages into threads. The API stores `thread_id` on each message and
 * has no `/threads` route. Pass messages newest-first (the list endpoint order).
 * The first time a thread id appears is treated as the latest activity.
 */
export function groupThreads(messages: Message[]): Thread[] {
  const order: string[] = [];
  const groups = new Map<string, Message[]>();
  for (const message of messages) {
    const existing = groups.get(message.thread_id);
    if (!existing) {
      order.push(message.thread_id);
      groups.set(message.thread_id, [message]);
    } else {
      existing.push(message);
    }
  }
  return order.map((id) => {
    const threadMessages = groups.get(id) ?? [];
    const latest = threadMessages[0];
    return {
      id,
      inbox_id: latest?.inbox_id ?? "",
      subject: latest?.subject ?? "",
      latest_at: latest?.created_at ?? "",
      message_count: threadMessages.length,
      messages: threadMessages,
    };
  });
}
