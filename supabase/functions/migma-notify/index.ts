import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TEST_EMAIL_DOMAIN = "@uorak.com";
const ALLOWED_CLIENT_SERVICE_FAMILIES = new Set(["cos", "transfer", "initial"]);

function isUorakTestEmail(email: string | null | undefined): boolean {
  return Boolean(email?.trim().toLowerCase().endsWith(TEST_EMAIL_DOMAIN));
}

function normalizeServiceFamily(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase().replace(/_/g, "-").replace(/\s+/g, "-");
  if (!normalized) return null;
  if (normalized === "change-of-status" || normalized.includes("change-of-status")) return "cos";
  const family = normalized.split("-")[0];
  if (ALLOWED_CLIENT_SERVICE_FAMILIES.has(family)) return family;
  if (normalized.includes("cos")) return "cos";
  if (normalized.includes("transfer")) return "transfer";
  if (normalized.includes("initial")) return "initial";
  return null;
}

function resolveClientServiceFamily(profile: {
  service_type?: string | null;
  student_process_type?: string | null;
}): string | null {
  return normalizeServiceFamily(profile.service_type) ?? normalizeServiceFamily(profile.student_process_type);
}

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// ─── Trigger catalogue ────────────────────────────────────────────────────────

export type TriggerType =
  // Client-facing
  | "selection_fee_paid"
  | "application_fee_paid"
  | "questionnaire_received"
  | "contract_approved"
  | "scholarship_approved"
  | "placement_fee_paid"
  | "document_rejected"
  | "all_documents_approved"
  | "forms_generated"
  | "package_sent_matriculausa"
  | "acceptance_letter_ready"
  | "transfer_form_approved"
  | "transfer_form_rejected"
  | "transfer_form_delivered"
  | "transfer_completed"
  | "new_pending_task"
  | "deadline_alert_transfer"
  | "deadline_alert_cos"
  | "dependent_pending"
  | "referral_goal_reached"
  | "new_referral_closed"
  // Billing (Fase 9)
  | "billing_started"
  | "billing_installment_due"
  | "billing_installment_paid"
  | "billing_suspended"
  // Admin-facing
  | "admin_new_documents"
  | "admin_contract_resubmitted"
  | "admin_package_complete"
  | "admin_no_university_match"
  | "admin_support_handoff";

// ─── Payload ──────────────────────────────────────────────────────────────────

interface NotifyPayload {
  trigger: TriggerType;
  user_id?: string;          // required for client triggers
  admin_email?: string;      // override; falls back to ADMIN_NOTIFY_EMAIL env var
  channels?: {
    email?: boolean;
    whatsapp?: boolean;
  };
  data?: {
    payment_link?: string;
    app_url?: string;
    university_name?: string;
    course_name?: string;
    scholarship_label?: string;
    scholarship_percent?: number;
    placement_fee_usd?: number;
    tuition_annual_usd?: number;
    document_name?: string;
    document_reason?: string;
    days_remaining?: number;
    task_description?: string;
    referral_name?: string;
    closures_count?: number;
    client_name?: string;
    client_id?: string;
    client_email?: string;
    client_phone?: string;
    order_number?: string;
    contract_type?: string;
    reason?: string;
    rejection_reason?: string;
    last_message?: string;
    // Billing (Fase 9)
    monthly_usd?: number;
    installment_number?: number;
    installments_total?: number;
    installments_paid?: number;
    degree_level?: string;
    process_type?: string;
    start_date?: string;
    next_billing_date?: string;
    billing_link?: string;
    receipt_url?: string;
    suspend_reason?: string;
    acceptance_letter_url?: string;
  };
}

// ─── WhatsApp dispatch ────────────────────────────────────────────────────────
// Preferred env vars: N8N_WHATSAPP_NOTIFY_URL, N8N_WHATSAPP_NOTIFY_SECRET
// Legacy fallback env vars: EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE

async function sendWhatsAppViaN8n(args: {
  trigger: TriggerType;
  phone: string;
  email: string;
  name: string;
  message: string;
  data: NotifyPayload["data"];
  isAdminTrigger: boolean;
}): Promise<{ sent: boolean; reason?: string; provider?: string }> {
  const webhookUrl = Deno.env.get("N8N_WHATSAPP_NOTIFY_URL");
  const webhookSecret = Deno.env.get("N8N_WHATSAPP_NOTIFY_SECRET");

  if (!webhookUrl) return { sent: false, reason: "n8n_not_configured", provider: "n8n" };

  const normalised = args.phone.replace(/\D/g, "");
  if (normalised.length < 10) {
    console.warn(`[migma-notify][whatsapp:n8n] Invalid phone: ${args.phone}`);
    return { sent: false, reason: "invalid_phone", provider: "n8n" };
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(webhookSecret ? { "x-migma-notify-secret": webhookSecret } : {}),
      },
      body: JSON.stringify({
        trigger: args.trigger,
        recipient_type: args.isAdminTrigger ? "admin" : "client",
        recipient: {
          name: args.name,
          email: args.email,
          phone: normalised,
        },
        message: {
          text: args.message,
        },
        data: args.data ?? {},
        meta: {
          source: "migma-notify",
          environment: Deno.env.get("APP_ENV") ?? "production",
          created_at: new Date().toISOString(),
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[migma-notify][whatsapp:n8n] Webhook error ${res.status}: ${body}`);
      return { sent: false, reason: `n8n_${res.status}`, provider: "n8n" };
    }

    console.log(`[migma-notify][whatsapp:n8n] Dispatched trigger=${args.trigger} to ${normalised}`);
    return { sent: true, provider: "n8n" };
  } catch (err: any) {
    console.error("[migma-notify][whatsapp:n8n] Fetch error:", err.message);
    return { sent: false, reason: err.message, provider: "n8n" };
  }
}

async function sendWhatsAppViaEvolution(phone: string, message: string): Promise<{ sent: boolean; reason?: string; provider?: string }> {
  const apiUrl  = Deno.env.get("EVOLUTION_API_URL");
  const apiKey  = Deno.env.get("EVOLUTION_API_KEY");
  const instance = Deno.env.get("EVOLUTION_INSTANCE");

  if (!apiUrl || !apiKey || !instance) {
    console.log(`[migma-notify][whatsapp:stub] Evolution API not configured. Would send to ${phone}: ${message.slice(0, 80)}...`);
    return { sent: false, reason: "evolution_not_configured", provider: "evolution" };
  }

  // Normalise: digits only, ensure country code (min 10 digits)
  const normalised = phone.replace(/\D/g, "");
  if (normalised.length < 10) {
    console.warn(`[migma-notify][whatsapp] Invalid phone: ${phone}`);
    return { sent: false, reason: "invalid_phone", provider: "evolution" };
  }

  try {
    const res = await fetch(
      `${apiUrl.replace(/\/$/, "")}/message/sendText/${instance}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": apiKey,
        },
        body: JSON.stringify({ number: normalised, text: message }),
      }
    );
    if (!res.ok) {
      const body = await res.text();
      console.error(`[migma-notify][whatsapp] Evolution API error ${res.status}: ${body}`);
      return { sent: false, reason: `evolution_${res.status}`, provider: "evolution" };
    }
    const result = await res.json().catch(() => ({}));
    console.log(`[migma-notify][whatsapp] Sent to ${normalised}, key=${result?.key?.id ?? "?"}`);
    return { sent: true, provider: "evolution" };
  } catch (err: any) {
    console.error("[migma-notify][whatsapp] Fetch error:", err.message);
    return { sent: false, reason: err.message, provider: "evolution" };
  }
}

async function sendWhatsApp(args: {
  trigger: TriggerType;
  phone: string;
  email: string;
  name: string;
  message: string;
  data: NotifyPayload["data"];
  isAdminTrigger: boolean;
}): Promise<{ sent: boolean; reason?: string; provider?: string }> {
  const n8nResult = await sendWhatsAppViaN8n(args);
  if (n8nResult.sent || n8nResult.reason !== "n8n_not_configured") return n8nResult;
  return sendWhatsAppViaEvolution(args.phone, args.message);
}

// ─── Email helper ─────────────────────────────────────────────────────────────

