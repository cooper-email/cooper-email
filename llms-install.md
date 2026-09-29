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

2. Call the `cooper_onboard` tool with `{"username": "<short-slug>"}`. It returns an API key (`coop_live_…`, shown once) and your first inbox (`<short-slug>@cooperemail.com`).

3. Save the key and add it to the same entry so the other tools are authorized:

```json
"headers": { "Authorization": "Bearer coop_live_..." }
```

Don't commit the key. Docs: https://cooperemail.com/docs/mcp
