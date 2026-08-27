# @xone/mcp

MCP server for **XOne** agent wallets. Wraps [`@xonepay/sdk`](../sdk) with tools for create, inspect, and x402 pay under console policy.

Private keys stay on the API. The spend key is **user-supplied** — create stops until the operator provides a `xone_…` key.

---

## Overview

| Component | Role |
| --- | --- |
| `@xonepay/sdk` | TypeScript / LangChain runtime |
| `@xone/mcp` | MCP tool surface for AI hosts (Cursor, Claude Desktop, …) |
| [Console](https://xone-console.pages.dev/login) | Keys, limits, allowlists, pause/delete |

Limits, pause, and delete remain in the console. MCP exposes spend and read tools only.

---

## Installation

```bash
npx -y @xone/mcp
```

Or add as a dev dependency after publish:

```bash
pnpm add -D @xone/mcp
```

---

## Configuration

| Variable | Required | Description |
| --- | --- | --- |
| `XONE_API_URL` | no | API origin. Defaults to production when unset. |
| `XONE_AGENT_TOKEN` | no | Pre-set spend key to skip the create prompt |

### Cursor / Claude Desktop

Do not embed the spend key in config unless the operator already placed it there:

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

Set `XONE_AGENT_TOKEN` in `env` only when the key is already configured out-of-band.

---

## API key flow

1. Model calls `xone_create_agent` with name and limits (no key).
2. Server stops and asks the host to collect the console key (MCP elicitation).
3. If the host cannot prompt, call `xone_set_api_key` or pass `apiKey` on the next tool call.
4. Server calls `xone.agent.create({ apiKey, … })` — idempotent, 1 key ↔ 1 wallet.

---

## Tools

| Tool | Description |
| --- | --- |
| `xone_set_api_key` | Save the console key for this session |
| `xone_create_agent` | Create or load the bound wallet |
| `xone_get_agent` | Load agent metadata |
| `xone_wallet_address` | Address, chain, status |
| `xone_wallet_balance` | Spend-policy snapshot (address + limits; not RPC USDC) |
| `xone_payment_status` | Limits + remaining daily |
| `xone_get_history` | Recent events (`limit?`) |
| `xone_x402_pay` | Settle an x402 URL |

### xone_set_api_key

| Arg | Type | Required | Description |
| --- | --- | --- | --- |
| `apiKey` | `string` | no | Console key; omit to prompt |

### xone_create_agent

| Arg | Type | Required | Description |
| --- | --- | --- | --- |
| `apiKey` | `string` | no | Console key; omit to prompt |
| `name` | `string` | yes | Display name |
| `dailyLimit` | `number` | yes | UTC daily cap |
| `perTransaction` | `number` | yes | Per-payment cap |
| `chain` | `string` | no | `base-sepolia` · `base` · `polygon` · `arbitrum` |
| `currency` | `string` | no | Default `USDC` |

### xone_get_agent

| Arg | Type | Required | Description |
| --- | --- | --- | --- |
| `apiKey` | `string` | no | If not already in session |

Returns agent metadata, or `{ agent: null }` if the key has no wallet yet.

### xone_wallet_address

| Arg | Type | Required | Description |
| --- | --- | --- | --- |
| `apiKey` | `string` | no | If not already in session |

Returns `agentId`, `name`, `chain`, `address`, `status`.

### xone_wallet_balance

| Arg | Type | Required | Description |
| --- | --- | --- | --- |
| `apiKey` | `string` | no | If not already in session |

Returns address + spend-limit snapshot (not an on-chain USDC balance).

### xone_payment_status

| Arg | Type | Required | Description |
| --- | --- | --- | --- |
| `apiKey` | `string` | no | If not already in session |

Returns limits, `remainingDaily`, allowlists, and `status`.

### xone_get_history

| Arg | Type | Required | Description |
| --- | --- | --- | --- |
| `apiKey` | `string` | no | If not already in session |
| `limit` | `number` | no | Max entries (1–100, default 20) |

### xone_x402_pay

| Arg | Type | Required | Description |
| --- | --- | --- | --- |
| `apiKey` | `string` | no | If not already in session |
| `url` | `string` | yes | x402 resource |
| `maxAmount` | `number \| string` | no | Ceiling only |
| `idempotencyKey` | `string` | no | Reuse on retries |

---

## Security

- Never log or commit console keys.
- Fund the agent wallet with on-chain USDC before pay.
- Reuse `idempotencyKey` on network retries — do not mint a new key until the prior attempt is verified.
