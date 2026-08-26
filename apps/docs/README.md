# XOne Docs

Documentation and API playground for `@xone/sdk`, HTTP API, and `@xone/mcp`.

| Section | URL |
| --- | --- |
| SDK docs | https://xone-sdk-docs.pages.dev |
| HTTP API | https://xone-sdk-docs.pages.dev/?doc=api |
| MCP docs | https://xone-sdk-docs.pages.dev/?doc=mcp |
| Playground | https://xone-sdk-docs.pages.dev/?view=playground |

## Development

```bash
pnpm --filter @xone/sdk-playground dev
pnpm --filter @xone/sdk-playground run deploy
```

- **Docs** renders `apps/sdk/README.md`, `apps/docs/content/http-api.md`, and `apps/mcp/README.md` with grouped sidebars.
- **Playground** exercises the live spender API with a console key.

Production `/v1` is proxied to `https://xone-sdk-api.tskwangyi.workers.dev` via a Pages Function.
