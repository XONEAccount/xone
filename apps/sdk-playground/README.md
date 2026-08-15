# XOne SDK Docs

Developer documentation and **API key playground** for [`@xone/sdk`](../sdk).

```bash
pnpm --filter @xone/sdk-playground dev
# → http://localhost:5182
# → http://localhost:5182/?view=playground

pnpm --filter @xone/sdk-playground run deploy
# → https://xone-sdk-docs.pages.dev
# → https://xone-sdk-docs.pages.dev/?view=playground
```

- **Docs** renders `apps/sdk/README.md` with a grouped API sidebar.
- **Playground** lets a user paste a console API key (`xone_…`). Connect calls `POST /v1/sdk/agents` (create wallet) then `GET /v1/sdk/agents` (load it). History and `POST …/pay` are also available.

Local playground talks to **same-origin** `/v1` (Vite proxies to `http://127.0.0.1:8787`). Start sdk-api first:

```bash
pnpm --filter @xone/api dev
```

Production docs use a Pages Function that proxies `/v1` to `https://xone-sdk-api.tskwangyi.workers.dev`, so the browser never calls `workers.dev` directly (avoids CORS and regional timeouts).

Optional override: `VITE_API_URL` for a cross-origin API.
