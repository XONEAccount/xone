import { createApp } from "./app.js";

/** Cloudflare Workers entry — export the Hono fetch handler. */
const app = createApp();

export default app;
