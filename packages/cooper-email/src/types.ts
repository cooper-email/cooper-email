export type Inbox = {
  id: string;
  username: string;
  email: string;
  display_name: string | null;
  created_at: string;
};

export type Attachment = {
  id: string;
  filename: string;
  content_type: string;
  content_id: string | null;
  disposition: "inline" | "attachment";
  size_bytes: number;
  url: string;
};

export type AttachmentInput = {
  filename: string;
  content_base64: string;
  content_type?: string;
  content_id?: string;
};

export type Message = {
  id: string;
  inbox_id: string;
  thread_id: string;
  direction: "inbound" | "outbound";
  status: "queued" | "sent" | "received" | "failed";
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  reply_to: string | null;
  subject: string;
  text: string;
  html: string | null;
  extracted_text: string;
  extracted_html: string;
  preview: string;
  in_reply_to: string | null;
  references: string[];
  client_id: string | null;
  labels: string[];
  created_at: string;
  provider: string | null;
  idempotent?: boolean;
  attachments?: Attachment[];
};

export type List<T> = {
  object: "list";
  data: T[];
};

export type MessageList = List<Message> & {
  inbox_id: string;
};

export type SearchResult = List<Message> & {
  q: string;
};

export type WebhookEvent = "message.received" | "message.sent" | "task.received" | "owner.reply";

export type Webhook = {
  id: string;
  url: string;
  events: WebhookEvent[] | string[];
  secret: string | null;
  created_at: string;
  inbox_id?: string | null;
  /** Names with values redacted by the API. */
  headers?: Record<string, string>;
  last_delivery_status?: string | null;
  last_delivery_at?: string | null;
};

export type OwnerDigest = "immediate" | "daily";
export type OwnerStatus = "pending" | "verified" | "unsubscribed";
export type UpdateKind = "progress" | "needs_input" | "done" | "error";
export type TaskStatus = "pending" | "in_progress" | "done";

export type Owner = {
  id: string;
  inbox_id: string;
  email: string;
  status: OwnerStatus;
  digest: OwnerDigest;
  created_at: string;
  verified_at: string | null;
  unsubscribed_at: string | null;
  confirmation?: "sent" | "already_verified";
};

export type UpdateLink = {
  label: string;
  url: string;
};

export type OwnerDelivery = {
  id: string;
  owner_id: string;
  email: string;
  mode: OwnerDigest;
  status: "sent" | "queued" | "skipped" | "failed";
  reason: string | null;
  message_id: string | null;
  rfc_message_id: string | null;
};

export type OwnerUpdate = {
  id: string;
  inbox_id: string;
  task_id: string | null;
  kind: UpdateKind;
  title: string | null;
  status: string | null;
  text: string;
  links: UpdateLink[];
  attachment_names: string[];
  client_id: string | null;
  created_at: string;
  idempotent?: boolean;
  deliveries: OwnerDelivery[];
};

export type Task = {
  id: string;
  inbox_id: string;
  message_id: string | null;
  task_id: string | null;
  status: TaskStatus;
  trusted: boolean;
  verified_owner: boolean;
  sender: string;
  subject: string;
  text: string;
  quoted_text: string;
  auth: { spf: string | null; dkim: string | null; dmarc: string | null };
  in_reply_to: string | null;
  references: string[];
  content_trust: "untrusted_data";
  created_at: string;
  updated_at: string;
};

export type TaskReply = {
  task: Task;
  message: Message;
};

export type NotifyOwnerInput = {
  inboxId: string;
  kind: UpdateKind;
  text: string;
  title?: string;
  status?: string;
  taskId?: string;
  links?: UpdateLink[];
  clientId?: string;
};

export type OnboardResult = {
  account_id: string;
  api_key: string | null;
  api_key_id: string;
  inbox: Inbox;
};

export type Thread = {
  id: string;
  inbox_id: string;
  subject: string;
  latest_at: string;
  message_count: number;
  messages: Message[];
};

export type SendMessageInput = {
  to: string[];
  subject?: string;
  text?: string;
  html?: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  headers?: Record<string, string>;
  clientId?: string;
  inReplyTo?: string;
  labels?: string[];
  attachments?: AttachmentInput[];
};

export type InboundInput = {
  from: string;
  to?: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  text?: string;
  html?: string;
  headers?: Record<string, string>;
  clientId?: string;
  inReplyTo?: string;
  labels?: string[];
  attachments?: AttachmentInput[];
};

export type DownloadedAttachment = {
  bytes: Uint8Array;
  contentType: string | null;
  contentDisposition: string | null;
};
