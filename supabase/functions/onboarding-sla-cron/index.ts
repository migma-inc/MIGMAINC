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

const ONBOARDING_STEP_IDLE_HOURS = 48;
const ALLOWED_ONBOARDING_SERVICE_FAMILIES = new Set(["cos", "transfer", "initial"]);

const ONBOARDING_STEP_LABELS: Record<string, string> = {
  selection_fee: "Selection Fee",
  selection_survey: "Profile Survey",
  wait_room: "Review Wait Room",
  scholarship_selection: "University Selection",
  placement_fee: "Placement Fee",
  documents_upload: "Documents Upload",
  payment: "Application Fee",
  dados_complementares: "Complementary Data",
  my_applications: "Applications",
  acceptance_letter: "Acceptance Letter",
};

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

async function notifyClient(trigger: string, profileId: string, data: Record<string, unknown>) {
  const functionsBaseUrl = (
    Deno.env.get("MIGMA_FUNCTIONS_BASE_URL") ||
    Deno.env.get("FUNCTIONS_BASE_URL") ||
    Deno.env.get("SUPABASE_URL") ||
    Deno.env.get("MIGMA_REMOTE_URL") ||
    ""
  ).replace(/\/+$/, "");
  const serviceKey = Deno.env.get("MIGMA_REMOTE_SERVICE_ROLE_KEY") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  if (!functionsBaseUrl || !serviceKey) {
    throw new Error("Missing functions base URL or service role for migma-notify");
  }

  const res = await fetch(`${functionsBaseUrl}/functions/v1/migma-notify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${serviceKey}`,
      "apikey": serviceKey,
    },
    body: JSON.stringify({
      trigger,
      user_id: profileId,
      data,
    }),
  });

  const responseText = await res.text();
  if (!res.ok) {
    throw new Error(`migma-notify ${trigger} failed: ${res.status} ${responseText}`);
  }

  return responseText ? JSON.parse(responseText) : { success: true };
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
  const acceptedSecrets = [
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    Deno.env.get("MIGMA_REMOTE_SERVICE_ROLE_KEY"),
    cronSecret,
  ].filter((value): value is string => Boolean(value));
  const isAuthorized =
    Boolean(authHeader) &&
    acceptedSecrets.some((secret) => authHeader?.includes(secret));

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
  const testProfileId =
    typeof body.test_profile_id === "string" && body.test_profile_id.trim()
      ? body.test_profile_id.trim()
      : null;
  const requestedChecks = Array.isArray(body.checks)
    ? body.checks.filter((value: unknown): value is string => typeof value === "string" && value.trim().length > 0)
    : null;
  const shouldRunCheck = (name: string) => !requestedChecks || requestedChecks.includes(name);
  const dryRun = body.dry_run === true;

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
    onboardingStepFollowups: 0,
    dryRun,
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

  try {
    if (shouldRunCheck("onboarding_steps")) {
      report.onboardingStepFollowups = await checkOnboardingStepInactivity(
        supabase,
        testEmail,
        testProfileId,
        dryRun,
      );
    }
    console.log(`[SLA Cron] Onboarding step followups: ${report.onboardingStepFollowups} followup(s) created`);
  } catch (err) {
    const msg = `onboardingStepFollowups: ${err instanceof Error ? err.message : String(err)}`;
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

type SupabaseClient = any;

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

    await notifyClient("deadline_alert_transfer", profile.id, {
      days_remaining: daysUntil,
      deadline_date: profile.transfer_deadline_date,
    });
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

    await notifyClient("deadline_alert_cos", profile.id, {
      days_remaining: daysUntil,
      deadline_date: profile.cos_i94_expiry_date,
    });
    created++;
  }

  return created;
}

// ---------------------------------------------------------------------------
// Check 5: Onboarding step inactivity
// ---------------------------------------------------------------------------

type OnboardingProfile = {
  id: string;
  user_id: string | null;
  email: string | null;
  full_name: string | null;
  source: string | null;
  status: string | null;
  service_type: string | null;
  student_process_type: string | null;
  onboarding_current_step: string | null;
  onboarding_completed: boolean | null;
  is_archived: boolean | null;
  last_activity_at: string | null;
  onboarding_step_entered_at: string | null;
  onboarding_followup_started_at: string | null;
  migma_checkout_completed_at: string | null;
  updated_at: string | null;
  created_at: string | null;
  mentor_id: string | null;
};

type OnboardingStepFollowup = {
  id: string;
  profile_id: string;
  onboarding_step: string;
  step_label: string;
  step_url: string;
  idle_reference_at: string;
  idle_hours: number;
  status: string;
  student_notified_at: string | null;
  mentor_notified_at: string | null;
  notification_count: number | null;
};

