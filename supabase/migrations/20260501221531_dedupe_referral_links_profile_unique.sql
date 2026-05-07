-- Fix referral reward links so each student profile has only one referral link.
-- The dashboard expects a single row per profile_id; without this constraint,
-- concurrent first loads can create duplicates and make .maybeSingle() fail.

BEGIN;

WITH ranked_links AS (
  SELECT
    id,
    profile_id,
    clicks,
    closures_count,
    goal_reached_at,
    first_value(id) OVER (
      PARTITION BY profile_id
      ORDER BY closures_count DESC, clicks DESC, created_at ASC, id ASC
    ) AS keep_id,
    row_number() OVER (
      PARTITION BY profile_id
      ORDER BY closures_count DESC, clicks DESC, created_at ASC, id ASC
    ) AS rn
  FROM public.referral_links
),
duplicate_totals AS (
  SELECT
    profile_id,
    keep_id,
    sum(clicks) AS total_clicks,
    sum(closures_count) AS total_closures,
    min(goal_reached_at) FILTER (WHERE goal_reached_at IS NOT NULL) AS first_goal_reached_at
  FROM ranked_links
  GROUP BY profile_id, keep_id
  HAVING count(*) > 1
)
UPDATE public.referral_links keep
SET
  clicks = duplicate_totals.total_clicks,
  closures_count = duplicate_totals.total_closures,
  goal_reached_at = COALESCE(keep.goal_reached_at, duplicate_totals.first_goal_reached_at)
FROM duplicate_totals
WHERE keep.id = duplicate_totals.keep_id;

WITH ranked_links AS (
  SELECT
    id,
    first_value(id) OVER (
      PARTITION BY profile_id
      ORDER BY closures_count DESC, clicks DESC, created_at ASC, id ASC
    ) AS keep_id,
    row_number() OVER (
      PARTITION BY profile_id
      ORDER BY closures_count DESC, clicks DESC, created_at ASC, id ASC
    ) AS rn
  FROM public.referral_links
)
UPDATE public.referral_leads leads
SET referral_link_id = ranked_links.keep_id
FROM ranked_links
WHERE ranked_links.rn > 1
  AND leads.referral_link_id = ranked_links.id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'book_a_call_submissions'
      AND column_name = 'referral_link_id'
  ) THEN
    WITH ranked_links AS (
      SELECT
        id,
        first_value(id) OVER (
          PARTITION BY profile_id
          ORDER BY closures_count DESC, clicks DESC, created_at ASC, id ASC
        ) AS keep_id,
        row_number() OVER (
          PARTITION BY profile_id
          ORDER BY closures_count DESC, clicks DESC, created_at ASC, id ASC
        ) AS rn
      FROM public.referral_links
    )
    UPDATE public.book_a_call_submissions submissions
    SET referral_link_id = ranked_links.keep_id
    FROM ranked_links
    WHERE ranked_links.rn > 1
      AND submissions.referral_link_id = ranked_links.id;
  END IF;
END $$;

WITH ranked_links AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY profile_id
      ORDER BY closures_count DESC, clicks DESC, created_at ASC, id ASC
    ) AS rn
  FROM public.referral_links
)
DELETE FROM public.referral_links links
USING ranked_links
WHERE links.id = ranked_links.id
  AND ranked_links.rn > 1;

DROP INDEX IF EXISTS public.idx_referral_links_profile;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'referral_links_profile_id_key'
      AND conrelid = 'public.referral_links'::regclass
  ) THEN
    ALTER TABLE public.referral_links
      ADD CONSTRAINT referral_links_profile_id_key UNIQUE (profile_id);
  END IF;
END $$;

COMMIT;
