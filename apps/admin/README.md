# XOne Admin

Ops control plane for the consumer wallet, Console, and SDK. React + Tailwind monochrome UI (same primitives as `@xone/console`). Separate Hono Admin API.

| Package | Path | Port | Cloudflare |
|---|---|---|---|
| `@xone/admin` | `apps/admin` | `5174` | Pages `xone-admin` |
| `@xone/admin-api` | `apps/admin-api` | `4397` | Worker `xone-admin-api` |

## Auth (wallet / SIWE-lite)

Challenge → sign → verify → JWT (no password):

1. Connect injected wallet (MetaMask / OKX / …) via **viem**
2. `GET /api/auth/challenge?address=` → server nonce message
3. Wallet `signMessage` (no gas)
4. `POST /api/auth/login` → verify signature + **allowlist** → 12h JWT

Allowlist = `ADMIN_WALLETS` env **∪** rows in `public.admin_wallets` (`status = active`).

## Local

```bash
cp apps/admin-api/.env.example apps/admin-api/.env
# SUPABASE_* + ADMIN_JWT_SECRET + ADMIN_WALLETS=0xYourAddress

# Optional DB allowlist + audit tables:
#   supabase/migrations/20260812000000_admin_audit_logs.sql
#   supabase/migrations/20260827000000_admin_wallets.sql

cp apps/admin/.env.example apps/admin/.env
pnpm install
pnpm dev:admin
```

Open http://localhost:5174 → **Connect wallet & sign**.
