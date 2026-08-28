/**
 * Estimates a Bocha search charge in USDC within [0.01, 0.1].
 * Uses a short LLM call when DEEPSEEK_API_KEY is set; otherwise a heuristic.
 * @param query - User search question
 * @param deepseekApiKey - Optional DeepSeek API key
 * @returns Price in human USDC
 */
export async function estimateBochaSearchPriceUsd(
  query: string,
  deepseekApiKey?: string,
): Promise<{ priceUsd: number; method: "ai" | "heuristic" }> {
  const q = query.trim();
  if (!q) {
    return { priceUsd: 0.01, method: "heuristic" };
  }

  if (deepseekApiKey) {
    try {
      const price = await estimateWithDeepSeek(q, deepseekApiKey);
      return { priceUsd: clampPrice(price), method: "ai" };
    } catch (err) {
      console.warn("[bocha] AI price estimate failed, using heuristic", err);
    }
  }

  return { priceUsd: clampPrice(heuristicPrice(q)), method: "heuristic" };
}

/**
 * Clamps to 0.01–0.1 with 2 decimal places.
 * @param value - Raw estimate
 */
function clampPrice(value: number): number {
  if (!Number.isFinite(value)) return 0.05;
  const rounded = Math.round(value * 100) / 100;
  return Math.min(0.1, Math.max(0.01, rounded));
}

/**
 * Heuristic price from query complexity.
 * @param query - Search text
 */
function heuristicPrice(query: string): number {
  let price = 0.01;
  const len = query.length;
  if (len > 30) price = 0.03;
  if (len > 80) price = 0.05;
  if (len > 160) price = 0.07;
  if (/对比|分析|为什么|如何|最新|研报|report|research|compare|why|how/i.test(query)) {
    price += 0.02;
  }
  if (/详细|全面|综述|deep|comprehensive/i.test(query)) {
    price += 0.02;
  }
  return price;
}

/**
 * Asks DeepSeek for a price in [0.01, 0.1].
 * @param query - Search text
 * @param apiKey - DeepSeek key
 */
async function estimateWithDeepSeek(query: string, apiKey: string): Promise<number> {
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      temperature: 0,
      max_tokens: 16,
      messages: [
        {
          role: "system",
          content:
            "You price a single web-search API call in USDC. Reply with ONLY a number between 0.01 and 0.10 (two decimals). Harder / longer / research-style queries cost more.",
        },
        {
          role: "user",
          content: query.slice(0, 500),
        },
      ],
    }),
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    throw new Error(`DeepSeek HTTP ${response.status}`);
  }

  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = body.choices?.[0]?.message?.content?.trim() ?? "";
  const match = text.match(/0?\.\d{1,2}|0\.10|0\.1\b/);
  if (!match) {
    throw new Error(`Unparseable price: ${text}`);
  }
  return Number(match[0]);
}

export type BochaSearchResult = {
  query: string;
  priceUsd: number;
  priceMethod: "ai" | "heuristic";
  source: "bocha";
  results: Array<{
    title: string;
    url: string;
    snippet: string;
    siteName?: string;
  }>;
};

/**
 * Runs a live Bocha web search. Fails hard when the key is missing or upstream errors.
 * @param query - Search question
 * @param bochaApiKey - Bocha API key (required)
 * @param priceUsd - Settled price for this call
 * @param priceMethod - How price was chosen
 * @throws When key missing or Bocha HTTP is not OK
 */
export async function runBochaSearch(
  query: string,
  bochaApiKey: string | undefined,
  priceUsd: number,
  priceMethod: "ai" | "heuristic",
): Promise<BochaSearchResult> {
  const q = query.trim();
  if (!bochaApiKey) {
    throw new Error(
      "BOCHA_API_KEY is not configured on the seller — live search required (no mock)",
    );
  }

  const response = await fetch("https://api.bochaai.com/v1/web-search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${bochaApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: q,
      freshness: "noLimit",
      summary: true,
      count: 8,
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    if (response.status === 403) {
      throw new Error(
        `Bocha 账户余额或套餐配额不足（HTTP 403）。请充值或更换 BOCHA_API_KEY。${text.slice(0, 120)}`,
      );
    }
    throw new Error(`Bocha HTTP ${response.status}: ${text.slice(0, 200)}`);
  }

  const body = (await response.json()) as {
    data?: {
      webPages?: {
        value?: Array<{
          name?: string;
          url?: string;
          snippet?: string;
          summary?: string;
          siteName?: string;
        }>;
      };
    };
  };

  const pages = body.data?.webPages?.value ?? [];
  return {
    query: q,
    priceUsd,
    priceMethod,
    source: "bocha",
    results: pages.slice(0, 8).map((p) => ({
      title: p.name ?? "Untitled",
      url: p.url ?? "",
      snippet: p.summary || p.snippet || "",
      siteName: p.siteName,
    })),
  };
}

/**
 * Converts human USDC to 6-decimal atomic units for settlement overrides.
 * @param priceUsd - Human USDC
 */
export function usdcToAtomic(priceUsd: number): string {
  return String(Math.round(priceUsd * 1_000_000));
}
