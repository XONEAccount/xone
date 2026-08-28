import {
  HTTPFacilitatorClient,
  x402ResourceServer,
  type HTTPRequestContext,
} from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { UptoEvmScheme } from "@x402/evm/upto/server";
import { paymentMiddleware, setSettlementOverrides } from "@x402/hono";
import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  estimateBochaSearchPriceUsd,
  runBochaSearch,
} from "./bocha.js";

export type SellerBindings = {
  EVM_ADDRESS?: string;
  FACILITATOR_URL?: string;
  NETWORK?: string;
  CORS_ORIGIN?: string;
  /** Bocha Web Search API key (optional — mock results without it). */
  BOCHA_API_KEY?: string;
  /** DeepSeek key for AI price estimate in [0.01, 0.1] USDC. */
  DEEPSEEK_API_KEY?: string;
};

type AppEnv = {
  Bindings: SellerBindings;
};

/**
 * Reads seller config from process.env (Node) or Worker bindings.
 * @param bindings - Optional Cloudflare Worker env
 */
function getSellerConfig(bindings?: SellerBindings) {
  const evmAddress =
    bindings?.EVM_ADDRESS ||
    process.env.EVM_ADDRESS ||
    "0xYourEvmWalletAddress";
  const facilitatorUrl =
    bindings?.FACILITATOR_URL ||
    process.env.FACILITATOR_URL ||
    "https://x402.org/facilitator";
  const network = (bindings?.NETWORK ||
    process.env.NETWORK ||
    "eip155:84532") as `${string}:${string}`;
  const corsOrigin =
    bindings?.CORS_ORIGIN || process.env.CORS_ORIGIN || "*";
  const bochaApiKey =
    bindings?.BOCHA_API_KEY || process.env.BOCHA_API_KEY || "";
  const deepseekApiKey =
    bindings?.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY || "";

  return {
    evmAddress,
    facilitatorUrl,
    network,
    corsOrigin,
    bochaApiKey,
    deepseekApiKey,
  };
}

/**
 * Creates the Hono x402 seller app (Node + Cloudflare Workers).
 * @param bindings - Optional Worker bindings used at cold start
 * @returns Configured Hono app
 */
