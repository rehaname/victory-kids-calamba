-- Soft-delete for Kids Church sessions (schema victory_calamba only).
-- Attendance keeps its session_id (ON DELETE RESTRICT). History rows stay.
-- Idempotent. Does not touch iosifin, public, or other tenants.
-- Does not grant anon. Re-asserts script 07.

alter table victory_calamba.sessions
  add column if not exists deleted_at timestamptz null;

create index if not exists sessions_active_started_at_idx
  on victory_calamba.sessions (started_at desc)
  where deleted_at is null;

revoke select on victory_calamba.parents, victory_calamba.children,
  victory_calamba.sessions, victory_calamba.attendance
  from anon;

notify pgrst, 'reload schema';
