type SupabaseClientLike = {
  from: (table: string) => any;
};

type ServiceRequestRow = {
  id: string;
  service_id: string;
  service_type?: string | null;
  workflow_stage?: string | null;
  stage_entered_at?: string | null;
  case_status?: string | null;
  status_i20?: string | null;
  status_sevis?: string | null;
  transfer_form_status?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

export type OperationalEventSource = "system" | "n8n" | "user" | "gateway" | "email" | "ai";

type RuntimeConfig = {
  supabaseUrl: string;
  supabaseServiceKey: string;
  fromEmail: string;
};

type InboundEmailAttachment = {
  fileName: string;
  mimeType: string | null;
  storageUrl: string | null;
  sizeBytes: number | null;
  documentType: string;
};

type InboundEmailAnalysis = {
  summary: string;
  categories: string[];
  attachmentCount: number;
  mentionsDocuments: boolean;
  asksQuestion: boolean;
  needsManualReview: boolean;
};

export function deriveServiceType(serviceId?: string | null): string | null {
  if (!serviceId) return null;
  if (serviceId.startsWith("transfer-")) return "transfer";
  if (serviceId.startsWith("cos-")) return "cos";
  if (serviceId.startsWith("initial-")) return "initial";
  return null;
}

function getRuntimeConfig(): RuntimeConfig {
  const supabaseUrl =
    Deno.env.get("MIGMA_REMOTE_URL") ||
    Deno.env.get("REMOTE_SUPABASE_URL") ||
    Deno.env.get("SUPABASE_URL") ||
    "";
  const supabaseServiceKey =
    Deno.env.get("MIGMA_REMOTE_SERVICE_ROLE_KEY") ||
    Deno.env.get("REMOTE_SUPABASE_SERVICE_ROLE_KEY") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    "";

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase runtime configuration");
  }

  return {
    supabaseUrl,
    supabaseServiceKey,
    fromEmail:
      Deno.env.get("SMTP_FROM_EMAIL") ||
      Deno.env.get("SMTP_USER") ||
      "support@migmainc.com",
  };
}

