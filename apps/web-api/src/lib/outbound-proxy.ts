/**
 * Installs an outbound HTTP(S) proxy for Node `fetch` / undici when env is set.
 * Browsers often use the macOS system proxy; Node does not — without this,
 * local API calls to workers.dev can time out while the browser succeeds.
 */
export async function installOutboundProxy(): Promise<string | null> {
  const proxy =
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY ||
    process.env.ALL_PROXY ||
    process.env.https_proxy ||
    process.env.http_proxy ||
    process.env.all_proxy ||
    null;

  if (!proxy) return null;

  const { ProxyAgent, setGlobalDispatcher } = await import("undici");
  setGlobalDispatcher(new ProxyAgent(proxy));
  return proxy;
}
