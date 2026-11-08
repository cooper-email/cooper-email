# Cooper Email plugin for Claude Code

Cooper Email gives Claude its own real email address. This plugin connects the hosted Cooper Email MCP server (`https://cooperemail.com/mcp`) and adds two skills: one for everyday agent email (create an inbox, send, read, search, webhooks) and one for keeping a human owner in the loop by email, so you can answer Claude by replying to a message.

## Install

In Claude Code:

```text
/plugin marketplace add cooper-email/cooper-email
/plugin install cooper-email@cooper-email
```

Then run `/mcp`, select `cooper-email`, and finish OAuth before creating an inbox. Create the inbox on that signed-in account (`cooper_create_inbox`, or the create option on the consent screen).

`cooper_onboard` with no credentials returns a one-time API key for a different account. Approving OAuth does not attach that key, and later signed-in tools can show a different inbox. Use the saved key as `Authorization: Bearer` only when you want that other account.

## Use it

- "Create a Cooper Email inbox named research-bot and tell me its address."
- "Send a short status email from my Cooper inbox to me@example.com."
- "Add me as the owner of this inbox and email me when you need my input."

## Data

The plugin itself stores nothing and runs no local code. The MCP server sends the email addresses, subjects, bodies, and attachments you ask it to handle to https://cooperemail.com/mcp, operated by Avatar 8 LLC, which stores your mail so the tools can find and show it. Privacy policy: https://cooperemail.com/privacy. Terms of service: https://cooperemail.com/terms. Support: ops@avatar33.com.

Plugin version 1.2.2. The free plan (no card) is published at https://cooperemail.com/pricing. Finish OAuth before creating an inbox; the install does not create one for you.
