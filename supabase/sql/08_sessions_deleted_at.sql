-- Soft-delete for Kids Church sessions (schema victory_calamba only).
-- Attendance keeps its session_id (ON DELETE RESTRICT). History rows stay.
-- Idempotent. Does not touch any schema other than victory_calamba.
-- Does not grant anon. Re-asserts script 07.
--
-- Check-in locks the session row, then the child row, before inserting.
-- Soft-delete locks those same rows, then refuses the write when anyone
-- is still checked in (time_out is null). An open session is closed in
-- the same update that sets deleted_at. A failed bulk child delete
-- rolls back the whole statement.

alter table victory_calamba.sessions
  add column if not exists deleted_at timestamptz null;

-- Index is created in victory_calamba because that is the table's schema.
create index if not exists sessions_active_started_at_idx
  on victory_calamba.sessions (started_at desc)
  where deleted_at is null;

create or replace function victory_calamba.guard_attendance_insert()
returns trigger
language plpgsql
set search_path = victory_calamba, pg_temp
as $$
declare
  sess victory_calamba.sessions%rowtype;
  child_deleted timestamptz;
begin
  select * into sess
  from victory_calamba.sessions
  where id = new.session_id
  for update;

  if not found or sess.deleted_at is not null or sess.status <> 'open' then
    raise exception 'No open session';
  end if;

  select deleted_at into child_deleted
  from victory_calamba.children
  where id = new.child_id
  for update;

  if not found then
    raise exception 'Child not found';
  end if;

  if child_deleted is not null then
    raise exception 'That child was removed from the roster.';
  end if;

  return new;
end;
$$;

create or replace function victory_calamba.guard_child_soft_delete()
returns trigger
language plpgsql
set search_path = victory_calamba, pg_temp
as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    if exists (
      select 1
      from victory_calamba.attendance
      where child_id = new.id
        and time_out is null
    ) then
      raise exception 'Check out first before removing this child from the roster.';
    end if;
  end if;
  return new;
end;
$$;

create or replace function victory_calamba.guard_session_soft_delete()
returns trigger
language plpgsql
set search_path = victory_calamba, pg_temp
as $$
declare
  still_in int;
begin
  if new.deleted_at is not null and old.deleted_at is null then
    select count(*) into still_in
    from victory_calamba.attendance
    where session_id = new.id
      and time_out is null;

    if still_in > 0 then
      raise exception '% child(ren) still checked in. Check them out before deleting this session.', still_in;
    end if;

    if old.status = 'open' then
      new.status := 'closed';
      if new.ended_at is null then
        new.ended_at := new.deleted_at;
      end if;
    end if;
  end if;
  return new;
end;
$$;

create or replace function victory_calamba.soft_delete_children(child_ids uuid[])
returns void
language plpgsql
set search_path = victory_calamba, pg_temp
as $$
declare
  requested uuid[];
  found_count int;
  names text[];
  shown text;
  extra int;
  updated_count int;
begin
  if child_ids is null or cardinality(child_ids) = 0 then
    raise exception 'Select at least one child.';
  end if;

  select coalesce(array_agg(distinct id), '{}'::uuid[])
    into requested
  from unnest(child_ids) as t(id)
  where id is not null;

  if cardinality(requested) = 0 then
    raise exception 'Select at least one child.';
  end if;

  if cardinality(requested) > 1000 then
    raise exception 'Select fewer children and try again.';
  end if;

  perform 1
  from victory_calamba.children c
  where c.id = any(requested)
  order by c.id
  for update;

  select count(*) into found_count
  from victory_calamba.children c
  where c.id = any(requested)
    and c.deleted_at is null;

  if found_count <> cardinality(requested) then
    raise exception 'Some selected children are no longer on the roster. Nothing was removed.';
  end if;

  select coalesce(
    array_agg(c.first_name || ' ' || c.last_name order by c.last_name, c.first_name),
    '{}'::text[]
  )
    into names
  from victory_calamba.children c
  where c.id = any(requested)
    and exists (
      select 1
      from victory_calamba.attendance a
      where a.child_id = c.id
        and a.time_out is null
    );

  if cardinality(names) > 0 then
    extra := greatest(cardinality(names) - 8, 0);
    shown := array_to_string(names[1:least(8, cardinality(names))], ', ');
    if extra > 0 then
      shown := shown || format(', and %s others', extra);
    end if;
    raise exception 'Check out first before removing: %. Nothing was removed.', shown;
  end if;

  update victory_calamba.children
  set deleted_at = now()
  where id = any(requested)
    and deleted_at is null;

  get diagnostics updated_count = row_count;
  if updated_count <> cardinality(requested) then
    raise exception 'Some selected children changed. Refresh and try again.';
  end if;
end;
$$;

create or replace function victory_calamba.soft_delete_session(session_id uuid)
returns void
language plpgsql
set search_path = victory_calamba, pg_temp
as $$
declare
  sess victory_calamba.sessions%rowtype;
  still_in int;
  stamp timestamptz := now();
begin
  if session_id is null then
    raise exception 'Session not found';
  end if;

  select * into sess
  from victory_calamba.sessions
  where id = session_id
  for update;

  if not found then
    raise exception 'Session not found';
  end if;

  if sess.deleted_at is not null then
    raise exception 'That session is already removed.';
  end if;

  select count(*) into still_in
  from victory_calamba.attendance
  where session_id = sess.id
    and time_out is null;

  if still_in > 0 then
    raise exception '% child(ren) still checked in. Check them out before deleting this session.', still_in;
  end if;

  if sess.status = 'open' then
    update victory_calamba.sessions
    set deleted_at = stamp,
        status = 'closed',
        ended_at = stamp
    where id = sess.id
      and deleted_at is null;
  else
    update victory_calamba.sessions
    set deleted_at = stamp
    where id = sess.id
      and deleted_at is null
      and status = 'closed';
  end if;

  if not found then
    raise exception 'That session is already removed.';
  end if;
end;
$$;

drop trigger if exists guard_attendance_insert on victory_calamba.attendance;
create trigger guard_attendance_insert
  before insert on victory_calamba.attendance
  for each row
  execute function victory_calamba.guard_attendance_insert();

drop trigger if exists guard_child_soft_delete on victory_calamba.children;
create trigger guard_child_soft_delete
  before update on victory_calamba.children
  for each row
  execute function victory_calamba.guard_child_soft_delete();

drop trigger if exists guard_session_soft_delete on victory_calamba.sessions;
create trigger guard_session_soft_delete
  before update on victory_calamba.sessions
  for each row
  execute function victory_calamba.guard_session_soft_delete();

revoke all on function victory_calamba.soft_delete_session(uuid) from public, anon, authenticated;
revoke all on function victory_calamba.soft_delete_children(uuid[]) from public, anon, authenticated;
revoke all on function victory_calamba.guard_attendance_insert() from public, anon, authenticated;
revoke all on function victory_calamba.guard_child_soft_delete() from public, anon, authenticated;
revoke all on function victory_calamba.guard_session_soft_delete() from public, anon, authenticated;

grant execute on function victory_calamba.soft_delete_session(uuid) to service_role;
grant execute on function victory_calamba.soft_delete_children(uuid[]) to service_role;
grant execute on function victory_calamba.guard_attendance_insert() to service_role;
grant execute on function victory_calamba.guard_child_soft_delete() to service_role;
grant execute on function victory_calamba.guard_session_soft_delete() to service_role;

revoke select on victory_calamba.parents, victory_calamba.children,
  victory_calamba.sessions, victory_calamba.attendance
  from anon;

notify pgrst, 'reload schema';
