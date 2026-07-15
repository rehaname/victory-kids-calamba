-- Add optional nickname for registered children (Victory Calamba only).
-- Safe / idempotent. Does not touch iosifin.

alter table victory_calamba.children
  add column if not exists nickname text not null default '';
