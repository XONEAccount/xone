# @xone/mcp

MCP server for **XOne** agent wallets. Tools call `@xone/sdk` (`create` / `get` / `pay`) under the same console policy. The spend API key is **user-supplied** — create will not proceed until the human pastes a `xone_…` key.

## Install

After `@xone/sdk` and `@xone/mcp` are published:

```bash
npx -y @xone/mcp
```

Monorepo (this repo):

```bash
pnpm --filter @xone/sdk build
pnpm --filter @xone/mcp build
node apps/mcp/dist/cli.js
```

## Cursor / Claude Desktop

Do **not** put the API key in this file if you want the host to prompt for it on create:

```json
{
  "mcpServers": {
    "xone": {
      "command": "npx",
      "args": ["-y", "@xone/mcp"],
      "env": {
        "XONE_API_URL": "https://xone-sdk-api.tskwangyi.workers.dev"
      }
    }
  }
}
```

Local checkout:

```json
{
  "mcpServers": {
    "xone": {
      "command": "node",
      "args": ["apps/mcp/dist/cli.js"],
      "env": {
        "XONE_API_URL": "http://127.0.0.1:8787"
      }
    }
  }
}
```

Optional: set `XONE_AGENT_TOKEN` in `env` to skip the prompt (the user already filled the key in config).

## Create flow

1. Model calls `xone_create_agent` with name + limits (no key).
2. Server **stops** and asks the host to collect the API key (MCP elicitation).
3. If the host cannot prompt, the tool returns an error: paste the key via `xone_set_api_key` or `apiKey`.
4. Only then does the server call `xone.agent.create({ apiKey, … })`.

## Tools

| Tool | Role |
| ---- | ---- |
| `xone_set_api_key` | Prompt / save the console key for this session |
| `xone_create_agent` | Idempotent wallet create (requires API key) |
| `xone_get_agent` | Load the bound agent |
| `xone_wallet_address` | Address + chain + status |
| `xone_wallet_balance` | Address + spend-limit snapshot |
| `xone_payment_status` | Limits + remaining daily |
| `xone_get_history` | Recent events |
| `xone_x402_pay` | Settle an x402 URL |

Limits, pause, and delete stay in the console. The MCP server never holds a private key.
