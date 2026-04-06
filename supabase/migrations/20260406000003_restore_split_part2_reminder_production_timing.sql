-- Migration: Restore split payment part 2 reminder timing for normal operation
-- Description: Sets reminder delay back to 2 hours and the cron job to every 15 minutes
-- Date: 2026-04-06

CREATE OR REPLACE FUNCTION public.dispatch_split_part2_payment_reminders()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  split_record RECORD;
  processed_count integer := 0;
BEGIN
  FOR split_record IN
    SELECT sp.id
    FROM public.split_payments sp
    WHERE sp.part1_payment_status = 'completed'
      AND sp.part2_payment_status = 'pending'
      AND sp.part2_checkout_email_sent_at IS NOT NULL
      AND sp.part2_checkout_email_reminder_sent_at IS NULL
      AND sp.part2_checkout_email_sent_at <= NOW() - INTERVAL '2 hours'
  LOOP
    PERFORM net.http_post(
      url := 'https://ekxftwrjvxtpnqbraszv.supabase.co/functions/v1/send-split-part2-payment-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVreGZ0d3Jqdnh0cG5xYnJhc3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2ODY3ODEsImV4cCI6MjA4MDI2Mjc4MX0.6DjFMOtKnB5BSJN4wnHTwTcQf-Rrci6XXyqhORhhGP0',
        'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVreGZ0d3Jqdnh0cG5xYnJhc3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2ODY3ODEsImV4cCI6MjA4MDI2Mjc4MX0.6DjFMOtKnB5BSJN4wnHTwTcQf-Rrci6XXyqhORhhGP0'
      ),
      body := jsonb_build_object(
        'split_payment_id', split_record.id,
        'email_type', 'reminder'
      ),
      timeout_milliseconds := 5000
    );

    processed_count := processed_count + 1;
  END LOOP;

  RETURN processed_count;
END;
$$;

SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'split-part2-payment-reminder'),
  schedule := '*/15 * * * *'
);
