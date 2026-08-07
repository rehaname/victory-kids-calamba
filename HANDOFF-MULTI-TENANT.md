# Multi-Tenant Handoff — nomad-tenants + Victory Kids

Last updated: 2026-08-07  
Audience: next agent continuing Victory Kids Calamba on the shared Supabase project  
Related app handoff: [`HANDOFF.md`](./HANDOFF.md)

For product/UI next steps see [`HANDOFF.md`](./HANDOFF.md). This file is the multi-tenant source of truth.

---

## Architecture in one paragraph

Auth and API keys are **shared** across tenants in one Supabase project (`nomad-tenants`, ref `rhmvnrvukvcyllxotvya`). Isolation is **per Postgres schema** plus `public.profiles.tenant`. Each customer/SME gets its own schema (example live tenant: `iosifin`). Each deployed app instance hardcodes **one** tenant slug so it never reads/writes another tenant’s schema.

```text
┌─────────────────────────────────────────────────────────┐
│  Supabase project: nomad-tenants (rhmvnrvukvcyllxotvya) │
│                                                         │
│  shared: auth.*  public.profiles  public.create_tenant  │
│                                                         │
│  schema iosifin          schema victory_calamba         │
│  (POS / live SME)        (Kids Church — this app)       │
│                                                         │
│  PostgREST db_schema includes BOTH schemas (append only)│
└─────────────────────────────────────────────────────────┘
         ▲                              ▲
         │                              │
  iosifin Vercel app           victory-kids Vercel app
  TENANT_SCHEMA=iosifin        TENANT_SCHEMA=victory_calamba
  (do not change)              (this repo only)
```

---

## Project facts

| Item | Value |
|------|--------|
| Supabase project name | `nomad-tenants` |
| Project ref | `rhmvnrvukvcyllxotvya` |
| API URL | `https://rhmvnrvukvcyllxotvya.supabase.co` |
| Existing live tenant | `iosifin` |
| New tenant for this app | `victory_calamba` |
| Isolation keys | schema name + `public.profiles.tenant` |
| App constant file | [`src/lib/tenant.ts`](src/lib/tenant.ts) |

In this repo today:

```ts
export const TENANT = "victory_calamba";
export const TENANT_SCHEMA = "victory_calamba";
export const PROJECT_REF = "rhmvnrvukvcyllxotvya";
```

Clients set `db: { schema: TENANT_SCHEMA }` so PostgREST queries hit only that schema.

---

## Hard rules (never violate)

1. **Never** drop, alter, truncate, or rewrite schema `iosifin`, its tables, RLS, or RPCs.
2. **Never** re-run migrations `0001`–`0004` as a whole. They already exist. Only call `public.create_tenant('<new>')`.
3. **Never** remove `iosifin` from PostgREST exposed schemas. Only **append** the new schema name.
4. **Do not** change the iosifin app deployment’s `TENANT_SCHEMA` / `TENANT` to the new name.
5. Schema name must be a safe Postgres identifier: lowercase letters, digits, underscore only.
6. Do **not** use reserved names: `public`, `storage`, `auth`, `extensions`, `graphql_public`, or `iosifin`.
7. Do **not** create a new Supabase project unless explicitly asked.
8. Do **not** change Auth settings (email confirm stays off; HIBP is Pro-only).
9. Do **not** manually recreate base tables that `create_tenant` already stamps (stores/products/orders style POS stamp). For Kids Church, **add** app-specific tables in the new schema after `create_tenant`.
10. Keep **one app instance per tenant** so hardcoded `TENANT` / `TENANT_SCHEMA` never collide.

---

## How a second tenant is created

### Step A — Confirm slug is free

```sql
select nspname from pg_namespace where nspname = 'victory_calamba';
```

### Step B — Stamp tenant via RPC only

```sql
select public.create_tenant('victory_calamba');
```

`create_tenant` clones the base tenant footprint (tables/RLS/RPCs pattern used by `iosifin`). It does **not** create Kids Church domain tables by itself.

### Step C — Expose schema on PostgREST (append only)

```http
PATCH /v1/projects/rhmvnrvukvcyllxotvya/postgrest
Authorization: Bearer <management_access_token>
Content-Type: application/json

{
  "db_schema": "public, storage, graphql_public, iosifin, victory_calamba"
}
```

Always **GET** current `db_schema` first and append if missing. Never replace the list with only the new schema.

### Step D — Add Victory Kids tables (app-owned)

Apply [`supabase/sql/01_victory_kids_tables.sql`](supabase/sql/01_victory_kids_tables.sql) into `victory_calamba` only:

- `victory_calamba.parents`
- `victory_calamba.children`
- `victory_calamba.sessions`
- `victory_calamba.attendance`

RLS on those tables is keyed on:

```sql
exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and p.tenant = 'victory_calamba'
)
```

### Automated script in this repo

```bash
npm run provision:tenant
```

Script: [`scripts/provision-tenant.mjs`](scripts/provision-tenant.mjs)

It expects a Management API token from one of:

- `iosifin_supabase_access_token`
- `IOSIFIN_SUPABASE_ACCESS_TOKEN`
- `NOMAD_SUPABASE_ACCESS_TOKEN`
- `SUPABASE_ACCESS_TOKEN`

**Status:** previous cloud agent could not run this because no token was injected (`environment: null`). Next agent must confirm the secret is present, then run the script.

---

## App instance model (critical)

