-- Victory Kids tables for tenant schema victory_calamba ONLY.
-- Safe to re-run. Does not touch schema iosifin or public.create_tenant internals.

create schema if not exists victory_calamba;

-- Parents / guardians (one parent record can own many children)
create table if not exists victory_calamba.parents (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  address text not null default '',
  contact_number text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Children linked to a parent
create table if not exists victory_calamba.children (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references victory_calamba.parents(id) on delete restrict,
  first_name text not null,
  last_name text not null,
  birthday date not null,
  home_service text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists children_parent_id_idx on victory_calamba.children(parent_id);
create index if not exists children_name_idx on victory_calamba.children (lower(last_name), lower(first_name));

-- Kids-Church sessions (labeled by start date/time)
create table if not exists victory_calamba.sessions (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);

create unique index if not exists sessions_one_open_idx
  on victory_calamba.sessions ((status))
  where status = 'open';

-- Attendance / check-in-out for a session
create table if not exists victory_calamba.attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references victory_calamba.sessions(id) on delete restrict,
  child_id uuid not null references victory_calamba.children(id) on delete restrict,
  time_in timestamptz not null default now(),
  time_out timestamptz,
  claimant_name text,
  -- Future RFID upgrade: claim tag assigned at check-in
  rfid_tag_id text,
  created_at timestamptz not null default now()
);

create unique index if not exists attendance_active_child_idx
  on victory_calamba.attendance (session_id, child_id)
  where time_out is null;

create index if not exists attendance_session_idx on victory_calamba.attendance(session_id);
create index if not exists attendance_child_idx on victory_calamba.attendance(child_id);

-- Grants for PostgREST roles (schema already stamped by create_tenant; re-grant is idempotent)
grant usage on schema victory_calamba to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema victory_calamba to authenticated, service_role;
grant select on all tables in schema victory_calamba to anon;
alter default privileges in schema victory_calamba
  grant select, insert, update, delete on tables to authenticated, service_role;

-- RLS: keyed on public.profiles.tenant (same isolation model as other tenants)
alter table victory_calamba.parents enable row level security;
alter table victory_calamba.children enable row level security;
alter table victory_calamba.sessions enable row level security;
alter table victory_calamba.attendance enable row level security;

-- Helper predicate reused by policies
-- profiles.tenant must equal 'victory_calamba' for this app instance.

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'victory_calamba' and tablename = 'parents' and policyname = 'victory_calamba_parents_all'
  ) then
    create policy victory_calamba_parents_all on victory_calamba.parents
      for all to authenticated
      using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.tenant = 'victory_calamba'
        )
      )
      with check (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.tenant = 'victory_calamba'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'victory_calamba' and tablename = 'children' and policyname = 'victory_calamba_children_all'
  ) then
    create policy victory_calamba_children_all on victory_calamba.children
      for all to authenticated
      using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.tenant = 'victory_calamba'
        )
      )
      with check (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.tenant = 'victory_calamba'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'victory_calamba' and tablename = 'sessions' and policyname = 'victory_calamba_sessions_all'
  ) then
    create policy victory_calamba_sessions_all on victory_calamba.sessions
      for all to authenticated
      using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.tenant = 'victory_calamba'
        )
      )
      with check (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.tenant = 'victory_calamba'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'victory_calamba' and tablename = 'attendance' and policyname = 'victory_calamba_attendance_all'
  ) then
    create policy victory_calamba_attendance_all on victory_calamba.attendance
      for all to authenticated
      using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.tenant = 'victory_calamba'
        )
      )
      with check (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.tenant = 'victory_calamba'
        )
      );
  end if;
end $$;
