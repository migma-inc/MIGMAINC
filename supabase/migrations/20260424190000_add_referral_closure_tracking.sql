-- Migration: add referral closure tracking
-- Applied remotely 2026-04-24

-- 1. Status field for book_a_call_submissions
ALTER TABLE book_a_call_submissions
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'novo';

ALTER TABLE book_a_call_submissions
  ADD CONSTRAINT book_a_call_submissions_status_check
  CHECK (status IN ('novo', 'em_contato', 'fechado', 'descartado'));

-- 2. goal_reached_at for referral_links
ALTER TABLE referral_links
  ADD COLUMN IF NOT EXISTS goal_reached_at TIMESTAMPTZ;

-- 3. RPC: credit a referral closure (admin-only, SECURITY DEFINER)
CREATE OR REPLACE FUNCTION credit_referral_closure(p_submission_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral_link_id UUID;
  v_new_count INTEGER;
  v_profile_id UUID;
  v_already_closed BOOLEAN;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;

  SELECT referral_link_id, (status = 'fechado')
  INTO v_referral_link_id, v_already_closed
  FROM book_a_call_submissions
  WHERE id = p_submission_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found';
  END IF;

  UPDATE book_a_call_submissions
  SET status = 'fechado'
  WHERE id = p_submission_id;

  IF v_referral_link_id IS NULL THEN
    RETURN jsonb_build_object(
      'closures_count', 0,
      'goal_reached', false,
      'profile_id', NULL,
      'already_closed', v_already_closed
    );
  END IF;

  IF NOT v_already_closed THEN
    UPDATE referral_links
    SET closures_count = closures_count + 1
    WHERE id = v_referral_link_id
    RETURNING closures_count, profile_id INTO v_new_count, v_profile_id;

    IF v_new_count >= 10 THEN
      UPDATE referral_links
      SET goal_reached_at = NOW()
      WHERE id = v_referral_link_id AND goal_reached_at IS NULL;
    END IF;
  ELSE
    SELECT closures_count, profile_id
    INTO v_new_count, v_profile_id
    FROM referral_links
    WHERE id = v_referral_link_id;
  END IF;

  RETURN jsonb_build_object(
    'closures_count', v_new_count,
    'goal_reached', v_new_count >= 10,
    'profile_id', v_profile_id,
    'already_closed', v_already_closed
  );
END;
$$;

GRANT EXECUTE ON FUNCTION credit_referral_closure(UUID) TO authenticated;

-- 4. RPC: revert a closure (admin-only)
CREATE OR REPLACE FUNCTION revert_referral_closure(p_submission_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral_link_id UUID;
  v_new_count INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;

  SELECT referral_link_id INTO v_referral_link_id
  FROM book_a_call_submissions
  WHERE id = p_submission_id AND status = 'fechado';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Submission not found or not closed');
  END IF;

  UPDATE book_a_call_submissions
  SET status = 'novo'
  WHERE id = p_submission_id;

  IF v_referral_link_id IS NOT NULL THEN
    UPDATE referral_links
    SET
      closures_count = GREATEST(closures_count - 1, 0),
      goal_reached_at = CASE WHEN closures_count - 1 < 10 THEN NULL ELSE goal_reached_at END
    WHERE id = v_referral_link_id
    RETURNING closures_count INTO v_new_count;
  END IF;

  RETURN jsonb_build_object(
    'closures_count', COALESCE(v_new_count, 0),
    'goal_reached', COALESCE(v_new_count, 0) >= 10
  );
END;
$$;

GRANT EXECUTE ON FUNCTION revert_referral_closure(UUID) TO authenticated;
