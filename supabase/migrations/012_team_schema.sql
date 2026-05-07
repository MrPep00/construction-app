-- ============================================================
-- Migration 012: Team Schema (Phase 1 of M8.6 multi-user)
-- Adds teams, team_members, team_invitations tables.
-- Adds nullable team_id column to projects (backfilled in 013).
-- Does NOT change RLS on existing tables — app behaviour unchanged.
-- ============================================================

-- ============================================================
-- TABLE: teams
-- ============================================================
CREATE TABLE teams (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL DEFAULT 'Mój zespół',
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- ============================================================
-- TABLE: team_invitations
-- (declared before team_members so the FK can be added below)
-- ============================================================
CREATE TABLE team_invitations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     uuid        NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  token       text        NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  created_by  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  revoked     boolean     NOT NULL DEFAULT false,
  revoked_at  timestamptz
);

-- ============================================================
-- TABLE: team_members
-- ============================================================
CREATE TABLE team_members (
  team_id                uuid        NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id                uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at              timestamptz NOT NULL DEFAULT now(),
  joined_via_invitation_id uuid       REFERENCES team_invitations(id) ON DELETE SET NULL,
  PRIMARY KEY (team_id, user_id)
);

-- ============================================================
-- Add team_id to projects (nullable — backfilled in migration 013)
-- ============================================================
ALTER TABLE projects
  ADD COLUMN team_id uuid REFERENCES teams(id) ON DELETE RESTRICT;

CREATE INDEX idx_projects_team_id ON projects (team_id);

-- ============================================================
-- FUNCTION: get_user_team_ids
-- Returns all team_ids the given user belongs to.
-- SECURITY DEFINER so RLS policies can call it without recursion.
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_team_ids(p_user_id uuid)
RETURNS TABLE(team_id uuid)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT tm.team_id
  FROM team_members tm
  WHERE tm.user_id = p_user_id;
$$;

GRANT EXECUTE ON FUNCTION get_user_team_ids(uuid) TO authenticated;

-- ============================================================
-- FUNCTION: check_invitation_token
-- Validates a raw token string.
-- Returns team_id + team_name when valid, valid=false otherwise.
-- SECURITY DEFINER + GRANT TO anon so pre-login pages can validate.
-- ============================================================
CREATE OR REPLACE FUNCTION check_invitation_token(p_token text)
RETURNS TABLE(
  team_id   uuid,
  team_name text,
  valid     boolean,
  reason    text
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_invitation team_invitations%ROWTYPE;
  v_team        teams%ROWTYPE;
BEGIN
  SELECT * INTO v_invitation
  FROM team_invitations
  WHERE token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, false, 'not_found';
    RETURN;
  END IF;

  IF v_invitation.revoked THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, false, 'revoked';
    RETURN;
  END IF;

  IF v_invitation.expires_at < now() THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, false, 'expired';
    RETURN;
  END IF;

  SELECT * INTO v_team FROM teams WHERE id = v_invitation.team_id;

  RETURN QUERY SELECT v_invitation.team_id, v_team.name, true, NULL::text;
END;
$$;

GRANT EXECUTE ON FUNCTION check_invitation_token(text) TO anon, authenticated;

-- ============================================================
-- RLS: teams
-- ============================================================
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team members can select own team"
  ON teams FOR SELECT
  USING (id IN (SELECT team_id FROM get_user_team_ids(auth.uid())));

CREATE POLICY "authenticated can insert team"
  ON teams FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "creator can update team"
  ON teams FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "creator can delete team"
  ON teams FOR DELETE
  USING (created_by = auth.uid());

-- ============================================================
-- RLS: team_members
-- ============================================================
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team members can select own team members"
  ON team_members FOR SELECT
  USING (team_id IN (SELECT team_id FROM get_user_team_ids(auth.uid())));

-- INSERT: any authenticated user (Server Action validates invitation before inserting)
CREATE POLICY "authenticated can insert team members"
  ON team_members FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- DELETE: own row, or a team creator removing someone
CREATE POLICY "member can delete own row or creator can remove any"
  ON team_members FOR DELETE
  USING (
    user_id = auth.uid()
    OR team_id IN (SELECT t.id FROM teams t WHERE t.created_by = auth.uid())
  );

-- ============================================================
-- RLS: team_invitations
-- ============================================================
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

-- Members of the team can see its invitations
CREATE POLICY "team members can select invitations"
  ON team_invitations FOR SELECT
  USING (team_id IN (SELECT team_id FROM get_user_team_ids(auth.uid())));

CREATE POLICY "authenticated can create invitations"
  ON team_invitations FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Only creator can revoke (UPDATE)
CREATE POLICY "creator can update invitations"
  ON team_invitations FOR UPDATE
  USING (created_by = auth.uid());