function normalizeServiceFamily(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase().replace(/_/g, "-").replace(/\s+/g, "-");
  if (!normalized) return null;
  if (normalized === "change-of-status" || normalized.includes("change-of-status")) return "cos";
  if (normalized.includes("cos")) return "cos";
  if (normalized.includes("transfer")) return "transfer";
  if (normalized.includes("initial")) return "initial";
  const family = normalized.split("-")[0];
  return ALLOWED_ONBOARDING_SERVICE_FAMILIES.has(family) ? family : null;
}

function resolveProfileServiceFamily(profile: OnboardingProfile): "cos" | "transfer" | "initial" | null {
  const family = normalizeServiceFamily(profile.service_type) ?? normalizeServiceFamily(profile.student_process_type);
  if (family === "cos" || family === "transfer" || family === "initial") return family;
  return null;
}

function getOnboardingStepLabel(step: string): string {
  return ONBOARDING_STEP_LABELS[step] ?? step.replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function getOnboardingStepUrl(step: string): string {
  const baseUrl = (Deno.env.get("APP_BASE_URL") ?? "https://migmainc.com").replace(/\/+$/, "");
  return `${baseUrl}/student/onboarding?step=${encodeURIComponent(step)}`;
}

function latestIso(values: Array<string | null | undefined>): string | null {
  let latest: Date | null = null;

  for (const value of values) {
    if (!value) continue;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) continue;
    if (!latest || parsed > latest) latest = parsed;
  }

  return latest?.toISOString() ?? null;
}

function idleHoursSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60));
}

async function resolveLatestServiceRequestId(
  supabase: SupabaseClient,
  email: string | null,
): Promise<string | null> {
  if (!email) return null;

  const { data } = await supabase
    .from("visa_orders")
    .select("service_request_id")
    .eq("client_email", email)
    .not("service_request_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.service_request_id ?? null;
}

async function resolveMovedOnboardingStepFollowups(
  supabase: SupabaseClient,
  profileId: string,
  currentStep: string,
) {
  const { error } = await supabase
    .from("onboarding_step_followups")
    .update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
      resolved_reason: "step_changed",
    })
    .eq("profile_id", profileId)
    .eq("status", "open")
    .neq("onboarding_step", currentStep);

  if (error) {
    console.error("[SLA Cron] Failed to resolve moved onboarding followups", {
      profileId,
      currentStep,
      error,
    });
  }
}

async function getOpenOnboardingStepFollowup(
  supabase: SupabaseClient,
  profileId: string,
  currentStep: string,
): Promise<OnboardingStepFollowup | null> {
  const { data, error } = await supabase
    .from("onboarding_step_followups")
    .select("id, profile_id, onboarding_step, step_label, step_url, idle_reference_at, idle_hours, status, student_notified_at, mentor_notified_at, notification_count")
    .eq("profile_id", profileId)
    .eq("onboarding_step", currentStep)
    .eq("status", "open")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[SLA Cron] Failed to read onboarding step followup", {
      profileId,
      currentStep,
      error,
    });
    return null;
  }

  return data as OnboardingStepFollowup | null;
}

async function createStudentDashboardNotification(
  supabase: SupabaseClient,
  profile: OnboardingProfile,
  stepLabel: string,
  stepUrl: string,
) {
  if (!profile.user_id) return;

  const { error } = await supabase
    .from("student_notifications")
    .insert({
      user_id: profile.user_id,
      title: "Continue your Migma onboarding",
      message: `You have been on ${stepLabel} for more than 48 hours. Continue here: ${stepUrl}`,
    });

  if (error) {
    console.error("[SLA Cron] Failed to create student dashboard notification", {
      profileId: profile.id,
      error,
    });
  }
}

