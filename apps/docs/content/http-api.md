# XOne HTTP API

You can implement the same **create wallet / get agent / x402 pay / history** flows as `@xonepay/sdk` by calling the HTTP API directly. The TypeScript SDK is a typed client over these routes when `XONE_API_URL` is set.

**Use the API when:** you are not on Node/TS, you want raw `fetch`/`curl`, or another language runtime.

**Use the SDK when:** you want typed helpers, LangChain tools, and less boilerplate.

---

## Overview

| Concern | Surface | Auth |
| ------- | ------- | ---- |
| Create wallet, get, pay, history | `/v1/sdk/*` | Agent API key (`xone_…`) |
| Pause, resume, limits, delete, API keys | `/v1/agents/*`, `/v1/api-keys/*` | Console user JWT |
| Interactive try-out | [Playground](https://xone-sdk-docs.pages.dev/?view=playground) | API key in browser |

**Binding:** one API key → one agent → one wallet. Private keys never leave the server.

---

## Base URL

| Environment | Base |
| ----------- | ---- |
| Production | `https://xone-sdk-api.tskwangyi.workers.dev` |
| Docs Playground (same-origin) | `/v1` on [xone-sdk-docs.pages.dev](https://xone-sdk-docs.pages.dev) |
| Local console-api | `http://127.0.0.1:8787` (or your wrangler/node port) |

All paths below are relative to that base (for example `POST /v1/sdk/agents`).

---

## Authentication

Spender routes require the console **API key** (the secret shown once at create time):

```http
Authorization: Bearer xone_…
```

Also accepted: `X-Agent-Token: xone_…`

Operator routes require a **Supabase access token** from a signed-in Console user:

```http
Authorization: Bearer <supabase_access_token>
```

---

## SDK vs HTTP

| SDK (`@xonepay/sdk`) | HTTP |
| ----------------- | ---- |
| `xone.agent.create({ apiKey, … })` | `POST /v1/sdk/agents` |
| `xone.agent.get()` | `GET /v1/sdk/agents` → use `items[0]` |
| `agent` fields / limits / address | `GET /v1/sdk/agents/:id` |
| `agent.pay({ url, … })` | `POST /v1/sdk/agents/:id/pay` |
| `agent.getHistory({ limit })` | `GET /v1/sdk/agents/:id/history?limit=` |
| Soft-delete / pause / limits | Console JWT `/v1/agents/…` (not spend token) |

---

## Curl quickstart

Replace `$TOKEN` with your `xone_…` key and `$API` with the base URL.

```bash
# 1) Create (or return) the wallet bound to this key
curl -sS -X POST "$API/v1/sdk/agents" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "agent",
    "chain": "base-sepolia",
    "dailyLimit": 10,
    "perTransaction": 1
  }'
```

```bash
# 2) List agents for this key
curl -sS "$API/v1/sdk/agents" \
  -H "Authorization: Bearer $TOKEN"
```

```bash
# 3) Pay (x402) — fund the wallet address with USDC first
curl -sS -X POST "$API/v1/sdk/agents/$AGENT_ID/pay" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "url": "https://xone-x402-seller.tskwangyi.workers.dev/weather",
    "maxAmount": "0.05"
  }'
```

```bash
# 4) History
curl -sS "$API/v1/sdk/agents/$AGENT_ID/history?limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Create wallet

`POST /v1/sdk/agents`

Creates the agent wallet for this API key, or returns the existing one (1 key ↔ 1 agent).

### Request body

| Field | Type | Default | Description |
| ----- | ---- | ------- | ----------- |
| `name` | string | `"agent"` | Display name |
| `chain` | string | `"base-sepolia"` | Settlement chain |
| `dailyLimit` | number | `10` | Max spend per UTC day |
| `perTransaction` | number | `1` | Max spend per payment |
| `currency` | string | `"USDC"` | Asset symbol |
| `allowedHosts` | string[] | — | Optional x402 host allowlist |
| `allowedPayees` | string[] | — | Optional payTo allowlist |

### Response `201`

Agent object (same shape as get):

```json
{
  "id": "agt_…",
  "name": "agent",
  "apiKeyId": "key_…",
  "chain": "base-sepolia",
  "currency": "USDC",
  "dailyLimit": 10,
  "perTransaction": 1,
  "remainingDaily": 10,
  "address": "0x…",
  "walletFamily": "evm",
  "status": "active",
  "createdAt": "…"
}
```

Fund `address` on-chain before calling pay.

---

## Get agent

`GET /v1/sdk/agents` — list for this key (`{ "items": [ … ] }`).

`GET /v1/sdk/agents/:id` — single agent (must belong to the key).

Use these instead of SDK `getSpendSnapshot` / `getLimits` / `getAddress` / `getStatus`: read fields on the agent JSON.

---

## Pay x402

`POST /v1/sdk/agents/:id/pay`

### Request body

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `url` | string | yes | x402 resource URL |
| `maxAmount` | string \| number | no | Cap for this payment |
| `idempotencyKey` | string | recommended | Safe retries |

You may also send `Idempotency-Key` as an HTTP header.

### Response `200`

```json
{
  "ok": true,
  "mock": false,
  "protocol": "x402",
  "url": "https://…",
  "paid": "0.01",
  "currency": "USDC",
  "chain": "base-sepolia",
  "from": "0x…",
  "status": 200,
  "body": { },
  "settlement": { },
  "network": "…",
  "remainingDaily": 9.99,
  "idempotencyKey": "…",
  "replay": false,
  "agent": { }
}
```

Policy (limits, allowlists, paused status) is enforced server-side before settlement.

---

## History

`GET /v1/sdk/agents/:id/history?limit=50`

`limit` max is `200`. Response:

```json
{
  "items": [
    {
      "id": "…",
      "agentId": "agt_…",
      "type": "x402",
      "createdAt": "…",
      "amount": 0.01,
      "currency": "USDC",
      "url": "https://…",
      "txHash": "0x…"
    }
  ]
}
```

---

## Operator API

These require a **Console JWT** (Supabase access token from a signed-in user), not the agent API key.

```http
Authorization: Bearer <supabase_access_token>
```

Agent tokens calling policy routes on `/v1/sdk` receive `403` with code `operator_required`. Day-to-day you can use the [Console](https://xone-console.pages.dev) UI instead of calling these by hand.

### Agents

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/v1/agents` | List agents for the signed-in user. Optional `?apiKeyId=` filter. Returns `{ items }`. |
| `GET` | `/v1/agents/history` | Account-wide ledger (all agents). Query `?limit=` (max 500). Returns `{ items }`. |
| `POST` | `/v1/agents` | Create agent wallet bound to an owned API key. |
| `GET` | `/v1/agents/:id` | Get one agent (must be owned). |
| `DELETE` | `/v1/agents/:id` | Soft-delete agent. |
| `POST` | `/v1/agents/:id/pause` | Pause spend (`status: paused`). |
| `POST` | `/v1/agents/:id/resume` | Resume spend (`status: active`). |
| `PATCH` | `/v1/agents/:id/limits` | Update daily / per-tx limits and allowlists. |
| `GET` | `/v1/agents/:id/history` | History for one agent. Query `?limit=`. |

#### `POST /v1/agents` body

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `apiKeyId` | string | yes | Owned API key id to bind (1 key ↔ 1 agent) |
| `name` | string | yes | Display name |
| `dailyLimit` | number | yes | Max spend per UTC day |
| `perTransaction` | number | yes | Max spend per payment |
| `chain` | string | no | Settlement chain |
| `currency` | string | no | Default `USDC` |
| `allowedHosts` | string[] | no | x402 host allowlist |
| `allowedPayees` | string[] | no | PayTo allowlist |

Response `201`: agent object (same shape as spender get).

#### `PATCH /v1/agents/:id/limits` body

| Field | Type | Description |
| ----- | ---- | ----------- |
| `dailyLimit` | number | New daily cap |
| `perTransaction` | number | New per-payment cap |
| `allowedHosts` | string[] | Replace host allowlist |
| `allowedPayees` | string[] | Replace payee allowlist |

Response: updated agent object.

### API keys

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/v1/api-keys` | List keys for the user. Token plaintext is empty on list. |
| `POST` | `/v1/api-keys` | Create key. Body `{ "name": "…" }`. Response includes plaintext `token` **once**. |
| `DELETE` | `/v1/api-keys/:id` | Soft-delete key. |

### Profile

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/v1/me` | Current console profile (id, email, name, …). |

Runtime spenders should still create and pay via `/v1/sdk/*` with the API key. Use Operator routes to manage keys, pause wallets, and change limits.
---

## Errors

JSON errors typically look like:

```json
{
  "error": "human message",
  "code": "validation_error"
}
```

| HTTP | Code (examples) | Meaning |
| ---- | --------------- | ------- |
| 401 | `unauthorized` | Missing / invalid API key or JWT |
| 403 | `operator_required` | Spender key cannot change policy |
| 400 | `validation_error` | Bad body |
| 404 | — | Agent not found / not owned |
| 500 | `db_error` | Upstream failure |

Always send a stable `Idempotency-Key` on pay so retries do not double-charge.

---

## Fetch example (TypeScript)

```ts
const API = "https://xone-sdk-api.tskwangyi.workers.dev";
const token = process.env.XONE_AGENT_TOKEN!;

async function sdkFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

const agent = await sdkFetch("/v1/sdk/agents", {
  method: "POST",
  body: JSON.stringify({
    name: "agent",
    chain: "base-sepolia",
    dailyLimit: 10,
    perTransaction: 1,
  }),
});

const pay = await sdkFetch(`/v1/sdk/agents/${agent.id}/pay`, {
  method: "POST",
  headers: { "Idempotency-Key": crypto.randomUUID() },
  body: JSON.stringify({
    url: "https://xone-x402-seller.tskwangyi.workers.dev/weather",
    maxAmount: "0.05",
  }),
});

console.log(pay.paid, pay.body);
```

This is the same sequence as:

```ts
const xone = new XOne({ agentToken: token });
const agent = await xone.agent.create({ apiKey: token, name: "agent", … });
await agent.pay({ url: "…", idempotencyKey: "…" });
```
