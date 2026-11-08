# Installing Cooper Email MCP in Cline

Cooper Email is a hosted remote MCP server. Nothing to clone, build, or install.

1. Add this to `cline_mcp_settings.json`:

```json
{
  "mcpServers": {
    "cooper-email": {
      "type": "streamableHttp",
      "url": "https://cooperemail.com/mcp"
    }
  }
}
```

2. This file is the Bearer-key path, for a client that does not finish OAuth. Call `cooper_onboard` with `{"username": "<short-slug>"}`. It returns an API key (`coop_live_…`, shown once) and an inbox (`<short-slug>@cooperemail.com`) on that new account. The key is not applied to an OAuth connector automatically.

3. Save the key and add it to the same entry so the other tools on this entry are authorized. Without this header, a later OAuth approval uses the OAuth account, which can be a different inbox:

```json
"headers": { "Authorization": "Bearer coop_live_..." }
```

Don't commit the key. Docs: https://cooperemail.com/docs/mcp
