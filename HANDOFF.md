# Victory Kids Calamba — Agent Handoff

Last updated: 2026-07-15  
Branch: `cursor/victory-kids-kiosk-4c53`  
PR: https://github.com/rehaname/victory-kids-calamba/pull/1  
Repo: https://github.com/rehaname/victory-kids-calamba  
Base branch: `main`

Related multi-tenant handoff: [`HANDOFF-MULTI-TENANT.md`](./HANDOFF-MULTI-TENANT.md)

## Goal

Build a simple staff-managed Kids Church check-in kiosk for Victory Calamba (iPad/laptop). Parents type on the church device; staff starts/closes sessions. No parent accounts.

## Product decisions (locked)

- Brand: Victory Calamba (blue / white / black)
- Single kiosk app (not separate parent/staff portals)
- Staff owns the device; parents only type into it
- Checkout: claimant types their full name (dad/relative/etc.)
- Sessions: labeled by date/time (`Asia/Manila`), no named service types required
- One parent → many children
- Internet reliable → no offline IndexedDB sync in MVP
- DB: shared Supabase project `nomad-tenants` (`rhmvnrvukvcyllxotvya`)
- Deploy: Vercel
- Future: RFID claim tags (nullable `rfid_tag_id` field already planned)

## Views

1. **Current Pool** — search, Time In, age groups 4–6 / 7–9 / 10–12, Time Out
2. **Register** — parent + children first visit
3. **History** — session attendance + CSV export

Search/results must show child full name + parent full name as sub-label.

## What’s already done

- Next.js App Router + Tailwind + shadcn UI scaffolded
- Victory-branded kiosk UI in [`src/components/kiosk-app.tsx`](src/components/kiosk-app.tsx)
- Domain model + memory repository for local demo
- Supabase repository ready behind `KIDS_DATA_SOURCE=supabase`
- Hardcoded tenant constants in [`src/lib/tenant.ts`](src/lib/tenant.ts):
  - `TENANT = "victory_calamba"`
  - `TENANT_SCHEMA = "victory_calamba"`
- Provision script: [`scripts/provision-tenant.mjs`](scripts/provision-tenant.mjs)
- Kids SQL: [`supabase/sql/01_victory_kids_tables.sql`](supabase/sql/01_victory_kids_tables.sql)
- Build passes; age-pool unit test passes
- App currently runs on **in-memory** data until Supabase is wired

## Blocked item (do this first)

Tenant provisioning was **not executed** because no Supabase Management API token was injected into the previous cloud agent run (`environment: null`).

Tried env names (none present):

- `iosifin_supabase_access_token`
- `NOMAD_SUPABASE_ACCESS_TOKEN`
- `SUPABASE_ACCESS_TOKEN`

### Confirm token is available

```bash
python3 - <<'PY'
import os
for k in [
  'iosifin_supabase_access_token',
  'IOSIFIN_SUPABASE_ACCESS_TOKEN',
  'NOMAD_SUPABASE_ACCESS_TOKEN',
  'SUPABASE_ACCESS_TOKEN',
]:
  v = os.environ.get(k)
  print(f'{k}: present={v is not None} len={len(v) if v is not None else "NA"}')
PY
```

If all `present=False`, fix Cloud Agent secrets / relaunch the agent, then continue.

## Critical next steps (in order)

### 1) Provision `victory_calamba` tenant (do not touch `iosifin`)

Hard rules from the multi-tenant nano-db setup:

- Never drop/alter/truncate schema `iosifin`
- Never re-run migrations `0001–0004`
- Only call `public.create_tenant('<slug>')`
- Never remove `iosifin` from PostgREST exposed schemas — only append
- Do not change the iosifin app’s `TENANT_SCHEMA`
- Schema name: lowercase letters/digits/underscore only → use `victory_calamba`

Run:

```bash
npm run provision:tenant
```

That script should:

