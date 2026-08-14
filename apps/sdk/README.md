# @xone/sdk

A programmable wallet SDK for **AI agents**: pay for **x402** resources within spend limits set in the console, and expose the same capabilities as **LangChain tools**.

---

## What this SDK is for

XOne solves this problem:

> Your agent needs to access **HTTP 402 / x402** paid resources — without putting a hot mainnet wallet into the model to spend freely.

There are two sides:

| Role | Responsibility | Surface |
|------|-----------------|---------|
| **Human / Console** | Sign up, create API keys **and agents**, set limits / host & payee allowlists, pause, review history | Personal console |
| **App / agent runtime** | Load the bound agent with a key and pay within those limits | `@xone/sdk` |

Core rules:

- **1 API key ↔ 1 agent ↔ 1 wallet**
- Keys are created in the Console (`xone_` + 16 alphanumeric) and shown in full only once
- **Agent tokens are spend-only:** `get` / `pay` / history / `getTools()`. Create, limits, pause, and delete require the console session
- App surface: `new XOne({ agentToken })` → `agent.get()` → `pay` / `getTools()`
- **Daily / per-tx limits** apply to x402; daily budget resets each **UTC calendar day**
- Optional **allowedHosts** / **allowedPayees** (empty = any public host / any payee). Private/localhost URLs are always blocked on the API
- **No deposit / withdraw ledger** — fund the agent address with on-chain USDC; SDK only enforces spend limits
- Private keys stay **sealed on the API** in remote mode; `pay` / tools hit server-side settlement
- The API origin is not a constructor option — read env **`XONE_API_URL`** (set → remote, unset → mock)

```
Console issues a key + creates the agent (limits, allowlists)
    │
    ▼
App: new XOne({ agentToken })
    │
    ├─ agent.get()
    │     → wallet + spend limits
    │
    ├─ agent.pay({ url })          → real x402 paid fetch
    │
    └─ agent.getTools()
          → LLM calls xone_x402_pay / read tools
```

Real x402 uses `@x402/fetch` + `ExactEvmScheme`: probe `402` → sign `PAYMENT-SIGNATURE` → retry for the resource. Example seller: `https://xone-x402-seller.tskwangyi.workers.dev/weather`. Fund the agent address with on-chain USDC; spend limits use remainingDaily / perTransaction only.


## Install

```bash
pnpm add @xone/sdk
```

## Concepts

| Concept | Meaning |
|---------|---------|
| **API key** (`agentToken`) | Created in Console. `xone_` + 16 alphanumeric. **1 key = 1 agent** |
| **Agent** | Named wallet + `dailyLimit` / `perTransaction` |
| **Spend limits** | Apply to **x402** only (no fake deposit balance) |
| **Status** | `active` · `paused` · `exhausted` · `deleted` |

## Quick start

```ts
import { XOne } from "@xone/sdk";

// Optional: XONE_API_URL=https://your-api…  (omit = local mock)
const xone = new XOne({
  agentToken: process.env.XONE_AGENT_TOKEN!, // from console
});

const agent = await xone.agent.get();
if (!agent) {
  throw new Error("Create the agent in the console first");
}

// Fund agent.getAddress() with on-chain USDC, then pay.
const paid = await agent.pay({
  url: "https://xone-x402-seller.tskwangyi.workers.dev/weather",
});
console.log(paid.body);

const tools = agent.getTools();
```

---

## `new XOne(config)`

Creates the SDK client. Public config is only the API key; the API origin is read internally from **`XONE_API_URL`**.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `agentToken` | `string` | yes | Console API key (`xone_…`) |

```ts
const xone = new XOne({
  agentToken: process.env.XONE_AGENT_TOKEN!,
});
```

---

## `xone.agent` methods

### `agent.create(params)`

**Mock only.** With `XONE_API_URL` set this throws `OperatorRequiredError` — create the agent in the console (JWT), then call `agent.get()`.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | yes | Human-readable name |
| `chain` | `XOneChain` | no | Settlement chain; default `"base-sepolia"` |
| `dailyLimit` | `number \| string` | yes | Max spend per **UTC calendar day** |
| `perTransaction` | `number \| string` | yes | Max spend per single tx |
| `currency` | `string` | no | Default `"USDC"` |
| `allowedHosts` | `string[]` | no | Hostname allowlist (`example.com` or `*.example.com`). Empty = any public host |
| `allowedPayees` | `string[]` | no | `0x` payTo allowlist. Empty = any payee |

---

### `agent.get()`

