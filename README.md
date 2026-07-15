# Victory Calamba Kids Church

Staff-managed check-in kiosk for Kids Church. Parents type on the church iPad/laptop; staff starts and closes sessions.

## Stack

- Next.js (App Router) on Vercel
- Supabase shared project `nomad-tenants` (`rhmvnrvukvcyllxotvya`)
- Tenant schema: `victory_calamba` (isolated from `iosifin`)

## Local demo (no Supabase yet)

```bash
npm install
npm run dev
```

Uses an in-memory store until `KIDS_DATA_SOURCE=supabase` is set.

## Provision tenant (does not touch iosifin)

```bash
export NOMAD_SUPABASE_ACCESS_TOKEN=sbp_...
npm run provision:tenant
```

This will:

1. Call `select public.create_tenant('victory_calamba');`
2. Append `victory_calamba` to PostgREST exposed schemas
3. Create Kids tables: `parents`, `children`, `sessions`, `attendance`

## Env for this app instance

```env
NEXT_PUBLIC_SUPABASE_URL=https://rhmvnrvukvcyllxotvya.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
KIDS_DATA_SOURCE=supabase
```

Hardcoded tenant constants live in `src/lib/tenant.ts` (`TENANT` / `TENANT_SCHEMA` = `victory_calamba`).

## Views

1. **Current Pool** — search, Time In, age groups 4–6 / 7–9 / 10–12, Time Out with claimant name
2. **Register** — parent + multiple children
3. **History** — session attendance + CSV export