| Concern | iosifin instance | victory-kids instance |
|---------|------------------|------------------------|
| Supabase URL | same | same |
| Anon key | same | same |
| Service role key | same | same |
| Hardcoded `TENANT` | `iosifin` | `victory_calamba` |
| Hardcoded `TENANT_SCHEMA` | `iosifin` | `victory_calamba` |
| Vercel project | existing iosifin deploy | **separate** Victory Kids deploy |
| Admin/staff seats | iosifin seats | victory seats (do not steal iosifin seats) |

Shared env shape for Victory Kids:

```env
NEXT_PUBLIC_SUPABASE_URL=https://rhmvnrvukvcyllxotvya.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
KIDS_DATA_SOURCE=supabase
```

Do **not** put `TENANT_SCHEMA` in shared env that both apps read unless each deploy overrides it. Prefer hardcoded constants per app (already done in this repo).

---

## Isolation model

1. **Schema isolation** — queries use `db.schema = TENANT_SCHEMA`, so the client talks to `victory_calamba.*` not `iosifin.*`.
2. **RLS isolation** — policies require `public.profiles.tenant` to match the tenant slug.
3. **Deployment isolation** — separate Vercel app/instance so a misconfigured env cannot flip the live iosifin tenant.

### Verification checklist

```sql
-- schemas exist
select nspname from pg_namespace where nspname in ('iosifin', 'victory_calamba');

-- kids tables only under victory
select table_schema, table_name
from information_schema.tables
where table_name in ('parents','children','sessions','attendance')
order by table_schema, table_name;

-- iosifin still present / untouched expectation
select count(*) from information_schema.tables where table_schema = 'iosifin';
```

Also verify via app:

- iosifin authenticated user cannot read Victory Kids attendance
- victory staff cannot read iosifin POS tables
- starting/closing a Kids session does not affect iosifin

---

## Auth / seats notes

- Auth is project-wide (same Auth users table).
- Tenant membership is via `public.profiles.tenant`.
- If nano-db uses `/admin/signup` (first N admin seats per tenant) and `/signup` for employees, Victory Kids should onboard against **its own app instance** so seats are counted for `victory_calamba`, not `iosifin`.
- Do not edit iosifin Vercel env or Auth project settings while doing this.

---

## What `create_tenant` vs Kids SQL own

| Layer | Owner | Examples |
|-------|--------|----------|
| Shared platform | migrations 0001–0004 (already applied) | `public.create_tenant`, `public.profiles`, grants |
| Per-tenant base stamp | `create_tenant('slug')` | base SME tables/RLS/RPCs (POS-style footprint) |
| Kids Church domain | this app’s SQL only | `parents`, `children`, `sessions`, `attendance` |

Do not invent a parallel tenant-creation path. Always go through `create_tenant`, then add Kids tables.

---

## Current repo wiring

| File | Role |
|------|------|
| [`src/lib/tenant.ts`](src/lib/tenant.ts) | Hardcoded `TENANT` / `TENANT_SCHEMA` / `PROJECT_REF` |
| [`src/lib/supabase/client.ts`](src/lib/supabase/client.ts) | Browser client with `db.schema = TENANT_SCHEMA` |
| [`src/lib/supabase/server.ts`](src/lib/supabase/server.ts) | Server client with same schema |
| [`src/lib/data/supabase.ts`](src/lib/data/supabase.ts) | Kids CRUD against schema tables |
| [`src/lib/data/index.ts`](src/lib/data/index.ts) | Switches memory vs supabase via `KIDS_DATA_SOURCE` |
| [`scripts/provision-tenant.mjs`](scripts/provision-tenant.mjs) | Safe create + expose + Kids SQL |
| [`supabase/sql/01_victory_kids_tables.sql`](supabase/sql/01_victory_kids_tables.sql) | Kids tables + RLS |

Default today: `KIDS_DATA_SOURCE=memory` until provisioning + keys are ready.

---

## Ordered next actions for next agent

1. Confirm Management API token env is present (see names above).
2. Run `npm run provision:tenant`.
3. Confirm PostgREST exposes `iosifin` **and** `victory_calamba`.
4. Confirm Kids tables exist under `victory_calamba` only.
5. Set Victory app env (`URL`, anon, service role, `KIDS_DATA_SOURCE=supabase`).
6. Onboard victory staff profile with `profiles.tenant = 'victory_calamba'`.
7. E2E: session → register → check-in → check-out → history/CSV.
8. Deploy a **separate** Vercel instance; leave iosifin deploy alone.

---

## Do not

- Create another Supabase project for Victory
- Point iosifin `TENANT_SCHEMA` at `victory_calamba`
- Rewrite PostgREST schemas without including `iosifin`
- Drop or migrate `iosifin` data “to clean up”
- Share one running app process that switches tenants dynamically in MVP
- Commit access tokens, service role keys, or `.env.local`

---

## Definition of done (multi-tenant)

- [ ] `victory_calamba` schema created via `public.create_tenant('victory_calamba')`
- [ ] PostgREST `db_schema` includes both `iosifin` and `victory_calamba`
- [ ] Kids tables live only in `victory_calamba`
- [ ] RLS uses `public.profiles.tenant = 'victory_calamba'`
- [ ] This app hardcodes `TENANT_SCHEMA=victory_calamba`
- [ ] Separate Vercel instance uses same project URL/keys, different tenant constant
- [ ] iosifin schema, deploy, and data remain unchanged
- [ ] Isolation verified both directions
