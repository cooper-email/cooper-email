const { NodeConnectionTypes } = require("n8n-workflow");
const { buildCooperRequest } = require("./operations");

class CooperEmail {
  constructor() {
    this.description = {
      displayName: "Cooper Email",
      name: "cooperEmail",
      icon: "fa:envelope",
      group: ["output"],
      version: 1,
      subtitle: '={{$parameter["operation"]}}',
      description: "Create inboxes, send mail, search Cooper Email, and ask a human over email.",
      defaults: { name: "Cooper Email" },
      inputs: [NodeConnectionTypes.Main],
      outputs: [NodeConnectionTypes.Main],
      credentials: [{ name: "cooperEmailApi", required: false }],
      requestDefaults: { baseURL: "https://cooperemail.com" },
      properties: [
        {
          displayName: "Operation",
          name: "operation",
          type: "options",
          noDataExpression: true,
          options: [
            { name: "Onboard", value: "onboard", action: "Create an inbox and API key" },
            { name: "Create Inbox", value: "createInbox", action: "Create an inbox" },
            { name: "List Inboxes", value: "listInboxes", action: "List inboxes" },
            { name: "Send", value: "send", action: "Send an email" },
            { name: "List Messages", value: "listMessages", action: "List messages" },
            { name: "Get Message", value: "getMessage", action: "Get a message" },
            { name: "Search", value: "search", action: "Search mail" },
            { name: "Register Webhook", value: "registerWebhook", action: "Register a webhook" },
            { name: "Download Attachment", value: "downloadAttachment", action: "Download an attachment" },
            { name: "Add Owner", value: "addOwner", action: "Email an owner a confirmation link" },
            { name: "List Owners", value: "listOwners", action: "List human owners" },
            { name: "Notify Owner", value: "notifyOwner", action: "Send progress, needs_input, done, or error" },
            { name: "Get Tasks", value: "getTasks", action: "List or long-poll owner tasks" },
            { name: "Reply to Task", value: "replyTask", action: "Reply in-thread and optionally mark done" },
            { name: "Mark Task Done", value: "markTaskDone", action: "Mark a task done" },
          ],
          default: "onboard",
        },
        { displayName: "Username", name: "username", type: "string", default: "", displayOptions: { show: { operation: ["onboard", "createInbox"] } } },
        { displayName: "Display Name", name: "displayName", type: "string", default: "", displayOptions: { show: { operation: ["onboard", "createInbox"] } } },
        { displayName: "Inbox ID", name: "inboxId", type: "string", default: "", displayOptions: { show: { operation: ["send", "listMessages", "getMessage", "downloadAttachment", "addOwner", "listOwners", "notifyOwner", "getTasks"] } } },
        { displayName: "To", name: "to", type: "string", default: "", description: "Comma-separated recipients", displayOptions: { show: { operation: ["send"] } } },
        { displayName: "Subject", name: "subject", type: "string", default: "", displayOptions: { show: { operation: ["send"] } } },
        { displayName: "Text", name: "text", type: "string", typeOptions: { rows: 4 }, default: "", displayOptions: { show: { operation: ["send", "notifyOwner", "replyTask"] } } },
        { displayName: "HTML", name: "html", type: "string", default: "", displayOptions: { show: { operation: ["send"] } } },
        { displayName: "Client ID", name: "clientId", type: "string", default: "", description: "Idempotency key", displayOptions: { show: { operation: ["send", "notifyOwner"] } } },
        { displayName: "Message ID", name: "messageId", type: "string", default: "", displayOptions: { show: { operation: ["getMessage", "downloadAttachment"] } } },
        { displayName: "Attachment ID", name: "attachmentId", type: "string", default: "", displayOptions: { show: { operation: ["downloadAttachment"] } } },
        { displayName: "Limit", name: "limit", type: "number", default: 25, displayOptions: { show: { operation: ["listMessages", "search", "getTasks"] } } },
        { displayName: "Query", name: "q", type: "string", default: "", displayOptions: { show: { operation: ["search"] } } },
        { displayName: "Webhook URL", name: "url", type: "string", default: "", displayOptions: { show: { operation: ["registerWebhook"] } } },
        { displayName: "Webhook Secret", name: "secret", type: "string", typeOptions: { password: true }, default: "", displayOptions: { show: { operation: ["registerWebhook"] } } },
        { displayName: "Events", name: "events", type: "string", default: "message.received,message.sent", displayOptions: { show: { operation: ["registerWebhook"] } } },
        { displayName: "Owner Email", name: "email", type: "string", default: "", displayOptions: { show: { operation: ["addOwner"] } } },
        { displayName: "Digest", name: "digest", type: "options", options: [{ name: "Immediate", value: "immediate" }, { name: "Daily", value: "daily" }], default: "immediate", displayOptions: { show: { operation: ["addOwner"] } } },
        { displayName: "Kind", name: "kind", type: "options", options: [{ name: "Progress", value: "progress" }, { name: "Needs Input", value: "needs_input" }, { name: "Done", value: "done" }, { name: "Error", value: "error" }], default: "needs_input", displayOptions: { show: { operation: ["notifyOwner"] } } },
        { displayName: "Title", name: "title", type: "string", default: "", displayOptions: { show: { operation: ["notifyOwner"] } } },
        { displayName: "Task ID", name: "taskId", type: "string", default: "", displayOptions: { show: { operation: ["notifyOwner", "replyTask", "markTaskDone"] } } },
        { displayName: "Status", name: "status", type: "options", options: [{ name: "Pending", value: "pending" }, { name: "In Progress", value: "in_progress" }, { name: "Done", value: "done" }, { name: "All", value: "all" }], default: "pending", displayOptions: { show: { operation: ["getTasks", "replyTask"] } } },
        { displayName: "Wait Seconds", name: "wait", type: "number", default: 0, description: "Long-poll seconds, maximum 25", displayOptions: { show: { operation: ["getTasks"] } } },
      ],
    };
  }

