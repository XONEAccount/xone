/// <reference types="@cloudflare/workers-types" />
import { createApp, type SellerBindings } from "./app.js";

let cachedApp: ReturnType<typeof createApp> | null = null;

/**
 * Cloudflare Workers entry — builds the Hono app once with Worker bindings.
 */
export default {
  fetch(
    request: Request,
    env: SellerBindings,
    ctx: ExecutionContext,
  ): Response | Promise<Response> {
    if (!cachedApp) {
      cachedApp = createApp(env);
    }
    return cachedApp.fetch(request, env, ctx);
  },
};