function emailWrapper(title: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;line-height:1.6;color:#e5e7eb;background-color:#000000;margin:0;padding:0;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#000000;min-height:100vh;">
    <tr>
      <td align="center" style="padding:40px 0;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color:#000000;max-width:600px;width:100%;margin:0 auto;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding:40px 20px 30px;background-color:#000000;">
              <img src="https://migmainc.com/logo2.png" alt="MIGMA" width="180" style="display:block;border:0;outline:none;text-decoration:none;">
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="padding:0 20px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
                style="background:linear-gradient(145deg,#1a1a1a 0%,#0a0a0a 100%);border:1px solid #CE9F48;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(206,159,72,0.15);">
                <tr>
                  <td style="padding:40px;">
                    <h2 style="margin:0 0 24px;font-size:24px;font-weight:600;text-align:center;color:#F3E196;background:linear-gradient(180deg,#F3E196 0%,#CE9F48 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">
                      ${title}
                    </h2>
                    <div style="font-size:15px;color:#d1d5db;line-height:1.7;">
                      <p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#CE9F48;">English</p>
                      ${body}
                      <!-- MIGMA_EMAIL_BODY_END -->
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:40px 20px;">
              <p style="margin:0 0 6px;font-size:16px;font-weight:600;color:#CE9F48;font-family:'Times New Roman',serif;letter-spacing:1px;">The MIGMA Team</p>
              <p style="margin:0;font-size:12px;color:#4b5563;font-style:italic;">Automated notification · Please do not reply to this email</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function btn(label: string, url: string): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center" style="padding:24px 0 10px;">
        <a href="${url}" style="display:inline-block;padding:16px 32px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:#000000;text-decoration:none;background:linear-gradient(180deg,#F3E196 0%,#CE9F48 50%,#F3E196 100%);border-radius:6px;box-shadow:0 4px 12px rgba(206,159,72,0.3);text-transform:uppercase;letter-spacing:0.5px;">${label}</a>
      </td>
    </tr>
  </table>`;
}

function highlight(text: string): string {
  return `<span style="color:#fff;font-weight:600;">${text}</span>`;
}

function normalizeBaseUrl(appBaseUrl: string): string {
  return (appBaseUrl || "https://migmainc.com").replace(/\/+$/, "");
}

function resolveUrl(url: string | null | undefined, fallback: string, baseUrl: string): string {
  const trimmed = url?.trim();
  if (!trimmed) return fallback;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/")) return `${baseUrl}${trimmed}`;
  return trimmed;
}

// ─── Template registry ────────────────────────────────────────────────────────

interface Template { subject: string; emailHtml: string; whatsapp: string }
interface LocalizedMessage { subject: string; html: string; whatsapp: string }
interface MultilingualMessage { pt: LocalizedMessage; es: LocalizedMessage }

function langSection(label: "Português" | "Español", body: string): string {
  return `
    <div style="height:1px;background:#2a2a2a;margin:28px 0 22px;"></div>
    <p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#CE9F48;">${label}</p>
    ${body}
  `;
}

function triSubject(en: string, pt: string, es: string): string {
  return `${en} / ${pt} / ${es}`;
}

function triWhatsapp(en: string, pt: string, es: string): string {
  return `${en}\n\n---\n*Português*\n${pt}\n\n---\n*Español*\n${es}`;
}

function moneyUsd(value: number | undefined): string {
  return typeof value === "number" ? `US$ ${value.toLocaleString("en-US")}` : "-";
}

function resolveActionUrl(data: NotifyPayload["data"], fallback: string, baseUrl: string): string {
  return resolveUrl(data?.billing_link ?? data?.payment_link ?? data?.app_url, fallback, baseUrl);
}

function buildMultilingualCopy(
  trigger: TriggerType,
  firstName: string,
  data: NotifyPayload["data"] = {},
  routes: ReturnType<typeof buildRoutes>,
  dash: string,
): MultilingualMessage {
  const university = data.university_name ?? "universidade selecionada";
  const universidad = data.university_name ?? "universidad seleccionada";
  const course = data.course_name ?? "programa selecionado";
  const curso = data.course_name ?? "programa seleccionado";
  const scholarship = data.scholarship_label ??
    (typeof data.scholarship_percent === "number" ? `${data.scholarship_percent}%` : "bolsa aprovada");
  const placementFee = typeof data.placement_fee_usd === "number" ? data.placement_fee_usd : undefined;
  const placementFeePt = placementFee === 0 ? "isenta" : moneyUsd(placementFee);
  const placementFeeEs = placementFee === 0 ? "exenta" : moneyUsd(placementFee);
  const tuition = moneyUsd(data.tuition_annual_usd);
  const documentName = data.document_name ?? "documento enviado";
  const documentReason = data.document_reason ?? data.rejection_reason ?? "";
  const task = data.task_description ?? "";
  const supportUrl = routes.studentSupport;
  const dashboardUrl = routes.studentDashboard;
  const documentsUrl = resolveUrl(data.app_url, routes.studentDocuments, dash);
  const formsUrl = resolveUrl(data.app_url, routes.studentForms, dash);
  const paymentUrl = resolveActionUrl(data, routes.onboardingPayment, dash);
  const placementUrl = resolveUrl(data.app_url, routes.onboardingPlacementFee, dash);
  const acceptanceUrl = resolveUrl(data.acceptance_letter_url, routes.onboardingAcceptanceLetter, dash);
  const clientName = data.client_name ?? "cliente";
  const clientNameEs = data.client_name ?? "cliente";
  const adminUrl = data.client_id ? routes.adminUser(data.client_id) : routes.adminUser();
  const installmentNumber = data.installment_number ?? (data.installments_paid ?? 0) + 1;
  const installmentsTotal = data.installments_total ?? "-";
  const monthlyAmount = moneyUsd(data.monthly_usd);

  switch (trigger) {
    case "selection_fee_paid":
      return {
        pt: {
          subject: "Pagamento confirmado — Processo de Seleção Migma",
          html: `<p>Olá, ${highlight(firstName)}!</p><p>O pagamento da <strong>Taxa do Processo de Seleção</strong> foi confirmado.</p><p>Agora complete o questionário do perfil para apresentarmos sua aplicação às universidades parceiras.</p>${btn("Completar questionário", routes.onboardingSurvey)}`,
          whatsapp: `✅ *Migma* — Pagamento confirmado!\n\nOlá ${firstName}, sua Taxa do Processo de Seleção foi recebida. Acesse sua conta e complete o questionário: ${routes.onboardingSurvey}`,
        },
        es: {
          subject: "Pago confirmado — Proceso de Selección Migma",
          html: `<p>Hola, ${highlight(firstName)}!</p><p>El pago de la <strong>Tarifa del Proceso de Selección</strong> fue confirmado.</p><p>Ahora completa el cuestionario de perfil para presentar tu aplicación a las universidades asociadas.</p>${btn("Completar cuestionario", routes.onboardingSurvey)}`,
          whatsapp: `✅ *Migma* — Pago confirmado!\n\nHola ${firstName}, recibimos tu Tarifa del Proceso de Selección. Accede a tu cuenta y completa el cuestionario: ${routes.onboardingSurvey}`,
        },
      };

    case "questionnaire_received":
      return {
        pt: {
          subject: "Questionário recebido — Perfil enviado às universidades",
          html: `<p>Olá, ${highlight(firstName)}!</p><p>Recebemos seu questionário. Seu perfil foi encaminhado para análise das universidades parceiras da Migma.</p><p>Nossa equipe avisará quando houver opções disponíveis para o seu perfil.</p>${btn("Acompanhar status", dashboardUrl)}`,
          whatsapp: `📋 *Migma* — Questionário recebido!\n\nOlá ${firstName}, seu perfil foi enviado às universidades parceiras. Acompanhe o status aqui: ${dashboardUrl}`,
        },
        es: {
          subject: "Cuestionario recibido — Perfil enviado a universidades",
          html: `<p>Hola, ${highlight(firstName)}!</p><p>Recibimos tu cuestionario. Tu perfil fue enviado para revisión de las universidades asociadas a Migma.</p><p>Nuestro equipo te avisará cuando existan opciones disponibles para tu perfil.</p>${btn("Ver estado", dashboardUrl)}`,
          whatsapp: `📋 *Migma* — Cuestionario recibido!\n\nHola ${firstName}, tu perfil fue enviado a las universidades asociadas. Revisa el estado aquí: ${dashboardUrl}`,
        },
      };

    case "contract_approved":
      return {
        pt: {
          subject: "Contrato aprovado — Escolha sua universidade",
          html: `<p>Olá, ${highlight(firstName)}!</p><p>Boa notícia: seu contrato foi <strong>aprovado</strong> pela equipe Migma.</p><p>Agora você pode acessar sua conta e escolher a universidade mais adequada ao seu perfil.</p>${btn("Escolher universidade", routes.onboardingScholarship)}`,
          whatsapp: `🎉 *Migma* — Contrato aprovado!\n\nOlá ${firstName}, seu contrato foi aprovado. Acesse sua conta para escolher sua universidade: ${routes.onboardingScholarship}`,
        },
        es: {
          subject: "Contrato aprobado — Elige tu universidad",
          html: `<p>Hola, ${highlight(firstName)}!</p><p>Buena noticia: tu contrato fue <strong>aprobado</strong> por el equipo Migma.</p><p>Ahora puedes acceder a tu cuenta y elegir la universidad más adecuada para tu perfil.</p>${btn("Elegir universidad", routes.onboardingScholarship)}`,
          whatsapp: `🎉 *Migma* — Contrato aprobado!\n\nHola ${firstName}, tu contrato fue aprobado. Accede a tu cuenta para elegir tu universidad: ${routes.onboardingScholarship}`,
        },
      };

    case "scholarship_approved":
      return {
        pt: {
          subject: `Bolsa aprovada — ${university}`,
          html: `<p>Olá, ${highlight(firstName)}!</p><p>Sua bolsa foi aprovada. Confira os dados aprovados:</p><div style="background:#111;border:1px solid #2a2a2a;border-radius:12px;padding:16px;margin:18px 0;"><p><strong>Universidade:</strong> ${university}</p><p><strong>Programa:</strong> ${course}</p><p><strong>Bolsa:</strong> ${scholarship}</p><p><strong>Tuition anual:</strong> ${tuition}</p><p><strong>Placement Fee:</strong> ${placementFeePt}</p></div><p>${placementFee === 0 ? "Não há pagamento de Placement Fee para esta bolsa aprovada." : "Para garantir sua vaga, conclua o pagamento da Placement Fee."}</p>${btn(placementFee === 0 ? "Acessar portal" : "Pagar Placement Fee", placementUrl)}`,
          whatsapp: `🏫 *Migma* — Bolsa aprovada!\n\nOlá ${firstName}, sua bolsa em *${university}* foi aprovada.\n\n*Programa:* ${course}\n*Bolsa:* ${scholarship}\n*Tuition:* ${tuition}\n*Placement Fee:* ${placementFeePt}\n\n${placementFee === 0 ? "Nenhum pagamento de Placement Fee é necessário. Acesse o portal:" : "Pague a Placement Fee para garantir sua vaga:"}\n${placementUrl}`,
        },
        es: {
          subject: `Beca aprobada — ${universidad}`,
          html: `<p>Hola, ${highlight(firstName)}!</p><p>Tu beca fue aprobada. Revisa los datos aprobados:</p><div style="background:#111;border:1px solid #2a2a2a;border-radius:12px;padding:16px;margin:18px 0;"><p><strong>Universidad:</strong> ${universidad}</p><p><strong>Programa:</strong> ${curso}</p><p><strong>Beca:</strong> ${scholarship}</p><p><strong>Tuition anual:</strong> ${tuition}</p><p><strong>Placement Fee:</strong> ${placementFeeEs}</p></div><p>${placementFee === 0 ? "No se requiere pago de Placement Fee para esta beca aprobada." : "Para asegurar tu lugar, completa el pago de la Placement Fee."}</p>${btn(placementFee === 0 ? "Acceder al portal" : "Pagar Placement Fee", placementUrl)}`,
          whatsapp: `🏫 *Migma* — Beca aprobada!\n\nHola ${firstName}, tu beca en *${universidad}* fue aprobada.\n\n*Programa:* ${curso}\n*Beca:* ${scholarship}\n*Tuition:* ${tuition}\n*Placement Fee:* ${placementFeeEs}\n\n${placementFee === 0 ? "No se requiere pago de Placement Fee. Accede al portal:" : "Paga la Placement Fee para asegurar tu lugar:"}\n${placementUrl}`,
        },
      };

    case "application_fee_paid":
      return {
        pt: {
          subject: "Application Fee confirmada — Vaga garantida",
          html: `<p>Olá, ${highlight(firstName)}!</p><p>O pagamento da <strong>Application Fee</strong> foi confirmado.</p><p>Sua aplicação está registrada. Agora complete as informações adicionais solicitadas pela universidade.</p>${btn("Completar dados adicionais", routes.onboardingComplementaryData)}`,
          whatsapp: `✅ *Migma* — Application Fee confirmada!\n\nOlá ${firstName}, seu pagamento foi recebido e sua aplicação foi registrada. Complete a próxima etapa aqui: ${routes.onboardingComplementaryData}`,
        },
        es: {
          subject: "Application Fee confirmada — Lugar asegurado",
          html: `<p>Hola, ${highlight(firstName)}!</p><p>El pago de la <strong>Application Fee</strong> fue confirmado.</p><p>Tu aplicación está registrada. Ahora completa la información adicional solicitada por la universidad.</p>${btn("Completar datos adicionales", routes.onboardingComplementaryData)}`,
          whatsapp: `✅ *Migma* — Application Fee confirmada!\n\nHola ${firstName}, recibimos tu pago y tu aplicación fue registrada. Completa el siguiente paso aquí: ${routes.onboardingComplementaryData}`,
        },
      };

    case "placement_fee_paid":
      return {
        pt: {
          subject: "Placement Fee confirmada — Envie seus documentos",
          html: `<p>Olá, ${highlight(firstName)}!</p><p>O pagamento da <strong>Placement Fee</strong> foi confirmado.</p><p>Agora envie os documentos exigidos para o seu processo.</p>${btn("Enviar documentos", routes.onboardingDocumentsUpload)}`,
          whatsapp: `💳 *Migma* — Placement Fee confirmada!\n\nOlá ${firstName}, pagamento recebido. Agora envie seus documentos aqui: ${routes.onboardingDocumentsUpload}`,
        },
        es: {
          subject: "Placement Fee confirmada — Sube tus documentos",
          html: `<p>Hola, ${highlight(firstName)}!</p><p>El pago de la <strong>Placement Fee</strong> fue confirmado.</p><p>Ahora sube los documentos requeridos para tu proceso.</p>${btn("Subir documentos", routes.onboardingDocumentsUpload)}`,
          whatsapp: `💳 *Migma* — Placement Fee confirmada!\n\nHola ${firstName}, pago recibido. Ahora sube tus documentos aquí: ${routes.onboardingDocumentsUpload}`,
        },
      };

    case "document_rejected":
      return {
        pt: {
          subject: `Documento recusado — Correção necessária: ${documentName}`,
          html: `<p>Olá, ${highlight(firstName)}!</p><p>O documento <strong>${documentName}</strong> precisa de correção.</p>${documentReason ? `<p style="background:#1a1a1a;border-left:3px solid #e55;padding:12px 16px;border-radius:4px;color:#ddd;">${documentReason}</p>` : ""}<p>Acesse o portal, corrija o arquivo e envie novamente.</p>${btn("Reenviar documento", documentsUrl)}`,
          whatsapp: `⚠️ *Migma* — Correção necessária\n\nOlá ${firstName}, o documento *${documentName}* precisa ser atualizado.${documentReason ? `\n\nMotivo: ${documentReason}` : ""}\n\nAcesse: ${documentsUrl}`,
        },
        es: {
          subject: `Documento rechazado — Corrección necesaria: ${documentName}`,
          html: `<p>Hola, ${highlight(firstName)}!</p><p>El documento <strong>${documentName}</strong> necesita corrección.</p>${documentReason ? `<p style="background:#1a1a1a;border-left:3px solid #e55;padding:12px 16px;border-radius:4px;color:#ddd;">${documentReason}</p>` : ""}<p>Accede al portal, corrige el archivo y envíalo nuevamente.</p>${btn("Reenviar documento", documentsUrl)}`,
          whatsapp: `⚠️ *Migma* — Corrección necesaria\n\nHola ${firstName}, el documento *${documentName}* debe actualizarse.${documentReason ? `\n\nMotivo: ${documentReason}` : ""}\n\nAccede: ${documentsUrl}`,
        },
      };

    case "all_documents_approved":
      return {
        pt: {
          subject: "Documentos aprovados — Pague a Application Fee",
          html: `<p>Olá, ${highlight(firstName)}!</p><p>Todos os seus documentos foram <strong>revisados e aprovados</strong>.</p><p>O próximo passo é pagar a <strong>Application Fee</strong>.</p>${btn("Pagar Application Fee", paymentUrl)}`,
          whatsapp: `✅ *Migma* — Documentos aprovados!\n\nOlá ${firstName}, todos os documentos foram aprovados. Próximo passo: pague a Application Fee aqui:\n${paymentUrl}`,
        },
        es: {
          subject: "Documentos aprobados — Paga la Application Fee",
          html: `<p>Hola, ${highlight(firstName)}!</p><p>Todos tus documentos fueron <strong>revisados y aprobados</strong>.</p><p>El siguiente paso es pagar la <strong>Application Fee</strong>.</p>${btn("Pagar Application Fee", paymentUrl)}`,
          whatsapp: `✅ *Migma* — Documentos aprobados!\n\nHola ${firstName}, todos los documentos fueron aprobados. Próximo paso: paga la Application Fee aquí:\n${paymentUrl}`,
        },
      };

    case "forms_generated":
      return {
        pt: {
          subject: "Formulários prontos — Assinatura digital necessária",
          html: `<p>Olá, ${highlight(firstName)}!</p><p>Seus formulários foram gerados e estão prontos para assinatura digital.</p><p>Revise e assine cada formulário no portal.</p>${btn("Assinar formulários", formsUrl)}`,
          whatsapp: `📄 *Migma* — Formulários prontos!\n\nOlá ${firstName}, seus formulários estão prontos para assinatura digital. Acesse aqui: ${formsUrl}`,
        },
        es: {
          subject: "Formularios listos — Firma digital requerida",
          html: `<p>Hola, ${highlight(firstName)}!</p><p>Tus formularios fueron generados y están listos para firma digital.</p><p>Revisa y firma cada formulario en el portal.</p>${btn("Firmar formularios", formsUrl)}`,
          whatsapp: `📄 *Migma* — Formularios listos!\n\nHola ${firstName}, tus formularios están listos para firma digital. Accede aquí: ${formsUrl}`,
        },
      };

    case "package_sent_matriculausa":
      return {
        pt: {
          subject: "Pacote enviado à MatriculaUSA — Processamento iniciado",
          html: `<p>Olá, ${highlight(firstName)}!</p><p>Seu pacote foi <strong>enviado à MatriculaUSA</strong> para processamento.</p><p>O setor de admissões processará seu I-20 / Acceptance Letter. Avisaremos quando estiver pronto.</p>${btn("Acompanhar status", routes.studentApplications)}`,
          whatsapp: `🚀 *Migma* — Pacote enviado!\n\nOlá ${firstName}, seu pacote foi enviado à MatriculaUSA. Aguarde o processamento do I-20 / Acceptance Letter. Acompanhe aqui: ${routes.studentApplications}`,
        },
        es: {
          subject: "Paquete enviado a MatriculaUSA — Procesamiento iniciado",
          html: `<p>Hola, ${highlight(firstName)}!</p><p>Tu paquete fue <strong>enviado a MatriculaUSA</strong> para procesamiento.</p><p>El área de admisiones procesará tu I-20 / Acceptance Letter. Te avisaremos cuando esté listo.</p>${btn("Ver estado", routes.studentApplications)}`,
          whatsapp: `🚀 *Migma* — Paquete enviado!\n\nHola ${firstName}, tu paquete fue enviado a MatriculaUSA. Espera el procesamiento del I-20 / Acceptance Letter. Revisa aquí: ${routes.studentApplications}`,
        },
      };

    case "acceptance_letter_ready":
      return {
        pt: {
          subject: "Sua Acceptance Letter está pronta — Migma",
          html: `<p>Olá, ${highlight(firstName)}!</p><p>Ótima notícia: sua <strong>Acceptance Letter</strong> foi emitida e está disponível para download no portal.</p>${btn("Acessar documento", acceptanceUrl)}`,
          whatsapp: `🎓 *Migma* — Acceptance Letter pronta!\n\nOlá ${firstName}, sua Acceptance Letter foi emitida. Acesse o portal para baixar: ${acceptanceUrl}`,
        },
        es: {
          subject: "Tu Acceptance Letter está lista — Migma",
          html: `<p>Hola, ${highlight(firstName)}!</p><p>Excelente noticia: tu <strong>Acceptance Letter</strong> fue emitida y está disponible para descargar en el portal.</p>${btn("Acceder al documento", acceptanceUrl)}`,
          whatsapp: `🎓 *Migma* — Acceptance Letter lista!\n\nHola ${firstName}, tu Acceptance Letter fue emitida. Accede al portal para descargarla: ${acceptanceUrl}`,
        },
      };

    case "transfer_form_approved":
      return {
        pt: {
          subject: "Transfer Form aprovado — Migma",
          html: `<p>Olá, ${highlight(firstName)}!</p><p>Seu <strong>Transfer Form</strong> foi revisado e <strong>aprovado</strong> pela equipe da MatriculaUSA.</p><p>Seu processo de transferência continuará avançando.</p>${btn("Ver status", routes.onboardingAcceptanceLetter)}`,
          whatsapp: `✅ *Migma* — Transfer Form aprovado!\n\nOlá ${firstName}, seu Transfer Form foi aprovado pela equipe da MatriculaUSA. Seu processo está avançando.\n\nAcesse: ${routes.onboardingAcceptanceLetter}`,
        },
        es: {
          subject: "Transfer Form aprobado — Migma",
          html: `<p>Hola, ${highlight(firstName)}!</p><p>Tu <strong>Transfer Form</strong> fue revisado y <strong>aprobado</strong> por el equipo de MatriculaUSA.</p><p>Tu proceso de transferencia seguirá avanzando.</p>${btn("Ver estado", routes.onboardingAcceptanceLetter)}`,
          whatsapp: `✅ *Migma* — Transfer Form aprobado!\n\nHola ${firstName}, tu Transfer Form fue aprobado por el equipo de MatriculaUSA. Tu proceso avanza.\n\nAccede: ${routes.onboardingAcceptanceLetter}`,
        },
      };

    case "transfer_form_rejected":
      return {
        pt: {
          subject: "Transfer Form — Correção necessária",
          html: `<p>Olá, ${highlight(firstName)}!</p><p>Seu <strong>Transfer Form</strong> foi revisado e precisa de correção.</p>${documentReason ? `<p style="background:#1a1a1a;border-left:3px solid #e53e3e;padding:12px 16px;border-radius:4px;color:#ddd;"><strong>Motivo:</strong> ${documentReason}</p>` : ""}<p>Acesse o portal, corrija o formulário e envie novamente.</p>${btn("Reenviar Transfer Form", routes.onboardingAcceptanceLetter)}`,
          whatsapp: `⚠️ *Migma* — Correção no Transfer Form\n\nOlá ${firstName}, seu Transfer Form precisa ser corrigido.${documentReason ? `\n\n*Motivo:* ${documentReason}` : ""}\n\nAcesse para reenviar: ${routes.onboardingAcceptanceLetter}`,
        },
        es: {
          subject: "Transfer Form — Corrección necesaria",
          html: `<p>Hola, ${highlight(firstName)}!</p><p>Tu <strong>Transfer Form</strong> fue revisado y necesita corrección.</p>${documentReason ? `<p style="background:#1a1a1a;border-left:3px solid #e53e3e;padding:12px 16px;border-radius:4px;color:#ddd;"><strong>Motivo:</strong> ${documentReason}</p>` : ""}<p>Accede al portal, corrige el formulario y envíalo nuevamente.</p>${btn("Reenviar Transfer Form", routes.onboardingAcceptanceLetter)}`,
          whatsapp: `⚠️ *Migma* — Corrección en Transfer Form\n\nHola ${firstName}, tu Transfer Form debe corregirse.${documentReason ? `\n\n*Motivo:* ${documentReason}` : ""}\n\nAccede para reenviarlo: ${routes.onboardingAcceptanceLetter}`,
        },
      };

    case "new_pending_task":
      return {
        pt: {
          subject: "Nova tarefa pendente — Ação necessária",
          html: `<p>Olá, ${highlight(firstName)}!</p><p>A equipe Migma criou uma nova tarefa pendente na sua conta.</p>${task ? `<p style="background:#1a1a1a;border-left:3px solid #f5a623;padding:12px 16px;border-radius:4px;color:#ddd;">${task}</p>` : ""}${btn("Resolver tarefa", dashboardUrl)}`,
          whatsapp: `🔔 *Migma* — Nova tarefa pendente\n\nOlá ${firstName}${task ? `: ${task}` : ", há uma tarefa pendente na sua conta"}.\n\nAcesse: ${dashboardUrl}`,
        },
        es: {
          subject: "Nueva tarea pendiente — Acción requerida",
          html: `<p>Hola, ${highlight(firstName)}!</p><p>El equipo Migma creó una nueva tarea pendiente en tu cuenta.</p>${task ? `<p style="background:#1a1a1a;border-left:3px solid #f5a623;padding:12px 16px;border-radius:4px;color:#ddd;">${task}</p>` : ""}${btn("Resolver tarea", dashboardUrl)}`,
          whatsapp: `🔔 *Migma* — Nueva tarea pendiente\n\nHola ${firstName}${task ? `: ${task}` : ", hay una tarea pendiente en tu cuenta"}.\n\nAccede: ${dashboardUrl}`,
        },
      };

    case "deadline_alert_transfer":
      return {
        pt: {
          subject: `Alerta de prazo — ${data.days_remaining} dia(s) restantes para sua Transfer`,
          html: `<p>Olá, ${highlight(firstName)}!</p><p>Atenção: restam <strong>${data.days_remaining} dia(s)</strong> para o prazo do seu processo de Transfer.</p><p>Confira se todos os documentos e etapas estão completos.</p>${btn("Ver meu processo", dashboardUrl)}`,
          whatsapp: `⏰ *Migma* — Alerta de prazo!\n\nOlá ${firstName}, restam *${data.days_remaining} dia(s)* para o prazo da sua Transfer. Confira seu processo: ${dashboardUrl}`,
        },
        es: {
          subject: `Alerta de plazo — ${data.days_remaining} día(s) restantes para tu Transfer`,
          html: `<p>Hola, ${highlight(firstName)}!</p><p>Atención: quedan <strong>${data.days_remaining} día(s)</strong> para el plazo de tu proceso de Transfer.</p><p>Revisa que todos los documentos y pasos estén completos.</p>${btn("Ver mi proceso", dashboardUrl)}`,
          whatsapp: `⏰ *Migma* — Alerta de plazo!\n\nHola ${firstName}, quedan *${data.days_remaining} día(s)* para el plazo de tu Transfer. Revisa tu proceso: ${dashboardUrl}`,
        },
      };

    case "deadline_alert_cos":
      return {
        pt: {
          subject: `Alerta de prazo — ${data.days_remaining} dia(s) até o prazo do I-94 / COS`,
          html: `<p>Olá, ${highlight(firstName)}!</p><p>Atenção: seu prazo de I-94 / Change of Status (COS) vence em <strong>${data.days_remaining} dia(s)</strong>.</p><p>É essencial concluir todas as etapas antes dessa data.</p>${btn("Ver meu processo", dashboardUrl)}`,
          whatsapp: `⏰ *Migma* — Prazo urgente de COS!\n\nOlá ${firstName}, seu I-94 vence em *${data.days_remaining} dia(s)*. Confira com urgência: ${dashboardUrl}`,
        },
        es: {
          subject: `Alerta de plazo — ${data.days_remaining} día(s) hasta el plazo del I-94 / COS`,
          html: `<p>Hola, ${highlight(firstName)}!</p><p>Atención: tu plazo de I-94 / Change of Status (COS) vence en <strong>${data.days_remaining} día(s)</strong>.</p><p>Es esencial completar todos los pasos antes de esa fecha.</p>${btn("Ver mi proceso", dashboardUrl)}`,
          whatsapp: `⏰ *Migma* — Plazo urgente de COS!\n\nHola ${firstName}, tu I-94 vence en *${data.days_remaining} día(s)*. Revisa con urgencia: ${dashboardUrl}`,
        },
      };

    case "dependent_pending":
      return {
        pt: {
          subject: "Tarefa pendente de dependente — Dados ou documentos necessários",
          html: `<p>Olá, ${highlight(firstName)}!</p><p>Há uma pendência relacionada a <strong>dependentes</strong> na sua conta.</p>${task ? `<p style="background:#1a1a1a;border-left:3px solid #f5a623;padding:12px 16px;border-radius:4px;color:#ddd;">${task}</p>` : "<p>Acesse o portal para conferir os dados ou documentos solicitados.</p>"}${btn("Resolver tarefa", dashboardUrl)}`,
          whatsapp: `👨‍👩‍👧 *Migma* — Pendência de dependente\n\nOlá ${firstName}${task ? `: ${task}` : ", há informações de dependente pendentes na sua conta"}.\n\nAcesse: ${dashboardUrl}`,
        },
        es: {
          subject: "Tarea pendiente de dependiente — Datos o documentos necesarios",
          html: `<p>Hola, ${highlight(firstName)}!</p><p>Hay una tarea pendiente relacionada con <strong>dependientes</strong> en tu cuenta.</p>${task ? `<p style="background:#1a1a1a;border-left:3px solid #f5a623;padding:12px 16px;border-radius:4px;color:#ddd;">${task}</p>` : "<p>Accede al portal para revisar los datos o documentos solicitados.</p>"}${btn("Resolver tarea", dashboardUrl)}`,
          whatsapp: `👨‍👩‍👧 *Migma* — Pendiente de dependiente\n\nHola ${firstName}${task ? `: ${task}` : ", hay información de dependiente pendiente en tu cuenta"}.\n\nAccede: ${dashboardUrl}`,
        },
      };

    case "referral_goal_reached":
      return {
        pt: {
          subject: "Parabéns! Você atingiu 10 indicações — Mensalidade Migma isenta",
          html: `<p>Olá, ${highlight(firstName)}!</p><p>Ótima notícia: você atingiu a meta de <strong>10 indicações fechadas</strong>.</p><p>Sua mensalidade Migma foi <strong>automaticamente isenta</strong>.</p>${btn("Ver minha conta", routes.studentRewards)}`,
          whatsapp: `🏆 *Migma* — Meta atingida!\n\nParabéns ${firstName}! Você fechou 10 indicações e sua mensalidade Migma foi isenta automaticamente. Veja aqui: ${routes.studentRewards}`,
        },
        es: {
          subject: "Felicitaciones! Llegaste a 10 referidos — Mensualidad Migma exenta",
          html: `<p>Hola, ${highlight(firstName)}!</p><p>Excelente noticia: llegaste a la meta de <strong>10 referidos cerrados</strong>.</p><p>Tu mensualidad Migma fue <strong>exenta automáticamente</strong>.</p>${btn("Ver mi cuenta", routes.studentRewards)}`,
          whatsapp: `🏆 *Migma* — Meta alcanzada!\n\nFelicitaciones ${firstName}! Cerraste 10 referidos y tu mensualidad Migma fue exenta automáticamente. Mira aquí: ${routes.studentRewards}`,
        },
      };

    case "new_referral_closed":
      return {
        pt: {
          subject: `Nova indicação fechada — ${data.closures_count ?? "?"} no total`,
          html: `<p>Olá, ${highlight(firstName)}!</p><p>Sua indicação <strong>${data.referral_name ?? "recente"}</strong> se tornou cliente Migma.</p><p>Agora você tem <strong>${data.closures_count ?? "?"} indicação(ões) fechada(s)</strong>.</p>${btn("Ver recompensas", routes.studentRewards)}`,
          whatsapp: `🎯 *Migma* — Indicação fechada!\n\nOlá ${firstName}, ${data.referral_name ?? "sua indicação"} se tornou cliente. Total: *${data.closures_count ?? "?"}* indicações fechadas. Veja aqui: ${routes.studentRewards}`,
        },
        es: {
          subject: `Nuevo referido cerrado — ${data.closures_count ?? "?"} en total`,
          html: `<p>Hola, ${highlight(firstName)}!</p><p>Tu referido <strong>${data.referral_name ?? "reciente"}</strong> se convirtió en cliente Migma.</p><p>Ahora tienes <strong>${data.closures_count ?? "?"} referido(s) cerrado(s)</strong>.</p>${btn("Ver recompensas", routes.studentRewards)}`,
          whatsapp: `🎯 *Migma* — Referido cerrado!\n\nHola ${firstName}, ${data.referral_name ?? "tu referido"} se convirtió en cliente. Total: *${data.closures_count ?? "?"}* referidos cerrados. Mira aquí: ${routes.studentRewards}`,
        },
      };

    case "admin_new_documents":
      return {
        pt: {
          subject: `[Admin] Novos documentos para revisão — ${clientName}`,
          html: `<p>Novos documentos foram enviados por <strong>${clientName}</strong> e aguardam revisão.</p>${data.client_id ? btn("Revisar documentos", adminUrl) : ""}`,
          whatsapp: `📥 *Migma Admin* — Novos documentos\n\n${clientName} enviou documentos para revisão.\n${adminUrl}`,
        },
        es: {
          subject: `[Admin] Nuevos documentos para revisión — ${clientNameEs}`,
          html: `<p>Nuevos documentos fueron enviados por <strong>${clientNameEs}</strong> y esperan revisión.</p>${data.client_id ? btn("Revisar documentos", adminUrl) : ""}`,
          whatsapp: `📥 *Migma Admin* — Nuevos documentos\n\n${clientNameEs} envió documentos para revisión.\n${adminUrl}`,
        },
      };

    case "admin_contract_resubmitted":
      return {
        pt: {
          subject: `[Admin] Documentos reenviados — ${clientName} | Pedido #${data.order_number ?? "?"}`,
          html: `<p><strong>${clientName}</strong> reenviou documentos de identidade do pedido <strong>#${data.order_number ?? "?"}</strong>.</p><p>O contrato voltou para status pendente e aguarda nova revisão.</p>${data.client_id ? btn("Revisar pedido", adminUrl) : ""}`,
          whatsapp: `📤 *Migma Admin* — Documentos reenviados\n\n${clientName} reenviou documentos do pedido *#${data.order_number ?? "?"}*.\n\nAguardando revisão.${data.client_id ? `\n${adminUrl}` : ""}`,
        },
        es: {
          subject: `[Admin] Documentos reenviados — ${clientNameEs} | Pedido #${data.order_number ?? "?"}`,
          html: `<p><strong>${clientNameEs}</strong> reenvió documentos de identidad del pedido <strong>#${data.order_number ?? "?"}</strong>.</p><p>El contrato volvió a estado pendiente y espera nueva revisión.</p>${data.client_id ? btn("Revisar pedido", adminUrl) : ""}`,
          whatsapp: `📤 *Migma Admin* — Documentos reenviados\n\n${clientNameEs} reenvió documentos del pedido *#${data.order_number ?? "?"}*.\n\nEsperando revisión.${data.client_id ? `\n${adminUrl}` : ""}`,
        },
      };

    case "admin_package_complete":
      return {
        pt: {
          subject: `[Admin] Pacote completo — ${clientName} pronto para MatriculaUSA`,
          html: `<p>O pacote de <strong>${clientName}</strong> está completo e pronto para envio à MatriculaUSA.</p>${data.client_id ? btn("Ver pacote", adminUrl) : ""}`,
          whatsapp: `✅ *Migma Admin* — Pacote completo\n\n${clientName} tem um pacote pronto para MatriculaUSA.\n${adminUrl}`,
        },
        es: {
          subject: `[Admin] Paquete completo — ${clientNameEs} listo para MatriculaUSA`,
          html: `<p>El paquete de <strong>${clientNameEs}</strong> está completo y listo para enviar a MatriculaUSA.</p>${data.client_id ? btn("Ver paquete", adminUrl) : ""}`,
          whatsapp: `✅ *Migma Admin* — Paquete completo\n\n${clientNameEs} tiene un paquete listo para MatriculaUSA.\n${adminUrl}`,
        },
      };

    case "billing_started":
      return {
        pt: {
          subject: "Cobrança Migma ativada — Plano mensal configurado",
          html: `<p>Olá, ${highlight(firstName)}!</p><p>Seu plano mensal Migma foi ativado com sucesso.</p><ul style="color:#ccc;line-height:2;"><li>Valor mensal: <strong>${monthlyAmount}</strong></li><li>Parcelas: <strong>${installmentsTotal}x</strong></li><li>Processo: <strong>${data.process_type ?? data.degree_level ?? "-"}</strong></li><li>Primeira cobrança: <strong>${data.start_date ?? "-"}</strong></li></ul><p>Você receberá o link de pagamento mensalmente.</p>${btn("Acessar minha conta", dashboardUrl)}`,
          whatsapp: `💳 *Migma* — Cobrança ativada!\n\nOlá ${firstName}, seu pagamento mensal de *${monthlyAmount}* em ${installmentsTotal} parcela(s) foi configurado. Você receberá o link todo mês. Dúvidas: ${dashboardUrl}`,
        },
        es: {
          subject: "Cobro Migma activado — Plan mensual configurado",
          html: `<p>Hola, ${highlight(firstName)}!</p><p>Tu plan mensual Migma fue activado correctamente.</p><ul style="color:#ccc;line-height:2;"><li>Valor mensual: <strong>${monthlyAmount}</strong></li><li>Cuotas: <strong>${installmentsTotal}x</strong></li><li>Proceso: <strong>${data.process_type ?? data.degree_level ?? "-"}</strong></li><li>Primer cobro: <strong>${data.start_date ?? "-"}</strong></li></ul><p>Recibirás el enlace de pago todos los meses.</p>${btn("Acceder a mi cuenta", dashboardUrl)}`,
          whatsapp: `💳 *Migma* — Cobro activado!\n\nHola ${firstName}, tu pago mensual de *${monthlyAmount}* en ${installmentsTotal} cuota(s) fue configurado. Recibirás el enlace cada mes. Dudas: ${dashboardUrl}`,
        },
      };

    case "billing_installment_due":
      return {
        pt: {
          subject: `Parcela ${installmentNumber}/${installmentsTotal} criada — ${monthlyAmount}`,
          html: `<p>Olá, ${highlight(firstName)}!</p><p>Sua parcela <strong>${installmentNumber} de ${installmentsTotal}</strong> foi criada.</p><p>Valor: <strong>${monthlyAmount}</strong></p>${data.billing_link ?? data.payment_link ? btn("Pagar agora", resolveUrl(data.billing_link ?? data.payment_link, dashboardUrl, dash)) : `<p style="color:#888;">A equipe Migma enviará as instruções de pagamento pelo canal combinado.</p>`}<p style="margin-top:20px;color:#888;font-size:13px;">Próxima parcela: ${data.next_billing_date ?? "-"}.</p>`,
          whatsapp: `💳 *Migma* — Parcela ${installmentNumber}/${installmentsTotal} criada!\n\nOlá ${firstName}, sua mensalidade de *${monthlyAmount}* foi criada.\n\n${data.billing_link ?? data.payment_link ? `Pague aqui: ${resolveUrl(data.billing_link ?? data.payment_link, dashboardUrl, dash)}` : "A equipe Migma enviará as instruções pelo canal combinado."}`,
        },
        es: {
          subject: `Cuota ${installmentNumber}/${installmentsTotal} creada — ${monthlyAmount}`,
          html: `<p>Hola, ${highlight(firstName)}!</p><p>Tu cuota <strong>${installmentNumber} de ${installmentsTotal}</strong> fue creada.</p><p>Valor: <strong>${monthlyAmount}</strong></p>${data.billing_link ?? data.payment_link ? btn("Pagar ahora", resolveUrl(data.billing_link ?? data.payment_link, dashboardUrl, dash)) : `<p style="color:#888;">El equipo Migma enviará las instrucciones de pago por el canal acordado.</p>`}<p style="margin-top:20px;color:#888;font-size:13px;">Próxima cuota: ${data.next_billing_date ?? "-"}.</p>`,
          whatsapp: `💳 *Migma* — Cuota ${installmentNumber}/${installmentsTotal} creada!\n\nHola ${firstName}, tu mensualidad de *${monthlyAmount}* fue creada.\n\n${data.billing_link ?? data.payment_link ? `Paga aquí: ${resolveUrl(data.billing_link ?? data.payment_link, dashboardUrl, dash)}` : "El equipo Migma enviará las instrucciones por el canal acordado."}`,
        },
      };

    case "billing_installment_paid":
      return {
        pt: {
          subject: `Pagamento confirmado — Parcela ${data.installment_number ?? "-"}/${installmentsTotal}`,
          html: `<p>Olá, ${highlight(firstName)}!</p><p>Recebemos o pagamento da sua parcela <strong>${data.installment_number ?? "-"} de ${installmentsTotal}</strong>.</p><p>Parcelas pagas até agora: <strong>${data.installments_paid ?? "-"}</strong>.</p>${data.receipt_url ? btn("Ver recibo", resolveUrl(data.receipt_url, dashboardUrl, dash)) : btn("Acessar minha conta", dashboardUrl)}`,
          whatsapp: `✅ *Migma* — Pagamento confirmado!\n\nOlá ${firstName}, recebemos a parcela ${data.installment_number ?? "-"}/${installmentsTotal}. Pagas até agora: ${data.installments_paid ?? "-"}.${data.receipt_url ? `\n\nRecibo: ${resolveUrl(data.receipt_url, dashboardUrl, dash)}` : ""}`,
        },
        es: {
          subject: `Pago confirmado — Cuota ${data.installment_number ?? "-"}/${installmentsTotal}`,
          html: `<p>Hola, ${highlight(firstName)}!</p><p>Recibimos el pago de tu cuota <strong>${data.installment_number ?? "-"} de ${installmentsTotal}</strong>.</p><p>Cuotas pagadas hasta ahora: <strong>${data.installments_paid ?? "-"}</strong>.</p>${data.receipt_url ? btn("Ver recibo", resolveUrl(data.receipt_url, dashboardUrl, dash)) : btn("Acceder a mi cuenta", dashboardUrl)}`,
          whatsapp: `✅ *Migma* — Pago confirmado!\n\nHola ${firstName}, recibimos la cuota ${data.installment_number ?? "-"}/${installmentsTotal}. Pagadas hasta ahora: ${data.installments_paid ?? "-"}.${data.receipt_url ? `\n\nRecibo: ${resolveUrl(data.receipt_url, dashboardUrl, dash)}` : ""}`,
        },
      };

    case "billing_suspended":
      return {
        pt: {
          subject: "Cobrança Migma suspensa — Fale conosco",
          html: `<p>Olá, ${highlight(firstName)}!</p><p>Sua cobrança Migma foi <strong>suspensa</strong>.</p>${data.suspend_reason ? `<p style="background:#1a1a1a;border-left:3px solid #e55;padding:12px 16px;border-radius:4px;color:#ddd;">${data.suspend_reason}</p>` : ""}<p>Entre em contato com a equipe Migma para resolver a situação.</p>${btn("Falar com a Migma", supportUrl)}`,
          whatsapp: `⚠️ *Migma* — Cobrança suspensa\n\nOlá ${firstName}, seu plano mensal foi suspenso.${data.suspend_reason ? `\n\nMotivo: ${data.suspend_reason}` : ""}\n\nFale conosco: ${supportUrl}`,
        },
        es: {
          subject: "Cobro Migma suspendido — Contáctanos",
          html: `<p>Hola, ${highlight(firstName)}!</p><p>Tu cobro Migma fue <strong>suspendido</strong>.</p>${data.suspend_reason ? `<p style="background:#1a1a1a;border-left:3px solid #e55;padding:12px 16px;border-radius:4px;color:#ddd;">${data.suspend_reason}</p>` : ""}<p>Contacta al equipo Migma para resolver la situación.</p>${btn("Contactar a Migma", supportUrl)}`,
          whatsapp: `⚠️ *Migma* — Cobro suspendido\n\nHola ${firstName}, tu plan mensual fue suspendido.${data.suspend_reason ? `\n\nMotivo: ${data.suspend_reason}` : ""}\n\nContáctanos: ${supportUrl}`,
        },
      };

    case "transfer_form_delivered":
      return {
        pt: {
          subject: `[Admin] Aluno confirmou entrega do Transfer Form — ${clientName}`,
          html: `<p><strong>${clientName}</strong> confirmou que o Transfer Form foi entregue à escola atual.</p><p>Aguarde a liberação do SEVIS pela escola. Depois da confirmação, marque o processo como <strong>Transfer Completed</strong> no admin.</p>${data.client_id ? btn("Ver perfil do aluno", adminUrl) : ""}`,
          whatsapp: `✅ *Migma Admin* — Transfer Form entregue\n\n${clientName} confirmou a entrega do Transfer Form à escola atual. Aguarde a liberação do SEVIS.\n${data.client_id ? adminUrl : routes.adminUser()}`,
        },
        es: {
          subject: `[Admin] Alumno confirmó entrega del Transfer Form — ${clientNameEs}`,
          html: `<p><strong>${clientNameEs}</strong> confirmó que el Transfer Form fue entregado a la escuela actual.</p><p>Espera la liberación de SEVIS por la escuela. Después de la confirmación, marca el proceso como <strong>Transfer Completed</strong> en admin.</p>${data.client_id ? btn("Ver perfil del alumno", adminUrl) : ""}`,
          whatsapp: `✅ *Migma Admin* — Transfer Form entregado\n\n${clientNameEs} confirmó la entrega del Transfer Form a la escuela actual. Espera la liberación de SEVIS.\n${data.client_id ? adminUrl : routes.adminUser()}`,
        },
      };

    case "transfer_completed":
      return {
        pt: {
          subject: "Transfer concluído — Parabéns!",
          html: `<p>Olá, ${highlight(firstName)}!</p><p><strong>Seu transfer foi concluído com sucesso.</strong></p><p>Seu novo I-20 foi emitido. Em breve, você receberá emails da universidade com informações de orientação, datas e início do programa.</p><p style="background:#0a1f0a;border-left:3px solid #22c55e;padding:12px 16px;border-radius:4px;color:#bbf7d0;">Aguarde o contato da universidade sobre o início das aulas. Bem-vindo à sua nova universidade.</p>${btn("Ver meu dashboard", dashboardUrl)}`,
          whatsapp: `🎓 *Migma* — Transfer concluído!\n\nParabéns, ${firstName}! Seu transfer foi concluído e seu novo I-20 foi emitido. Aguarde o contato da universidade sobre o início das aulas.\n\nAcesse: ${dashboardUrl}`,
        },
        es: {
          subject: "Transfer completado — Felicitaciones!",
          html: `<p>Hola, ${highlight(firstName)}!</p><p><strong>Tu transfer fue completado con éxito.</strong></p><p>Tu nuevo I-20 fue emitido. Pronto recibirás emails de la universidad con información de orientación, fechas e inicio del programa.</p><p style="background:#0a1f0a;border-left:3px solid #22c55e;padding:12px 16px;border-radius:4px;color:#bbf7d0;">Espera el contacto de la universidad sobre el inicio de clases. Bienvenido a tu nueva universidad.</p>${btn("Ver mi dashboard", dashboardUrl)}`,
          whatsapp: `🎓 *Migma* — Transfer completado!\n\nFelicitaciones, ${firstName}! Tu transfer fue completado y tu nuevo I-20 fue emitido. Espera el contacto de la universidad sobre el inicio de clases.\n\nAccede: ${dashboardUrl}`,
        },
      };

    case "admin_no_university_match":
      return {
        pt: {
          subject: `[Admin] Sem match Caroline/Oikos — Revisão manual necessária: ${clientName}`,
          html: `<p><strong>${clientName}</strong> não teve compatibilidade com Caroline University ou Oikos University.</p><p>É necessária intervenção manual para definir uma alternativa.</p>${data.client_id ? btn("Ver perfil do cliente", adminUrl) : ""}`,
          whatsapp: `⚠️ *Migma Admin* — Sem match de universidade\n\n${clientName} não tem Caroline/Oikos disponível. Intervenção manual necessária.\n${adminUrl}`,
        },
        es: {
          subject: `[Admin] Sin match Caroline/Oikos — Revisión manual necesaria: ${clientNameEs}`,
          html: `<p><strong>${clientNameEs}</strong> no tuvo compatibilidad con Caroline University u Oikos University.</p><p>Se requiere intervención manual para definir una alternativa.</p>${data.client_id ? btn("Ver perfil del cliente", adminUrl) : ""}`,
          whatsapp: `⚠️ *Migma Admin* — Sin match de universidad\n\n${clientNameEs} no tiene Caroline/Oikos disponible. Intervención manual necesaria.\n${adminUrl}`,
        },
      };

    case "admin_support_handoff":
      return {
        pt: {
          subject: `[Suporte] Aluno aguardando atendimento humano: ${clientName}`,
          html: `<p>O agente de IA transferiu <strong>${clientName}</strong> para atendimento humano.</p>${data.reason ? `<p><strong>Motivo:</strong> ${data.reason}</p>` : ""}${data.last_message ? `<p><strong>Última mensagem:</strong><br><em>"${data.last_message}"</em></p>` : ""}${data.client_id ? btn("Abrir conversa", adminUrl) : ""}`,
          whatsapp: `🙋 *Migma Suporte* — Atendimento humano solicitado\n\nAluno: ${clientName}\n${data.reason ? `Motivo: ${data.reason}\n` : ""}${data.client_id ? adminUrl : routes.adminUser()}`,
        },
        es: {
          subject: `[Soporte] Alumno esperando atención humana: ${clientNameEs}`,
          html: `<p>El agente de IA transfirió a <strong>${clientNameEs}</strong> a atención humana.</p>${data.reason ? `<p><strong>Motivo:</strong> ${data.reason}</p>` : ""}${data.last_message ? `<p><strong>Último mensaje:</strong><br><em>"${data.last_message}"</em></p>` : ""}${data.client_id ? btn("Abrir conversación", adminUrl) : ""}`,
          whatsapp: `🙋 *Migma Soporte* — Atención humana solicitada\n\nAlumno: ${clientNameEs}\n${data.reason ? `Motivo: ${data.reason}\n` : ""}${data.client_id ? adminUrl : routes.adminUser()}`,
        },
      };
  }
}