function escapeHtml(value: string | null | undefined): string {
  if (!value) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatServiceLabel(serviceType?: string | null, productSlug?: string | null): string {
  const value = serviceType || productSlug || "your service";
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function extractEmailAddress(raw?: string | null): string | null {
  if (!raw) return null;

  const angleBracketMatch = raw.match(/<([^>]+)>/);
  const candidate = (angleBracketMatch?.[1] || raw)
    .trim()
    .replace(/^mailto:/i, "")
    .split(",")[0]
    .trim()
    .toLowerCase();

  return candidate.includes("@") ? candidate : null;
}

function normalizeMessageIdentifier(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const inner = trimmed.replace(/^<|>$/g, "");
  return inner ? `<${inner}>` : null;
}

function extractMessageIdentifierCandidates(...values: Array<string | null | undefined>): string[] {
  const identifiers = new Set<string>();

  for (const value of values) {
    if (!value) continue;

    const angleMatches = value.match(/<[^>]+>/g);
    if (angleMatches?.length) {
      for (const match of angleMatches) {
        const normalized = normalizeMessageIdentifier(match);
        if (normalized) identifiers.add(normalized);
      }
      continue;
    }

    const normalized = normalizeMessageIdentifier(value);
    if (normalized) identifiers.add(normalized);
  }

  return Array.from(identifiers);
}

function getOperationalReplyBaseEmail(runtime: RuntimeConfig): string {
  return (
    Deno.env.get("MIGMA_INBOUND_REPLY_EMAIL") ||
    Deno.env.get("ONBOARDING_INBOUND_REPLY_EMAIL") ||
    Deno.env.get("MIGMA_ONBOARDING_REPLY_EMAIL") ||
    runtime.fromEmail
  );
}

function buildOperationalThreadId(serviceRequestId: string): string {
  return `service-request:${serviceRequestId}`;
}

function buildOperationalReplyAddress(serviceRequestId: string, baseEmail: string): string {
  const normalizedBase = extractEmailAddress(baseEmail);
  if (!normalizedBase) return baseEmail;

  const [localPart, domain] = normalizedBase.split("@");
  if (!localPart || !domain) return normalizedBase;

  const canonicalLocalPart = localPart.split("+")[0];
  return `${canonicalLocalPart}+sr_${serviceRequestId}@${domain}`;
}

function buildOperationalMessageId(serviceRequestId: string, fromEmail: string): string {
  const normalizedFrom = extractEmailAddress(fromEmail) || "support@migmainc.com";
  const [, domain = "migmainc.com"] = normalizedFrom.split("@");
  const stamp = new Date().toISOString().replace(/[^0-9]/g, "");
  return `<onboarding.${serviceRequestId}.${stamp}@${domain}>`;
}

function extractServiceRequestIdFromReplyAddress(address?: string | null): string | null {
  const normalized = extractEmailAddress(address);
  if (!normalized) return null;

  const [localPart] = normalized.split("@");
  const match = localPart.match(/\+sr[_-]([0-9a-f-]{36})/i);
  return match?.[1]?.toLowerCase() || null;
}

function getOnboardingFormUrl(serviceType?: string | null): string | null {
  const normalized = (serviceType || "").toLowerCase();
  const generic =
    Deno.env.get("MIGMA_ONBOARDING_FORM_URL") ||
    Deno.env.get("ONBOARDING_FORM_URL") ||
    null;

  if (normalized === "transfer") {
    return (
      Deno.env.get("MIGMA_TRANSFER_ONBOARDING_FORM_URL") ||
      Deno.env.get("TRANSFER_ONBOARDING_FORM_URL") ||
      generic
    );
  }

  if (normalized === "cos") {
    return (
      Deno.env.get("MIGMA_COS_ONBOARDING_FORM_URL") ||
      Deno.env.get("COS_ONBOARDING_FORM_URL") ||
      generic
    );
  }

  if (normalized === "initial") {
    return (
      Deno.env.get("MIGMA_INITIAL_ONBOARDING_FORM_URL") ||
      Deno.env.get("INITIAL_ONBOARDING_FORM_URL") ||
      generic
    );
  }

  return generic;
}

function getInitialChecklist(serviceType?: string | null): string[] {
  const normalized = (serviceType || "").toLowerCase();

  if (normalized === "transfer") {
    return [
      "Your passport identification page",
      "Your current visa and your latest I-20 or DS-2019, if applicable",
      "Any current school or enrollment documents you already have available",
      "Dependent documents as well, if someone else is included in the case",
    ];
  }

  return [
    "A valid identification document, preferably your passport",
    "The main documents you already have for this case",
    "Any supporting documents for dependents or related applicants, if applicable",
  ];
}

type OnboardingPaymentStep = {
  label: string;
  amountLabel: string;
};

function getOnboardingPaymentPath(serviceType?: string | null): OnboardingPaymentStep[] {
  const normalized = (serviceType || "").toLowerCase();

  if (normalized === "transfer") {
    return [
      { label: "Selection Process", amountLabel: "USD 400 + USD 150 per dependent" },
      { label: "Scholarship", amountLabel: "USD 900" },
      { label: "I-20 Control", amountLabel: "USD 900" },
      { label: "Transfer - Full Process Payment", amountLabel: "USD 2200 + USD 150 per dependent" },
    ];
  }

  if (normalized === "cos") {
    return [
      { label: "Selection Process", amountLabel: "USD 400 + USD 150 per dependent" },
      { label: "Scholarship", amountLabel: "USD 900" },
      { label: "I-20 Control", amountLabel: "USD 900" },
      { label: "Change of Status - Full Process Payment", amountLabel: "USD 2200 + USD 150 per dependent" },
    ];
  }

  return [];
}

function getPaymentPathSection(serviceType?: string | null) {
  const paymentPath = getOnboardingPaymentPath(serviceType);

  if (paymentPath.length === 0) {
    return {
      html: "",
      text: "",
      items: [] as OnboardingPaymentStep[],
    };
  }

  const htmlItems = paymentPath
    .map((step) => (
      `<li style="margin-bottom: 8px;"><strong style="color: #F3E196;">${escapeHtml(step.label)}:</strong> ${escapeHtml(step.amountLabel)}</li>`
    ))
    .join("");

  const textItems = paymentPath
    .map((step) => `- ${step.label}: ${step.amountLabel}`)
    .join("\n");

  return {
    html: `
      <div style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(206, 159, 72, 0.18); border-radius: 8px; padding: 20px; margin: 24px 0;">
        <p style="margin: 0 0 12px 0; color: #F3E196; font-size: 16px; font-weight: 600;">Current payment path for your service</p>
        <ul style="margin: 0 0 0 18px; padding: 0; color: #e0e0e0; font-size: 14px; line-height: 1.7;">
          ${htmlItems}
        </ul>
      </div>
    `,
    text: `Current payment path for your service:\n${textItems}\n`,
    items: paymentPath,
  };
}

function normalizeInboundAttachments(rawAttachments: unknown): InboundEmailAttachment[] {
  if (!Array.isArray(rawAttachments)) return [];

  return rawAttachments
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const candidate = item as Record<string, unknown>;
      const fileName =
        String(candidate.fileName || candidate.filename || candidate.name || "").trim();

      if (!fileName) return null;

      return {
        fileName,
        mimeType: candidate.mimeType
          ? String(candidate.mimeType)
          : candidate.contentType
            ? String(candidate.contentType)
            : null,
        storageUrl: candidate.storageUrl
          ? String(candidate.storageUrl)
          : candidate.storage_url
            ? String(candidate.storage_url)
            : candidate.url
              ? String(candidate.url)
              : null,
        sizeBytes: typeof candidate.sizeBytes === "number"
          ? candidate.sizeBytes
          : typeof candidate.size_bytes === "number"
            ? candidate.size_bytes
            : null,
        documentType: candidate.documentType
          ? String(candidate.documentType)
          : candidate.document_type
            ? String(candidate.document_type)
            : "email_attachment",
      } satisfies InboundEmailAttachment;
    })
    .filter((attachment): attachment is InboundEmailAttachment => Boolean(attachment));
}

