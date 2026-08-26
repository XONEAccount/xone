import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { getEnv } from "./lib/env.js";
import { installOutboundProxy } from "./lib/outbound-proxy.js";

const proxy = await installOutboundProxy();
const app = createApp();
const env = getEnv();

serve(
  {
    fetch: app.fetch,
    port: env.port,
  },
  (info) => {
    console.log(`API listening on http://localhost:${info.port}`);
    if (proxy) console.log(`Outbound HTTP proxy: ${proxy}`);
  },
);
