# XPayLabs-x402-seller: x402 Seller Test Server for USDC Micropayments

> **Last updated:** June 2026
>
> [**中文文档**](./README.zh-CN.md)

XPay (XPayLabs) seller test server for the [x402 protocol](https://docs.x402.org) — an open HTTP 402 payment standard for USDC micropayments on EVM chains. Built with Express + `@x402/express` middleware. Use this to test [XPayLabs-x402](https://github.com/yan253319066/XPayLabs-x402) (buyer SDK) or any x402-compatible client without setting up a production seller infrastructure.

## What Is XPayLabs-x402-seller?

An Express-based test server that implements the [x402 HTTP 402 Payment Required](https://docs.x402.org/core-concepts/http-402) protocol on the seller side. It protects API endpoints behind USDC payments, returning a **402** status with payment requirements on the first request and serving data after the client signs and submits a valid `PAYMENT-SIGNATURE` header. Works with both `exact` (fixed-price) and `upto` (usage-based) [payment schemes](https://docs.x402.org/schemes/overview).

## Why Use It?

| Scenario | Without XPay seller server | With XPay seller server |
|----------|---------------------------|------------------------|
| Testing buyer SDK | Need a production x402 API | Run locally in 30 seconds |
| Learning x402 protocol | Read docs only | Interactive 402 handshake |
| CI/CD integration | External API dependency | Self-contained test endpoint |
| Scheme experimentation | Limited to what APIs offer | Both `exact` and `upto` out of the box |

## Features

- **Exact payment** (`/weather`) — fixed **$0.001**, test the `exact` scheme (EIP-3009)
- **Usage-based payment** (`/api/generate`) — up to **$0.10**, random usage via `upto` scheme + `setSettlementOverrides` (Permit2)
- **Free endpoint** (`/public`) — no payment required
- **Returns real transaction hash** — `PAYMENT-RESPONSE` header decoded by buyer SDK into `paymentId`
- **Configurable network** — switch between Base Sepolia (testnet) and Base Mainnet
- **Full x402 handshake** — 402 → sign → retry → 200 flow
- **Health check** (`/health`) — verify server status

## Quick Start

### 1. Install

```bash
git clone <repo-url>
cd XPayLabs-x402-seller
npm install
```

### 2. Configure

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Your EVM wallet address to receive USDC payments
EVM_ADDRESS=0xYourEvmWalletAddress

# Facilitator URL (testnet: https://x402.org/facilitator)
FACILITATOR_URL=https://x402.org/facilitator

# Network CAIP-2 identifier (Base Sepolia)
NETWORK=eip155:84532

# Port (default 4021)
PORT=4021
```

### 3. Start

```bash
npm run dev
```

Server starts at `http://localhost:4021`.

### 4. Test

```bash
# Free endpoint — no payment
curl http://localhost:4021/public

# Protected endpoint — first request returns 402,
# client must sign and retry with PAYMENT-SIGNATURE header
curl http://localhost:4021/weather

# Health check
curl http://localhost:4021/health
```

Test with the XPay buyer SDK:

```bash
cd XPayLabs-x402
npx tsx test/integration.test.ts
```

## API Endpoints

| Endpoint | Scheme | Price | Network | Description |
|----------|--------|-------|---------|-------------|
| `GET /weather` | `exact` | $0.001 | Base Sepolia | Mock weather data (sunny, 70°F) |
| `GET /api/generate` | `upto` | $0.10 max | Base Sepolia | Mock AI generation with random usage |
| `GET /public` | — | Free | — | Public endpoint, no payment |
| `GET /health` | — | — | — | Server health status |

## How x402 Payment Works

```
Client                    XPay seller server                 Facilitator
  │                              │                              │
  │──── GET /weather ──────────→ │                              │
  │                              │                              │
  │←─── 402 PAYMENT-REQUIRED ────│                              │
  │     (price, network, payTo)  │                              │
  │                              │                              │
  │  Sign locally (EIP-3009)     │                              │
  │  (private key never sent)    │                              │
  │                              │                              │
  │──── GET + PAYMENT-SIGNATURE →│───── verify & settle ──────→│
  │                              │←───────── tx hash ──────────│
  │←─── 200 + PAYMENT-RESPONSE ──│                              │
  │     (transaction in header)  │                              │
```

Steps:
1. Client requests the protected `/weather` endpoint
2. Server responds with **402 Payment Required** + `PAYMENT-REQUIRED` header containing price, network, and payTo address
3. Client signs the payment locally using EIP-3009 (private key stays in process)
4. Client retries with `PAYMENT-SIGNATURE` header containing the cryptographic proof
5. Server verifies the signature via the [facilitator](https://docs.x402.org/core-concepts/facilitator) and settles on-chain
6. Server returns **200** + response data with `PAYMENT-RESPONSE` header containing the transaction hash

## Mainnet

To test on Base Mainnet with real USDC, update `.env`:

```env
EVM_ADDRESS=0xYourRealWalletAddress
FACILITATOR_URL=https://api.cdp.coinbase.com/platform/v2/x402
NETWORK=eip155:8453
```

> **Warning:** Mainnet transactions use real USDC and gas fees. Test thoroughly on testnet first.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot reload (tsx watch) |
| `npm start` | Start production server |
| `npm run build` | Compile TypeScript to dist/ |
| `npm run typecheck` | TypeScript type checking (tsc --noEmit) |

## Environment Variables

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `EVM_ADDRESS` | — | Yes | Your EVM wallet to receive USDC payments |
| `FACILITATOR_URL` | `https://x402.org/facilitator` | No | x402 facilitator endpoint |
| `NETWORK` | `eip155:84532` | No | [CAIP-2](https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-2.md) network identifier |
| `PORT` | `4021` | No | HTTP server port |

## FAQ

### Do I need real USDC to test?

For testnet, no. Get free Base Sepolia USDC from the [CDP Faucet](https://faucet.circle.com/). For mainnet, you need real USDC.

### Does the server submit real transactions?

Yes. The testnet facilitator (`https://x402.org/facilitator`) submits real on-chain transactions on Base Sepolia. The `PAYMENT-RESPONSE` header contains the transaction hash, which the [XPay buyer SDK](https://github.com/yan253319066/XPayLabs-x402) decodes into `paymentId`. Transactions are verifiable on [Base Sepolia Explorer](https://sepolia.basescan.org/).

### What's the difference between exact and upto?

- **Exact** — Fixed price. Buyer pays exactly $0.001. Uses EIP-3009 (gas sponsored by facilitator).
- **Upto** — Usage-based. Buyer authorizes up to $0.10, seller charges actual usage via `setSettlementOverrides`. Uses Permit2.

### Can I add my own endpoints?

Yes. Edit `src/index.ts` and add route configs to the `paymentMiddleware()` call following the existing pattern. See the [x402 Express middleware docs](https://docs.x402.org/getting-started/quickstart-for-sellers) for details.

## Tech Stack

- **Runtime:** Node.js >= 18
- **Framework:** [Express](https://expressjs.com/) 4.21
- **x402:** [@x402/express](https://www.npmjs.com/package/@x402/express), [@x402/core](https://www.npmjs.com/package/@x402/core), [@x402/evm](https://www.npmjs.com/package/@x402/evm)
- **Language:** TypeScript 5.6
- **Dev runner:** [tsx](https://www.npmjs.com/package/tsx) (TypeScript execution)

## Repository

**GitHub:** [yan253319066/XPayLabs-x402-seller](https://github.com/yan253319066/XPayLabs-x402-seller)
**Gitee (mirror):** [XPayLabs/XPayLabs-x402-seller](https://gitee.com/XPayLabs/XPayLabs-x402-seller)

## License

MIT
