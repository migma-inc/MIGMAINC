import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ---------------------------------------------------------------------------
// SLA thresholds: how many days without update triggers a stuck-case followup
// ---------------------------------------------------------------------------
const STUCK_CASE_SLA: Record<string, { days: number; followupType: string; label: string }> = {
  awaiting_client_data: {
    days: 3,
    followupType: "sla_stuck_awaiting_data",
    label: "Client has not responded in 3+ days — check in and follow up",
  },
  documents_pending: {
    days: 5,
    followupType: "sla_stuck_documents_pending",
    label: "Documents still pending for 5+ days — send reminder to client",
  },
  documents_under_review: {
    days: 7,
    followupType: "sla_stuck_under_review",
    label: "Documents under review for 7+ days — check internal processing status",
  },
  in_processing: {
    days: 14,
    followupType: "sla_stuck_in_processing",
    label: "Case in processing for 14+ days without update — escalate to processing team",
  },
};

// ---------------------------------------------------------------------------
// Deadline alert intervals per service
// ---------------------------------------------------------------------------
const TRANSFER_DEADLINE_ALERTS: { days: number; followupType: string }[] = [
  { days: 30, followupType: "sla_transfer_deadline_30d" },
  { days: 15, followupType: "sla_transfer_deadline_15d" },
  { days: 7,  followupType: "sla_transfer_deadline_7d"  },
  { days: 1,  followupType: "sla_transfer_deadline_1d"  },
];

const COS_I94_DEADLINE_ALERTS: { days: number; followupType: string }[] = [
  { days: 60, followupType: "sla_cos_i94_deadline_60d" },
  { days: 30, followupType: "sla_cos_i94_deadline_30d" },
  { days: 15, followupType: "sla_cos_i94_deadline_15d" },
  { days: 7,  followupType: "sla_cos_i94_deadline_7d"  },
];