function analyzeInboundClientEmail(
  bodyText: string,
  attachments: InboundEmailAttachment[],
): InboundEmailAnalysis {
  const normalizedBody = bodyText.toLowerCase();
  const attachmentCount = attachments.length;
  const mentionsDocuments =
    /(passport|i-20|ds-2019|document|documents|attachment|attached|anexo|anexei|documento|documentos)/i
      .test(bodyText) || attachmentCount > 0;
  const asksQuestion =
    bodyText.includes("?") ||
    /(can you|could you|what|when|which|how|help|question|duvida|dúvida|como|quando|qual|pode|posso)/i
      .test(bodyText);

  const categories = new Set<string>();
  if (attachmentCount > 0) categories.add("documents_attached");
  if (mentionsDocuments) categories.add("documents_mentioned");
  if (asksQuestion) categories.add("client_question");
  if (!normalizedBody.trim() && attachmentCount > 0) categories.add("attachment_only_reply");
  categories.add("manual_review_required");

  const summaryParts = [
    attachmentCount > 0
      ? `${attachmentCount} attachment${attachmentCount === 1 ? "" : "s"} received`
      : "no attachments detected",
    mentionsDocuments ? "documents mentioned" : "no explicit document mention",
    asksQuestion ? "client asked at least one question" : "no direct question detected",
  ];

  return {
    summary: summaryParts.join("; "),
    categories: Array.from(categories),
    attachmentCount,
    mentionsDocuments,
    asksQuestion,
    needsManualReview: true,
  };
}

function buildInitialOnboardingEmail(params: {
  clientName: string;
  orderNumber: string;
  productSlug?: string | null;
  serviceType?: string | null;
  formUrl?: string | null;
  supabaseUrl: string;
}) {
  const safeClientName = escapeHtml(params.clientName);
  const safeOrderNumber = escapeHtml(params.orderNumber);
  const safeServiceLabel = escapeHtml(formatServiceLabel(params.serviceType, params.productSlug));
  const checklist = getInitialChecklist(params.serviceType);
  const paymentPathSection = getPaymentPathSection(params.serviceType);
  const formUrl = params.formUrl || null;
  const logoUrl = `${params.supabaseUrl}/storage/v1/object/public/logo/logo2.png`;
  const subject = `Welcome to MIGMA Onboarding - Next Steps for Order ${safeOrderNumber}`;

  const checklistHtml = checklist
    .map((item) => `<li style="margin-bottom: 8px;">${escapeHtml(item)}</li>`)
    .join("");
  const checklistText = checklist.map((item) => `- ${item}`).join("\n");

  const formBlockHtml = formUrl
    ? `
      <div style="background: rgba(206, 159, 72, 0.08); border: 1px solid rgba(206, 159, 72, 0.25); border-radius: 8px; padding: 20px; margin: 24px 0;">
        <p style="margin: 0 0 12px 0; color: #F3E196; font-size: 16px; font-weight: 600;">Required form</p>
        <p style="margin: 0 0 16px 0; color: #e0e0e0; font-size: 14px; line-height: 1.6;">
          Please complete your onboarding form here before replying with the requested documents.
        </p>
        <a href="${escapeHtml(formUrl)}" style="display: inline-block; background: linear-gradient(180deg, #F3E196 0%, #CE9F48 100%); color: #000000; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 700; font-size: 14px;">
          Open onboarding form
        </a>
      </div>
    `
    : `
      <div style="background: rgba(255, 255, 255, 0.04); border-left: 4px solid #CE9F48; border-radius: 8px; padding: 18px; margin: 24px 0;">
        <p style="margin: 0; color: #e0e0e0; font-size: 14px; line-height: 1.6;">
          If your case requires an additional form, our team will share it in the next communication. For now, you can already reply to this email with the documents listed below.
        </p>
      </div>
    `;

  const formBlockText = formUrl
    ? `Onboarding form: ${formUrl}\n`
    : "If your case requires an additional form, our team will share it in the next communication.\n";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', Arial, sans-serif; background-color: #000000; color: #e0e0e0;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #000000;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; background-color: #000000; border-radius: 8px;">
          <tr>
            <td align="center" style="padding: 40px 20px 30px;">
              <img src="${logoUrl}" alt="MIGMA Logo" width="200" style="display: block; max-width: 200px; height: auto;">
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 40px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="padding: 30px; background: linear-gradient(135deg, #1a1a1a 0%, #000000 100%); border-radius: 8px; border: 1px solid #CE9F48;">
                    <h1 style="margin: 0 0 18px 0; font-size: 28px; font-weight: bold; color: #F3E196; text-align: center; background: linear-gradient(180deg, #8E6E2F 0%, #F3E196 25%, #CE9F48 50%, #F3E196 75%, #8E6E2F 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                      Welcome to MIGMA Onboarding
                    </h1>
                    <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">
                      Hello <strong style="color: #CE9F48;">${safeClientName}</strong>,
                    </p>
                    <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">
                      Your payment has been confirmed and your <strong style="color: #CE9F48;">${safeServiceLabel}</strong> onboarding is now open.
                    </p>
                    <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">
                      Order reference: <strong style="color: #F3E196;">${safeOrderNumber}</strong>
                    </p>
                    <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6;">
                      Your next step is to reply to this email with the requested documents below:
                    </p>
                    <ul style="margin: 0 0 24px 18px; padding: 0; color: #e0e0e0; font-size: 15px; line-height: 1.7;">
                      ${checklistHtml}
                    </ul>
                    ${paymentPathSection.html}
                    ${formBlockHtml}
                    <p style="margin: 20px 0 0 0; font-size: 15px; line-height: 1.7;">
                      If any listed item does not apply to your case, just tell us in your reply and we will guide you on the correct next step.
                    </p>
                    <p style="margin: 20px 0 0 0; font-size: 15px; line-height: 1.7;">
                      Best regards,<br>
                      <strong style="color: #CE9F48;">MIGMA Team</strong>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 20px 40px;">
              <p style="margin: 0; font-size: 12px; color: #666666;">
                © MIGMA INC. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const text = [
    `Hello ${params.clientName},`,
    "",
    `Your payment has been confirmed and your ${formatServiceLabel(params.serviceType, params.productSlug)} onboarding is now open.`,
    `Order reference: ${params.orderNumber}`,
    "",
    "Please reply to this email with the following documents:",
    checklistText,
    "",
    paymentPathSection.text,
    formBlockText,
    "If any listed item does not apply to your case, reply and tell us so we can guide you.",
    "",
    "Best regards,",
    "MIGMA Team",
  ].join("\n");

  return {
    subject,
    html,
    text,
    checklist,
    paymentPath: paymentPathSection.items,
    formUrl,
    serviceLabel: formatServiceLabel(params.serviceType, params.productSlug),
  };
}

