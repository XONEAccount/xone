# X-ONE钱包 — Web3 AI Wallet

Web-first Web3 钱包，支持 A2A 快捷支付。

技术栈：React + Vite + Tailwind + Hono + Cloudflare（Pages + Workers）+ Supabase + thirdweb（In-App Wallet / MetaMask 等）。

## 结构

```
apps/web          React 钱包 UI（Cloudflare Pages）
apps/api          Hono API（Cloudflare Workers）
packages/types    领域类型
packages/schemas  Zod 校验
packages/config   链 / 资产 / 默认策略
supabase/         SQL migrations
```

## 本地启动

```bash
pnpm install
cp .env.example .env
```

`apps/api/.env` 中保持：

```bash
ALLOW_DEMO_AUTH=true
```

```bash
pnpm dev
```

- Web: http://localhost:5173
- API: http://localhost:4396/health

## Cloudflare 部署

仓库：https://github.com/XONEAccount/web.git

### GitHub Actions（推荐）

推送到 `main` / `master` 会自动执行 `pnpm run deploy`（见 `.github/workflows/deploy.yml`）。

在 GitHub → Settings → Secrets and variables → Actions 配置：

| Secret | 说明 |
|--------|------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token（需 Workers / Pages 编辑权限） |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID |
| `VITE_API_URL` | 例如 `https://xone-wallet-api.tskwangyi.workers.dev` |
| `VITE_SUPABASE_URL` | Supabase 项目 URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |
| `VITE_THIRDWEB_CLIENT_ID` | thirdweb client id |
| `VITE_ETHERSCAN_API_KEY` | 可选 |

Worker 侧的 `SUPABASE_*` / `THIRDWEB_*` 等仍用 `wrangler secret put` 配在 Cloudflare，不必放进 GitHub。

### 本地手动部署

```bash
pnpm --filter @wallet/api exec wrangler login
pnpm deploy:api
# 构建时指向线上 API
VITE_API_URL=https://xone-wallet-api.tskwangyi.workers.dev pnpm deploy:web
# 或一次性
pnpm deploy
```

## 产品说明

- **登录**：邮箱 / GitHub / Google / Apple / Discord / 手机号 / Passkey / MetaMask / WalletConnect 等（thirdweb）
- **钱包**：Ethereum Sepolia 余额、收款二维码、链上转账
- **首页**：链上余额 + A2A 快捷入口
- **设置**：退出登录、从钱包转入 A2A、配置限额
- **顶栏**：钱包余额 + A2A 可支付余额 + Connect 账户菜单

## 安全模型

```
Intent → Validation → Policy → Authorization → Execution → Confirmation → Audit
```

## 项目规则

`.cursor/rules/web3-wallet.mdc`
