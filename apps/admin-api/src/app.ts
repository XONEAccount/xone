import { Hono } from "hono";
import { cors } from "hono/cors";
import { applyWorkerBindings, type WorkerBindings } from "./lib/cf-env.js";
import { getEnv } from "./lib/env.js";
import { agents } from "./routes/agents.js";
import { audit } from "./routes/audit.js";
import { auth } from "./routes/auth.js";
import { dashboard } from "./routes/dashboard.js";
import { fundings } from "./routes/fundings.js";
import { payments } from "./routes/payments.js";
import { profiles } from "./routes/profiles.js";
import { search } from "./routes/search.js";
import { serviceCatalog } from "./routes/service-catalog.js";
import { xone } from "./routes/xone.js";

type AppEnv = {
  Bindings: WorkerBindings;
};

/**
 * Creates the admin Hono application for Node and Cloudflare Workers.
 * @returns Configured Hono app
 */
export function createApp() {
  const app = new Hono<AppEnv>();

  app.use("*", async (c, next) => {
    applyWorkerBindings(c.env);
    await next();
  });

  app.use("*", async (c, next) => {
    const env = getEnv();
    return cors({
      origin: env.corsOrigin === "*" ? "*" : env.corsOrigin,
      allowHeaders: ["Content-Type", "Authorization"],
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    })(c, next);
  });

  app.get("/health", (c) =>
    c.json({
      ok: true,
      service: "admin-api",
      time: new Date().toISOString(),
    }),
  );

  app.route("/api/auth", auth);
  app.route("/api/dashboard", dashboard);
  app.route("/api/search", search);
  app.route("/api/profiles", profiles);
  app.route("/api/agents", agents);
  app.route("/api/payments", payments);
  app.route("/api/fundings", fundings);
  app.route("/api/audit", audit);
  app.route("/api/xone", xone);
  app.route("/api/service-catalog", serviceCatalog);

  return app;
}
