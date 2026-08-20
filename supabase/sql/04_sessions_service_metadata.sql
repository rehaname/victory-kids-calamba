-- Name Kids-Church sessions and allow one open session per service time per day.
-- Before this, a partial unique index allowed exactly one open session overall,
-- so "select the live session" had nothing to choose between.
-- Safe / idempotent. Does not touch iosifin.

alter table victory_calamba.sessions
  add column if not exists name text not null default '',
  add column if not exists service_time text not null default '',
  add column if not exists session_date date not null
    default (now() at time zone 'Asia/Manila')::date;

-- Existing rows predate the columns: derive their date from started_at and give
-- them a readable label so the session picker never shows a blank entry.
update victory_calamba.sessions
set session_date = (started_at at time zone 'Asia/Manila')::date
where session_date <> (started_at at time zone 'Asia/Manila')::date;

update victory_calamba.sessions
set name = to_char(started_at at time zone 'Asia/Manila', 'FMMon FMDD, YYYY FMHH12:MI AM')
where trim(name) = '';

create index if not exists sessions_started_at_idx
  on victory_calamba.sessions (started_at desc);

create index if not exists sessions_open_idx
  on victory_calamba.sessions (session_date desc)
  where status = 'open';

-- Replace "one open session, ever" with "one open session per service time per day".
drop index if exists victory_calamba.sessions_one_open_idx;

create unique index if not exists sessions_one_open_per_service_idx
  on victory_calamba.sessions (session_date, service_time)
  where status = 'open';