1. Check `pg_namespace` for `victory_calamba`
2. Call `select public.create_tenant('victory_calamba');` if missing
3. GET current PostgREST `db_schema`, then PATCH appending `victory_calamba`
4. Apply Kids tables SQL into `victory_calamba` only
5. Verify `iosifin` still exists and Kids tables exist

Expected exposed schemas example:

`public, storage, graphql_public, iosifin, victory_calamba`

### 2) Wire app env to Supabase

Create `.env.local` (do not commit secrets):

```env
NEXT_PUBLIC_SUPABASE_URL=https://rhmvnrvukvcyllxotvya.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
KIDS_DATA_SOURCE=supabase
```

Same project URL/keys as iosifin app, but this instance must keep:

- [`src/lib/tenant.ts`](src/lib/tenant.ts) → `victory_calamba`
- [`src/lib/supabase/client.ts`](src/lib/supabase/client.ts) / server client already use `TENANT_SCHEMA`

### 3) Staff auth for this tenant

- Use shared Auth on the same Supabase project
- Isolation is `public.profiles.tenant = 'victory_calamba'`
- Onboard Victory staff/admins against this app instance only
- Do not consume/modify iosifin seats/users beyond shared Auth infrastructure

If the existing nano-db uses `/admin/signup` + `/signup` seat model, mirror that pattern for this Kids app **or** add a minimal staff PIN/login suitable for a church kiosk. Prefer matching the existing tenant auth model if already stamped by `create_tenant`.

### 4) Verify isolation

- iosifin user must not see `victory_calamba` Kids tables
- victory staff must not see iosifin POS data
- Closing/opening Kids sessions must not affect iosifin

### 5) End-to-end kiosk test

1. Start session
2. Register parent + 2 children
3. Time In → appears in correct age pool
4. Search shows child + parent sub-label
5. Time Out with claimant name
6. Close session (warn if anyone still checked in)
7. History + CSV export

### 6) Deploy to Vercel

- Separate Vercel project/instance from iosifin
- Env: same Supabase URL/keys, `KIDS_DATA_SOURCE=supabase`
- Do **not** point iosifin’s `TENANT_SCHEMA` at `victory_calamba`

## Key files

| Path | Purpose |
|------|---------|
| `src/components/kiosk-app.tsx` | Main UI |
| `src/app/actions.ts` | Server actions |
| `src/lib/tenant.ts` | Hardcoded tenant slug |
| `src/lib/data/memory.ts` | Local demo store |
| `src/lib/data/supabase.ts` | Supabase adapter |
| `scripts/provision-tenant.mjs` | Safe tenant create + Kids SQL |
| `supabase/sql/01_victory_kids_tables.sql` | parents/children/sessions/attendance |

## Kids schema (in `victory_calamba`)

- `parents` — full_name, address, contact_number
- `children` — parent_id, first_name, last_name, birthday, home_service
- `sessions` — started_at, ended_at, status (`open`/`closed`), one open session max
- `attendance` — session_id, child_id, time_in, time_out, claimant_name, rfid_tag_id (nullable)

Age pool is computed from birthday (not stored).

## Commands

```bash
git checkout cursor/victory-kids-kiosk-4c53
npm install
npm run dev          # memory mode by default
npm run test
npm run build
npm run provision:tenant   # needs Management API token in env
```

## Do not

- Create a new Supabase project
- Modify/delete `iosifin` schema, RLS, RPCs, or Vercel env
- Re-run migrations 0001–0004
- Use Google Sheets as the live DB
- Build parent accounts / public parent portal
- Spend time on RFID yet (schema field only)

## Definition of done for next agent

- [ ] `victory_calamba` schema exists via `create_tenant`
- [ ] PostgREST exposes both `iosifin` and `victory_calamba`
- [ ] Kids tables exist only under `victory_calamba`
- [ ] App runs with `KIDS_DATA_SOURCE=supabase`
- [ ] Staff can start session, register, check in/out, close, export CSV
- [ ] iosifin data untouched
- [ ] Vercel deployment for this instance configured (or ready)