async function tryNotify(
  trigger: string,
  profileId: string,
  data: Record<string, unknown>,
): Promise<{ success: boolean; result: Record<string, unknown> }> {
  try {
    const result = await notifyClient(trigger, profileId, data);
    return { success: true, result };
  } catch (err) {
    return {
      success: false,
      result: {
        error: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

async function dispatchOnboardingStepNotifications(
  supabase: SupabaseClient,
  followup: OnboardingStepFollowup,
  profile: OnboardingProfile,
  serviceFamily: "cos" | "transfer" | "initial",
) {
  const data = {
    followup_id: followup.id,
    profile_id: profile.id,
    client_id: profile.id,
    client_name: profile.full_name ?? profile.email ?? "Student",
    client_email: profile.email ?? undefined,
    service_family: serviceFamily,
    step: followup.onboarding_step,
    step_label: followup.step_label,
    step_url: followup.step_url,
    idle_hours: Math.max(followup.idle_hours ?? ONBOARDING_STEP_IDLE_HOURS, idleHoursSince(followup.idle_reference_at)),
  };

  const updates: Record<string, unknown> = {
    notification_count: (followup.notification_count ?? 0) + 1,
  };

  if (!followup.student_notified_at) {
    const studentResult = await tryNotify("onboarding_step_followup", profile.id, data);
    updates.student_notification_result = studentResult.result;

    if (studentResult.success) {
      updates.student_notified_at = new Date().toISOString();
      await createStudentDashboardNotification(supabase, profile, followup.step_label, followup.step_url);
    }
  }

  if (profile.mentor_id && !followup.mentor_notified_at) {
    const mentorResult = await tryNotify("mentor_onboarding_step_stalled", profile.mentor_id, data);
    updates.mentor_notification_result = mentorResult.result;

    if (mentorResult.success) {
      updates.mentor_notified_at = new Date().toISOString();
    }
  } else if (!profile.mentor_id) {
    updates.mentor_notification_result = { skipped: "no_mentor" };
  }

  const { error } = await supabase
    .from("onboarding_step_followups")
    .update(updates)
    .eq("id", followup.id);

  if (error) {
    console.error("[SLA Cron] Failed to update onboarding followup notification state", {
      followupId: followup.id,
      error,
    });
  }
}

async function checkOnboardingStepInactivity(
  supabase: SupabaseClient,
  testEmail: string | null = null,
  testProfileId: string | null = null,
  dryRun = false,
): Promise<number> {
  let created = 0;

  let profileQuery = supabase
    .from("user_profiles")
    .select(`
      id, user_id, email, full_name, source, status, service_type, student_process_type,
      onboarding_current_step, onboarding_completed, is_archived,
      last_activity_at, onboarding_step_entered_at, onboarding_followup_started_at, migma_checkout_completed_at,
      updated_at, created_at, mentor_id
    `)
    .eq("source", "migma")
    .not("onboarding_followup_started_at", "is", null)
    .not("onboarding_current_step", "is", null);

  if (testEmail) profileQuery = profileQuery.eq("email", testEmail);
  if (testProfileId) profileQuery = profileQuery.eq("id", testProfileId);

  const { data: profiles, error } = await profileQuery;

  if (error) {
    console.error("[SLA Cron] Error fetching profiles for onboarding inactivity", error);
    throw error;
  }

  if (!profiles?.length) return 0;

  for (const profile of profiles as OnboardingProfile[]) {
    if (!profile.user_id) continue;
    if (profile.status && profile.status !== "active") continue;
    if (profile.onboarding_completed || profile.is_archived) continue;

    const currentStep = profile.onboarding_current_step ?? "";
    if (!currentStep || currentStep === "completed") continue;

    const serviceFamily = resolveProfileServiceFamily(profile);
    if (!serviceFamily) continue;

    const idleReferenceAt = latestIso([
      profile.last_activity_at,
      profile.onboarding_step_entered_at,
      profile.onboarding_followup_started_at,
      profile.migma_checkout_completed_at,
    ]);

    if (!idleReferenceAt) continue;

    const idleHours = idleHoursSince(idleReferenceAt);
    if (idleHours < ONBOARDING_STEP_IDLE_HOURS) continue;

    if (dryRun) {
      created++;
      continue;
    }

    await resolveMovedOnboardingStepFollowups(supabase, profile.id, currentStep);

    const existing = await getOpenOnboardingStepFollowup(supabase, profile.id, currentStep);
    if (existing) {
      await dispatchOnboardingStepNotifications(supabase, existing, profile, serviceFamily);
      continue;
    }

    const serviceRequestId = await resolveLatestServiceRequestId(supabase, profile.email);
    const stepLabel = getOnboardingStepLabel(currentStep);
    const stepUrl = getOnboardingStepUrl(currentStep);

    const { data: inserted, error: insertError } = await supabase
      .from("onboarding_step_followups")
      .insert({
        profile_id: profile.id,
        service_request_id: serviceRequestId,
        mentor_profile_id: profile.mentor_id,
        service_family: serviceFamily,
        onboarding_step: currentStep,
        step_label: stepLabel,
        step_url: stepUrl,
        idle_reference_at: idleReferenceAt,
        idle_hours: idleHours,
        status: "open",
        notes: `${profile.full_name ?? profile.email ?? profile.id} has been idle in ${stepLabel} for ${idleHours} hour(s).`,
      })
      .select("id, profile_id, onboarding_step, step_label, step_url, idle_reference_at, idle_hours, status, student_notified_at, mentor_notified_at, notification_count")
      .single();

    if (insertError || !inserted) {
      console.error("[SLA Cron] Failed to create onboarding step followup", {
        profileId: profile.id,
        currentStep,
        insertError,
      });
      continue;
    }

    created++;
    await dispatchOnboardingStepNotifications(
      supabase,
      inserted as OnboardingStepFollowup,
      profile,
      serviceFamily,
    );
  }

  return created;
}