function applyMultilingualTemplate(template: Template, copy: MultilingualMessage): Template {
  const extraHtml = `${langSection("Português", copy.pt.html)}${langSection("Español", copy.es.html)}`;
  return {
    subject: triSubject(template.subject, copy.pt.subject, copy.es.subject),
    emailHtml: template.emailHtml.replace("<!-- MIGMA_EMAIL_BODY_END -->", extraHtml),
    whatsapp: triWhatsapp(template.whatsapp, copy.pt.whatsapp, copy.es.whatsapp),
  };
}

function buildRoutes(dash: string) {
  return {
    studentDashboard: `${dash}/student/dashboard`,
    studentApplications: `${dash}/student/dashboard/applications`,
    studentDocuments: `${dash}/student/dashboard/documents`,
    studentForms: `${dash}/student/dashboard/forms`,
    studentRewards: `${dash}/student/dashboard/rewards`,
    studentSupport: `${dash}/student/dashboard/support`,
    onboarding: `${dash}/student/onboarding`,
    onboardingSurvey: `${dash}/student/onboarding?step=selection_survey`,
    onboardingScholarship: `${dash}/student/onboarding?step=scholarship_selection`,
    onboardingPlacementFee: `${dash}/student/onboarding?step=placement_fee`,
    onboardingDocumentsUpload: `${dash}/student/onboarding?step=documents_upload`,
    onboardingPayment: `${dash}/student/onboarding?step=payment`,
    onboardingComplementaryData: `${dash}/student/onboarding?step=dados_complementares`,
    onboardingMyApplications: `${dash}/student/onboarding?step=my_applications`,
    onboardingAcceptanceLetter: `${dash}/student/onboarding?step=acceptance_letter`,
    adminUser: (profileId?: string) => profileId ? `${dash}/dashboard/users/${profileId}` : `${dash}/dashboard/users`,
  };
}

