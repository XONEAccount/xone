const DEFAULT_UPSTREAM = "https://xone-sdk-api.tskwangyi.workers.dev";

const FORWARD_HEADERS = new Set([
  "authorization",
  "content-type",
  "idempotency-key",
  "x-agent-token",
  "accept",
]);

type PagesContext = {
  request: Request;
  env: { API_UPSTREAM?: string };
};

/**
 * Proxies a Pages request to the Hono spender API (same-origin for the browser).
 * @param context - Cloudflare Pages function context
 * @returns Upstream response
 */
export async function proxyUpstream(context: PagesContext): Promise<Response> {
  const incoming = new URL(context.request.url);
  const upstream = (
    context.env.API_UPSTREAM?.trim() || DEFAULT_UPSTREAM
  ).replace(/\/$/, "");
  const target = `${upstream}${incoming.pathname}${incoming.search}`;

  const headers = new Headers();
  for (const [key, value] of context.request.headers) {
    if (FORWARD_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  }

  const method = context.request.method.toUpperCase();
  const init: RequestInit = { method, headers, redirect: "follow" };
  if (method !== "GET" && method !== "HEAD") {
    init.body = context.request.body;
    Object.assign(init, { duplex: "half" });
  }

  const res = await fetch(target, init);
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
  });
}
