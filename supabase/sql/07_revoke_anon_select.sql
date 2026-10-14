-- Revoke anon SELECT on Kids Church tables in schema victory_calamba only.
-- Apply manually after review. Does not change service_role grants.
-- Does not change POS table grants.

revoke select on victory_calamba.parents, victory_calamba.children,
  victory_calamba.sessions, victory_calamba.attendance
  from anon;
