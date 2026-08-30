-- Location-tagged Kids Church sessions: multiple open sessions allowed.
-- Halang / Bayan (and any free-text site) can run the same service hour at once;
-- consecutive Starts at the same location+hour also create distinct rows.
-- Safe / idempotent. victory_calamba only. Does not touch iosifin / public / other tenants.

alter table victory_calamba.sessions
  add column if not exists location text not null default '';

-- Drop every "at most one open session" guard (global and per-service-per-day).
drop index if exists victory_calamba.sessions_one_open_idx;
drop index if exists victory_calamba.sessions_one_open_per_service_idx;

-- Non-unique helper for listing today's live sessions.
create index if not exists sessions_open_started_at_idx
  on victory_calamba.sessions (started_at desc)
  where status = 'open';
