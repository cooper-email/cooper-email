# Cooper Email plugin for Claude Code

Cooper Email gives Claude its own real email address. This plugin connects the hosted Cooper Email MCP server (`https://cooperemail.com/mcp`) and adds two skills: one for everyday agent email (create an inbox, send, read, search, webhooks) and one for keeping a human owner in the loop by email, so you can answer Claude by replying to a message.

## Install

In Claude Code:

```text
/plugin marketplace add cooper-email/cooper-email
/plugin install cooper-email@cooper-email
```

Then run `/mcp`, select `cooper-email`, and sign in on Cooper's OAuth screen (create an inbox or paste an existing `coop_live_…` key).

## Use it

- "Create a Cooper Email inbox named research-bot and tell me its address."
- "Send a short status email from my Cooper inbox to me@example.com."
- "Add me as the owner of this inbox and email me when you need my input."

## Data

The plugin itself stores nothing and runs no local code. The MCP server sends the email addresses, subjects, bodies, and attachments you ask it to handle to https://cooperemail.com/mcp, operated by Avatar 8 LLC, which stores your mail so the tools can find and show it. Privacy policy: https://cooperemail.com/privacy. Support: ops@avatar33.com.