async function bumpServiceRequestActivity(
  supabase: SupabaseClientLike,
  serviceRequestId: string,
  patch: Record<string, unknown> = {},
) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("service_requests")
    .update({
      ...patch,
      updated_at: now,
    })
    .eq("id", serviceRequestId);

  if (error) {
    console.error("[Operational Case] Failed to bump service request activity", {
      serviceRequestId,
      error,
    });
  }
}

export async function appendServiceRequestEvent(
  supabase: SupabaseClientLike,
  serviceRequestId: string,
  eventType: string,
  eventSource: OperationalEventSource,
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

export async function transitionServiceRequestStage(
  supabase: SupabaseClientLike,
  serviceRequest: ServiceRequestRow,
  nextStage: string,
  triggerSource: OperationalEventSource,
  reason: string,
  payload: Record<string, unknown> = {},
) {
  const previousStage = serviceRequest.workflow_stage || null;
  if (previousStage === nextStage) {
    return { changed: false, workflowStage: nextStage };
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("service_requests")
    .update({
      workflow_stage: nextStage,
      stage_entered_at: now,
      updated_at: now,
    })
    .eq("id", serviceRequest.id);

  if (updateError) {
    throw new Error(`Failed to update workflow stage: ${updateError.message}`);
  }

  const { error: historyError } = await supabase
    .from("service_request_stage_history")
    .insert({
      service_request_id: serviceRequest.id,
      from_stage: previousStage,
      to_stage: nextStage,
      reason,
      trigger_source: triggerSource,
      created_at: now,
    });

  if (historyError) {
    console.error("[Operational Case] Failed to insert stage history", {
      serviceRequestId: serviceRequest.id,
      previousStage,
      nextStage,
      historyError,
    });
  }

  await appendServiceRequestEvent(
    supabase,
    serviceRequest.id,
    "workflow_stage_changed",
    triggerSource,
    {
      from_stage: previousStage,
      to_stage: nextStage,
      reason,
      ...payload,
    },
  );

  return { changed: true, workflowStage: nextStage };
}

export async function ensureOperationalCaseInitialized(
  supabase: SupabaseClientLike,
  serviceRequestId: string,
  eventSource: OperationalEventSource,
  payload: Record<string, unknown> = {},
) {
  const { data: serviceRequest, error } = await supabase
    .from("service_requests")
    .select("id, service_id, service_type, workflow_stage, stage_entered_at, case_status, status_i20, status_sevis, transfer_form_status, updated_at, created_at")
    .eq("id", serviceRequestId)
    .single();

  if (error || !serviceRequest) {
    throw new Error(`Service request not found: ${serviceRequestId}`);
  }

  const nextServiceType = serviceRequest.service_type || deriveServiceType(serviceRequest.service_id);
  const nextWorkflowStage = serviceRequest.workflow_stage || "awaiting_client_data";
  const now = new Date().toISOString();

  const updatePayload: Record<string, unknown> = {};
  if (!serviceRequest.service_type && nextServiceType) updatePayload.service_type = nextServiceType;
  if (!serviceRequest.workflow_stage) updatePayload.workflow_stage = nextWorkflowStage;
  if (!serviceRequest.stage_entered_at) updatePayload.stage_entered_at = serviceRequest.updated_at || serviceRequest.created_at || now;
  if (!serviceRequest.case_status) updatePayload.case_status = "active";
  if (!serviceRequest.status_i20) updatePayload.status_i20 = "not_requested";
  if (!serviceRequest.status_sevis) updatePayload.status_sevis = "current_school";
  if (!serviceRequest.transfer_form_status) updatePayload.transfer_form_status = "not_sent";

  if (Object.keys(updatePayload).length > 0) {
    updatePayload.updated_at = now;
    const { error: updateError } = await supabase
      .from("service_requests")
      .update(updatePayload)
      .eq("id", serviceRequestId);

    if (updateError) {
      throw new Error(`Failed to initialize operational fields: ${updateError.message}`);
    }
  }

  if (!serviceRequest.workflow_stage) {
    const { error: historyError } = await supabase
      .from("service_request_stage_history")
      .insert({
        service_request_id: serviceRequestId,
        from_stage: null,
        to_stage: nextWorkflowStage,
        reason: "operational_case_initialized",
        trigger_source: eventSource,
        created_at: now,
      });

    if (historyError) {
      console.error("[Operational Case] Failed to create initial stage history", {
        serviceRequestId,
        nextWorkflowStage,
        historyError,
      });
    }
  }

  await appendServiceRequestEvent(
    supabase,
    serviceRequestId,
    "operational_case_initialized",
    eventSource,
    {
      service_type: nextServiceType,
      workflow_stage: nextWorkflowStage,
      ...payload,
    },
  );

  return {
    ...serviceRequest,
    ...updatePayload,
  };
}

/**
 * Derive a readable service_type from a MIGMA product slug.
 * Keeps the Transfer-domain derivation and extends it with visa slugs.
 */
function deriveMigmaServiceType(productSlug?: string | null): string | null {
  if (!productSlug) return null;
  if (productSlug.startsWith("transfer-")) return "transfer";
  if (productSlug.startsWith("cos-")) return "cos";
  if (productSlug.startsWith("initial-")) return "initial";
  if (productSlug.startsWith("consultation-")) return "consultation";
  if (productSlug.startsWith("eb3-") || productSlug === "eb3") return "eb3";
  if (productSlug.startsWith("scholarship-")) return "scholarship";
  return productSlug;
}

async function resolveServiceRequestIdForInboundEmail(
  supabase: SupabaseClientLike,
  params: {
    serviceRequestId?: string | null;
    toAddress?: string | null;
    fromAddress?: string | null;
    inReplyTo?: string | null;
    references?: string | null;
    threadId?: string | null;
  },
): Promise<{ serviceRequestId: string | null; reason?: string }> {
  if (params.serviceRequestId) {
    return { serviceRequestId: params.serviceRequestId };
  }

  const fromAddress = extractEmailAddress(params.fromAddress);
  const toAddress = extractEmailAddress(params.toAddress);

  const serviceRequestIdFromAddress = extractServiceRequestIdFromReplyAddress(toAddress);
  if (serviceRequestIdFromAddress) {
    return { serviceRequestId: serviceRequestIdFromAddress };
  }

  const messageIdCandidates = extractMessageIdentifierCandidates(params.inReplyTo, params.references);
  if (messageIdCandidates.length > 0) {
    const { data: outboundByMessageId } = await supabase
      .from("service_request_messages")
      .select("service_request_id")
      .eq("direction", "outbound")
      .in("provider_message_id", messageIdCandidates)
      .limit(1)
      .maybeSingle();

    if (outboundByMessageId?.service_request_id) {
      return { serviceRequestId: outboundByMessageId.service_request_id };
    }
  }

  if (params.threadId) {
    const { data: outboundByThread } = await supabase
      .from("service_request_messages")
      .select("service_request_id")
      .eq("direction", "outbound")
      .eq("thread_id", params.threadId)
      .limit(1)
      .maybeSingle();

    if (outboundByThread?.service_request_id) {
      return { serviceRequestId: outboundByThread.service_request_id };
    }
  }

  if (fromAddress) {
    const { data: recentOutboundMessages } = await supabase
      .from("service_request_messages")
      .select("service_request_id")
      .eq("direction", "outbound")
      .eq("counterparty_type", "client")
      .eq("to_address", fromAddress)
      .order("created_at", { ascending: false })
      .limit(5);

    const uniqueServiceRequestIds = Array.from(
      new Set((recentOutboundMessages || []).map((row: { service_request_id?: string | null }) => row.service_request_id).filter(Boolean)),
    );

    if (uniqueServiceRequestIds.length === 1) {
      return { serviceRequestId: uniqueServiceRequestIds[0] as string };
    }

    if (uniqueServiceRequestIds.length > 1) {
      return { serviceRequestId: null, reason: "ambiguous_sender_email" };
    }
  }

  return { serviceRequestId: null, reason: "service_request_not_resolved" };
}

export async function captureInboundClientEmail(
  supabase: SupabaseClientLike,
  params: {
    serviceRequestId?: string | null;
    fromAddress?: string | null;
    toAddress?: string | null;
    subject?: string | null;
    bodyText?: string | null;
    bodyHtml?: string | null;
    provider?: string | null;
    providerMessageId?: string | null;
    inReplyTo?: string | null;
    references?: string | null;
    threadId?: string | null;
    receivedAt?: string | null;
    attachments?: unknown;
    rawPayload?: Record<string, unknown> | null;
  },
): Promise<{
  stored: boolean;
  skipped: boolean;
  reason?: string;
  serviceRequestId?: string | null;
  analysis?: InboundEmailAnalysis;
  createdDocuments?: number;
}> {
  const providerMessageId = normalizeMessageIdentifier(params.providerMessageId) || params.providerMessageId || null;
  const inboundBodyText = (params.bodyText || "").trim();
  const normalizedFromAddress = extractEmailAddress(params.fromAddress);
  const normalizedToAddress = extractEmailAddress(params.toAddress);
  const receivedAt = params.receivedAt || new Date().toISOString();
  const resolvedThreadId = params.threadId || null;
  const attachments = normalizeInboundAttachments(params.attachments);

  const resolved = await resolveServiceRequestIdForInboundEmail(supabase, {
    serviceRequestId: params.serviceRequestId,
    toAddress: normalizedToAddress,
    fromAddress: normalizedFromAddress,
    inReplyTo: params.inReplyTo || null,
    references: params.references || null,
    threadId: resolvedThreadId,
  });

  if (!resolved.serviceRequestId) {
    return {
      stored: false,
      skipped: true,
      reason: resolved.reason || "service_request_not_resolved",
      serviceRequestId: null,
    };
  }

  if (providerMessageId) {
    const { data: existingInbound } = await supabase
      .from("service_request_messages")
      .select("id")
      .eq("service_request_id", resolved.serviceRequestId)
      .eq("direction", "inbound")
      .eq("provider_message_id", providerMessageId)
      .maybeSingle();

    if (existingInbound?.id) {
      return {
        stored: false,
        skipped: true,
        reason: "already_processed",
        serviceRequestId: resolved.serviceRequestId,
      };
    }
  }

  const analysis = analyzeInboundClientEmail(inboundBodyText, attachments);
  const threadId = resolvedThreadId || buildOperationalThreadId(resolved.serviceRequestId);

  const { data: insertedMessage, error: messageError } = await supabase
    .from("service_request_messages")
    .insert({
      service_request_id: resolved.serviceRequestId,
      direction: "inbound",
      counterparty_type: "client",
      channel: "email",
      provider: params.provider || "smtp",
      from_address: normalizedFromAddress,
      to_address: normalizedToAddress,
      subject: params.subject || null,
      body_text: inboundBodyText || null,
      thread_id: threadId,
      provider_message_id: providerMessageId,
      classification: "client_reply",
      received_at: receivedAt,
      message_metadata: {
        html: params.bodyHtml || null,
        in_reply_to: normalizeMessageIdentifier(params.inReplyTo) || params.inReplyTo || null,
        references: params.references || null,
        analysis,
        attachments,
        raw_payload: params.rawPayload || null,
      },
      created_at: receivedAt,
    })
    .select("id")
    .single();

  if (messageError || !insertedMessage) {
    throw new Error(`Failed to persist inbound client email: ${messageError?.message || "unknown_error"}`);
  }

  let createdDocuments = 0;
  const storableAttachments = attachments.filter((attachment) => attachment.storageUrl);
  if (storableAttachments.length > 0) {
    const { error: documentsError } = await supabase
      .from("service_request_documents")
      .insert(
        storableAttachments.map((attachment) => ({
          service_request_id: resolved.serviceRequestId,
          source_message_id: insertedMessage.id,
          document_type: attachment.documentType,
          source: "client_email",
          storage_url: attachment.storageUrl,
          file_name: attachment.fileName,
          mime_type: attachment.mimeType,
          document_status: "received",
          extracted_data_json: {
            attachment_size_bytes: attachment.sizeBytes,
            attachment_origin: "client_email_reply",
          },
          received_at: receivedAt,
          created_at: receivedAt,
        })),
      );

    if (documentsError) {
      console.error("[Operational Case] Failed to persist inbound email attachments", {
        serviceRequestId: resolved.serviceRequestId,
        documentsError,
      });
    } else {
      createdDocuments = storableAttachments.length;
    }
  }

  await bumpServiceRequestActivity(supabase, resolved.serviceRequestId, {
    last_client_contact_at: receivedAt,
  });

  await appendServiceRequestEvent(
    supabase,
    resolved.serviceRequestId,
    "client_email_received",
    "email",
    {
      from_address: normalizedFromAddress,
      to_address: normalizedToAddress,
      subject: params.subject || null,
      provider: params.provider || "smtp",
      provider_message_id: providerMessageId,
      thread_id: threadId,
      attachment_count: attachments.length,
      created_documents: createdDocuments,
      analysis,
    },
  );

  return {
    stored: true,
    skipped: false,
    serviceRequestId: resolved.serviceRequestId,
    analysis,
    createdDocuments,
  };
}

export async function triggerInitialOnboardingWelcome(
  supabase: SupabaseClientLike,
  params: {
    serviceRequestId: string;
    orderId: string;
    orderNumber?: string | null;
    clientEmail?: string | null;
    clientName?: string | null;
    clientWhatsapp?: string | null;
    productSlug?: string | null;
    serviceType?: string | null;
    provider?: string | null;
  },
): Promise<{ sent: boolean; skipped: boolean; reason?: string }> {
  const {
    serviceRequestId,
    orderId,
    orderNumber,
    clientEmail,
    clientName,
    productSlug,
    serviceType,
    provider,
  } = params;

  const eventKey = `initial-onboarding-welcome:${serviceRequestId}`;

  if (!serviceRequestId) {
    return { sent: false, skipped: true, reason: "missing_service_request_id" };
  }

  if (!clientEmail) {
    await appendServiceRequestEvent(
      supabase,
      serviceRequestId,
      "onboarding_welcome_failed",
      "system",
      {
        reason: "missing_client_email",
        order_id: orderId,
        provider: provider || null,
      },
      { eventKey },
    );
    await bumpServiceRequestActivity(supabase, serviceRequestId);
    return { sent: false, skipped: true, reason: "missing_client_email" };
  }

  const { data: existingSent } = await supabase
    .from("service_request_events")
    .select("id")
    .eq("service_request_id", serviceRequestId)
    .eq("event_type", "onboarding_welcome_sent")
    .eq("event_key", eventKey)
    .maybeSingle();

  if (existingSent?.id) {
    return { sent: false, skipped: true, reason: "already_sent" };
  }

  const { data: serviceRequest, error: srError } = await supabase
    .from("service_requests")
    .select("id, service_id, service_type, workflow_stage, stage_entered_at, case_status, status_i20, status_sevis, transfer_form_status, updated_at, created_at")
    .eq("id", serviceRequestId)
    .single();

  if (srError || !serviceRequest) {
    throw new Error(`Service request not found for onboarding welcome: ${serviceRequestId}`);
  }

  const runtime = getRuntimeConfig();
  const resolvedServiceType =
    serviceType ||
    serviceRequest.service_type ||
    deriveMigmaServiceType(productSlug) ||
    deriveServiceType(serviceRequest.service_id);
  const resolvedClientName = clientName || "Client";
  const resolvedOrderNumber = orderNumber || orderId;
  const formUrl = getOnboardingFormUrl(resolvedServiceType);
  const threadId = buildOperationalThreadId(serviceRequestId);
  const replyTo = buildOperationalReplyAddress(
    serviceRequestId,
    getOperationalReplyBaseEmail(runtime),
  );
  const outboundMessageId = buildOperationalMessageId(serviceRequestId, runtime.fromEmail);
  const emailContent = buildInitialOnboardingEmail({
    clientName: resolvedClientName,
    orderNumber: resolvedOrderNumber,
    productSlug,
    serviceType: resolvedServiceType,
    formUrl,
    supabaseUrl: runtime.supabaseUrl,
  });

  let emailResponseBody: Record<string, unknown> | null = null;

  try {
    const emailResponse = await fetch(`${runtime.supabaseUrl}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${runtime.supabaseServiceKey}`,
        "apikey": runtime.supabaseServiceKey,
      },
      body: JSON.stringify({
        to: clientEmail,
        subject: emailContent.subject,
        html: emailContent.html,
        replyTo,
        messageId: outboundMessageId,
      }),
    });

    const rawResponse = await emailResponse.text();
    try {
      emailResponseBody = rawResponse ? JSON.parse(rawResponse) : null;
    } catch {
      emailResponseBody = { raw: rawResponse };
    }

    if (!emailResponse.ok || emailResponseBody?.success === false) {
      const failureReason =
        String(emailResponseBody?.error || emailResponse.statusText || "send_email_failed");
      await appendServiceRequestEvent(
        supabase,
        serviceRequestId,
        "onboarding_welcome_failed",
        "system",
        {
          reason: failureReason,
          order_id: orderId,
          order_number: resolvedOrderNumber,
          provider: provider || null,
          client_email: clientEmail,
          response_status: emailResponse.status,
        },
        { eventKey },
      );
      await bumpServiceRequestActivity(supabase, serviceRequestId);
      await supabase
        .from("user_profiles")
        .update({
          onboarding_email_status: "welcome_email_failed",
          updated_at: new Date().toISOString(),
        })
        .eq("email", clientEmail);
      return { sent: false, skipped: false, reason: failureReason };
    }
  } catch (error) {
    const failureReason = error instanceof Error ? error.message : "send_email_failed";
    await appendServiceRequestEvent(
      supabase,
      serviceRequestId,
      "onboarding_welcome_failed",
      "system",
      {
        reason: failureReason,
        order_id: orderId,
        order_number: resolvedOrderNumber,
        provider: provider || null,
        client_email: clientEmail,
      },
      { eventKey },
    );
    await bumpServiceRequestActivity(supabase, serviceRequestId);
    await supabase
      .from("user_profiles")
      .update({
        onboarding_email_status: "welcome_email_failed",
        updated_at: new Date().toISOString(),
      })
      .eq("email", clientEmail);
    return { sent: false, skipped: false, reason: failureReason };
  }

  await appendServiceRequestEvent(
    supabase,
    serviceRequestId,
    "onboarding_welcome_sent",
    "system",
    {
      order_id: orderId,
      order_number: resolvedOrderNumber,
      provider: provider || null,
      client_email: clientEmail,
      product_slug: productSlug || null,
      service_type: resolvedServiceType,
      form_url: emailContent.formUrl,
      checklist: emailContent.checklist,
      payment_path: emailContent.paymentPath,
      reply_to: replyTo,
      thread_id: threadId,
      outbound_message_id: outboundMessageId,
      workflow_stage: serviceRequest.workflow_stage || null,
    },
    { eventKey },
  );

  const now = new Date().toISOString();
  const { error: messageError } = await supabase
    .from("service_request_messages")
    .insert({
      service_request_id: serviceRequestId,
      direction: "outbound",
      counterparty_type: "client",
      channel: "email",
      provider: "smtp",
      from_address: runtime.fromEmail,
      to_address: clientEmail,
      subject: emailContent.subject,
      body_text: emailContent.text,
      thread_id: threadId,
      classification: "onboarding_welcome",
      provider_message_id: outboundMessageId,
      sent_at: now,
      message_metadata: {
        template_key: "initial_onboarding_welcome",
        html: emailContent.html,
        response: emailResponseBody,
        order_id: orderId,
        order_number: resolvedOrderNumber,
        product_slug: productSlug || null,
        service_type: resolvedServiceType,
        form_url: emailContent.formUrl,
        payment_path: emailContent.paymentPath,
        reply_to: replyTo,
        thread_id: threadId,
        outbound_message_id: outboundMessageId,
      },
      created_at: now,
    });

  if (messageError) {
    console.error("[Operational Case] Failed to persist onboarding outbound message", {
      serviceRequestId,
      orderId,
      messageError,
    });
  }

  const { error: profileUpdateError } = await supabase
    .from("user_profiles")
    .update({
      onboarding_email_status: "awaiting_client_data",
      updated_at: now,
    })
    .eq("email", clientEmail);

  if (profileUpdateError) {
    console.error("[Operational Case] Failed to update onboarding_email_status", {
      serviceRequestId,
      clientEmail,
      profileUpdateError,
    });
  }

  const shouldAdvanceStage =
    !serviceRequest.workflow_stage || serviceRequest.workflow_stage === "case_created";
  if (shouldAdvanceStage) {
    try {
      await transitionServiceRequestStage(
        supabase,
        serviceRequest,
        "awaiting_client_data",
        "system",
        "onboarding_welcome_sent",
        {
          order_id: orderId,
          order_number: resolvedOrderNumber,
          provider: provider || null,
        },
      );
    } catch (error) {
      console.error("[Operational Case] Failed to transition stage after onboarding welcome", {
        serviceRequestId,
        error,
      });
    }
  } else {
    await bumpServiceRequestActivity(supabase, serviceRequestId);
  }

  return { sent: true, skipped: false };
}

