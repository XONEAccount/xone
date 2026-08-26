import { Hono } from "hono";
import { createPaymentRequestSchema, authorizePaymentSchema } from "@xone/schemas";
import type { PaymentAuthorization, PaymentRequest } from "@xone/types";
import type { AuthVariables } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";
import { evaluatePaymentPolicy } from "../services/payment/policy-engine.js";
import { paymentRouter } from "../services/payment/router.js";

const payments = new Hono<{ Variables: AuthVariables }>();

/** In-memory store for scaffold only; replace with Supabase in Phase 1 wiring. */
const paymentRequests = new Map<string, PaymentRequest>();
const authorizations = new Map<string, PaymentAuthorization>();

payments.use("*", requireAuth);

/**
 * Creates a payment request (intent) and returns a policy decision.
 */
payments.post("/requests", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json();
  const parsed = createPaymentRequestSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Invalid payment request", details: parsed.error.flatten() }, 400);
  }

  const input = parsed.data;
  const now = new Date().toISOString();
  const request: PaymentRequest = {
    id: crypto.randomUUID(),
    userId,
    agentTaskId: input.agentTaskId ?? null,
    orderId: input.orderId ?? null,
    merchant: input.merchant ?? null,
    merchantAgentId: input.merchantAgentId ?? null,
    asset: input.asset,
    amount: input.amount,
    currency: input.currency,
    chain: input.chain,
    recipient: input.recipient,
    status: "created",
    expiresAt: input.expiresAt ?? null,
    metadata: input.metadata ?? {},
    createdAt: now,
    updatedAt: now,
  };

  const decision = evaluatePaymentPolicy(request);
  request.status =
    decision === "allow"
      ? "authorized"
      : decision === "confirm"
        ? "awaiting_authorization"
        : "rejected";

  paymentRequests.set(request.id, request);

  return c.json({ request, decision }, 201);
});

/**
 * Records explicit user authorization for a payment request.
 */
payments.post("/:id/authorize", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const request = paymentRequests.get(id);

  if (!request || request.userId !== userId) {
    return c.json({ error: "Payment request not found" }, 404);
  }

  const body = await c.req.json();
  const parsed = authorizePaymentSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid authorization payload", details: parsed.error.flatten() }, 400);
  }

  if (!parsed.data.confirm) {
    request.status = "cancelled";
    request.updatedAt = new Date().toISOString();
    paymentRequests.set(id, request);
    return c.json({ request });
  }

  const authorization: PaymentAuthorization = {
    id: crypto.randomUUID(),
    paymentRequestId: request.id,
    userId,
    decision: "confirm",
    authorizedBy: "user",
    maxAmount: request.amount,
    expiresAt: null,
    createdAt: new Date().toISOString(),
  };

  request.status = "authorized";
  request.updatedAt = new Date().toISOString();
  paymentRequests.set(id, request);
  authorizations.set(request.id, authorization);

  return c.json({ request, authorization });
});

/**
 * Executes an authorized payment via the payment router.
 */
payments.post("/:id/execute", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const request = paymentRequests.get(id);

  if (!request || request.userId !== userId) {
    return c.json({ error: "Payment request not found" }, 404);
  }

  if (request.status !== "authorized") {
    return c.json({ error: "Payment is not authorized" }, 409);
  }

  let authorization = authorizations.get(request.id);
  if (!authorization) {
    authorization = {
      id: crypto.randomUUID(),
      paymentRequestId: request.id,
      userId,
      decision: "allow",
      authorizedBy: "system",
      maxAmount: request.amount,
      expiresAt: null,
      createdAt: new Date().toISOString(),
    };
  }

  try {
    const result = await paymentRouter.pay(request, authorization);
    request.status = result.payment.status;
    request.updatedAt = new Date().toISOString();
    paymentRequests.set(id, request);
    return c.json({ request, result });
  } catch (error) {
    request.status = "failed";
    request.updatedAt = new Date().toISOString();
    paymentRequests.set(id, request);
    return c.json(
      {
        error: error instanceof Error ? error.message : "Payment execution failed",
        request,
      },
      500,
    );
  }
});

/**
 * Fetches a payment request by id.
 */
payments.get("/:id", async (c) => {
  const userId = c.get("userId");
  const request = paymentRequests.get(c.req.param("id"));

  if (!request || request.userId !== userId) {
    return c.json({ error: "Payment request not found" }, 404);
  }

  return c.json({ request });
});

export { payments };
