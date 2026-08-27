# `@xone/ui`

Shared **shadcn/ui (new-york)** React primitives for all XOne frontends (`web`, `console`, `admin`, `docs`, `marketing`).

Source of truth: [ui.shadcn.com](https://ui.shadcn.com/docs/components). If shadcn ships it, we use it — we do not invent parallel primitives.

## Usage

```ts
import { Button, Card, Input } from "@xone/ui";
// or
import { Button } from "@xone/ui/button";
```

Apps keep thin re-exports under `src/components/ui/*` so existing `@/components/ui/...` imports keep working.

## Add more components

From `packages/ui`:

```bash
cd packages/ui
pnpm dlx shadcn@latest add <component>
```

Then export from `src/index.ts` and `package.json` `exports`.

Do **not** hand-write a component that already exists in the shadcn registry. If you need something shadcn does not provide, propose it for review first.

## App-only components

Anything that is not shared lives in the app with a **prefix**:

- `apps/web/.../web-dismissible-error.tsx` — thin Alert wrapper with auto-hide
- `apps/web/.../web-markdown.tsx`
- `apps/marketing/.../marketing-button.tsx` (if marketing needs a divergent CTA)

Compose shadcn primitives first; still show new app-prefixed primitives for review before landing.

## Theming

Components use shadcn semantic tokens (`bg-background`, `border-input`, `bg-primary`, …) backed by CSS variables in each app’s `index.css` (`--color-*`, `--radius-*`).

Each app must scan this package for Tailwind:

```css
@source "../../../packages/ui/src";
```