  async execute() {
    const items = this.getInputData();
    const credentials = await this.getCredentials("cooperEmailApi").catch(() => ({}));
    const baseUrl = credentials.baseUrl || "https://cooperemail.com";
    const apiKey = credentials.apiKey || "";
    const returnData = [];
    for (let i = 0; i < items.length; i += 1) {
      const operation = this.getNodeParameter("operation", i);
      const params = {
        username: this.getNodeParameter("username", i, ""),
        displayName: this.getNodeParameter("displayName", i, ""),
        inboxId: this.getNodeParameter("inboxId", i, ""),
        to: this.getNodeParameter("to", i, ""),
        subject: this.getNodeParameter("subject", i, ""),
        text: this.getNodeParameter("text", i, ""),
        html: this.getNodeParameter("html", i, ""),
        clientId: this.getNodeParameter("clientId", i, ""),
        messageId: this.getNodeParameter("messageId", i, ""),
        attachmentId: this.getNodeParameter("attachmentId", i, ""),
        limit: this.getNodeParameter("limit", i, ""),
        q: this.getNodeParameter("q", i, ""),
        url: this.getNodeParameter("url", i, ""),
        secret: this.getNodeParameter("secret", i, ""),
        events: this.getNodeParameter("events", i, ""),
        email: this.getNodeParameter("email", i, ""),
        digest: this.getNodeParameter("digest", i, ""),
        kind: this.getNodeParameter("kind", i, ""),
        title: this.getNodeParameter("title", i, ""),
        taskId: this.getNodeParameter("taskId", i, ""),
        status: this.getNodeParameter("status", i, ""),
        wait: this.getNodeParameter("wait", i, ""),
      };
      const request = buildCooperRequest({ baseUrl, apiKey, operation, params });
      const response = await this.helpers.httpRequest({
        method: request.method,
        url: request.url,
        headers: request.headers,
        body: request.body,
        json: true,
      });
      returnData.push({ json: response });
    }
    return [returnData];
  }
}

module.exports = { CooperEmail };
