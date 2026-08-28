# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

x402 protocol seller test server. Express 4 + TypeScript, validates and processes USDC micropayments via `@x402/express` middleware.

## Commands

```bash
npm run dev       # Dev server with hot reload (tsx watch, port 4021)
npm start         # Production server (tsx)
npm run build     # tsc compile to dist/
npm run typecheck # tsc --noEmit type check
```

No test commands.

## API Endpoints

| Route | Type | Scheme | Price | Description |
|------|------|--------|-------|-------------|
| `GET /weather` | Paid | exact | $0.001 | Mock weather data |
| `GET /api/generate` | Paid | upto | $0.10 max | Mock LLM generation |
| `GET /bocha/search?q=` | Paid | exact | $0.01–$0.10 (dynamic) | Bocha web search (AI-priced, EIP-3009) |
| `GET /public` | Free | — | — | Public endpoint |
| `GET /health` | Free | — | — | Health check |

## Environment Variables

```
NETWORK=base-sepolia           # CAIP-2 network ID (eip155:84532)
FACILITATOR_URL=https://x402-facilitator-testnet.vercel.app/api
EVM_ADDRESS=0x...              # Seller's EVM address to receive USDC
PORT=4021                     # Server port
```

## Architecture

- Single-file Express server (`src/index.ts`)
- `@x402/express` middleware applied to paid routes
- Registers both `ExactEvmScheme` and `UptoEvmScheme`
- Free/public routes bypass payment middleware entirely

## Notes

- `.env` file contains private keys/addresses — keep out of version control
- Uses `tsx watch` for dev hot reload
