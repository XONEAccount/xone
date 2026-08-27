# XOne — Web3 AI Wallet & Agent Payments

Web-first Web3 wallet plus policy-gated **x402 agent payments** (Console / SDK / MCP / HTTP).

Stack: React + Vite + Tailwind + Hono + Cloudflare (Pages + Workers) + Supabase + Privy + viem + x402.

## Monorepo

```
apps/web            Consumer wallet UI (Pages)
apps/web-api        Wallet / A2A / chat API (@xone/wallet-api, Workers)
apps/console        Operator console — keys, wallets, limits, ledger
apps/console-api    Spend + operator HTTP API (/v1/sdk, /v1/agents, …)
apps/sdk            @xonepay/sdk — runtime create / get / pay / history
apps/mcp            @xone/mcp — MCP tools over the same spend surface
apps/docs           SDK docs + playground (@xone/sdk-playground)
apps/marketing      Public marketing site
apps/admin          Ops admin UI (React, console-style)
apps/admin-api      Ops admin API (wallet + XOne surfaces)
apps/XPayLabs-x402-seller   Sample x402 seller
packages/ui         Shared shadcn UI (@xone/ui)
packages/types      Shared domain types
packages/schemas    Zod schemas
packages/config     Chains / assets / defaults
supabase/           SQL migrations
```

## Local development

```bash
pnpm install
cp .env.example .env
```

### Wallet (`pnpm dev`)

1. Privy Dashboard → App ID → `apps/web/.env` as `VITE_PRIVY_APP_ID`
2. Allowed Origins include `http://localhost:5173`
3. `apps/web-api/.env`: `ALLOW_DEMO_AUTH=true` (and Supabase / LLM secrets as needed)

```bash
pnpm dev
```

- Web: http://localhost:5173
- API: http://localhost:4396/health

### Console + agent API

```bash
pnpm dev:console
```

### Docs / marketing

```bash
pnpm dev:docs    # SDK playground
pnpm dev:site    # marketing
```

## Surfaces

| Surface | Auth | Role |
|---------|------|------|
| Wallet web + web-api | Privy / Supabase | End-user wallet, A2A, assistant |
| Console + console-api JWT | Supabase user JWT | Keys, pause/resume, limits, soft-delete, ledger |
| `/v1/sdk/*` + `@xonepay/sdk` / `@xone/mcp` | Agent API key (`xone_…`) | Create/get agent, `pay`, history |
| Docs `?doc=api` | — | Same HTTP contract for any language |

**Spend vs operator:** soft-delete, pause, resume, and limit changes are console JWT only — not on the spend token. SDK `getSpendSnapshot()` is address + policy headroom (`remainingDaily` / limits), **not** an on-chain USDC RPC balance. Fund USDC at the agent `address` separately.

## Deploy (Cloudflare)

Repo: https://github.com/XONEAccount/web.git

```bash
pnpm deploy              # wallet-api + web
pnpm deploy:console      # console-api + console
pnpm deploy:docs
pnpm deploy:site
pnpm deploy:ops          # admin-api + admin
```

Worker secrets (`SUPABASE_*`, etc.) via `wrangler secret put`. Frontend `VITE_*` at build / CI time.

## Product notes

**Wallet:** Privy login, Base Sepolia balances, receive / send, A2A fund & settle, AI assistant under policy.

**Agent payments:** one API key → one agent → one wallet; daily / per-tx caps; optional host/payee allowlists; idempotent `pay`.

## Security model

```
Intent → Validation → Policy → Authorization → Execution → Confirmation → Audit
```

Never put private keys or service-role secrets in the browser. LLM proposes; policy decides; spend keys cannot operate the wallet.

## Project rules

`.cursor/rules/web3-wallet.mdc`
