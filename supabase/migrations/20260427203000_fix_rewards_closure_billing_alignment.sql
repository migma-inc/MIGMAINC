-- Gap 3 Rewards alignment.
-- Fixes admin authorization for the remote schema and applies the referral benefit
-- to Migma recurring charges when the 10th closed referral is credited.

CREATE OR REPLACE FUNCTION public.credit_referral_closure(p_submission_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral_link_id uuid;
  v_new_count integer;
  v_profile_id uuid;
  v_already_closed boolean;
  v_goal_reached_now boolean := false;
  v_goal_stamp_count integer := 0;
  v_exempted_charges integer := 0;
BEGIN
  IF COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', '') NOT IN ('admin', 'superadmin', 'super_admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;

  SELECT referral_link_id, (status = 'fechado')
  INTO v_referral_link_id, v_already_closed
  FROM public.book_a_call_submissions
  WHERE id = p_submission_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found';
  END IF;

  UPDATE public.book_a_call_submissions
  SET status = 'fechado'
  WHERE id = p_submission_id;

  IF v_referral_link_id IS NULL THEN
    RETURN jsonb_build_object(
      'closures_count', 0,
      'goal_reached', false,
      'goal_reached_now', false,
      'profile_id', NULL,
      'already_closed', v_already_closed,
      'exempted_charges', 0
    );
  END IF;

  IF NOT v_already_closed THEN
    UPDATE public.referral_links
    SET closures_count = closures_count + 1
    WHERE id = v_referral_link_id
    RETURNING closures_count, profile_id INTO v_new_count, v_profile_id;

    IF v_new_count >= 10 THEN
      UPDATE public.referral_links
      SET goal_reached_at = now()
      WHERE id = v_referral_link_id
        AND goal_reached_at IS NULL;

      GET DIAGNOSTICS v_goal_stamp_count = ROW_COUNT;
      v_goal_reached_now := v_goal_stamp_count > 0;

      UPDATE public.recurring_charges
      SET
        status = 'exempted',
        exempted_by_referral = true,
        suspended_at = COALESCE(suspended_at, now()),
        suspended_reason = 'Referral goal reached: 10 closed referrals'
      WHERE profile_id = v_profile_id
        AND status = 'active';

      GET DIAGNOSTICS v_exempted_charges = ROW_COUNT;
    END IF;
  ELSE
    SELECT closures_count, profile_id
    INTO v_new_count, v_profile_id
    FROM public.referral_links
    WHERE id = v_referral_link_id;
  END IF;

  RETURN jsonb_build_object(
    'closures_count', v_new_count,
    'goal_reached', COALESCE(v_new_count, 0) >= 10,
    'goal_reached_now', v_goal_reached_now,
    'profile_id', v_profile_id,
    'already_closed', v_already_closed,
    'exempted_charges', v_exempted_charges
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.credit_referral_closure(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.revert_referral_closure(p_submission_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral_link_id uuid;
  v_new_count integer;
  v_profile_id uuid;
  v_reactivated_charges integer := 0;
BEGIN
  IF COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', '') NOT IN ('admin', 'superadmin', 'super_admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;

  SELECT referral_link_id
  INTO v_referral_link_id
  FROM public.book_a_call_submissions
  WHERE id = p_submission_id
    AND status = 'fechado';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Submission not found or not closed');
  END IF;

  UPDATE public.book_a_call_submissions
  SET status = 'novo'
  WHERE id = p_submission_id;

  IF v_referral_link_id IS NOT NULL THEN
    UPDATE public.referral_links
    SET
      closures_count = GREATEST(closures_count - 1, 0),
      goal_reached_at = CASE WHEN closures_count - 1 < 10 THEN NULL ELSE goal_reached_at END
    WHERE id = v_referral_link_id
    RETURNING closures_count, profile_id INTO v_new_count, v_profile_id;

    IF COALESCE(v_new_count, 0) < 10 THEN
      UPDATE public.recurring_charges
      SET
        status = 'active',
        exempted_by_referral = false,
        suspended_at = NULL,
        suspended_reason = NULL
      WHERE profile_id = v_profile_id
        AND status = 'exempted'
        AND exempted_by_referral = true;

      GET DIAGNOSTICS v_reactivated_charges = ROW_COUNT;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'closures_count', COALESCE(v_new_count, 0),
    'goal_reached', COALESCE(v_new_count, 0) >= 10,
    'profile_id', v_profile_id,
    'reactivated_charges', v_reactivated_charges
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.revert_referral_closure(uuid) TO authenticated;
