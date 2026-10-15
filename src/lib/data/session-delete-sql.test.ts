import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync(
  new URL("../../../supabase/sql/08_sessions_deleted_at.sql", import.meta.url),
  "utf8",
);

test("session soft-delete SQL stays in victory_calamba and keeps anon locked out", () => {
  assert.match(sql, /add column if not exists deleted_at timestamptz null/i);
  assert.match(sql, /create index if not exists sessions_active_started_at_idx/i);
  assert.match(sql, /on victory_calamba\.sessions \(started_at desc\)/i);
  assert.doesNotMatch(sql, /create index if not exists victory_calamba\.sessions_active_started_at_idx/i);
  assert.match(sql, /function victory_calamba\.soft_delete_session\(session_id uuid\)/);
  assert.match(sql, /function victory_calamba\.soft_delete_children\(child_ids uuid\[\]\)/);
  assert.match(sql, /for update/i);
  assert.match(sql, /time_out is null/i);
  assert.match(sql, /guard_attendance_insert/);
  assert.match(sql, /guard_child_soft_delete/);
  assert.match(sql, /guard_session_soft_delete/);
  assert.match(
    sql,
    /revoke all on function victory_calamba\.soft_delete_session\(uuid\) from public, anon, authenticated/i,
  );
  assert.match(
    sql,
    /revoke all on function victory_calamba\.soft_delete_children\(uuid\[\]\) from public, anon, authenticated/i,
  );
  assert.match(
    sql,
    /grant execute on function victory_calamba\.soft_delete_session\(uuid\) to service_role/i,
  );
  assert.match(
    sql,
    /revoke select on victory_calamba\.parents, victory_calamba\.children,\s+victory_calamba\.sessions, victory_calamba\.attendance\s+from anon/i,
  );
  assert.match(sql, /notify pgrst, 'reload schema'/);
  assert.doesNotMatch(sql, /iosifin/i);
  assert.doesNotMatch(sql, /security definer/i);
  assert.doesNotMatch(sql, /grant\s+(select|insert|update|delete|all)\b[\s\S]*?\bto\s+anon\b/i);
});
