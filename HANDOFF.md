# Victory Kids Calamba — Agent Handoff

Last updated: 2026-07-15  
Branch: `main`  
Merged PRs: #3 (kiosk UI), #4 (Vercel deploy fix)  
Prior PRs: https://github.com/rehaname/victory-kids-calamba/pull/2, https://github.com/rehaname/victory-kids-calamba/pull/1  
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

1. **Kids Church pool (`/`)** — session start/close, age pools, check-in modal
2. **Check-in modal** — search existing child or register new (session required)
3. **History (`/history`)** — session attendance + CSV export

Search/results must show child full name + parent full name as sub-label.

## What’s already done

- Next.js App Router + Tailwind + shadcn UI scaffolded
- Victory-branded kiosk UI ([`src/components/kids-church-pool.tsx`](src/components/kids-church-pool.tsx))
- History module at `/history`
- Staff PIN gate ([`src/components/staff-pin-gate.tsx`](src/components/staff-pin-gate.tsx))
- Domain model + memory repository for local demo
- Supabase repository ready behind `KIDS_DATA_SOURCE=supabase`
- Hardcoded tenant constants in [`src/lib/tenant.ts`](src/lib/tenant.ts):
  - `TENANT = "victory_calamba"`
  - `TENANT_SCHEMA = "victory_calamba"`
- Provision script: [`scripts/provision-tenant.mjs`](scripts/provision-tenant.mjs)
- Kids SQL: [`supabase/sql/01_victory_kids_tables.sql`](supabase/sql/01_victory_kids_tables.sql)
- Build passes; age-pool unit test passes

### Unblocked and completed this run

- Cloud Agent secrets present: `IOSIFIN_SUPABASE_ACCESS_TOKEN`, `NOMAD_SUPABASE_ACCESS_TOKEN`
- Ran `npm run provision:tenant` successfully:
  - Called `public.create_tenant('victory_calamba')` (schema was missing)
  - Appended PostgREST schemas to: `public, storage, graphql_public, iosifin, victory_calamba`
  - Applied Kids tables (`parents`, `children`, `sessions`, `attendance`) under `victory_calamba` only
  - Verified `iosifin` still present and untouched (no Kids tables under `iosifin`)
- Wired server data path to service-role client scoped to `TENANT_SCHEMA`:
  - [`src/lib/supabase/admin.ts`](src/lib/supabase/admin.ts)
  - [`src/lib/data/supabase.ts`](src/lib/data/supabase.ts) uses admin client
  - [`src/lib/data/index.ts`](src/lib/data/index.ts) requires `SUPABASE_SERVICE_ROLE_KEY`
- Local `.env.local` created (gitignored) with URL + anon + service_role + `KIDS_DATA_SOURCE=supabase`
- E2E smoke against live DB: start session → register parent+2 kids → check-in → check-out with claimant → close → history OK
- Isolation checks: `iosifin.parents` does not exist; `victory_calamba.parents` exists; anon insert blocked
- Created Auth staff admin for this tenant only:
  - email: `victory.kids.staff@victorycalamba.local`
  - `public.profiles.tenant = 'victory_calamba'`, `role = 'admin'`, `status = 'active'`
  - Password generated locally (not committed). Reset via Supabase Auth Admin API / dashboard if needed.

### Merged this run (PR #3 + #4)

- Kiosk UI: Church Service default, optional address, underline tabs, age 4–12 enforcement, pool sort by age, child detail + Out flow
- Vercel: `vercel.json` forces Next.js framework preset (fixes platform 404 on all URLs)
- Production live: https://victory-kids-calamba.vercel.app

### Staff PIN unlock (current branch)

- 6-digit PIN stored in `public.profiles.remarks` for `victory_calamba` admin
- Default PIN: **331616** (John 3:16) — church can update `remarks` anytime in Supabase
- Asked on first open of a browser tab (`sessionStorage`); **not** asked again on refresh
- Kids Church session stays open in DB across refresh / tab close; staff re-enters PIN then can Close session
- SQL: [`supabase/sql/02_staff_pin_remarks.sql`](supabase/sql/02_staff_pin_remarks.sql)

## Remaining next steps

### 1) Optional: harden PIN with a short-lived server cookie

Client `sessionStorage` unlock is enough for a staff-owned iPad. For stronger protection, set an httpOnly cookie after `verifyStaffPinAction` and check it in server actions.

### 2) Vercel env vars (if not already set in dashboard)

- Separate Vercel project/instance from iosifin
- Env vars (do not commit secrets):

```env
NEXT_PUBLIC_SUPABASE_URL=https://rhmvnrvukvcyllxotvya.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
KIDS_DATA_SOURCE=supabase
```

- Do **not** point iosifin’s `TENANT_SCHEMA` at `victory_calamba`

### 3) Browser E2E on the kiosk UI

With `.env.local` set, run `npm run dev` and exercise:

1. Start session
2. Register parent + 2 children
3. Time In → correct age pool
4. Search shows child + parent sub-label
5. Time Out with claimant name
6. Close session (warn if anyone still checked in)
7. History + CSV export

## Key files

| Path | Purpose |
|------|---------|
| `src/components/kiosk-app.tsx` | Main UI |
| `src/app/actions.ts` | Server actions |
| `src/lib/tenant.ts` | Hardcoded tenant slug |
| `src/lib/data/memory.ts` | Local demo store |
| `src/lib/data/supabase.ts` | Supabase adapter (service role) |
| `src/lib/supabase/admin.ts` | Service-role client |
| `scripts/provision-tenant.mjs` | Safe tenant create + Kids SQL |
| `supabase/sql/01_victory_kids_tables.sql` | parents/children/sessions/attendance |

## Kids schema (in `victory_calamba`)

- `parents` — full_name, address, contact_number
- `children` — parent_id, first_name, last_name, birthday, home_service
- `sessions` — started_at, ended_at, status (`open`/`closed`), one open session max
- `attendance` — session_id, child_id, time_in, time_out, claimant_name, rfid_tag_id (nullable)

Age pool is computed from birthday (not stored).

`create_tenant` also stamped POS base tables (`stores`, `products`, `orders`, `transactions`) into `victory_calamba` — leave them alone; Kids app does not use them.

## Commands

```bash
git checkout cursor/supabase-tenant-provision-bd91
npm install
npm run dev          # uses .env.local (supabase mode when configured)
npm run test
npm run build
npm run provision:tenant   # idempotent; needs Management API token in env
```

## Do not

- Create a new Supabase project
- Modify/delete `iosifin` schema, RLS, RPCs, or Vercel env
- Re-run migrations 0001–0004
- Use Google Sheets as the live DB
- Build parent accounts / public parent portal
- Spend time on RFID yet (schema field only)
- Remove `iosifin` from PostgREST exposed schemas

## Definition of done

- [x] `victory_calamba` schema exists via `create_tenant`
- [x] PostgREST exposes both `iosifin` and `victory_calamba`
- [x] Kids tables exist only under `victory_calamba`
- [x] App builds with `KIDS_DATA_SOURCE=supabase` + service role wired
- [x] Live DB E2E: session / register / check-in / check-out / close / history
- [x] iosifin data untouched
- [x] Staff PIN unlock (profiles.remarks; sessionStorage unlock)
- [x] Vercel deployment serving the app (add Supabase env vars in dashboard for live DB)
