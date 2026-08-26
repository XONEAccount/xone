# @xone/sdk

TypeScript SDK for **policy-gated x402 payments** from agent runtimes. Exposes the same spend surface as **LangChain structured tools**.

For MCP hosts, use the sibling package [`@xone/mcp`](../mcp).

---

## Overview

| Surface                                         | Role                                                        |
| ----------------------------------------------- | ----------------------------------------------------------- |
| [Console](https://xone-console.pages.dev/login) | Identity, API keys, limits, allowlists, pause/delete, audit |
| `@xone/sdk`                                     | Create/load the bound agent and settle x402 under policy    |
| [HTTP API](https://xone-sdk-docs.pages.dev/?doc=api) | Same create / pay / history over `/v1/sdk` (any language) |

**Binding:** one API key → one agent → one wallet.

Runtime capabilities: idempotent `create`, `get`, `pay`, history, LangChain tools. Soft-delete, pause, and limit changes stay in the console (not on the spend token). Prefer raw HTTP if you do not want the TypeScript package — see **HTTP API** in the docs site (`?doc=api`).

Spend is enforced by daily/per-tx caps, optional host/payee allowlists, agent status, and server-side sealed keys (the client never receives a private key).

---

## Architecture

```
Console (operator JWT)
  keys, limits, allowlists
        │
        ▼
Runtime: new XOne()
  agent.create({ apiKey })  → RemoteAgent
  agent.get()
  agent.pay({ url })
        │
        ▼
XOne API → x402 settle (ExactEvmScheme) → resource body
```

---

## Console setup

1. Sign in to the [Console](https://xone-console.pages.dev/login).
2. Create an API key (`xone_…`). Copy the secret when shown — it is displayed once.
3. Note chain, limits, and optional `allowedHosts` / `allowedPayees`.
4. Fund the agent wallet with USDC on the selected chain.

---

## Playground

Try the live API from the browser: [Playground](https://xone-sdk-docs.pages.dev/?view=playground)

Connect with a console key, inspect the agent, and call `pay` against an x402 seller.

---

## Environment

| Variable           | Required | Description                  |
| ------------------ | -------- | ---------------------------- |
| `XONE_AGENT_TOKEN` | yes\*    | Console spend key (`xone_…`) |

---

## Installation

```bash
pnpm add @xone/sdk
```

**Requirements:** Node.js 18+, TypeScript 5 recommended.

---

## Quickstart

```ts
import { XOne } from "@xone/sdk";

const xone = new XOne();

const agent = await xone.agent.create({
  apiKey: process.env.XONE_AGENT_TOKEN!,
  name: "agent",
  chain: "base-sepolia",
  dailyLimit: 10,
  perTransaction: 1,
});

const result = await agent.pay({
  url: "https://xone-x402-seller.tskwangyi.workers.dev/weather",
  idempotencyKey: crypto.randomUUID(),
});

console.log(result.paid, result.body);
```

---

## Core concepts

| Concept             | Definition                                       |
| ------------------- | ------------------------------------------------ |
| **API key**         | Spend credential (`xone_…`). One key per agent.  |
| **Agent**           | Named wallet + policy (limits, allowlists).      |
| **Spend limits**    | Daily and per-transaction caps (UTC day).        |
| **`allowedHosts`**  | Pay URL host allowlist. Empty = any public host. |
| **`allowedPayees`** | Quote `payTo` allowlist. Empty = any payee.      |
| **Status**          | `active` · `paused` · `exhausted` · `deleted`    |

---

## API reference: XOne

### Constructor

```ts
new XOne(config?: XOneConfig)
```

| Field        | Type      | Description                                            |
| ------------ | --------- | ------------------------------------------------------ |
| `agentToken` | `string?` | Optional spend key. Prefer `apiKey` on `agent.create`. |

API origin comes from `XONE_API_URL`.

---

## API reference: xone.agent

| Method           | Returns                             | Description                                 |
| ---------------- | ----------------------------------- | ------------------------------------------- |
| `create(params)` | `Promise<RemoteAgent>`              | Idempotent wallet create (1 key ↔ 1 wallet) |
| `get()`          | `Promise<RemoteAgent \| undefined>` | Load the **single** agent bound to this key |

Soft-delete / pause / update limits: use the [Console](https://xone-console.pages.dev) (JWT). They are not on the spend SDK.

### create(params)

```ts
const agent = await xone.agent.create({
  apiKey: process.env.XONE_AGENT_TOKEN!,
  name: "agent",
  chain: "base-sepolia",
  dailyLimit: 10,
  perTransaction: 1,
});
```

### get()

Returns the one agent bound to the current API key, or `undefined` if none exists yet.

```ts
const agent = await xone.agent.get();
if (!agent) {
  // call create() first
}
```
---

## API reference: RemoteAgent

### Properties

| Property   | Type        | Description        |
| ---------- | ----------- | ------------------ |
| `id`       | `string`    | Agent id           |
| `name`     | `string`    | Display name       |
| `chain`    | `XOneChain` | Settlement network |
| `currency` | `string`    | e.g. `USDC`        |
| `apiKeyId` | `string`    | Owning key id      |

### Methods

| Method                   | Description                                      |
| ------------------------ | ------------------------------------------------ |
| `getStatus()`            | Lifecycle status                                 |
| `getAddress()`           | Wallet address                                   |
| `getSpendSnapshot()`     | Address + spend-policy snapshot (not RPC USDC)   |
| `getLimits()`            | Caps and remaining daily                         |
| `getHistory(params?)`    | Spend / lifecycle events                         |
| `pay(params)`            | Settle x402 resource                             |

`getBalance()` is a deprecated alias of `getSpendSnapshot()`.

### getStatus()

Returns `AgentStatus`: `active` · `paused` · `exhausted` · `deleted`.

### getAddress()

Returns the on-chain wallet address.

### getSpendSnapshot()

Returns `Promise<SpendSnapshot>` — address, policy caps, `remainingDaily`, status.

**Not** an on-chain USDC balance. Fund the wallet at `address` separately; use this for policy headroom.

### getLimits()

Returns `Promise<AgentLimits>`.
### getHistory(params?)

| Param   | Type                  | Description        |
| ------- | --------------------- | ------------------ |
| `limit` | `number?`             | Max entries        |
| `types` | `AgentHistoryType[]?` | Filter event types |

### pay(params)

| Param            | Type               | Required | Description                      |
| ---------------- | ------------------ | -------- | -------------------------------- |
| `url`            | `string`           | yes      | x402 resource URL                |
| `maxAmount`      | `string \| number` | no       | Ceiling; does not override quote |
| `idempotencyKey` | `string`           | no       | Stable retry key                 |

**Idempotency:** reuse the same key on timeout. Success replays cached result (`replay: true`).

**Requires:** EVM chain, on-chain USDC, `active` status, policy headroom, allowed host/payee when lists are set.

**Throws:** `X402PaymentError` · `LimitExceededError` · `InsufficientBalanceError` · `AgentPausedError` · `AgentDeletedError` · `ValidationError`

```ts
const result = await agent.pay({
  url: "https://xone-x402-seller.tskwangyi.workers.dev/weather",
  maxAmount: "0.05",
  idempotencyKey: crypto.randomUUID(),
});
```

---

## Types

### XOneChain

`base` · `base-sepolia` · `solana` · `polygon` · `arbitrum`

x402 settlement requires EVM: `base-sepolia` · `base` · `polygon` · `arbitrum`.

### SpendSnapshot

| Field            | Type          | Description              |
| ---------------- | ------------- | ------------------------ |
| `currency`       | `string`      | e.g. `USDC`              |
| `chain`          | `XOneChain`   | Network                  |
| `address`        | `string`      | Fund here                |
| `remainingDaily` | `number`      | Remaining UTC-day budget |
| `dailyLimit`     | `number`      | Daily cap                |
| `perTransaction` | `number`      | Per-payment cap          |
| `status`         | `AgentStatus` | Lifecycle                |
| `note`           | `string`      | Funding reminder         |

`BalanceSnapshot` is a deprecated type alias for `SpendSnapshot`.

### PayResult

| Field            | Type        | Description           |
| ---------------- | ----------- | --------------------- |
| `ok`             | `true`      | Success               |
| `protocol`       | `"x402"`    | Protocol              |
| `url`            | `string`    | Resource              |
| `paid`           | `number`    | Settled amount        |
| `currency`       | `string`    | e.g. `USDC`           |
| `chain`          | `XOneChain` | Network               |
| `from`           | `string`    | Payer address         |
| `status`         | `number`    | HTTP status after pay |
| `body`           | `unknown`   | Resource body         |
| `remainingDaily` | `number`    | Budget after debit    |
| `settlement`     | `unknown?`  | Chain payload         |
| `idempotencyKey` | `string`    | Key used              |
| `replay`         | `boolean?`  | Cached success        |

---

## Errors

All extend `XOneError` with a `code` field.

| Error                      | Code                   | When                          |
| -------------------------- | ---------------------- | ----------------------------- |
| `X402PaymentError`         | `X402_PAYMENT_FAILED`  | Probe, sign, or settle failed |
| `LimitExceededError`       | `LIMIT_EXCEEDED`       | Over per-tx or daily cap      |
| `InsufficientBalanceError` | `INSUFFICIENT_BALANCE` | On-chain funds insufficient   |
| `AgentPausedError`         | `AGENT_PAUSED`         | Spend while paused            |
| `AgentDeletedError`        | `AGENT_DELETED`        | Spend after delete            |
| `InvalidApiKeyError`       | `INVALID_API_KEY`      | Missing or deleted key        |
| `OperatorRequiredError`    | `OPERATOR_REQUIRED`    | Operator-only API             |
| `ValidationError`          | `VALIDATION_ERROR`     | Invalid params or policy      |

---

## Security notes

- Use HTTPS resource URLs. Private-network targets are blocked (SSRF).
- Empty allowlists permit any public destination, still subject to HTTPS and SSRF checks.
- Agent tokens are spend-only. Never embed console JWT or service-role keys in runtimes.
- Persist `idempotencyKey` with the job until success or definitive failure.
