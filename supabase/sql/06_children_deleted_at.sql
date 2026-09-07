-- Soft-delete for registered children (Victory Calamba only).
-- Attendance keeps referencing soft-deleted rows so history names remain.
-- Safe / idempotent. Does not touch iosifin.

alter table victory_calamba.children
  add column if not exists deleted_at timestamptz null;

create index if not exists children_active_name_idx
  on victory_calamba.children (lower(last_name), lower(first_name))
  where deleted_at is null;

notify pgrst, 'reload schema';
