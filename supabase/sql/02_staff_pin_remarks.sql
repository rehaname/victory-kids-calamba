-- Staff kiosk PIN storage for Victory Calamba.
-- Uses public.profiles.remarks so church can update the PIN without a deploy.
-- Safe / idempotent. Does not touch iosifin rows beyond the shared column add.

alter table public.profiles
  add column if not exists remarks text;

-- Default PIN: 331616 (John 3:16). Church can change remarks anytime.
update public.profiles
set remarks = coalesce(nullif(trim(remarks), ''), '331616')
where tenant = 'victory_calamba'
  and role = 'admin';