Load the agent bound to this API key (**1 key ↔ 1 agent**), or `undefined`.

```ts
const agent = await xone.agent.get();
if (!agent) {
  console.log("no agent yet — create it in the console");
} else {
  console.log(agent.name, agent.getStatus());
}
```

---

### `agent.delete()`

**Mock only.** Remote tokens throw `OperatorRequiredError`. Soft-delete from the console.

---

## `Agent` / `RemoteAgent` methods

Spender methods (`getStatus`, `getAddress`, `getBalance`, `getLimits`, `getHistory`, `pay`, `getTools`) exist on both. **Pause / resume / updateLimits / delete** are mock + console only — not on the remote spender token.

### `getStatus()`

Returns lifecycle status: `"active" | "paused" | "exhausted" | "deleted"`.

```ts
const status = agent.getStatus();
```

---

### `getAddress()`

Returns the on-chain wallet address (sync, from local snapshot).

```ts
const address = agent.getAddress();
// EVM: 0x…   Solana: base58…
```

---

### `getBalance()`

Returns the agent **address** plus current spend limits. There is no SDK deposit balance — fund on-chain USDC at `address`.

```ts
const snap = await agent.getBalance();
// { currency, chain, address, remainingDaily, dailyLimit, perTransaction, status, note }
```

---

### `getLimits()`

Snapshot of spend caps.

```ts
const limits = await agent.getLimits();
/*
{
  dailyLimit: 10,
  perTransaction: 1,
  remainingDaily: 8.5,
  currency: "USDC"
}
*/
```

---

### `updateLimits(params)`

Change daily and/or per-transaction caps. At least one field required.

```ts
const next = await agent.updateLimits({
  dailyLimit: 50,
  perTransaction: 5,
});
console.log(next.remainingDaily);
```

**Throws:** `ValidationError` if both fields omitted.

---

### `getHistory(params?)`

Spend + lifecycle events, newest first.

```ts
const history = await agent.getHistory({
  limit: 20,
  types: ["x402", "transfer"],
});

for (const e of history) {
  console.log(e.type, e.createdAt, e.amount, e.txHash ?? e.url);
}
```

| Param | Type | Description |
|-------|------|-------------|
| `limit` | `number` | Max entries |
| `types` | `AgentHistoryType[]` | Filter: `x402` · `transfer` · `limits_update` · `pause` · `resume` · `delete` (legacy `deposit`/`withdraw` may still appear in old rows) |

---

### `pause()` / `resume()`

Temporarily block **spending** (x402). Resume clears `paused` (and may clear `exhausted` when budget remains).

```ts
await agent.pause();
console.log(agent.getStatus()); // "paused"

await agent.resume();
console.log(agent.getStatus()); // "active"
```

**Throws on spend while paused:** `AgentPausedError`.

---

### `pay(params)`

Pay a real **x402** HTTP resource.

1. `GET url` → expect `402` + `PAYMENT-REQUIRED`
2. Quote amount from 402 (daily budget debit **always** equals the quote)
3. Enforce SDK spend limits (**before** chain settlement)
4. Sign + settle (`RemoteAgent` does this **server-side** with a sealed key)
5. Append history on success (failed settle refunds a reserved daily debit)

```ts
const idempotencyKey = crypto.randomUUID(); // save this for retries
const result = await agent.pay({
  url: "https://xone-x402-seller.tskwangyi.workers.dev/weather",
  // maxAmount: "0.01", // optional ceiling only
  idempotencyKey,
});

console.log(result.paid, result.body, result.settlement, result.replay);
```

| Param | Type | Description |
|-------|------|-------------|
| `url` | `string` | x402 resource URL |
| `maxAmount` | `string \| number` | Optional ceiling; aborts if quote is higher |
| `idempotencyKey` | `string` | Reuse on network retries to prevent a second on-chain pay |

On timeout/unknown errors: **reuse the same `idempotencyKey`**. Succeeded attempts replay the cached result; uncertain attempts refuse a new settlement.

**Requires:** EVM chain (`base-sepolia` / `base` / `polygon` / `arbitrum`), on-chain USDC at `agent.getAddress()`, and remaining daily / per-tx headroom.

**Throws:** `X402PaymentError`, `LimitExceededError`, `InsufficientBalanceError`, `AgentPausedError`, …

---

### `getTools()`

Returns **LangChain** structured tools (mock + remote). See below.

---

## LangChain tools (`agent.getTools()`)

```ts
const tools = agent.getTools();
```

Each tool returns a **JSON string**.

