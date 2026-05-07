import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const appMetadataApproverRoles = new Set([
  "admin",
  "superadmin",
  "super_admin",
  "seller",
  "head_of_sale",
  "head_of_sales",
]);
const legacyAdminRoles = new Set(["admin", "superadmin", "super_admin"]);
const sellerTableApproverRoles = new Set(["seller", "head_of_sale", "head_of_sales"]);

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type SupabaseAdmin = any;

function normalizeRole(role: unknown): string | null {
  if (typeof role !== "string") return null;
  const normalized = role.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return normalized.length > 0 ? normalized : null;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function requireZelleApprover(req: Request, supabase: SupabaseAdmin) {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    throw new HttpError(401, "Unauthorized");
  }

  const token = authHeader.replace("Bearer ", "").trim();
  const { data, error } = await supabase.auth.getUser(token);
  const user = data.user;

  if (error || !user) {
    console.error("[migma-checkout-zelle-admin] Invalid JWT:", error?.message);
    throw new HttpError(401, "Unauthorized");
  }

  const appRole = normalizeRole(user.app_metadata?.role);
  const metadataRole = normalizeRole(user.user_metadata?.role);

  if (appRole && appMetadataApproverRoles.has(appRole)) {
    return user;
  }

  const { data: seller, error: sellerError } = await supabase
    .from("sellers")
    .select("id, role, status")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (sellerError) {
    console.warn("[migma-checkout-zelle-admin] Seller role lookup failed", {
      user_id: user.id,
      email: user.email,
      error: sellerError.message,
    });
  }

  const sellerRole = normalizeRole(seller?.role);
  if (sellerRole && sellerTableApproverRoles.has(sellerRole)) {
    return user;
  }

  // Legacy compatibility: current admin accounts may still carry role only in
  // user_metadata. Do not trust user_metadata for seller/head_of_sales approval.
  if (metadataRole && legacyAdminRoles.has(metadataRole)) {
    return user;
  }

  console.warn("[migma-checkout-zelle-admin] Non-approver request blocked", {
    user_id: user.id,
    email: user.email,
    app_role: appRole,
    metadata_role: metadataRole,
    seller_role: sellerRole,
    seller_status: seller?.status ?? null,
  });
  throw new HttpError(403, "Forbidden");
}

async function listPending(supabase: SupabaseAdmin, includeTest: boolean) {
  let query = supabase
    .from("migma_checkout_zelle_pending")
    .select(`
      id,
      migma_user_id,
      migma_user_name,
      migma_user_email,
      service_request_id,
      service_type,
      amount,
      receipt_url,
      image_path,
      n8n_payment_id,
      n8n_response,
      n8n_confidence,
      status,
      admin_notes,
      approved_at,
      approved_by,
      created_at,
      updated_at,
      is_test
    `)
    .eq("status", "pending_verification")
    .order("created_at", { ascending: false });

  if (!includeTest) {
    query = query.or("is_test.eq.false,is_test.is.null");
  }

  const { data: payments, error } = await query;
  if (error) throw new Error(error.message);

  const userIds = [
    ...new Set((payments ?? []).map((payment: any) => payment.migma_user_id).filter(Boolean)),
  ];

  const profilesMap = new Map<string, any>();
  if (userIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from("user_profiles")
      .select("user_id, full_name, email")
      .in("user_id", userIds);

    if (profilesError) throw new Error(profilesError.message);
    (profiles ?? []).forEach((profile: any) => profilesMap.set(profile.user_id, profile));
  }

  return (payments ?? []).map((payment: any) => {
    const profile = profilesMap.get(payment.migma_user_id);
    return {
      ...payment,
      client_name:
        payment.migma_user_name ||
        profile?.full_name ||
        `User ${String(payment.migma_user_id ?? "").substring(0, 8)}`,
      client_email: payment.migma_user_email || profile?.email || "N/A",
    };
  });
}

async function approvePayment(supabase: SupabaseAdmin, paymentId: string, adminUserId: string) {
  const { data, error } = await supabase
    .from("migma_checkout_zelle_pending")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      approved_by: adminUserId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", paymentId)
    .eq("status", "pending_verification")
    .select("*")
    .single();

  if (error || !data) {
    console.error("[migma-checkout-zelle-admin] Approval failed:", error?.message);
    throw new HttpError(409, "Payment is not pending or was not found");
  }

  return data;
}

async function rejectPayment(
  supabase: SupabaseAdmin,
  paymentId: string,
  adminUserId: string,
  reason?: string,
) {
  const adminNotes = reason?.trim() || "Rejected by admin";

  const { data, error } = await supabase
    .from("migma_checkout_zelle_pending")
    .update({
      status: "rejected",
      admin_notes: adminNotes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", paymentId)
    .eq("status", "pending_verification")
    .select("*")
    .single();

  if (error || !data) {
    console.error("[migma-checkout-zelle-admin] Rejection failed:", error?.message);
    throw new HttpError(409, "Payment is not pending or was not found");
  }

  let rejectionWarning: string | null = null;
  const { data: migmaPayment } = await supabase
    .from("migma_payments")
    .select("id")
    .eq("user_id", data.migma_user_id)
    .in("status", ["pending", "pending_verification"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (migmaPayment?.id) {
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/process-zelle-rejection`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseServiceKey}`,
          apikey: supabaseServiceKey,
        },
        body: JSON.stringify({
          id: migmaPayment.id,
          type: "migma_payment",
          rejection_reason: adminNotes,
          processed_by_user_id: adminUserId,
        }),
      });

      if (!response.ok) {
        rejectionWarning = `process-zelle-rejection failed with status ${response.status}`;
        console.warn("[migma-checkout-zelle-admin]", rejectionWarning, await response.text());
      }
    } catch (err: any) {
      rejectionWarning = err?.message || "process-zelle-rejection failed";
      console.warn("[migma-checkout-zelle-admin]", rejectionWarning);
    }
  }

  return { payment: data, rejection_warning: rejectionWarning };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed" }, 405);
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return jsonResponse({ success: false, error: "Supabase env vars are not configured" }, 500);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const adminUser = await requireZelleApprover(req, supabase);
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action === "list") {
      const payments = await listPending(supabase, body.include_test === true);
      return jsonResponse({ success: true, payments });
    }

    if (action === "approve") {
      if (!body.payment_id) throw new HttpError(400, "payment_id is required");
      const payment = await approvePayment(supabase, body.payment_id, adminUser.id);
      return jsonResponse({ success: true, payment });
    }

    if (action === "reject") {
      if (!body.payment_id) throw new HttpError(400, "payment_id is required");
      const result = await rejectPayment(
        supabase,
        body.payment_id,
        adminUser.id,
        body.rejection_reason,
      );
      return jsonResponse({ success: true, ...result });
    }

    return jsonResponse({ success: false, error: "Invalid action" }, 400);
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Unexpected error";
    console.error("[migma-checkout-zelle-admin]", message);
    return jsonResponse({ success: false, error: message }, status);
  }
});
