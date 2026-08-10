import { Hono } from "hono";
import { recordTransferSchema } from "@wallet/schemas";
import type { AuthVariables } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";
import { getSupabaseAdmin } from "../lib/supabase.js";
import {
  listWalletTransfers,
  recordTransferLegs,
} from "../services/wallet/record-transfer.js";

const transactions = new Hono<{ Variables: AuthVariables }>();

transactions.use("*", requireAuth);

/**
 * Records an on-chain transfer after the client submits it successfully.
 * Writes sender `out` + recipient `in` ledger rows (idempotent).
 */
transactions.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = recordTransferSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Invalid transfer payload", details: parsed.error.flatten() },
      400,
    );
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return c.json({ error: "Database not configured" }, 503);
  }

  try {
    const legs = await recordTransferLegs(admin, parsed.data);
    return c.json({
      ok: true,
      out: legs.out,
      in: legs.in,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Record failed";
    console.error("[transactions] record", error);
    return c.json({ error: message }, 500);
  }
});

/**
 * Lists backend-recorded transfers for a wallet address.
 * Query: ?address=0x...
 */
transactions.get("/", async (c) => {
  const address = c.req.query("address")?.toLowerCase();
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return c.json({ error: "Valid address query param required" }, 400);
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return c.json({ transactions: [] });
  }

  try {
    const rows = await listWalletTransfers(admin, address);
    return c.json({ transactions: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "List failed";
    console.error("[transactions] list", error);
    return c.json({ error: message }, 500);
  }
});

export { transactions };
