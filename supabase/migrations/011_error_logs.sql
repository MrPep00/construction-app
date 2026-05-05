-- Migration 011: Error Logging Table + Admin RPC Functions
-- This migration adds persistent error logging for the admin dashboard.
-- Admin access is controlled via the ADMIN_EMAILS env var injected into
-- the app.admin_emails Postgres setting per-request (via RPC functions).

-- ============================================================
-- FUNCTION: is_admin_email
-- Checks whether the given email is in the comma-separated
-- admin list stored in the app.admin_emails session setting.
-- Called by RLS policies on error_logs.
-- ============================================================
CREATE OR REPLACE FUNCTION is_admin_email(email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  admin_emails_setting text;
  email_entry text;
BEGIN
  IF email IS NULL OR trim(email) = '' THEN
    RETURN false;
  END IF;

  admin_emails_setting := current_setting('app.admin_emails', true);

  IF admin_emails_setting IS NULL OR trim(admin_emails_setting) = '' THEN
    RETURN false;
  END IF;

  FOREACH email_entry IN ARRAY string_to_array(admin_emails_setting, ',') LOOP
    IF lower(trim(email_entry)) = lower(trim(email)) THEN
      RETURN true;
    END IF;
  END LOOP;

  RETURN false;
END;
$$;

-- ============================================================
-- TABLE: error_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS error_logs (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at  timestamptz NOT NULL DEFAULT now(),
  user_id      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email   text,
  route        text,
  action_name  text,
  severity     text        NOT NULL DEFAULT 'error'
                           CHECK (severity IN ('warn', 'error', 'fatal')),
  message      text        NOT NULL,
  stack        text,
  context      jsonb       NOT NULL DEFAULT '{}',
  user_agent   text,
  resolved     boolean     NOT NULL DEFAULT false,
  resolved_at  timestamptz,
  resolved_note text
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_error_logs_occurred_at
  ON error_logs (occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_error_logs_unresolved
  ON error_logs (occurred_at DESC)
  WHERE resolved = false;

CREATE INDEX IF NOT EXISTS idx_error_logs_user_id
  ON error_logs (user_id);

CREATE INDEX IF NOT EXISTS idx_error_logs_severity
  ON error_logs (severity);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- INSERT: anyone (including unauthenticated) can log errors
CREATE POLICY "anyone can insert errors"
  ON error_logs
  FOR INSERT
  WITH CHECK (true);

-- SELECT: only admins (app.admin_emails must be set via RPC before query)
CREATE POLICY "admins read errors"
  ON error_logs
  FOR SELECT
  USING (is_admin_email(auth.jwt() ->> 'email'));

-- UPDATE: only admins (for resolving/unresolving errors)
CREATE POLICY "admins update errors"
  ON error_logs
  FOR UPDATE
  USING (is_admin_email(auth.jwt() ->> 'email'));

-- ============================================================
-- ADMIN RPC FUNCTIONS
-- These functions set app.admin_emails within the SAME transaction
-- so that the RLS policies above can verify the caller is an admin.
-- The calling user's JWT email must be in p_admin_emails — this is
-- guaranteed because only the Next.js server calls these with
-- process.env.ADMIN_EMAILS.
-- ============================================================

CREATE OR REPLACE FUNCTION admin_get_error_logs(
  p_admin_emails       text,
  p_show_resolved      boolean DEFAULT false,
  p_severity           text    DEFAULT null,
  p_user_email_filter  text    DEFAULT null
)
RETURNS SETOF error_logs
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('app.admin_emails', p_admin_emails, true);

  IF NOT is_admin_email(auth.jwt() ->> 'email') THEN
    RAISE EXCEPTION 'Access denied: not an admin';
  END IF;

  RETURN QUERY
    SELECT *
    FROM error_logs
    WHERE
      (p_show_resolved OR NOT resolved)
      AND (p_severity IS NULL OR severity = p_severity)
      AND (p_user_email_filter IS NULL OR user_email ILIKE p_user_email_filter)
    ORDER BY occurred_at DESC
    LIMIT 100;
END;
$$;

CREATE OR REPLACE FUNCTION admin_get_error_stats(
  p_admin_emails text
)
RETURNS TABLE (
  total_unresolved bigint,
  today            bigint,
  this_week        bigint,
  count_warn       bigint,
  count_error      bigint,
  count_fatal      bigint
)
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('app.admin_emails', p_admin_emails, true);

  IF NOT is_admin_email(auth.jwt() ->> 'email') THEN
    RAISE EXCEPTION 'Access denied: not an admin';
  END IF;

  RETURN QUERY
    SELECT
      COUNT(*)    FILTER (WHERE NOT resolved)                                          AS total_unresolved,
      COUNT(*)    FILTER (WHERE NOT resolved AND occurred_at >= CURRENT_DATE)          AS today,
      COUNT(*)    FILTER (WHERE NOT resolved AND occurred_at >= date_trunc('week', now())) AS this_week,
      COUNT(*)    FILTER (WHERE NOT resolved AND severity = 'warn')                    AS count_warn,
      COUNT(*)    FILTER (WHERE NOT resolved AND severity = 'error')                   AS count_error,
      COUNT(*)    FILTER (WHERE NOT resolved AND severity = 'fatal')                   AS count_fatal
    FROM error_logs;
END;
$$;

CREATE OR REPLACE FUNCTION admin_update_error_resolved(
  p_admin_emails text,
  p_id           uuid,
  p_resolved     boolean,
  p_note         text DEFAULT null
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('app.admin_emails', p_admin_emails, true);

  IF NOT is_admin_email(auth.jwt() ->> 'email') THEN
    RAISE EXCEPTION 'Access denied: not an admin';
  END IF;

  IF p_resolved THEN
    UPDATE error_logs
    SET
      resolved      = true,
      resolved_at   = now(),
      resolved_note = p_note
    WHERE id = p_id;
  ELSE
    UPDATE error_logs
    SET
      resolved      = false,
      resolved_at   = null,
      resolved_note = null
    WHERE id = p_id;
  END IF;
END;
$$;
