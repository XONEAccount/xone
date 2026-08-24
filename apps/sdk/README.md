# @xone/sdk

TypeScript SDK for **agent-scoped wallets** that settle **HTTP 402 / x402** payments under console-defined policy. The same spend surface is exposed as **LangChain structured tools** for LLM runtimes.

---

## Overview

`@xone/sdk` is the **runtime** half of XOne:

| Surface                                             | Role                                                                                                      |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **[Console](https://xone-console.pages.dev/login)** | Operator identity, API keys, agent provisioning, spend limits, host/payee allowlists, pause/delete, audit |
| **`@xone/sdk`**                                     | Create/load the bound agent with a spend token and execute policy-constrained x402 payments               |

Agent tokens may **create** the wallet (idempotent, 1 key ↔ 1 wallet), **get**, **pay**, and read history. Policy changes (limits, allowlists, pause, delete) stay in the console.

Spend is gated by:

- Daily and per-transaction caps (UTC day boundary)
- Optional hostname and payee allowlists
- Agent lifecycle status (`active` / `paused` / `exhausted` / `deleted`)
- Server-side sealed keys (the client never receives the private key)

**Binding rule:** one API key maps to at most **one** agent and **one** wallet.

---

## Architecture

```
Console (JWT)
  create API key, set limits / allowlists
        │
        ▼
Runtime: new XOne({ agentToken })
        │
        ├─ agent.create(params)  → RemoteAgent (idempotent)
        ├─ agent.get()           → RemoteAgent
        ├─ agent.pay({ url })    → server-side x402 settle + resource body
        └─ agent.getTools()      → LangChain tools (same policy)
```

Private keys remain sealed on the API. `pay` and tools call the server to settle; the SDK client only carries the spend token.

### x402 settlement path

1. Request the resource URL; expect HTTP `402` with a payment requirement.
2. Debit the agent’s **daily budget** for the quote amount (atomic reserve).
3. Enforce per-tx / daily / allowlist policy **before** chain settlement.
4. Sign and settle server-side (`ExactEvmScheme` via `@x402/fetch`).
5. On success, append history. On failed settle after reserve, refund the daily debit.
6. Retry safely with the same `idempotencyKey`.

Supported settlement chains: `base-sepolia` \| `base` \| `polygon` \| `arbitrum`.

Example seller: `https://xone-x402-seller.tskwangyi.workers.dev/weather`

---

## Console setup

Do this before writing runtime code:

1. Open the [Console](https://xone-console.pages.dev/login) and sign in.
2. Create an **API key** (`xone_…`). Copy the secret when shown — it is displayed once.
3. Create an **agent** bound to that key: name, chain, `dailyLimit`, `perTransaction`.
4. Optionally set **`allowedHosts`** / **`allowedPayees`**.
5. Note the agent wallet address (also available later via `agent.getAddress()`).

Operator actions (limits, pause, delete) stay in the console. The SDK creates the bound wallet (idempotent) and spends.

---

## Try it online

Paste the API key into the [Playground](https://xone-sdk-docs.pages.dev/?view=playground) to call the live spender API from the browser:

1. **Connect** — `POST /v1/sdk/agents` (create wallet) then `GET /v1/sdk/agents` (load it).
2. **Load agent / History** — inspect policy and recent spend.
3. **Pay** — settle the sample seller (`/weather`) or any x402 URL.

The playground uses the same spend token as `new XOne({ agentToken })`. Connect creates the wallet if it does not exist (1 key ↔ 1 wallet). Limits, pause, and delete stay in the console. Fund the agent address with USDC before paying.

Local: `pnpm --filter @xone/sdk-playground dev` → [http://localhost:5182/?view=playground](http://localhost:5182/?view=playground)

---

## Funding

The SDK does **not** hold a deposit balance. Settlement spends **on-chain USDC** at the agent address.

1. Call `agent.getAddress()` (or copy the address from the console).
2. Send **USDC** on the agent’s chain (`agent.chain`, e.g. `base-sepolia`).
3. Confirm the transfer on an explorer before the first `pay`.
4. Policy still applies: even with on-chain funds, `remainingDaily` / `perTransaction` can block spend.

`getBalance()` returns address + **policy** snapshot (`remainingDaily`, caps, status). It is not a full RPC USDC balance query.

---

## Environment

Configure the runtime with environment variables (not constructor fields for the API origin):

| Variable           | Required | Description                                        |
| ------------------ | -------- | -------------------------------------------------- |
| `XONE_API_URL`     | yes      | Hono API origin (no trailing slash)                |
| `XONE_AGENT_TOKEN` | yes      | Console API key (`xone_…`), passed as `agentToken` |

```bash
# Production
export XONE_API_URL=https://xone-sdk-api.tskwangyi.workers.dev

# Local (when running sdk-api with wrangler / vite)
# export XONE_API_URL=http://127.0.0.1:8787

export XONE_AGENT_TOKEN=xone_…
```

API health: [https://xone-sdk-api.tskwangyi.workers.dev/health](https://xone-sdk-api.tskwangyi.workers.dev/health)

Store tokens in a secrets manager. Never embed operator JWT or service-role keys in agent runtimes.

---

## Installation

```bash
pnpm add @xone/sdk
# or: npm install @xone/sdk / yarn add @xone/sdk
```

**Requirements:** Node.js 18+, TypeScript 5 recommended.

If you are developing inside this monorepo before the package is published to npm:

```bash
pnpm add @xone/sdk --filter your-app
# workspace protocol: "workspace:*"
```

---

## Quickstart

Prerequisites: [Console setup](#console-setup), [Funding](#funding), and [Environment](#environment).

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

const tools = agent.getTools();
```

---

## Core concepts

| Concept                    | Definition                                                                                      |
| -------------------------- | ----------------------------------------------------------------------------------------------- |
| **API key (`agentToken`)** | Spend credential. Format `xone_…`. **1 key ↔ 1 agent**.                                         |
| **Agent**                  | Named wallet + policy (`dailyLimit`, `perTransaction`, allowlists). Provisioned in the console. |
| **Spend limits**           | Apply to **x402** only. There is no SDK-side deposit ledger.                                    |
| **`allowedHosts`**         | Hostname allowlist for pay URLs. Empty = any **public** host. Private/localhost always blocked. |
| **`allowedPayees`**        | Allowlist of `0x` quote `payTo` addresses. Empty = any payee.                                   |
| **Status**                 | `active` · `paused` · `exhausted` · `deleted`                                                   |

---

## API reference: `XOne`

### Constructor

```ts
new XOne(config: XOneConfig)
```

Creates a client bound to a single agent token. The client talks to the API at `XONE_API_URL`.

#### Parameters

| Field        | Type     | Required | Description                                                                   |
| ------------ | -------- | -------- | ----------------------------------------------------------------------------- |
| `agentToken` | `string` | no       | Console-issued API key (`xone_…`). Prefer passing `apiKey` to `agent.create`. |

#### Example

```ts
const xone = new XOne();
```

---

## API reference: `xone.agent`

Namespace for the agent bound to this key. `create` is idempotent (1 key ↔ 1 wallet). Limits, pause, and delete stay in the console.

### `agent.create(params)`

Creates the wallet for this token, or returns the existing one.

**Returns:** `Promise<RemoteAgent>`

```ts
const agent = await xone.agent.create({
  apiKey: process.env.XONE_AGENT_TOKEN!,
  name: "agent",
  chain: "base-sepolia",
  dailyLimit: 10,
  perTransaction: 1,
});
```

### `agent.get()`

Loads the agent for this token, or `undefined` if none is bound.

**Returns:** `Promise<RemoteAgent | undefined>`

```ts
const agent = await xone.agent.create({
  apiKey: process.env.XONE_AGENT_TOKEN!,
  name: "agent",
  chain: "base-sepolia",
  dailyLimit: 10,
  perTransaction: 1,
});
const loaded = await xone.agent.get();
```

---

## API reference: `RemoteAgent`

Spender methods available on the agent returned by `agent.get()`.

### Properties

| Property   | Type        | Description        |
| ---------- | ----------- | ------------------ |
| `id`       | `string`    | Agent id           |
| `name`     | `string`    | Display name       |
| `chain`    | `XOneChain` | Settlement network |
| `currency` | `string`    | e.g. `USDC`        |
| `apiKeyId` | `string`    | Owning API key id  |

### Methods

| Method       | Description                     |
| ------------ | ------------------------------- |
| `getStatus`  | Lifecycle status                |
| `getAddress` | Wallet address                  |
| `getBalance` | Address + spend-policy snapshot |
| `getLimits`  | Caps and remaining daily budget |
| `getHistory` | Spend / lifecycle events        |
| `pay`        | Settle an x402 resource         |
| `getTools`   | LangChain tools (same policy)   |

---

### `getStatus()`

**Returns:** `AgentStatus` — `"active" | "paused" | "exhausted" | "deleted"`.

```ts
const status = agent.getStatus();
```

---

### `getAddress()`

**Returns:** `string` — on-chain wallet address (sync snapshot).

```ts
const address = agent.getAddress();
// EVM: 0x…
```

---

### `getBalance()`

Returns address + current spend-policy snapshot. This is **not** an on-chain USDC balance query; fund USDC at `address` separately.

**Returns:** `Promise<BalanceSnapshot>`

```ts
const snap = await agent.getBalance();
```

---

### `getLimits()`

**Returns:** `Promise<AgentLimits>` — caps, remaining daily budget, optional allowlists.

```ts
const limits = await agent.getLimits();
```

---

### `getHistory(params?)`

Returns spend and lifecycle events, newest first.

#### Parameters

| Param   | Type                 | Description                                                                   |
| ------- | -------------------- | ----------------------------------------------------------------------------- |
| `limit` | `number`             | Maximum entries                                                               |
| `types` | `AgentHistoryType[]` | Filter: `x402` · `transfer` · `limits_update` · `pause` · `resume` · `delete` |

**Returns:** `Promise<AgentHistoryEntry[]>`

```ts
const history = await agent.getHistory({
  limit: 20,
  types: ["x402"],
});
```

---

### `pay(params)`

Pays a real **x402** HTTP resource under agent policy. Settlement is executed **on the API** with the sealed key.

#### Parameters

| Param            | Type               | Required | Description                                                                       |
| ---------------- | ------------------ | -------- | --------------------------------------------------------------------------------- |
| `url`            | `string`           | yes      | Resource that returns HTTP 402                                                    |
| `maxAmount`      | `string \| number` | no       | Client-side ceiling; aborts if the quote exceeds it (does not override the quote) |
| `idempotencyKey` | `string`           | no       | Stable key for retries; generated if omitted                                      |

#### Returns

`Promise<PayResult>` — see [Types](#types).

#### Idempotency

On timeout or unknown network errors, **reuse the same `idempotencyKey`**. Successful payments replay the cached result (`replay: true`). In-flight or ambiguous attempts refuse a second settlement.

#### Requirements

- EVM chain: `base-sepolia` \| `base` \| `polygon` \| `arbitrum`
- On-chain USDC at `agent.getAddress()`
- Status `active` with remaining daily / per-tx headroom
- URL host and quote payee allowed by policy (when allowlists are set)

#### Throws

`X402PaymentError` · `LimitExceededError` · `InsufficientBalanceError` · `AgentPausedError` · `AgentDeletedError` · `ValidationError`

```ts
const idempotencyKey = crypto.randomUUID();
const result = await agent.pay({
  url: "https://xone-x402-seller.tskwangyi.workers.dev/weather",
  maxAmount: "0.05",
  idempotencyKey,
});

console.log(result.paid, result.body, result.replay);
```

---

### `getTools()`

**Returns:** LangChain structured tools that share this agent’s policy. See [LangChain tools](#langchain-tools).

---

## LangChain tools

```ts
const tools = agent.getTools();
```

Each tool returns a **JSON string**. Parse before use in application code.

| Tool                  | Arguments                                     | Description                           |
| --------------------- | --------------------------------------------- | ------------------------------------- |
| `xone_wallet_address` | none                                          | Agent identity and address            |
| `xone_wallet_balance` | none                                          | Address + spend-limit snapshot        |
| `xone_payment_status` | none                                          | Limits + status (pre-pay check)       |
| `xone_x402_pay`       | `url`, optional `maxAmount`, `idempotencyKey` | Same settlement path as `agent.pay()` |

### `xone_wallet_address`

```ts
const t = tools.find(x => x.name === "xone_wallet_address")!;
const raw = await t.invoke({});
// { agentId, name, chain, address, family, status }
```

### `xone_wallet_balance`

```ts
const t = tools.find(x => x.name === "xone_wallet_balance")!;
const raw = await t.invoke({});
// { chain, address, currency, remainingDaily, dailyLimit, perTransaction, status, note }
```

### `xone_payment_status`

```ts
const t = tools.find(x => x.name === "xone_payment_status")!;
const raw = await t.invoke({});
// { dailyLimit, perTransaction, remainingDaily, currency, status, allowedHosts?, allowedPayees? }
```

### `xone_x402_pay`

| Arg              | Type               | Required | Description   |
| ---------------- | ------------------ | -------- | ------------- |
| `url`            | `string` (URL)     | yes      | x402 resource |
| `maxAmount`      | `number \| string` | no       | Ceiling only  |
| `idempotencyKey` | `string`           | no       | Retry key     |

```ts
const pay = tools.find(x => x.name === "xone_x402_pay")!;
const raw = await pay.invoke({
  url: "https://xone-x402-seller.tskwangyi.workers.dev/weather",
  maxAmount: "0.05",
});
```

**Throws:** `X402PaymentError`, `LimitExceededError`, `AgentPausedError`, `AgentDeletedError`

## Types

### `XOneChain`

```ts
type XOneChain = "base" | "base-sepolia" | "solana" | "polygon" | "arbitrum";
```

x402 settlement today requires an EVM chain: `base-sepolia` \| `base` \| `polygon` \| `arbitrum`.

### `AgentStatus`

`"active" | "paused" | "exhausted" | "deleted"`

### `BalanceSnapshot`

| Field            | Type          | Description                     |
| ---------------- | ------------- | ------------------------------- |
| `currency`       | `string`      | e.g. `USDC`                     |
| `chain`          | `XOneChain`   | Settlement network              |
| `address`        | `string`      | Fund this address on-chain      |
| `remainingDaily` | `number`      | Remaining daily spend (UTC day) |
| `dailyLimit`     | `number`      | Daily cap                       |
| `perTransaction` | `number`      | Per-payment cap                 |
| `status`         | `AgentStatus` | Lifecycle status                |
| `note`           | `string`      | Funding reminder                |

### `AgentLimits`

| Field            | Type        | Description              |
| ---------------- | ----------- | ------------------------ |
| `dailyLimit`     | `number`    | Daily cap                |
| `perTransaction` | `number`    | Per-payment cap          |
| `remainingDaily` | `number`    | Remaining today          |
| `currency`       | `string`    | e.g. `USDC`              |
| `dailyPeriod`    | `string?`   | UTC day key `YYYY-MM-DD` |
| `allowedHosts`   | `string[]?` | Host allowlist           |
| `allowedPayees`  | `string[]?` | Payee allowlist          |

### `AgentHistoryEntry`

| Field       | Type               | Description            |
| ----------- | ------------------ | ---------------------- |
| `id`        | `string`           | Event id               |
| `type`      | `AgentHistoryType` | Event kind             |
| `createdAt` | `string`           | ISO timestamp          |
| `amount`    | `number?`          | Amount when applicable |
| `currency`  | `string?`          | Currency               |
| `to`        | `string?`          | Destination            |
| `url`       | `string?`          | x402 URL               |
| `txHash`    | `string?`          | Chain tx when present  |
| `meta`      | `object?`          | Extra metadata         |

### `PayResult`

| Field            | Type        | Description                            |
| ---------------- | ----------- | -------------------------------------- |
| `ok`             | `true`      | Success                                |
| `protocol`       | `"x402"`    | Protocol marker                        |
| `url`            | `string`    | Paid resource                          |
| `paid`           | `number`    | Amount settled (matches quote)         |
| `currency`       | `string`    | e.g. `USDC`                            |
| `chain`          | `XOneChain` | Settlement chain                       |
| `from`           | `string`    | Payer address                          |
| `status`         | `number`    | Final HTTP status after payment        |
| `body`           | `unknown`   | Resource response body                 |
| `remainingDaily` | `number`    | Remaining daily budget after debit     |
| `settlement`     | `unknown?`  | Facilitator / chain settlement payload |
| `network`        | `string?`   | Network label when present             |
| `idempotencyKey` | `string`    | Key used for this attempt              |
| `replay`         | `boolean?`  | Cached success for the same key        |

---

## Errors

All SDK errors extend `XOneError` and expose a stable `code` string for programmatic handling.

| Error                      | `code`                 | When                                       |
| -------------------------- | ---------------------- | ------------------------------------------ |
| `X402PaymentError`         | `X402_PAYMENT_FAILED`  | Probe, signing, or settlement failed       |
| `LimitExceededError`       | `LIMIT_EXCEEDED`       | Quote exceeds per-tx or daily cap          |
| `InsufficientBalanceError` | `INSUFFICIENT_BALANCE` | On-chain funds insufficient for settlement |
| `AgentPausedError`         | `AGENT_PAUSED`         | Spend attempted while paused               |
| `AgentDeletedError`        | `AGENT_DELETED`        | Spend after soft-delete                    |
| `AgentNotFoundError`       | `AGENT_NOT_FOUND`      | Unknown agent                              |
| `InvalidApiKeyError`       | `INVALID_API_KEY`      | Missing or deleted API key                 |
| `OperatorRequiredError`    | `OPERATOR_REQUIRED`    | Spend token used for operator-only APIs    |
| `ValidationError`          | `VALIDATION_ERROR`     | Invalid params, host, payee, or network    |

```ts
import {
  LimitExceededError,
  InsufficientBalanceError,
  AgentPausedError,
} from "@xone/sdk";

try {
  await agent.pay({ url: "https://example.com/paid" });
} catch (e) {
  if (e instanceof LimitExceededError) {
    console.error(e.limitType, e.amount, e.limit);
  } else if (e instanceof InsufficientBalanceError) {
    console.error(e.balance, e.amount);
  } else if (e instanceof AgentPausedError) {
    console.error(e.agentId);
  } else {
    throw e;
  }
}
```

### Common scenarios

| Situation                           | Typical error              | What to do                                                       |
| ----------------------------------- | -------------------------- | ---------------------------------------------------------------- |
| Quote above per-tx or daily cap     | `LimitExceededError`       | Lower amount, wait for UTC day reset, or raise limits in console |
| Wallet underfunded                  | `InsufficientBalanceError` | Fund USDC at `getAddress()`                                      |
| Agent paused in console             | `AgentPausedError`         | Resume in console                                                |
| Host / payee not allowlisted        | `ValidationError`          | Update allowlists or use an allowed URL/payee                    |
| Seller not x402 / settlement failed | `X402PaymentError`         | Inspect seller; do not mint a new idempotency key yet            |
| Timeout after `pay`                 | Unknown                    | **Reuse the same `idempotencyKey`**                              |

---

## Security notes

- Prefer **https** resource URLs; the API blocks private / localhost targets (SSRF protection).
- Empty `allowedHosts` / `allowedPayees` means unrestricted among **allowed public** destinations — still subject to SSRF and https checks.
- Agent tokens are spend-only; never ship console JWT or Supabase service-role keys with the agent.
- Treat `idempotencyKey` as part of the payment intent — persist it with the job/request until success or definitive failure.
