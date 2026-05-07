-- ============================================================
-- Migration 014b: Team helper function for member email lookup
-- SECURITY DEFINER so it can join auth.users without exposing
-- the table to the anon/authenticated roles directly.
-- ============================================================

CREATE OR REPLACE FUNCTION get_team_members_with_emails(p_team_id uuid)
RETURNS TABLE(
  user_id    uuid,
  email      text,
  joined_at  timestamptz
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    tm.user_id,
    u.email::text,
    tm.joined_at
  FROM team_members tm
  JOIN auth.users u ON u.id = tm.user_id
  WHERE tm.team_id = p_team_id
    AND p_team_id IN (
      SELECT get_user_team_ids.team_id
      FROM get_user_team_ids(auth.uid())
    )
  ORDER BY tm.joined_at;
$$;

GRANT EXECUTE ON FUNCTION get_team_members_with_emails(uuid) TO authenticated;
