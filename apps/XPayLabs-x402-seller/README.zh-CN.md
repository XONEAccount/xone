# XPayLabs-x402-seller：x402 USDC 微支付卖家端测试服务器

> **最后更新：** 2026 年 6 月

XPay（XPayLabs）x402 协议卖家端测试服务器，基于 **Hono** + `@x402/hono` 中间件（已从 Express 迁移）。用于测试 [XPayLabs-x402](https://github.com/yan253319066/XPayLabs-x402)（买家 SDK）或任何兼容 x402 的客户端；可本地 Node 运行，也可部署到 Cloudflare Workers。

> 英文文档：[README.md](./README.md)

## 什么是 XPayLabs-x402-seller？

一个基于 Hono 的测试服务器，实现了 [x402 HTTP 402 Payment Required](https://docs.x402.org/core-concepts/http-402) 协议的卖家端。它通过 USDC 支付保护 API 端点——首次请求返回 **402** 状态码及支付要求，客户端签名并提交有效的 `PAYMENT-SIGNATURE` 头后获取数据。同时支持 `exact`（固定价格）和 `upto`（按使用量计费）两种[支付方案](https://docs.x402.org/schemes/overview)。

## 功能

- **固定价格支付**（`/weather`）— 固定 **$0.001**，测试 `exact` 方案（EIP-3009）
- **按使用量计费**（`/api/generate`）— 最高 **$0.10**，通过 `upto` 方案 + `setSettlementOverrides` 随机扣费（Permit2）
- **免费接口**（`/public`）— 无需支付
- **返回真实交易哈希** — `PAYMENT-RESPONSE` 头被买家 SDK 解码为 `paymentId`
- **可配置网络** — 通过 `.env` 在 Base Sepolia（测试网）和 Base Mainnet（主网）间切换
- **完整 x402 握手流程** — 402 → 签名 → 重试 → 200
- **健康检查**（`/health`）— 验证服务是否运行

## 快速开始

### 1. 安装（在 monorepo 根目录）

```bash
pnpm install
cp apps/XPayLabs-x402-seller/.env.example apps/XPayLabs-x402-seller/.env
```

编辑 `.env`，填入收款地址 `EVM_ADDRESS`（Base Sepolia USDC）。

### 2. 本地启动（Node + Hono）

```bash
pnpm --filter @wallet/x402-seller dev
```

服务启动在 `http://localhost:4021`。

### 3. 部署到 Cloudflare Workers

```bash
# 先写入收款地址（或改 wrangler.toml [vars]）
pnpm --filter @wallet/x402-seller exec wrangler secret put EVM_ADDRESS

pnpm --filter @wallet/x402-seller deploy
# 或在仓库根目录：pnpm deploy:x402-seller
```

### 4. 测试

```bash
# 免费接口
curl http://localhost:4021/public

# 受保护接口 — 首次请求返回 402，
# 客户端需签名并带 PAYMENT-SIGNATURE 头重试
curl http://localhost:4021/weather

# 健康检查
curl http://localhost:4021/health
```

配合 XPay 买家 SDK 测试：

```bash
cd XPayLabs-x402
npx tsx test/integration.test.ts
```

## API 端点

| 端点 | 方案 | 价格 | 网络 | 说明 |
|------|------|------|------|------|
| `GET /weather` | `exact` | $0.001 | Base Sepolia | 模拟天气数据（晴，70°F） |
| `GET /api/generate` | `upto` | $0.10 上限 | Base Sepolia | 模拟 AI 生成，随机扣费 |
| `GET /public` | — | 免费 | — | 公开接口 |
| `GET /health` | — | — | — | 健康检查 |

## x402 支付流程

```
客户端                    XPay 卖家服务器                   Facilitator
  │                              │                              │
  │──── GET /weather ──────────→ │                              │
  │                              │                              │
  │←─── 402 PAYMENT-REQUIRED ────│                              │
  │     (价格、网络、收款地址)    │                              │
  │                              │                              │
  │  本地签名（EIP-3009）        │                              │
  │  （私钥不离开进程）          │                              │
  │                              │                              │
  │──── GET + PAYMENT-SIGNATURE →│───── 验证并结算 ───────────→│
  │                              │←───────── 交易哈希 ──────────│
  │←─── 200 + PAYMENT-RESPONSE ──│                              │
  │     (头中含交易哈希)         │                              │
```

步骤：
1. 客户端请求受保护端点 `/weather`
2. 服务端返回 **402 Payment Required** + `PAYMENT-REQUIRED` 头（含价格、网络、收款地址）
3. 客户端使用 EIP-3009 本地签名（私钥不离开进程）
4. 客户端带 `PAYMENT-SIGNATURE` 头重试
5. 服务端通过 [Facilitator](https://docs.x402.org/core-concepts/facilitator) 验证签名并上链结算
6. 服务端返回 **200** + 响应数据 + `PAYMENT-RESPONSE` 头（含交易哈希）

## 主网测试

在主网上使用真实 USDC 测试，修改 `.env`：

```env
EVM_ADDRESS=0xYourRealWalletAddress
FACILITATOR_URL=https://api.cdp.coinbase.com/platform/v2/x402
NETWORK=eip155:8453
```

> **警告：** 主网交易消耗真实 USDC 和 gas 费。务必先在测试网充分验证。

## 命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发模式（热重载，tsx watch） |
| `npm start` | 生产启动 |
| `npm run build` | 编译 TypeScript 到 dist/ |
| `npm run typecheck` | 类型检查（tsc --noEmit） |

## 环境变量

| 变量 | 默认值 | 必填 | 说明 |
|------|--------|------|------|
| `EVM_ADDRESS` | — | 是 | 收款 EVM 钱包地址 |
| `FACILITATOR_URL` | `https://x402.org/facilitator` | 否 | x402 facilitator 地址 |
| `NETWORK` | `eip155:84532` | 否 | [CAIP-2](https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-2.md) 网络标识 |
| `PORT` | `4021` | 否 | HTTP 服务端口 |

## 常见问题

### 测试需要真实的 USDC 吗？

测试网不需要。从 [CDP Faucet](https://faucet.circle.com/) 免费领取 Base Sepolia USDC。主网需要真实 USDC。

### 测试网真的会上链吗？

会的。测试网 facilitator（`https://x402.org/facilitator`）会在 Base Sepolia 上提交真实交易。`PAYMENT-RESPONSE` 头中包含交易哈希，[XPay 买家 SDK](https://github.com/yan253319066/XPayLabs-x402) 会将其解码为 `paymentId`。交易可在 [Base Sepolia Explorer](https://sepolia.basescan.org/) 上验证。

### exact 和 upto 有什么区别？

- **Exact** — 固定价格。买家支付精确的 $0.001。使用 EIP-3009（gas 由 facilitator 赞助）。
- **Upto** — 按使用量计费。买家授权最高 $0.10，卖家通过 `setSettlementOverrides` 收取实际用量。使用 Permit2。

### 可以添加自己的端点吗？

可以。编辑 `src/index.ts`，按照现有模式向 `paymentMiddleware()` 添加路由配置。详见 [x402 Express 中间件文档](https://docs.x402.org/getting-started/quickstart-for-sellers)。

## 技术栈

- **运行环境：** Node.js >= 18
- **框架：** [Express](https://expressjs.com/) 4.21
- **x402：** [@x402/express](https://www.npmjs.com/package/@x402/express)、[@x402/core](https://www.npmjs.com/package/@x402/core)、[@x402/evm](https://www.npmjs.com/package/@x402/evm)
- **语言：** TypeScript 5.6
- **开发运行：** [tsx](https://www.npmjs.com/package/tsx)

## 仓库

**GitHub:** [yan253319066/XPayLabs-x402-seller](https://github.com/yan253319066/XPayLabs-x402-seller)
**Gitee（镜像）:** [XPayLabs/XPayLabs-x402-seller](https://gitee.com/XPayLabs/XPayLabs-x402-seller)

## 许可证

MIT