/**
 * Sync a user_profiles row for a MIGMA checkout client.
 *
 * Rules:
 * - If no profile exists for this email: INSERT with source='migma'.
 * - If a profile exists with source='migma': UPDATE operational fields (status, service_type).
 * - If a profile exists with a different source: log the cross-site gap and skip.
 *   Resolution will come when user_profile_sites is implemented.
 *
 * This is the canonical entry point that populates the Onboarding CRM hub from
 * payment gateway webhooks (square, stripe, parcelow, zelle). Call it after payment_confirmed.
 */
export async function syncMigmaUserProfile(
  supabase: SupabaseClientLike,
  params: {
    email: string;
    fullName: string | null;
    phone: string | null;
    productSlug: string | null;
    paymentMethod?: string | null;
    totalPriceUsd: number | string | null;
  },
): Promise<void> {
  const { email, fullName, phone, productSlug, paymentMethod, totalPriceUsd } = params;

  if (!email) {
    console.warn("[MIGMA Profile Sync] Missing email — cannot sync user_profiles.");
    return;
  }

  const serviceType = deriveMigmaServiceType(productSlug);

  try {
    // 1. Check if a profile already exists for this email
    const { data: existing, error: selectError } = await supabase
      .from("user_profiles")
      .select("id, source, onboarding_current_step, onboarding_completed, selection_process_fee_payment_method")
      .eq("email", email)
      .maybeSingle();

    if (selectError) {
      console.error("[MIGMA Profile Sync] Error reading user_profiles", { email, selectError });
      return;
    }

    const now = new Date().toISOString();

    if (!existing) {
      // 2a. No profile — create one with source='migma'
      const { error: insertError } = await supabase.from("user_profiles").insert({
        email,
        full_name: fullName || null,
        phone: phone || null,
        source: "migma",
        service_type: serviceType,
        total_price_usd: totalPriceUsd ? String(totalPriceUsd) : null,
        onboarding_current_step: "payment",
        onboarding_completed: false,
        selection_process_fee_payment_method: paymentMethod || null,
        status: "active",
        created_at: now,
        updated_at: now,
      });

      if (insertError) {
        console.error("[MIGMA Profile Sync] Failed to insert user_profiles", { email, insertError });
      } else {
        console.log("[MIGMA Profile Sync] Created new user_profiles row", { email, serviceType });
      }
      return;
    }

    if (existing.source === "migma") {
      // 2b. Existing MIGMA profile — update operational fields
      const updatePayload: Record<string, unknown> = { updated_at: now };
      if (fullName) updatePayload.full_name = fullName;
      if (phone) updatePayload.phone = phone;
      if (serviceType) updatePayload.service_type = serviceType;
      if (totalPriceUsd != null) updatePayload.total_price_usd = String(totalPriceUsd);
      if (paymentMethod && !existing.selection_process_fee_payment_method) {
        updatePayload.selection_process_fee_payment_method = paymentMethod;
      }
      if (!existing.onboarding_current_step) {
        updatePayload.onboarding_current_step = "payment";
      }
      if (existing.onboarding_completed == null) {
        updatePayload.onboarding_completed = false;
      }

      const { error: updateError } = await supabase
        .from("user_profiles")
        .update(updatePayload)
        .eq("id", existing.id);

      if (updateError) {
        console.error("[MIGMA Profile Sync] Failed to update user_profiles", { email, updateError });
      } else {
        console.log("[MIGMA Profile Sync] Updated user_profiles", { email, serviceType });
      }
      return;
    }

    // 2c. Profile exists with a different source — cross-site case, skip
    // Resolution: user_profile_sites (structural gap, tracked in spec).
    console.warn(
      "[MIGMA Profile Sync] Cross-site profile detected — skipping source overwrite.",
      { email, existingSource: existing.source },
    );
  } catch (err) {
    console.error("[MIGMA Profile Sync] Unexpected error", { email, err });
  }
}