### `xone_wallet_address`

**Purpose:** Read wallet identity (no args).

```ts
const t = tools.find((x) => x.name === "xone_wallet_address")!;
const raw = await t.invoke({});
console.log(JSON.parse(raw));
/*
{
  agentId, name, chain, address, family: "evm"|"solana", status
}
*/
```

---

### `xone_wallet_balance`

**Purpose:** Balance + remaining daily budget (no args).

```ts
const t = tools.find((x) => x.name === "xone_wallet_balance")!;
console.log(JSON.parse(await t.invoke({})));
/*
{
  chain, address, currency, balance,
  remainingDaily, dailyLimit, perTransaction, status
}
*/
```

---

### `xone_payment_status`

**Purpose:** Limits + status only (no args). Useful before a pay.

```ts
const t = tools.find((x) => x.name === "xone_payment_status")!;
console.log(JSON.parse(await t.invoke({})));
/*
{
  dailyLimit, perTransaction, remainingDaily, currency, status
}
*/
```

---

### `xone_x402_pay`

**Purpose:** Same as `agent.pay()` — real x402 payment for LLMs.

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `url` | `string` (URL) | yes | x402 resource (returns 402) |
| `maxAmount` | `number \| string` | no | Ceiling only; does not override the 402 quote |

```ts
const pay = tools.find((x) => x.name === "xone_x402_pay")!;
const raw = await pay.invoke({
  url: "https://xone-x402-seller.tskwangyi.workers.dev/weather",
});
console.log(JSON.parse(raw));
/*
{
  ok: true, mock: false, protocol: "x402",
  url, paid, currency, chain, from, status, body,
  remainingDaily, settlement, network
}
*/
```

**Throws:** `X402PaymentError`, `LimitExceededError`, `AgentPausedError`, `AgentDeletedError`.

---

## Typed errors

All extend `XOneError` with a `code` field.

| Error | `code` | When |
|-------|--------|------|
| `X402PaymentError` | `X402_PAYMENT_FAILED` | Real x402 HTTP/signing/settlement failed |
| `LimitExceededError` | `LIMIT_EXCEEDED` | x402 exceeds per-tx or daily cap |
| `AgentPausedError` | `AGENT_PAUSED` | Spend while paused |
| `AgentDeletedError` | `AGENT_DELETED` | Money movement after soft-delete |
| `AgentNotFoundError` | `AGENT_NOT_FOUND` | Unknown agent id |
| `InvalidApiKeyError` | `INVALID_API_KEY` | Missing / deleted API key |
| `OperatorRequiredError` | `OPERATOR_REQUIRED` | Agent token used for create / limits / pause / delete |
| `ValidationError` | `VALIDATION_ERROR` | Bad params, host/payee/network not allowed |

```ts
import {
  LimitExceededError,
  InsufficientBalanceError,
  AgentPausedError,
} from "@xone/sdk";

try {
  await pay.invoke({ url: "https://example.com/x", amount: 100 });
} catch (e) {
  if (e instanceof LimitExceededError) {
    console.log(e.limitType, e.amount, e.limit);
  } else if (e instanceof InsufficientBalanceError) {
    console.log(e.balance, e.amount);
  } else if (e instanceof AgentPausedError) {
    console.log(e.agentId);
  } else {
    throw e;
  }
}
```

---

## End-to-end example (mock)

```ts
import {
  XOne,
  createApiKeyRecord, // mock/dev helper only
  LimitExceededError,
} from "@xone/sdk";

const key = await createApiKeyRecord({ name: "demo" });
const xone = new XOne({ agentToken: key.token });

const agent = await xone.agent.create({
  name: "bot",
  chain: "base",
  dailyLimit: 5,
  perTransaction: 2,
});

console.log(await agent.getBalance()); // address + limits
console.log(await agent.getLimits());

const [addressTool, , , payTool] = agent.getTools();
console.log(await addressTool.invoke({}));

await payTool.invoke({ url: "https://example.com/a", maxAmount: 1 });

try {
  await payTool.invoke({ url: "https://example.com/b", amount: 3 });
} catch (e) {
  console.log(e instanceof LimitExceededError); // true (per-tx = 2)
}

await agent.pause();
await agent.resume();

const hist = await agent.getHistory({ limit: 10 });
console.log(hist.map((h) => h.type));
```

> In production, create the key **and the agent** in the **console**, set `XONE_API_URL`, and pass `agentToken`. Do not rely on `createApiKeyRecord` outside local/mock tests.

---
