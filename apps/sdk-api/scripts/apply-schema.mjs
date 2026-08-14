/**
 * Prints the SQL migration path. Apply in Supabase → SQL Editor.
 * Optional: set SUPABASE_DB_URL (postgres connection string) to auto-apply.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, "../.env") });

const sqlPath = resolve(
  here,
  "../../../supabase/migrations/20260813000000_xone_sdk_tables.sql",
);
const sql = readFileSync(sqlPath, "utf8");

const dbUrl = process.env.SUPABASE_DB_URL?.trim();
if (!dbUrl) {
  console.log("Apply this SQL in Supabase Dashboard → SQL Editor:\n");
  console.log(sqlPath);
  console.log("\n--- SQL preview (first 20 lines) ---");
  console.log(sql.split(/\r?\n/).slice(0, 20).join("\n"));
  console.log("...\n");
  console.log(
    "Tip: set SUPABASE_DB_URL=postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres to auto-apply.",
  );
  process.exit(0);
}

const { default: pg } = await import("pg").catch(() => ({ default: null }));
if (!pg) {
  console.error("Install pg to auto-apply: pnpm add -D pg --filter @xone/api");
  process.exit(1);
}

const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
await client.connect();
await client.query(sql);
await client.end();
console.log("Applied", sqlPath);