function getDeadlineAlertForDays(
  daysUntil: number,
  alerts: { days: number; followupType: string }[],
): { days: number; followupType: string } | null {
  const sortedAlerts = [...alerts].sort((a, b) => b.days - a.days);

  for (let index = 0; index < sortedAlerts.length; index++) {
    const alert = sortedAlerts[index];
    const nextAlert = sortedAlerts[index + 1];

    if (daysUntil > alert.days) continue;
    if (nextAlert && daysUntil <= nextAlert.days) continue;

    return alert;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("authorization");
  const cronSecret = Deno.env.get("CRON_SECRET_KEY");
  const isAuthorized =
    authHeader?.includes(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "") ||
    authHeader?.includes(cronSecret || "");

  if (!isAuthorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 401,
    });
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const testEmail =
    typeof body.test_email === "string" && body.test_email.trim()
      ? body.test_email.trim().toLowerCase()
      : null;
  const testServiceRequestId =
    typeof body.test_service_request_id === "string" && body.test_service_request_id.trim()
      ? body.test_service_request_id.trim()
      : null;
  const requestedChecks = Array.isArray(body.checks)
    ? body.checks.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : null;
  const shouldRunCheck = (name: string) => !requestedChecks || requestedChecks.includes(name);

  const supabase = createClient(
    Deno.env.get("MIGMA_REMOTE_URL") || Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("MIGMA_REMOTE_SERVICE_ROLE_KEY") ||
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const report = {
    stuckCases: 0,
    failedWelcomeEmails: 0,
    transferDeadlineAlerts: 0,
    cosDeadlineAlerts: 0,
    errors: [] as string[],
  };

  // Each check is isolated — one failure never blocks the others
  try {
    if (shouldRunCheck("stuck")) {
      report.stuckCases = await checkStuckCases(supabase, testServiceRequestId);
    }
    console.log(`[SLA Cron] Stuck cases: ${report.stuckCases} followup(s) created`);
  } catch (err) {
    const msg = `stuckCases: ${err instanceof Error ? err.message : String(err)}`;
    report.errors.push(msg);
    console.error("[SLA Cron]", msg);
  }

  try {
    if (shouldRunCheck("welcome")) {
      report.failedWelcomeEmails = await checkFailedWelcomeEmails(
        supabase,
        testEmail,
        testServiceRequestId,
      );
    }
    console.log(`[SLA Cron] Failed welcome emails: ${report.failedWelcomeEmails} followup(s) created`);
  } catch (err) {
    const msg = `failedWelcomeEmails: ${err instanceof Error ? err.message : String(err)}`;
    report.errors.push(msg);
    console.error("[SLA Cron]", msg);
  }

  try {
    if (shouldRunCheck("transfer")) {
      report.transferDeadlineAlerts = await checkTransferDeadlines(supabase, testEmail);
    }
    console.log(`[SLA Cron] Transfer deadline alerts: ${report.transferDeadlineAlerts} followup(s) created`);
  } catch (err) {
    const msg = `transferDeadlines: ${err instanceof Error ? err.message : String(err)}`;
    report.errors.push(msg);
    console.error("[SLA Cron]", msg);
  }

  try {
    if (shouldRunCheck("cos")) {
      report.cosDeadlineAlerts = await checkCosI94Deadlines(supabase, testEmail);
    }
    console.log(`[SLA Cron] COS I-94 alerts: ${report.cosDeadlineAlerts} followup(s) created`);
  } catch (err) {
    const msg = `cosDeadlines: ${err instanceof Error ? err.message : String(err)}`;
    report.errors.push(msg);
    console.error("[SLA Cron]", msg);
  }

  console.log("[SLA Cron] Run complete", report);

  return new Response(JSON.stringify({ success: true, report }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type SupabaseClient = ReturnType<typeof createClient>;

/**
 * Returns true if an open followup of the given type already exists for the
 * service_request. Used for idempotency — avoids duplicate alerts on every run.
 */
async function openFollowupExists(
  supabase: SupabaseClient,
  serviceRequestId: string,
  followupType: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("service_request_followups")
    .select("id")
    .eq("service_request_id", serviceRequestId)
    .eq("followup_type", followupType)
    .eq("status", "open")
    .limit(1)
    .maybeSingle();

  return Boolean(data);
}

/**
 * Creates a followup and appends an audit event to service_request_events.
 * Non-throwing — errors are logged but do not propagate.
 */
async function createSlaFollowup(
  supabase: SupabaseClient,
  serviceRequestId: string,
  followupType: string,
  notes: string,
  dueAt: string | null = null,
): Promise<void> {
  const { error } = await supabase
    .from("service_request_followups")
    .insert({
      service_request_id: serviceRequestId,
      followup_type: followupType,
      status: "open",
      notes,
      due_at: dueAt,
    });

  if (error) {
    console.error("[SLA Cron] Failed to create followup", {
      serviceRequestId,
      followupType,
      error,
    });
    return;
  }

  await appendServiceRequestEvent(
    supabase,
    serviceRequestId,
    "sla_followup_created",
    "system",
    { followup_type: followupType, notes },
  );
}

async function appendServiceRequestEvent(
  supabase: SupabaseClient,
  serviceRequestId: string,
  eventType: string,
  eventSource: "system" | "n8n" | "user" | "gateway" | "email" | "ai",
  payload: Record<string, unknown> = {},
  options: {
    eventKey?: string;
  } = {},
) {
  const { error } = await supabase
    .from("service_request_events")
    .insert({
      service_request_id: serviceRequestId,
      event_type: eventType,
      event_source: eventSource,
      event_key: options.eventKey ?? null,
      payload_json: payload,
    });

  if (error) {
    console.error("[Operational Case] Failed to append service_request_event", {
      serviceRequestId,
      eventType,
      error,
    });
  }
}

// ---------------------------------------------------------------------------
// Check 1: Stuck cases by workflow stage
// ---------------------------------------------------------------------------
async function checkStuckCases(
  supabase: SupabaseClient,
  testServiceRequestId: string | null = null,
): Promise<number> {
  let created = 0;
  const now = new Date();

  for (const [stage, sla] of Object.entries(STUCK_CASE_SLA)) {
    const threshold = new Date(now);
    threshold.setDate(threshold.getDate() - sla.days);

    let stuckQuery = supabase
      .from("service_requests")
      .select("id, workflow_stage, updated_at")
      .eq("workflow_stage", stage)
      .eq("case_status", "active")
      .lt("updated_at", threshold.toISOString());

    if (testServiceRequestId) {
      stuckQuery = stuckQuery.eq("id", testServiceRequestId);
    }

    const { data: stuckRequests, error } = await stuckQuery;

    if (error) {
      console.error(`[SLA Cron] Error fetching stuck cases for stage "${stage}"`, error);
      continue;
    }

    if (!stuckRequests?.length) continue;
    console.log(`[SLA Cron] ${stuckRequests.length} stuck case(s) in stage "${stage}"`);

    for (const sr of stuckRequests) {
      const alreadyOpen = await openFollowupExists(supabase, sr.id, sla.followupType);
      if (alreadyOpen) continue;

      await createSlaFollowup(supabase, sr.id, sla.followupType, sla.label);
      created++;
    }
  }

  return created;
}

// ---------------------------------------------------------------------------
// Check 2: Failed or missing welcome email
// ---------------------------------------------------------------------------
async function checkFailedWelcomeEmails(
  supabase: SupabaseClient,
  testEmail: string | null = null,
  testServiceRequestId: string | null = null,
): Promise<number> {
  let created = 0;

  if (testServiceRequestId) {
    const { data: serviceRequest, error: srError } = await supabase
      .from("service_requests")
      .select("id, case_status")
      .eq("id", testServiceRequestId)
      .eq("case_status", "active")
      .maybeSingle();

    if (srError) {
      console.error("[SLA Cron] Error fetching service request for welcome email test", srError);
      throw srError;
    }

    if (!serviceRequest) return 0;

    const { data: order } = await supabase
      .from("visa_orders")
      .select("service_request_id, client_email, created_at")
      .eq("service_request_id", testServiceRequestId)
      .not("service_request_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!order?.service_request_id) return 0;

    const orderCreatedAt = new Date(order.created_at);
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    if (orderCreatedAt > oneDayAgo) return 0;

    const email = testEmail || order.client_email;
    if (!email) return 0;

    const alreadyOpen = await openFollowupExists(supabase, testServiceRequestId, "sla_welcome_email_failed");
    if (alreadyOpen) return 0;

    await createSlaFollowup(
      supabase,
      testServiceRequestId,
      "sla_welcome_email_failed",
      `Welcome email was not sent or failed for ${email}. ` +
        "Manual intervention required â€” send welcome email and advance case to awaiting_client_data.",
    );
    return 1;
  }

  // Profiles where the welcome was not sent or failed, still at payment step
  let profileQuery = supabase
    .from("user_profiles")
    .select("id, email, onboarding_current_step, onboarding_email_status")
    .eq("source", "migma")
    .eq("onboarding_current_step", "payment");

  if (testEmail) {
    profileQuery = profileQuery.eq("email", testEmail);
  }

  const { data: profiles, error } = await profileQuery.or(
    "onboarding_email_status.is.null," +
    "onboarding_email_status.eq.failed," +
    "onboarding_email_status.eq.welcome_email_failed",
  );

  if (error) {
    console.error("[SLA Cron] Error fetching profiles for welcome email check", error);
    throw error;
  }

  if (!profiles?.length) return 0;

  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  for (const profile of profiles) {
    if (!profile.email) continue;

    // Find the most recent visa_order with a service_request for this client email
    const { data: visaOrder } = await supabase
      .from("visa_orders")
      .select("service_request_id, created_at")
      .eq("client_email", profile.email)
      .not("service_request_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!visaOrder?.service_request_id) continue;
    const srId = visaOrder.service_request_id;

    // Only flag cases older than 1 day — give the webhook-triggered T4A a chance to run
    const orderCreatedAt = new Date(visaOrder.created_at);
    if (orderCreatedAt > oneDayAgo) continue;

    // Confirm service_request is still active
    const { data: sr } = await supabase
      .from("service_requests")
      .select("id, case_status")
      .eq("id", srId)
      .eq("case_status", "active")
      .maybeSingle();

    if (!sr) continue;

    const alreadyOpen = await openFollowupExists(supabase, srId, "sla_welcome_email_failed");
    if (alreadyOpen) continue;

    await createSlaFollowup(
      supabase,
      srId,
      "sla_welcome_email_failed",
      `Welcome email was not sent or failed for ${profile.email}. ` +
        "Manual intervention required — send welcome email and advance case to awaiting_client_data.",
    );
    created++;
  }

  return created;
}

// ---------------------------------------------------------------------------
// Check 3: Transfer deadline alerts
// ---------------------------------------------------------------------------
async function checkTransferDeadlines(
  supabase: SupabaseClient,
  testEmail: string | null = null,
): Promise<number> {
  let created = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let profileQuery = supabase
    .from("user_profiles")
    .select("id, email, transfer_deadline_date")
    .eq("source", "migma")
    .not("transfer_deadline_date", "is", null);

  if (testEmail) {
    profileQuery = profileQuery.eq("email", testEmail);
  }

  const { data: profiles, error } = await profileQuery;

  if (error) {
    // Column not yet added via migration — skip silently
    if (error.message?.includes("transfer_deadline_date")) {
      console.log("[SLA Cron] transfer_deadline_date not in schema yet — skipping Transfer deadline check");
      return 0;
    }
    throw error;
  }

  if (!profiles?.length) return 0;

  for (const profile of profiles) {
    const deadline = new Date(profile.transfer_deadline_date);
    deadline.setHours(0, 0, 0, 0);
    const daysUntil = Math.round(
      (deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysUntil < 0) continue; // deadline already passed

    const { data: visaOrder } = await supabase
      .from("visa_orders")
      .select("service_request_id")
      .eq("client_email", profile.email)
      .ilike("product_slug", "transfer-%")
      .not("service_request_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!visaOrder?.service_request_id) continue;
    const srId = visaOrder.service_request_id;

    const alert = getDeadlineAlertForDays(daysUntil, TRANSFER_DEADLINE_ALERTS);
    if (!alert) continue;

    const alreadyOpen = await openFollowupExists(supabase, srId, alert.followupType);
    if (alreadyOpen) continue;

    await createSlaFollowup(
      supabase,
      srId,
      alert.followupType,
      `Transfer deadline approaching: ${daysUntil} day(s) remaining ` +
        `(deadline: ${profile.transfer_deadline_date}). ` +
        "Ensure transfer form, SEVIS release and I-20 are on track.",
      deadline.toISOString(),
    );
    created++;
  }

  return created;
}

// ---------------------------------------------------------------------------
// Check 4: COS I-94 expiry alerts
// ---------------------------------------------------------------------------
async function checkCosI94Deadlines(
  supabase: SupabaseClient,
  testEmail: string | null = null,
): Promise<number> {
  let created = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let profileQuery = supabase
    .from("user_profiles")
    .select("id, email, cos_i94_expiry_date")
    .eq("source", "migma")
    .not("cos_i94_expiry_date", "is", null);

  if (testEmail) {
    profileQuery = profileQuery.eq("email", testEmail);
  }

  const { data: profiles, error } = await profileQuery;

  if (error) {
    if (error.message?.includes("cos_i94_expiry_date")) {
      console.log("[SLA Cron] cos_i94_expiry_date not in schema yet — skipping COS I-94 deadline check");
      return 0;
    }
    throw error;
  }

  if (!profiles?.length) return 0;

  for (const profile of profiles) {
    const expiry = new Date(profile.cos_i94_expiry_date);
    expiry.setHours(0, 0, 0, 0);
    const daysUntil = Math.round(
      (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysUntil < 0) continue;

    const { data: visaOrder } = await supabase
      .from("visa_orders")
      .select("service_request_id")
      .eq("client_email", profile.email)
      .ilike("product_slug", "cos-%")
      .not("service_request_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!visaOrder?.service_request_id) continue;
    const srId = visaOrder.service_request_id;

    const alert = getDeadlineAlertForDays(daysUntil, COS_I94_DEADLINE_ALERTS);
    if (!alert) continue;

    const alreadyOpen = await openFollowupExists(supabase, srId, alert.followupType);
    if (alreadyOpen) continue;

    // Escalating urgency prefix for the COS I-94 — immigration-critical date
    const urgencyPrefix =
      alert.days <= 15
        ? "CRITICAL — "
        : alert.days <= 30
          ? "URGENT — "
          : "";

    await createSlaFollowup(
      supabase,
      srId,
      alert.followupType,
      `${urgencyPrefix}COS I-94 expiry approaching: ${daysUntil} day(s) remaining ` +
        `(expiry: ${profile.cos_i94_expiry_date}). ` +
        "This is an immigration-critical deadline — ensure COS filing is actively in progress.",
      expiry.toISOString(),
    );
    created++;
  }

  return created;
}

