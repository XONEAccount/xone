import { proxyUpstream } from "../_lib/upstream";

/** Proxies `/v1/*` to the XOne API. */
export const onRequest = proxyUpstream;
