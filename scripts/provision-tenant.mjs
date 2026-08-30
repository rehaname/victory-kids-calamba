#!/usr/bin/env node
/**
 * Provision Victory Calamba as a second tenant on shared nomad-tenants.
 *
 * Hard rules:
 * - Never touch schema iosifin
 * - Never re-run migrations 0001–0004
 * - Only call public.create_tenant('<slug>')
 * - Only APPEND the new schema to PostgREST exposed schemas
 *
 * Requires: NOMAD_SUPABASE_ACCESS_TOKEN
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const PROJECT_REF = "rhmvnrvukvcyllxotvya";
const TENANT = "victory_calamba";
const API = "https://api.supabase.com/v1";
const token =
  process.env.iosifin_supabase_access_token ||
  process.env.IOSIFIN_SUPABASE_ACCESS_TOKEN ||
  process.env.NOMAD_SUPABASE_ACCESS_TOKEN ||
  process.env.SUPABASE_ACCESS_TOKEN;

if (!token) {
  console.error(
    "Missing Supabase access token. Expected one of:",
  );
  console.error(
    "  iosifin_supabase_access_token | NOMAD_SUPABASE_ACCESS_TOKEN | SUPABASE_ACCESS_TOKEN",
  );
  console.error("Add it to Cloud Agent secrets and relaunch this agent, then re-run:");
  console.error("  npm run provision:tenant");
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlDir = join(__dirname, "../supabase/sql");
const kidsSqlFiles = [
  "01_victory_kids_tables.sql",
  "02_staff_pin_remarks.sql",
  "03_children_nickname.sql",
  "04_sessions_service_metadata.sql",
  "05_sessions_location.sql",
];

async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  if (!res.ok) {
    const err = new Error(`${method} ${path} failed: ${res.status}`);
    err.details = json;
    throw err;
  }
  return json;
}

async function query(sql) {
  return api("POST", `/projects/${PROJECT_REF}/database/query`, { query: sql });
}

async function main() {
  console.log(`Project: ${PROJECT_REF}`);
  console.log(`Tenant slug: ${TENANT}`);

  // 1) Confirm slug does not already exist
  const existing = await query(
    `select nspname from pg_namespace where nspname = '${TENANT}';`,
  );
  const alreadyExists = Array.isArray(existing) && existing.length > 0;
  console.log(alreadyExists ? `Schema ${TENANT} already exists.` : `Schema ${TENANT} not found.`);

  // 2) Create tenant via public.create_tenant only (stamps base tenant tables/RLS/RPCs)
  if (!alreadyExists) {
    console.log(`Calling public.create_tenant('${TENANT}')...`);
    await query(`select public.create_tenant('${TENANT}');`);
    console.log("create_tenant completed.");
  } else {
    console.log("Skipping create_tenant (schema already present).");
  }

  // 3) Read current PostgREST schemas and APPEND only if missing
  const postgrest = await api("GET", `/projects/${PROJECT_REF}/postgrest`);
  const current = String(postgrest.db_schema || "");
  const parts = current
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  console.log("Current db_schema:", current);

  if (!parts.includes(TENANT)) {
    const next = [...parts, TENANT].join(", ");
    console.log("Updating db_schema to:", next);
    await api("PATCH", `/projects/${PROJECT_REF}/postgrest`, {
      db_schema: next,
    });
  } else {
    console.log(`${TENANT} already in exposed schemas.`);
  }

  // 4) Add Victory Kids tables into the tenant schema (does not touch iosifin)
  for (const file of kidsSqlFiles) {
    const sql = readFileSync(join(sqlDir, file), "utf8");
    console.log(`Applying ${file}...`);
    await query(sql);
    console.log(`${file} applied.`);
  }

  // 5) Verify isolation markers
  const tables = await query(`
    select table_schema, table_name
    from information_schema.tables
    where table_schema in ('iosifin', '${TENANT}')
      and table_type = 'BASE TABLE'
    order by table_schema, table_name;
  `);
  console.log("Tenant tables snapshot:");
  console.log(JSON.stringify(tables, null, 2));

  const verify = await query(`
    select
      exists(select 1 from pg_namespace where nspname = 'iosifin') as iosifin_ok,
      exists(select 1 from pg_namespace where nspname = '${TENANT}') as victory_ok,
      exists(
        select 1 from information_schema.tables
        where table_schema = '${TENANT}' and table_name = 'parents'
      ) as parents_ok,
      exists(
        select 1 from information_schema.tables
        where table_schema = '${TENANT}' and table_name = 'children'
      ) as children_ok,
      exists(
        select 1 from information_schema.tables
        where table_schema = '${TENANT}' and table_name = 'sessions'
      ) as sessions_ok,
      exists(
        select 1 from information_schema.tables
        where table_schema = '${TENANT}' and table_name = 'attendance'
      ) as attendance_ok;
  `);
  console.log("Verification:", JSON.stringify(verify, null, 2));
  console.log("Done. iosifin was not modified.");
}

main().catch((err) => {
  console.error(err.message);
  if (err.details) console.error(JSON.stringify(err.details, null, 2));
  process.exit(1);
});