function buildTemplate(
  trigger: TriggerType,
  name: string,
  data: NotifyPayload["data"] = {},
  appBaseUrl: string
): Template {
  const firstName = name.split(" ")[0];
  const dash = normalizeBaseUrl(appBaseUrl);
  const routes = buildRoutes(dash);

  const englishTemplate = (() => {
  switch (trigger) {
    // ── 01 ────────────────────────────────────────────────────────────────────
    case "selection_fee_paid": return {
      subject: "Payment Confirmed — Migma Selection Process",
      emailHtml: emailWrapper("Payment Confirmed", `
        <p>Hi, ${highlight(firstName)}!</p>
        <p>Your <strong>Selection Process Fee</strong> payment has been confirmed.</p>
        <p>The next step is to complete your profile survey so we can present your application to partner universities.</p>
        ${btn("Complete Survey", routes.onboardingSurvey)}
      `),
      whatsapp: `✅ *Migma* — Payment confirmed!\n\nHi ${firstName}, your Selection Process Fee has been received. Access your account and complete the survey: ${routes.onboardingSurvey}`,
    };

    // ── 02 ────────────────────────────────────────────────────────────────────
    case "questionnaire_received": return {
      subject: "Survey Received — Your Profile Was Sent to Universities",
      emailHtml: emailWrapper("Survey Received", `
        <p>Hi, ${highlight(firstName)}!</p>
        <p>We received your survey. Your profile has been forwarded for review by Migma partner universities.</p>
        <p>Our admissions team will contact you soon with the available options for your profile.</p>
        ${btn("Track Status", routes.studentDashboard)}
      `),
      whatsapp: `📋 *Migma* — Survey received!\n\nHi ${firstName}, your profile was sent to our partner universities. Track your status here: ${routes.studentDashboard}`,
    };

    // ── 03 ────────────────────────────────────────────────────────────────────
    case "contract_approved": return {
      subject: "Contract Approved — Next Step: Choose Your University",
      emailHtml: emailWrapper("Contract Approved", `
        <p>Hi, ${highlight(firstName)}!</p>
        <p>Good news! Your contract has been <strong>approved</strong> by the Migma team.</p>
        <p>You can now access your account and choose the university that best fits your profile.</p>
        ${btn("Choose University", routes.onboardingScholarship)}
      `),
      whatsapp: `🎉 *Migma* — Contract approved!\n\nHi ${firstName}, your contract was approved. Access your account to choose your university: ${routes.onboardingScholarship}`,
    };

    // ── 04 ────────────────────────────────────────────────────────────────────
    case "scholarship_approved": {
      const university = data.university_name ?? "your selected university";
      const course = data.course_name ?? "Selected program";
      const scholarship = data.scholarship_label ??
        (typeof data.scholarship_percent === "number" ? `${data.scholarship_percent}% scholarship` : "Approved scholarship");
      const placementFee = typeof data.placement_fee_usd === "number" ? data.placement_fee_usd : null;
      const placementFeeLabel = placementFee === null ? "Pending confirmation" : placementFee === 0 ? "Waived" : `$${placementFee.toLocaleString("en-US")}`;
      const tuitionLabel = typeof data.tuition_annual_usd === "number" ? `$${data.tuition_annual_usd.toLocaleString("en-US")}/year` : null;
      const actionUrl = resolveUrl(data.app_url, routes.onboardingPlacementFee, dash);
      const isWaived = placementFee === 0;

      return {
        subject: `Scholarship approved — ${university}`,
        emailHtml: emailWrapper("Scholarship approved", `
          <p>Hi, ${highlight(firstName)}!</p>
          <p>Your scholarship has been approved. Below are the approved details for your application:</p>
          <div style="background:#111;border:1px solid #2a2a2a;border-radius:12px;padding:16px;margin:18px 0;">
            <p style="margin:0 0 8px;color:#bbb;"><strong style="color:#fff;">University:</strong> ${university}</p>
            <p style="margin:0 0 8px;color:#bbb;"><strong style="color:#fff;">Program:</strong> ${course}</p>
            <p style="margin:0 0 8px;color:#bbb;"><strong style="color:#fff;">Scholarship:</strong> ${scholarship}</p>
            ${tuitionLabel ? `<p style="margin:0 0 8px;color:#bbb;"><strong style="color:#fff;">Tuition:</strong> ${tuitionLabel}</p>` : ""}
            <p style="margin:0;color:#bbb;"><strong style="color:#fff;">Placement Fee:</strong> ${placementFeeLabel}</p>
          </div>
          ${isWaived
            ? `<p>No Placement Fee payment is required for this approved scholarship. Your seat has been confirmed and your next step is available in the student portal.</p>`
            : `<p>To secure your seat, please complete the <strong>Placement Fee</strong> payment using the link below.</p>`
          }
          ${btn(isWaived ? "Access student portal" : "Pay Placement Fee", actionUrl)}
          <p style="margin-top:20px;color:#888;font-size:13px;">If you have any questions, contact the Migma team before proceeding.</p>
        `),
        whatsapp: `🏫 *Migma* — Scholarship approved!\n\nHi ${firstName}, your scholarship at *${university}* has been approved.\n\n*Program:* ${course}\n*Scholarship:* ${scholarship}${tuitionLabel ? `\n*Tuition:* ${tuitionLabel}` : ""}\n*Placement Fee:* ${placementFeeLabel}\n\n${isWaived ? "No Placement Fee payment is required. Access your student portal for the next step:" : "Pay the Placement Fee to secure your seat:"}\n${actionUrl}`,
      };
    }

    // ── 05 ────────────────────────────────────────────────────────────────────
    case "application_fee_paid": return {
      subject: "Application Fee Confirmed — Your Spot is Secured!",
      emailHtml: emailWrapper("Application Fee Confirmed", `
        <p>Hi, ${highlight(firstName)}!</p>
        <p>Your <strong>Application Fee</strong> payment has been successfully confirmed.</p>
        <p>Your application is officially registered. The next step is to complete the remaining university information in your onboarding.</p>
        ${btn("Complete Additional Data", routes.onboardingComplementaryData)}
      `),
      whatsapp: `✅ *Migma* — Application Fee confirmed!\n\nHi ${firstName}, your payment was received and your application is registered. Complete the next step here: ${routes.onboardingComplementaryData}`,
    };

    // ── placement_fee_paid ────────────────────────────────────────────────────
    case "placement_fee_paid": return {
      subject: "Placement Fee Confirmed — Upload Your Documents",
      emailHtml: emailWrapper("Placement Fee Confirmed", `
        <p>Hi, ${highlight(firstName)}!</p>
        <p>Your <strong>Placement Fee</strong> payment has been confirmed.</p>
        <p>The next step is to upload the documents required for your process. Access the portal and upload each requested document.</p>
        ${btn("Upload Documents", resolveUrl(data.app_url, routes.onboardingDocumentsUpload, dash))}
      `),
      whatsapp: `💳 *Migma* — Placement Fee confirmed!\n\nHi ${firstName}, payment received. Now upload your documents here: ${resolveUrl(data.app_url, routes.onboardingDocumentsUpload, dash)}`,
    };

    // ── 06 ────────────────────────────────────────────────────────────────────
    case "document_rejected": return {
      subject: `Document Rejected — Correction Required: ${data.document_name ?? "document"}`,
      emailHtml: emailWrapper("Document Rejected", `
        <p>Hi, ${highlight(firstName)}!</p>
        <p>The document <strong>${data.document_name ?? "submitted"}</strong> requires a correction.</p>
        ${data.document_reason ? `<p style="background:#1a1a1a;border-left:3px solid #e55;padding:12px 16px;border-radius:4px;color:#ddd;">${data.document_reason}</p>` : ""}
        <p>Please access the portal, fix the document, and resubmit it.</p>
        ${btn("Resubmit Document", resolveUrl(data.app_url, routes.studentDocuments, dash))}
      `),
      whatsapp: `⚠️ *Migma* — Correction required\n\nHi ${firstName}, the document *${data.document_name ?? "submitted"}* needs an update.\n\n${data.document_reason ? `Reason: ${data.document_reason}\n\n` : ""}Access: ${resolveUrl(data.app_url, routes.studentDocuments, dash)}`,
    };

    // ── 07 ────────────────────────────────────────────────────────────────────
    case "all_documents_approved": return {
      subject: "Documents Approved — Pay Your Application Fee",
      emailHtml: emailWrapper("Documents Approved", `
        <p>Hi, ${highlight(firstName)}!</p>
        <p>All your submitted documents have been <strong>reviewed and approved</strong>.</p>
        <p>The next step is to pay your <strong>Application Fee</strong> so we can continue submitting your package to the university.</p>
        ${btn("Pay Application Fee", resolveUrl(data.app_url, routes.onboardingPayment, dash))}
      `),
      whatsapp: `✅ *Migma* — Documents approved!\n\nHi ${firstName}, all your documents have been approved. Next step: pay your Application Fee here:\n${resolveUrl(data.app_url, routes.onboardingPayment, dash)}`,
    };

    // ── 08 ────────────────────────────────────────────────────────────────────
    case "forms_generated": return {
      subject: "Forms Ready — Digital Signature Required",
      emailHtml: emailWrapper("Forms Ready for Signature", `
        <p>Hi, ${highlight(firstName)}!</p>
        <p>Your application forms have been generated and are ready for digital signature.</p>
        <p>Access the portal, review each form, and sign them. After signature, your package will be sent to MatriculaUSA.</p>
        ${btn("Sign Forms", resolveUrl(data.app_url, routes.studentForms, dash))}
      `),
      whatsapp: `📄 *Migma* — Forms ready!\n\nHi ${firstName}, your forms are ready for digital signature. Access them here: ${resolveUrl(data.app_url, routes.studentForms, dash)}`,
    };

    // ── 09 ────────────────────────────────────────────────────────────────────
    case "package_sent_matriculausa": return {
      subject: "Package Sent to MatriculaUSA — Processing Started",
      emailHtml: emailWrapper("Package Sent", `
        <p>Hi, ${highlight(firstName)}!</p>
        <p>Your application package has been <strong>sent to MatriculaUSA</strong> for processing.</p>
        <p>From here, the admissions office will process your I-20 / Acceptance Letter. We will notify you as soon as it is ready.</p>
        ${btn("Track Status", routes.studentApplications)}
      `),
      whatsapp: `🚀 *Migma* — Package sent!\n\nHi ${firstName}, your package was sent to MatriculaUSA. Please wait for I-20 / Acceptance Letter processing. Track it here: ${routes.studentApplications}`,
    };

    // ── 10 ────────────────────────────────────────────────────────────────────
    case "acceptance_letter_ready": return {
      subject: "Your Acceptance Letter is Ready — Migma",
      emailHtml: emailWrapper("Acceptance Letter Ready", `
        <p>Hi, ${highlight(firstName)}!</p>
        <p>Great news — your <strong>Acceptance Letter</strong> has been issued and is available for download in your portal.</p>
        <p>Please access the link below to view and download your documents.</p>
        ${data.acceptance_letter_url
          ? btn("Download Acceptance Letter", resolveUrl(data.acceptance_letter_url, routes.onboardingAcceptanceLetter, dash))
          : btn("View in Portal", routes.onboardingAcceptanceLetter)}
      `),
      whatsapp: `🎓 *Migma* — Acceptance Letter ready!\n\nHi ${firstName}, your Acceptance Letter has been issued. Access your portal to download it: ${resolveUrl(data.acceptance_letter_url, routes.onboardingAcceptanceLetter, dash)}`,
    };

    case "transfer_form_approved": return {
      subject: "Transfer Form Approved — Migma",
      emailHtml: emailWrapper("Transfer Form Approved", `
        <p>Hi, ${highlight(firstName)}!</p>
        <p>Good news — your <strong>Transfer Form</strong> has been reviewed and <strong>approved</strong> by the MatriculaUSA team.</p>
        <p>Your transfer process is moving forward. You will receive more information soon.</p>
        ${btn("View Status", routes.onboardingAcceptanceLetter)}
      `),
      whatsapp: `✅ *Migma* — Transfer Form approved!\n\nHi ${firstName}, your Transfer Form was approved by the MatriculaUSA team. Your transfer process is moving forward.\n\nAccess: ${routes.onboardingAcceptanceLetter}`,
    };

    case "transfer_form_rejected": return {
      subject: "Transfer Form — Correction Required",
      emailHtml: emailWrapper("Transfer Form — Correction Required", `
        <p>Hi, ${highlight(firstName)}!</p>
        <p>Your <strong>Transfer Form</strong> has been reviewed and requires a correction.</p>
        ${data.rejection_reason ? `<p style="background:#1a1a1a;border-left:3px solid #e53e3e;padding:12px 16px;border-radius:4px;color:#ddd;"><strong>Reason:</strong> ${data.rejection_reason}</p>` : ""}
        <p>Please access your portal, correct the form, and submit it again.</p>
        ${btn("Resubmit Transfer Form", routes.onboardingAcceptanceLetter)}
      `),
      whatsapp: `⚠️ *Migma* — Transfer Form correction required\n\nHi ${firstName}, your Transfer Form needs to be corrected.${data.rejection_reason ? `\n\n*Reason:* ${data.rejection_reason}` : ""}\n\nAccess your portal to resubmit it: ${routes.onboardingAcceptanceLetter}`,
    };

    // ── 11 ────────────────────────────────────────────────────────────────────
    case "new_pending_task": return {
      subject: "New Pending Task — Action Required",
      emailHtml: emailWrapper("New Pending Task", `
        <p>Hi, ${highlight(firstName)}!</p>
        <p>The Migma team created a new pending task in your account that requires your attention:</p>
        ${data.task_description ? `<p style="background:#1a1a1a;border-left:3px solid #f5a623;padding:12px 16px;border-radius:4px;color:#ddd;">${data.task_description}</p>` : ""}
        ${btn("Resolve Task", routes.studentDashboard)}
      `),
      whatsapp: `🔔 *Migma* — New pending task\n\nHi ${firstName}${data.task_description ? `: ${data.task_description}` : ", there is a pending task in your account"}.\n\nAccess: ${routes.studentDashboard}`,
    };

    // ── 11 ────────────────────────────────────────────────────────────────────
    case "deadline_alert_transfer": return {
      subject: `Deadline Alert — ${data.days_remaining} day(s) remaining for your Transfer`,
      emailHtml: emailWrapper("Deadline Alert — Transfer", `
        <p>Hi, ${highlight(firstName)}!</p>
        <p>Attention: you have <strong>${data.days_remaining} day(s)</strong> before the deadline for your Transfer process.</p>
        <p>Make sure all documents and steps are complete to avoid complications in your process.</p>
        ${btn("Check My Process", routes.studentDashboard)}
      `),
      whatsapp: `⏰ *Migma* — Deadline alert!\n\nHi ${firstName}, you have *${data.days_remaining} day(s)* remaining for your Transfer deadline. Check your progress: ${routes.studentDashboard}`,
    };

    // ── 12 ────────────────────────────────────────────────────────────────────
    case "deadline_alert_cos": return {
      subject: `Deadline Alert — ${data.days_remaining} day(s) until your I-94 / COS deadline`,
      emailHtml: emailWrapper("Deadline Alert — COS / I-94", `
        <p>Hi, ${highlight(firstName)}!</p>
        <p>Attention: your I-94 / Change of Status (COS) deadline expires in <strong>${data.days_remaining} day(s)</strong>.</p>
        <p>It is critical that every process step is completed before this date.</p>
        ${btn("Check My Process", routes.studentDashboard)}
      `),
      whatsapp: `⏰ *Migma* — Urgent COS deadline!\n\nHi ${firstName}, your I-94 expires in *${data.days_remaining} day(s)*. Check it urgently: ${routes.studentDashboard}`,
    };

    // ── 13 ────────────────────────────────────────────────────────────────────
    case "dependent_pending": return {
      subject: "Dependent Pending Task — Data or Documents Required",
      emailHtml: emailWrapper("Dependent Pending Task", `
        <p>Hi, ${highlight(firstName)}!</p>
        <p>There is a pending task related to <strong>dependents</strong> in your account:</p>
        ${data.task_description ? `<p style="background:#1a1a1a;border-left:3px solid #f5a623;padding:12px 16px;border-radius:4px;color:#ddd;">${data.task_description}</p>` : "<p>Please access the portal to check the required data or documents.</p>"}
        ${btn("Resolve Task", routes.studentDashboard)}
      `),
      whatsapp: `👨‍👩‍👧 *Migma* — Dependent pending task\n\nHi ${firstName}${data.task_description ? `: ${data.task_description}` : ", there is pending dependent information in your account"}.\n\nAccess: ${routes.studentDashboard}`,
    };

    // ── 14 ────────────────────────────────────────────────────────────────────
    case "referral_goal_reached": return {
      subject: "Congratulations! You Reached 10 Referrals — Migma Monthly Fee Waived",
      emailHtml: emailWrapper("Referral Goal Reached!", `
        <p>Hi, ${highlight(firstName)}!</p>
        <p>Great news! You reached the goal of <strong>10 closed referrals</strong>.</p>
        <p>As promised, your Migma monthly fee has been <strong>automatically waived</strong>. The benefit is already applied to your account.</p>
        ${btn("View My Account", routes.studentRewards)}
      `),
      whatsapp: `🏆 *Migma* — Goal reached!\n\nCongratulations ${firstName}! You closed 10 referrals and your Migma monthly fee was automatically waived. View it here: ${routes.studentRewards}`,
    };

    // ── 15 ────────────────────────────────────────────────────────────────────
    case "new_referral_closed": return {
      subject: `New Referral Closed — ${data.closures_count ?? "?"} Total`,
      emailHtml: emailWrapper("New Referral Closed", `
        <p>Hi, ${highlight(firstName)}!</p>
        <p>Your referral <strong>${data.referral_name ?? "recent referral"}</strong> has become a Migma client.</p>
        <p>You now have <strong>${data.closures_count ?? "?"} closed referral(s)</strong> in total. Keep referring to waive your Migma monthly fee.</p>
        ${btn("View Rewards", routes.studentRewards)}
      `),
      whatsapp: `🎯 *Migma* — Referral closed!\n\nHi ${firstName}, ${data.referral_name ?? "your referral"} has become a client. Total: *${data.closures_count ?? "?"}* closed referrals. View it here: ${routes.studentRewards}`,
    };

    // ── 16 — ADMIN ────────────────────────────────────────────────────────────
    case "admin_new_documents": return {
      subject: `[Admin] New Documents for Review — ${data.client_name ?? "client"}`,
      emailHtml: emailWrapper("[Admin] New Documents", `
        <p>New documents were submitted by <strong>${data.client_name ?? "client"}</strong> and are waiting for review.</p>
        ${data.client_id ? btn("Review Documents", routes.adminUser(data.client_id)) : ""}
      `),
      whatsapp: `📥 *Migma Admin* — New documents\n\n${data.client_name ?? "Client"} submitted documents for review.\n${data.client_id ? routes.adminUser(data.client_id) : routes.adminUser()}`,
    };

    // ── admin_contract_resubmitted — ADMIN ───────────────────────────────────
    case "admin_contract_resubmitted": {
      const contractLabel = data.contract_type === "annex"
        ? "Annex"
        : data.contract_type === "upsell_contract"
          ? "Upsell Contract"
          : data.contract_type === "upsell_annex"
            ? "Upsell Annex"
            : "Contract";
      return {
        subject: `[Admin] Documents Resubmitted — ${data.client_name ?? "client"} | Order #${data.order_number ?? "?"}`,
        emailHtml: emailWrapper("[Admin] Documents Resubmitted", `
          <p><strong>${data.client_name ?? "Client"}</strong> resubmitted identity documents for order <strong>#${data.order_number ?? "?"}</strong> (${contractLabel}).</p>
          <p>The contract returned to <em>Pending</em> status and is waiting for a new review.</p>
          ${data.client_id ? btn("Review Order", routes.adminUser(data.client_id)) : ""}
        `),
        whatsapp: `📤 *Migma Admin* — Documents resubmitted\n\n${data.client_name ?? "Client"} resubmitted documents for order *#${data.order_number ?? "?"}* (${contractLabel}).\n\nWaiting for review.${data.client_id ? `\n${routes.adminUser(data.client_id)}` : ""}`,
      };
    }

    // ── 17 — ADMIN ────────────────────────────────────────────────────────────
    case "admin_package_complete": return {
      subject: `[Admin] Package Complete — ${data.client_name ?? "client"} Ready for MatriculaUSA`,
      emailHtml: emailWrapper("[Admin] Package Complete", `
        <p>The package for <strong>${data.client_name ?? "client"}</strong> is complete and ready to be sent to MatriculaUSA.</p>
        ${data.client_id ? btn("View Package", routes.adminUser(data.client_id)) : ""}
      `),
      whatsapp: `✅ *Migma Admin* — Package complete\n\n${data.client_name ?? "Client"} has a package ready for MatriculaUSA.\n${data.client_id ? routes.adminUser(data.client_id) : routes.adminUser()}`,
    };

    // ── 19 — BILLING ──────────────────────────────────────────────────────────
    case "billing_started": return {
      subject: "Migma Billing Activated — Your Monthly Plan Is Set Up",
      emailHtml: emailWrapper("Billing Activated", `
        <p>Hi, ${highlight(firstName)}!</p>
        <p>Your Migma monthly plan has been activated successfully.</p>
        <ul style="color:#ccc;line-height:2;">
          <li>Monthly amount: <strong>US$ ${data.monthly_usd?.toLocaleString("en-US") ?? "-"}</strong></li>
          <li>Installments: <strong>${data.installments_total ?? "-"}x</strong></li>
          <li>Process: <strong>${data.process_type ?? data.degree_level ?? "-"}</strong></li>
          <li>First charge: <strong>${data.start_date ?? "-"}</strong></li>
        </ul>
        <p>You will receive the payment link every month in advance. If you have any questions, contact the Migma team.</p>
        ${btn("Access My Account", routes.studentDashboard)}
      `),
      whatsapp: `💳 *Migma* — Billing activated!\n\nHi ${firstName}, your monthly payment of *US$ ${data.monthly_usd?.toLocaleString("en-US") ?? "-"}* in ${data.installments_total ?? "-"} installment(s) has been configured. You will receive the payment link every month. Questions: ${routes.studentDashboard}`,
    };

    // ── 20 — BILLING ──────────────────────────────────────────────────────────
    case "billing_installment_due": return {
      subject: `Installment ${data.installment_number ?? (data.installments_paid ?? 0) + 1}/${data.installments_total ?? "-"} Created — US$ ${data.monthly_usd?.toLocaleString("en-US") ?? "-"}`,
      emailHtml: emailWrapper("Migma Installment Created", `
        <p>Hi, ${highlight(firstName)}!</p>
        <p>Your installment <strong>${data.installment_number ?? (data.installments_paid ?? 0) + 1} of ${data.installments_total ?? "-"}</strong> has been created.</p>
        <p>Amount: <strong>US$ ${data.monthly_usd?.toLocaleString("en-US") ?? "-"}</strong></p>
        ${data.billing_link ?? data.payment_link
          ? btn("Pay Now", resolveUrl(data.billing_link ?? data.payment_link, routes.studentDashboard, dash))
          : `<p style="color:#888;">The Migma team will send payment instructions through the agreed channel.</p>`}
        <p style="margin-top:20px;color:#888;font-size:13px;">Next installment: ${data.next_billing_date ?? "-"}.</p>
      `),
      whatsapp: `💳 *Migma* — Installment ${data.installment_number ?? (data.installments_paid ?? 0) + 1}/${data.installments_total ?? "-"} created!\n\nHi ${firstName}, your monthly payment of *US$ ${data.monthly_usd?.toLocaleString("en-US") ?? "-"}* has been created.\n\n${data.billing_link ?? data.payment_link ? `Pay here: ${resolveUrl(data.billing_link ?? data.payment_link, routes.studentDashboard, dash)}` : "The Migma team will send payment instructions through the agreed channel."}`,
    };

    case "billing_installment_paid": return {
      subject: `Payment Confirmed — Installment ${data.installment_number ?? "-"}/${data.installments_total ?? "-"}`,
      emailHtml: emailWrapper("Payment Confirmed", `
        <p>Hi, ${highlight(firstName)}!</p>
        <p>We received the payment for your installment <strong>${data.installment_number ?? "-"} of ${data.installments_total ?? "-"}</strong>.</p>
        <p>Installments paid so far: <strong>${data.installments_paid ?? "-"}</strong>.</p>
        ${data.receipt_url ? btn("View Receipt", resolveUrl(data.receipt_url, routes.studentDashboard, dash)) : btn("Access My Account", routes.studentDashboard)}
      `),
      whatsapp: `✅ *Migma* — Payment confirmed!\n\nHi ${firstName}, we received installment ${data.installment_number ?? "-"}/${data.installments_total ?? "-"}. Paid so far: ${data.installments_paid ?? "-"}.${data.receipt_url ? `\n\nReceipt: ${resolveUrl(data.receipt_url, routes.studentDashboard, dash)}` : ""}`,
    };

    // ── 21 — BILLING ──────────────────────────────────────────────────────────
    case "billing_suspended": return {
      subject: "Migma Billing Suspended — Contact Us",
      emailHtml: emailWrapper("Billing Suspended", `
        <p>Hi, ${highlight(firstName)}!</p>
        <p>Your Migma billing has been <strong>suspended</strong>.</p>
        ${data.suspend_reason ? `<p style="background:#1a1a1a;border-left:3px solid #e55;padding:12px 16px;border-radius:4px;color:#ddd;">${data.suspend_reason}</p>` : ""}
        <p>Contact the Migma team to resolve the situation and reactivate your plan.</p>
        ${btn("Contact Migma", routes.studentSupport)}
      `),
      whatsapp: `⚠️ *Migma* — Billing suspended\n\nHi ${firstName}, your monthly plan has been suspended.${data.suspend_reason ? `\n\nReason: ${data.suspend_reason}` : ""}\n\nContact us: ${routes.studentSupport}`,
    };

    // ── transfer_form_delivered — ADMIN ───────────────────────────────────────
    case "transfer_form_delivered": return {
      subject: `[Admin] Student Confirmed Transfer Form Delivery — ${data.client_name ?? "student"}`,
      emailHtml: emailWrapper("[Admin] Transfer Form Delivered to School", `
        <p><strong>${data.client_name ?? "The student"}</strong> confirmed that the Transfer Form was delivered to their current school.</p>
        <p>Wait for SEVIS release by the school. After confirmation, mark the process as <strong>Transfer Completed</strong> in the admin dashboard.</p>
        ${data.client_id ? btn("View Student Profile", routes.adminUser(data.client_id)) : ""}
      `),
      whatsapp: `✅ *Migma Admin* — Transfer Form delivered\n\n${data.client_name ?? "Student"} confirmed delivery of the Transfer Form to the current school. Wait for SEVIS release.\n${data.client_id ? routes.adminUser(data.client_id) : routes.adminUser()}`,
    };

    // ── transfer_completed — CLIENT ───────────────────────────────────────────
    case "transfer_completed": return {
      subject: "Transfer Completed — Congratulations!",
      emailHtml: emailWrapper("Transfer Completed", `
        <p>Hi, ${highlight(firstName)}!</p>
        <p><strong>Your transfer has been completed successfully.</strong></p>
        <p>Your new I-20 has been issued. You will soon receive emails directly from the university with information about orientation, dates, and program start.</p>
        <p style="background:#0a1f0a;border-left:3px solid #22c55e;padding:12px 16px;border-radius:4px;color:#bbf7d0;">
          Please wait for university contact about the beginning of classes. Welcome to your new university.
        </p>
        ${btn("View My Dashboard", routes.studentDashboard)}
      `),
      whatsapp: `🎓 *Migma* — Transfer completed!\n\nCongratulations, ${firstName}! Your transfer has been completed and your new I-20 has been issued. Please wait for university contact about the beginning of classes.\n\nAccess: ${routes.studentDashboard}`,
    };

    // ── 18 — ADMIN ────────────────────────────────────────────────────────────
    case "admin_no_university_match": return {
      subject: `[Admin] No Caroline/Oikos Match — Manual Review Required: ${data.client_name ?? "client"}`,
      emailHtml: emailWrapper("[Admin] No Compatible University", `
        <p><strong>${data.client_name ?? "Client"}</strong> did not match with Caroline University or Oikos University.</p>
        <p>Manual intervention is required to define an alternative.</p>
        ${data.client_id ? btn("View Client Profile", routes.adminUser(data.client_id)) : ""}
      `),
      whatsapp: `⚠️ *Migma Admin* — No university match\n\n${data.client_name ?? "Client"} does not have Caroline/Oikos available. Manual intervention is required.\n${data.client_id ? routes.adminUser(data.client_id) : routes.adminUser()}`,
    };

    // ── 19 — ADMIN support handoff ────────────────────────────────────────────
    case "admin_support_handoff": return {
      subject: `[Support] Student Waiting for Human Support: ${data.client_name ?? "student"}`,
      emailHtml: emailWrapper("[Support] Human Support Handoff", `
        <p>The AI agent transferred <strong>${data.client_name ?? "a student"}</strong> to human support.</p>
        ${data.reason ? `<p><strong>Reason:</strong> ${data.reason}</p>` : ""}
        ${data.last_message ? `<p><strong>Last message:</strong><br><em>"${data.last_message}"</em></p>` : ""}
        ${data.client_id ? btn("Open Conversation", routes.adminUser(data.client_id)) : ""}
      `),
      whatsapp: `🙋 *Migma Support* — Handoff requested\n\nStudent: ${data.client_name ?? "N/A"}\n${data.reason ? `Reason: ${data.reason}\n` : ""}${data.client_id ? routes.adminUser(data.client_id) : routes.adminUser()}`,
    };

    default:
      throw new Error(`Unknown trigger: ${trigger}`);
  }
  })();

  return applyMultilingualTemplate(
    englishTemplate,
    buildMultilingualCopy(trigger, firstName, data, routes, dash),
  );
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const appBaseUrl = Deno.env.get("APP_BASE_URL") ?? "https://migmainc.com";
  const adminNotifyEmail = Deno.env.get("ADMIN_NOTIFY_EMAIL") ?? "";
  const adminNotifyPhone = Deno.env.get("ADMIN_NOTIFY_PHONE") ?? "";

  try {
    const payload: NotifyPayload = await req.json();
    const { trigger, user_id, data = {} } = payload;
    const sendEmailChannel = payload.channels?.email !== false;
    const sendWhatsappChannel = payload.channels?.whatsapp !== false;

    if (!trigger) {
      return new Response(JSON.stringify({ error: "trigger is required" }), { status: 400, headers: CORS });
    }

    const isAdminTrigger = trigger.startsWith("admin_");

    // ── Resolve recipient ────────────────────────────────────────────────────
    let recipientEmail = "";
    let recipientPhone = "";
    let recipientName = "Client";

    if (isAdminTrigger) {
      recipientEmail = payload.admin_email ?? adminNotifyEmail;
      recipientPhone = adminNotifyPhone;
      recipientName = "Admin";
      if (!recipientEmail) {
        console.warn("[migma-notify] ADMIN_NOTIFY_EMAIL not set — email skipped");
      }
      if (!recipientPhone) {
        console.warn("[migma-notify] ADMIN_NOTIFY_PHONE not set — whatsapp skipped");
      }
    } else {
      if (!user_id && !data.client_email) {
        return json({ error: "user_id or client_email is required for client triggers" }, 400);
      }

      const { data: profile, error: profileErr } = await supabase
        .from("user_profiles")
        .select("id, user_id, full_name, email, phone, whatsapp, source, service_type, student_process_type")
        .eq(user_id ? "id" : "email", user_id ?? data.client_email!)
        .single();

      if (profileErr || !profile) {
        return json({ error: "User not found", detail: profileErr?.message }, 404);
      }

      if (!profile.user_id) {
        return json({ error: "client_not_authenticated" }, 403);
      }

      const serviceFamily = resolveClientServiceFamily(profile);
      if (profile.source !== "migma" || !serviceFamily) {
        return json({
          error: "client_not_eligible_for_migma_notify",
          detail: "Client notifications are restricted to authenticated Migma clients in COS, Transfer, or Initial.",
        }, 403);
      }

      recipientEmail = profile.email ?? "";
      recipientPhone = profile.phone ?? profile.whatsapp ?? "";
      recipientName = profile.full_name ?? "Client";
      data.client_id = profile.id;
      data.client_email = profile.email ?? data.client_email;
      data.client_phone = profile.phone ?? profile.whatsapp ?? data.client_phone;
      data.client_name = profile.full_name ?? data.client_name;
      data.process_type = data.process_type ?? serviceFamily;
    }

    // ── Resolve client_id from client_email for admin triggers ───────────────
    if (isAdminTrigger && data.client_email && !data.client_id) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("email", data.client_email)
        .maybeSingle();
      if (profile?.id) data.client_id = profile.id;
    }

    let adminNotificationSourceEmail = data.client_email ?? "";
    if (isAdminTrigger && !adminNotificationSourceEmail && data.client_id) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("email")
        .eq("id", data.client_id)
        .maybeSingle();
      if (profile?.email) {
        adminNotificationSourceEmail = profile.email;
        data.client_email = profile.email;
      }
    }

    const skipAdminNotificationForTestUser =
      isAdminTrigger && isUorakTestEmail(adminNotificationSourceEmail);

    if (skipAdminNotificationForTestUser) {
      console.log(`[migma-notify] Skipping admin notification for test user: ${adminNotificationSourceEmail}`);
    }

    // ── Build template ───────────────────────────────────────────────────────
    const template = buildTemplate(trigger, recipientName, data, appBaseUrl);

    // ── Send email ───────────────────────────────────────────────────────────
    let emailResult: { success: boolean; error?: string } = { success: false };
    if (!sendEmailChannel) {
      emailResult = { success: true, error: "skipped_by_channel" };
    } else if (skipAdminNotificationForTestUser) {
      emailResult = { success: true, error: "skipped_test_user_admin_notification" };
    } else if (recipientEmail) {
      try {
        const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseKey}`,
            "apikey": supabaseKey,
          },
          body: JSON.stringify({
            to: recipientEmail,
            subject: template.subject,
            html: template.emailHtml,
          }),
        });
        const emailBody = await emailRes.text();
        if (!emailRes.ok) {
          emailResult = { success: false, error: `send-email_${emailRes.status}: ${emailBody}` };
          console.error("[migma-notify][email] send-email failed:", emailResult.error);
        } else {
          const parsed = emailBody ? JSON.parse(emailBody) : {};
          emailResult = parsed?.error || parsed?.success === false
            ? { success: false, error: parsed?.error ?? "send-email_failed" }
            : { success: true };
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        emailResult = { success: false, error: message };
        console.error("[migma-notify][email] fetch error:", message);
      }
    } else {
      emailResult = { success: false, error: "no_email_address" };
      console.warn(`[migma-notify][email] No email for trigger ${trigger}`);
    }

    // ── Send WhatsApp ────────────────────────────────────────────────────────
    let whatsappResult: { sent: boolean; reason?: string; provider?: string } = { sent: false, reason: "no_phone" };
    if (!sendWhatsappChannel) {
      whatsappResult = { sent: true, reason: "skipped_by_channel" };
    } else if (skipAdminNotificationForTestUser) {
      whatsappResult = { sent: true, reason: "skipped_test_user_admin_notification" };
    } else if (recipientPhone) {
      whatsappResult = await sendWhatsApp({
        trigger,
        phone: recipientPhone,
        email: recipientEmail,
        name: recipientName,
        message: template.whatsapp,
        data,
        isAdminTrigger,
      });
    } else {
      console.warn(`[migma-notify][whatsapp] No phone for trigger ${trigger} user ${user_id}`);
    }

    console.log(`[migma-notify] trigger=${trigger} user=${user_id ?? "admin"} email=${emailResult.success} whatsapp=${whatsappResult.sent}`);

    return new Response(
      JSON.stringify({
        trigger,
        email: emailResult,
        whatsapp: whatsappResult,
      }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("[migma-notify] Unhandled error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS });
  }
});
