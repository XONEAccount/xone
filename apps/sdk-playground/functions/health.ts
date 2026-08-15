import { proxyUpstream } from "./_lib/upstream";

/** Proxies `/health` to the XOne API. */
export const onRequest = proxyUpstream;