export function createApp(bindings?: SellerBindings) {
  const { evmAddress, facilitatorUrl, network, corsOrigin } =
    getSellerConfig(bindings);

  const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });
  const resourceServer = new x402ResourceServer(facilitatorClient)
    .register(network, new ExactEvmScheme())
    .register(network, new UptoEvmScheme());

  const app = new Hono<AppEnv>();

  app.use("*", async (c, next) => {
    // Mirror Worker bindings into process.env for any library that reads env.
    if (c.env) {
      for (const key of [
        "EVM_ADDRESS",
        "FACILITATOR_URL",
        "NETWORK",
        "CORS_ORIGIN",
        "BOCHA_API_KEY",
        "DEEPSEEK_API_KEY",
      ] as const) {
        const value = c.env[key];
        if (typeof value === "string" && value.length > 0) {
          process.env[key] = value;
        }
      }
    }
    await next();
  });

  app.use(
    "*",
    cors({
      origin: corsOrigin === "*" ? "*" : corsOrigin,
      allowHeaders: [
        "Content-Type",
        "Authorization",
        "PAYMENT-SIGNATURE",
        "X-PAYMENT",
        "X-PAYMENT-RESPONSE",
      ],
      exposeHeaders: ["PAYMENT-RESPONSE", "X-PAYMENT-RESPONSE"],
    }),
  );

  const routes = {
    "GET /weather": {
      accepts: [
        {
          scheme: "exact",
          price: "$0.001",
          network,
          payTo: evmAddress,
        },
      ],
      description: "Current weather data for a given city",
      mimeType: "application/json",
    },
    "GET /api/generate": {
      accepts: [
        {
          scheme: "upto",
          price: "$0.10",
          network,
          payTo: evmAddress,
        },
      ],
      description: "AI text generation — billed by token usage",
      mimeType: "application/json",
    },
    "GET /bocha/search": {
      accepts: [
        {
          // exact (EIP-3009) — no Permit2 approve needed (upto returns HTTP 412 without it).
          scheme: "exact",
          price: async (ctx: HTTPRequestContext) => {
            let query = "";
            try {
              const url = new URL(ctx.adapter.getUrl());
              query = (
                url.searchParams.get("q") ??
                url.searchParams.get("query") ??
                ""
              ).trim();
            } catch {
              query = "";
            }
            const cfg = getSellerConfig();
            const { priceUsd } = await estimateBochaSearchPriceUsd(
              query,
              cfg.deepseekApiKey || undefined,
            );
            return `$${priceUsd.toFixed(2)}`;
          },
          network,
          payTo: evmAddress,
        },
      ],
      description:
        "Bocha web search for a user question (?q=). Exact USDC price estimated in [$0.01, $0.10].",
      mimeType: "application/json",
    },
  };

  // Eagerly sync facilitator capabilities before serving paid routes.
  // Without this, the first /weather request can hang until the SDK's 30s timeout.
  const facilitatorReady = resourceServer
    .initialize()
    .then(() => true as const)
    .catch((err: unknown) => {
      console.error("[x402-seller] facilitator initialize failed", err);
      return false as const;
    });

  // Must run before paymentMiddleware so paid routes wait for (or fail) init.
  app.use(async (c, next) => {
    const path = c.req.path;
    const needsFacilitator =
      path === "/weather" ||
      path === "/api/generate" ||
      path === "/bocha/search";
    if (needsFacilitator) {
      const ok = await facilitatorReady;
      if (!ok) {
        return c.json(
          {
            error:
              "Seller could not reach the x402 facilitator to load payment capabilities",
            facilitator: facilitatorUrl,
          },
          503,
        );
      }
    }
    await next();
  });

  app.use(
    paymentMiddleware(
      routes,
      resourceServer,
      undefined,
      undefined,
      // Already initialized above; avoid a second competing initialize() await.
      false,
    ),
  );

  app.get("/weather", (c) => {
    return c.json({
      report: {
        weather: "sunny",
        temperature: 70,
        humidity: 45,
        city: "San Francisco",
      },
    });
  });

  app.get("/api/generate", (c) => {
    const maxAmountAtomic = 100_000;
    const actualUsage = Math.floor(Math.random() * (maxAmountAtomic + 1));
    setSettlementOverrides(c, { amount: String(actualUsage) });
    return c.json({
      result: "Here is your generated text content from the x402 seller server.",
      usage: {
        authorizedMaxAtomic: String(maxAmountAtomic),
        actualChargedAtomic: String(actualUsage),
      },
    });
  });

  /**
   * Paid Bocha search. Query via `?q=`; exact price estimated in [$0.01, $0.10] at 402 time.
   */
  app.get("/bocha/search", async (c) => {
    const query = (c.req.query("q") ?? c.req.query("query") ?? "").trim();
    if (!query) {
      return c.json(
        { error: "Missing search query. Pass ?q= your question." },
        400,
      );
    }

    const cfg = getSellerConfig(c.env);
    const { priceUsd, method } = await estimateBochaSearchPriceUsd(
      query,
      cfg.deepseekApiKey || undefined,
    );

    try {
      const payload = await runBochaSearch(
        query,
        cfg.bochaApiKey || undefined,
        priceUsd,
        method,
      );
      return c.json(payload);
    } catch (err) {
      return c.json(
        {
          error: err instanceof Error ? err.message : String(err),
          query,
          priceUsd,
          priceMethod: method,
        },
        502,
      );
    }
  });

  app.get("/public", (c) => {
    return c.json({
      message: "This is a free public endpoint. No payment required.",
    });
  });

  app.get("/health", async (c) => {
    const cfg = getSellerConfig(c.env);
    const facilitatorOk = await facilitatorReady;
    return c.json({
      status: facilitatorOk ? "ok" : "degraded",
      runtime: "hono",
      facilitator: cfg.facilitatorUrl,
      facilitatorReady: facilitatorOk,
      address: cfg.evmAddress,
      network: cfg.network,
      bochaConfigured: Boolean(cfg.bochaApiKey),
      aiPriceConfigured: Boolean(cfg.deepseekApiKey),
    });
  });

  /**
   * Debug: can this runtime reach the public facilitator?
   * Helps distinguish Worker egress issues from x402 middleware bugs.
   */
  app.get("/debug/facilitator", async (c) => {
    const started = Date.now();
    const url = `${facilitatorUrl.replace(/\/$/, "")}/supported`;
    try {
      const response = await fetch(url, {
        method: "GET",
        signal: AbortSignal.timeout(10_000),
      });
      const body = await response.text();
      return c.json({
        ok: response.ok,
        status: response.status,
        ms: Date.now() - started,
        url,
        bodyPreview: body.slice(0, 240),
      });
    } catch (err) {
      return c.json(
        {
          ok: false,
          ms: Date.now() - started,
          url,
          error: err instanceof Error ? err.message : String(err),
        },
        502,
      );
    }
  });

  return app;
}
