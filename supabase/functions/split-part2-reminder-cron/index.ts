import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const REMINDER_DELAY_MS = 2 * 60 * 60 * 1000;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("authorization");
  const cronSecret = Deno.env.get("CRON_SECRET_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const isAuthorized =
    authHeader?.includes(serviceRoleKey) ||
    (cronSecret ? authHeader?.includes(cronSecret) : false);

  if (!isAuthorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const cutoff = new Date(Date.now() - REMINDER_DELAY_MS).toISOString();

    const { data: pendingReminders, error: fetchError } = await supabase
      .from("split_payments")
      .select("id")
      .eq("part1_payment_status", "completed")
      .eq("part2_payment_status", "pending")
      .not("part2_checkout_email_sent_at", "is", null)
      .is("part2_checkout_email_reminder_sent_at", null)
      .lte("part2_checkout_email_sent_at", cutoff);

    if (fetchError) {
      throw new Error(`Failed to fetch split reminders: ${fetchError.message}`);
    }

    const results = {
      processed: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
    };

    for (const splitPayment of pendingReminders || []) {
      results.processed += 1;

      try {
        const { data, error } = await supabase.functions.invoke("send-split-part2-payment-email", {
          body: {
            split_payment_id: splitPayment.id,
            email_type: "reminder",
          },
        });

        if (error) {
          results.failed += 1;
          console.error("[Split Part2 Reminder Cron] Failed to send reminder:", splitPayment.id, error);
          continue;
        }

        if (data?.sent) {
          results.sent += 1;
        } else {
          results.skipped += 1;
        }
      } catch (error) {
        results.failed += 1;
        console.error("[Split Part2 Reminder Cron] Unexpected error:", splitPayment.id, error);
      }
    }

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("[Split Part2 Reminder Cron] Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
