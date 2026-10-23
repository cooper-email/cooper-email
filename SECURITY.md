# Security policy

## Supported versions

Security fixes go to the hosted service at https://cooperemail.com (including the MCP server at https://cooperemail.com/mcp) and to the latest published release of each package and plugin in this repository. Older package versions are not patched; upgrade to the latest release.

## Reporting a vulnerability

Email **ops@avatar33.com** with a description, steps to reproduce, and the affected endpoint, package, or file. Please do not open a public issue for a vulnerability.

Please give us reasonable time to investigate and ship a fix before disclosing the issue publicly.

Policy and acknowledgments: https://cooperemail.com/security. Machine-readable contact: https://cooperemail.com/.well-known/security.txt.

## Handling credentials

Never commit a real Cooper API key (`coop_live_...`) or webhook secret. Keys and test fixtures in this repository are synthetic. If a key leaks, revoke it with `DELETE /api/v1/keys/{id}` and mint a new one.
