# Xone Admin Console

Vue 3 + PrimeVue ops console with a **separate** Hono Admin API. Both deploy to Cloudflare (Pages + Workers).

## Apps

| Package | Path | Port (local) | Cloudflare |
|---|---|---|---|
| `@xone/admin` | `apps/admin` | `5174` | Pages `xone-admin` |
| `@xone/admin-api` | `apps/admin-api` | `4397` | Worker `xone-admin-api` |

## Features (MVP)

- Password login → 12h JWT
- Dashboard aggregates
- Profiles / Agents / Payments / Fundings / Audit
- Agent disable, policy edit, API key revoke
- **Never** exposes `encrypted_private_key` or full API keys

## Local

```bash
# from repo root
cp apps/admin-api/.env.example apps/admin-api/.env
# fill SUPABASE_* + ADMIN_PASSWORD + ADMIN_JWT_SECRET

cp apps/admin/.env.example apps/admin/.env

pnpm install
pnpm dev:admin
```

Login password = `ADMIN_PASSWORD`.

Apply migration:

```bash
# supabase/migrations/20260812000000_admin_audit_logs.sql
```

## Deploy

```bash
# Worker secrets
pnpm --filter @xone/admin-api exec wrangler secret put SUPABASE_URL
pnpm --filter @xone/admin-api exec wrangler secret put SUPABASE_SERVICE_ROLE_KEY
pnpm --filter @xone/admin-api exec wrangler secret put ADMIN_JWT_SECRET
pnpm --filter @xone/admin-api exec wrangler secret put ADMIN_PASSWORD

pnpm deploy:ops
```

After the Worker URL is known, set admin frontend:

```bash
# apps/admin/.env.production
VITE_ADMIN_API_URL=https://xone-admin-api.<account>.workers.dev
```

Then redeploy Pages:

```bash
pnpm deploy:admin
```
