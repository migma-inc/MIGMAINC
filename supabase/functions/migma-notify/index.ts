import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  | "new_pending_task"
  | "deadline_alert_transfer"
  | "deadline_alert_cos"
  | "dependent_pending"
  | "referral_goal_reached"
  | "new_referral_closed"
  // Billing (Fase 9)
  | "billing_started"
  | "billing_installment_due"
  | "billing_suspended"
  // Admin-facing
  | "admin_new_documents"
  | "admin_package_complete"
  | "admin_no_university_match"
  | "admin_support_handoff";

// ─── Payload ──────────────────────────────────────────────────────────────────

interface NotifyPayload {
  trigger: TriggerType;
  user_id?: string;          // required for client triggers
  admin_email?: string;      // override; falls back to ADMIN_NOTIFY_EMAIL env var
  data?: {
    payment_link?: string;
    app_url?: string;
    university_name?: string;
    document_name?: string;
    document_reason?: string;
    days_remaining?: number;
    task_description?: string;
    referral_name?: string;
    closures_count?: number;
    client_name?: string;
    client_id?: string;
    reason?: string;
    last_message?: string;
    // Billing (Fase 9)
    monthly_usd?: number;
    installments_total?: number;
    installments_paid?: number;
    degree_level?: string;
    next_billing_date?: string;
    billing_link?: string;
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
                      ${body}
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

// ─── Template registry ────────────────────────────────────────────────────────

interface Template { subject: string; emailHtml: string; whatsapp: string }

function buildTemplate(
  trigger: TriggerType,
  name: string,
  data: NotifyPayload["data"] = {},
  appBaseUrl: string
): Template {
  const firstName = name.split(" ")[0];
  const dash = appBaseUrl || "https://migmainc.com";
  const routes = {
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
    onboardingMyApplications: `${dash}/student/onboarding?step=my_applications`,
    adminUser: (profileId?: string) => profileId ? `${dash}/dashboard/users/${profileId}` : `${dash}/dashboard/users`,
  };

  switch (trigger) {
    // ── 01 ────────────────────────────────────────────────────────────────────
    case "selection_fee_paid": return {
      subject: "Pagamento confirmado — Processo Seletivo Migma",
      emailHtml: emailWrapper("Pagamento confirmado", `
        <p>Olá, ${highlight(firstName)}!</p>
        <p>Seu pagamento da <strong>Taxa do Processo Seletivo</strong> foi confirmado com sucesso.</p>
        <p>O próximo passo é preencher o questionário de perfil para que possamos apresentar sua candidatura às universidades parceiras.</p>
        ${btn("Preencher questionário", routes.onboardingSurvey)}
      `),
      whatsapp: `✅ *Migma* — Pagamento confirmado!\n\nOlá ${firstName}, sua taxa do processo seletivo foi recebida. Acesse sua conta e preencha o questionário: ${routes.onboardingSurvey}`,
    };

    // ── 02 ────────────────────────────────────────────────────────────────────
    case "questionnaire_received": return {
      subject: "Questionário recebido — seu perfil foi enviado às universidades",
      emailHtml: emailWrapper("Questionário recebido", `
        <p>Olá, ${highlight(firstName)}!</p>
        <p>Recebemos seu questionário. Seu perfil já foi encaminhado para análise das universidades parceiras da Migma.</p>
        <p>Em breve nosso time de admissões entrará em contato com as opções disponíveis para você.</p>
        ${btn("Acompanhar status", routes.studentDashboard)}
      `),
      whatsapp: `📋 *Migma* — Questionário recebido!\n\nOlá ${firstName}, seu perfil foi enviado para nossas universidades parceiras. Acompanhe: ${routes.studentDashboard}`,
    };

    // ── 03 ────────────────────────────────────────────────────────────────────
    case "contract_approved": return {
      subject: "Contrato aprovado — próximo passo: escolha sua universidade",
      emailHtml: emailWrapper("Contrato aprovado", `
        <p>Olá, ${highlight(firstName)}!</p>
        <p>Boas notícias! Seu contrato foi <strong>aprovado</strong> pelo time Migma.</p>
        <p>Agora você pode acessar sua conta e escolher a universidade ideal para seu perfil.</p>
        ${btn("Escolher universidade", routes.onboardingScholarship)}
      `),
      whatsapp: `🎉 *Migma* — Contrato aprovado!\n\nOlá ${firstName}, seu contrato foi aprovado! Acesse sua conta para escolher sua universidade: ${routes.onboardingScholarship}`,
    };

    // ── 04 ────────────────────────────────────────────────────────────────────
    case "scholarship_approved": return {
      subject: `Bolsa aprovada — ${data.university_name ?? "universidade selecionada"}`,
      emailHtml: emailWrapper("Bolsa aprovada", `
        <p>Olá, ${highlight(firstName)}!</p>
        <p>Sua bolsa na <strong>${data.university_name ?? "universidade selecionada"}</strong> foi aprovada!</p>
        <p>Para garantir sua vaga, realize o pagamento do <strong>Placement Fee</strong> através do link abaixo:</p>
        ${data.payment_link ? btn("Pagar Placement Fee", data.payment_link) : ""}
        <p style="margin-top:20px;color:#888;font-size:13px;">Link válido por tempo limitado. Em caso de dúvidas, entre em contato com o time Migma.</p>
      `),
      whatsapp: `🏫 *Migma* — Bolsa aprovada!\n\nOlá ${firstName}, sua bolsa na *${data.university_name ?? "universidade"}* foi aprovada!\n\nPague o Placement Fee para garantir sua vaga:\n${data.payment_link ?? dash}`,
    };

    // ── 05 ────────────────────────────────────────────────────────────────────
    case "application_fee_paid": return {
      subject: "Application Fee Confirmed — Your Spot is Secured!",
      emailHtml: emailWrapper("Application Fee Confirmed", `
        <p>Hi, ${highlight(firstName)}!</p>
        <p>Your <strong>Application Fee</strong> payment has been successfully confirmed.</p>
        <p>Your application is officially registered. Track your progress through the student portal.</p>
        ${btn("Access my account", routes.onboardingDocumentsUpload)}
      `),
      whatsapp: `✅ *Migma* — Application Fee Confirmed!\n\nHi ${firstName}, your payment was received and your spot is secured! Track your progress: ${routes.onboardingDocumentsUpload}`,
    };

    // ── placement_fee_paid ────────────────────────────────────────────────────
    case "placement_fee_paid": return {
      subject: "Placement Fee confirmado — envie seus documentos",
      emailHtml: emailWrapper("Placement Fee confirmado", `
        <p>Olá, ${highlight(firstName)}!</p>
        <p>Seu pagamento do <strong>Placement Fee</strong> foi confirmado.</p>
        <p>O próximo passo é enviar os documentos necessários para o processo. Acesse o portal e faça o upload de cada documento solicitado.</p>
        ${btn("Enviar documentos", data.app_url ?? routes.onboardingDocumentsUpload)}
      `),
      whatsapp: `💳 *Migma* — Placement Fee confirmado!\n\nOlá ${firstName}, pagamento recebido! Agora envie seus documentos: ${data.app_url ?? routes.onboardingDocumentsUpload}`,
    };

    // ── 06 ────────────────────────────────────────────────────────────────────
    case "document_rejected": return {
      subject: `Document Rejected — Correction Required: ${data.document_name ?? "document"}`,
      emailHtml: emailWrapper("Document Rejected", `
        <p>Hi, ${highlight(firstName)}!</p>
        <p>The document <strong>${data.document_name ?? "submitted"}</strong> requires a correction.</p>
        ${data.document_reason ? `<p style="background:#1a1a1a;border-left:3px solid #e55;padding:12px 16px;border-radius:4px;color:#ddd;">${data.document_reason}</p>` : ""}
        <p>Please access the portal, fix the document, and resubmit it.</p>
        ${btn("Resubmit document", data.app_url ?? routes.studentDocuments)}
      `),
      whatsapp: `⚠️ *Migma* — Correction Required\n\nHi ${firstName}, the document *${data.document_name ?? "submitted"}* needs an update.\n\n${data.document_reason ? `Reason: ${data.document_reason}\n\n` : ""}Access: ${data.app_url ?? routes.studentDocuments}`,
    };

    // ── 07 ────────────────────────────────────────────────────────────────────
    case "all_documents_approved": return {
      subject: "All Documents Approved — Your Application is Being Processed",
      emailHtml: emailWrapper("Documents Approved", `
        <p>Hi, ${highlight(firstName)}!</p>
        <p>All your submitted documents have been <strong>reviewed and approved</strong>. 🎉</p>
        <p>Our team is now processing your application package and coordinating with the university. You will be notified as soon as your acceptance letter is ready.</p>
        ${btn("Track your documents", routes.studentDocuments)}
      `),
      whatsapp: `✅ *Migma* — Documents Approved!\n\nHi ${firstName}, all your documents have been approved! We're now processing your application. We'll notify you when your acceptance letter is ready.\n${routes.studentDocuments}`,
    };

    // ── 08 ────────────────────────────────────────────────────────────────────
    case "forms_generated": return {
      subject: "Formulários prontos — assine digitalmente",
      emailHtml: emailWrapper("Formulários para assinatura", `
        <p>Olá, ${highlight(firstName)}!</p>
        <p>Os formulários da sua candidatura foram gerados e estão prontos para assinatura digital.</p>
        <p>Acesse o portal, revise cada formulário e assine. Após a assinatura, o pacote será enviado automaticamente ao MatriculaUSA.</p>
        ${btn("Assinar formulários", data.app_url ?? routes.studentForms)}
      `),
      whatsapp: `📄 *Migma* — Formulários prontos!\n\nOlá ${firstName}, seus formulários estão prontos para assinatura digital. Acesse: ${data.app_url ?? routes.studentForms}`,
    };

    // ── 09 ────────────────────────────────────────────────────────────────────
    case "package_sent_matriculausa": return {
      subject: "Pacote enviado ao MatriculaUSA — aguarde processamento",
      emailHtml: emailWrapper("Pacote enviado", `
        <p>Olá, ${highlight(firstName)}!</p>
        <p>Seu pacote de candidatura foi <strong>enviado ao MatriculaUSA</strong> para processamento.</p>
        <p>A partir daqui, o escritório de admissões irá processar seu I-20 / Carta de Aceite. Assim que pronto, você será notificado.</p>
        ${btn("Acompanhar status", routes.studentApplications)}
      `),
      whatsapp: `🚀 *Migma* — Pacote enviado!\n\nOlá ${firstName}, seu pacote foi enviado ao MatriculaUSA. Aguarde o processamento do seu I-20. Acompanhe: ${routes.studentApplications}`,
    };

    // ── 10 ────────────────────────────────────────────────────────────────────
    case "acceptance_letter_ready": return {
      subject: "Your Acceptance Letter is Ready — Migma",
      emailHtml: emailWrapper("Acceptance Letter Ready", `
        <p>Hi, ${highlight(firstName)}!</p>
        <p>Great news — your <strong>Acceptance Letter</strong> has been issued and is available for download in your portal.</p>
        <p>Please access the link below to view and download your documents.</p>
        ${data.acceptance_letter_url
          ? btn("Download Acceptance Letter", data.acceptance_letter_url)
          : btn("View in Portal", `${dash}/student/onboarding?step=acceptance_letter`)}
      `),
      whatsapp: `🎓 *Migma* — Acceptance Letter Ready!\n\nHi ${firstName}, your Acceptance Letter has been issued! Access your portal to download it: ${data.acceptance_letter_url ?? `${dash}/student/onboarding?step=acceptance_letter`}`,
    };

    // ── 11 ────────────────────────────────────────────────────────────────────
    case "new_pending_task": return {
      subject: "Nova pendência — ação necessária na sua conta",
      emailHtml: emailWrapper("Nova pendência", `
        <p>Olá, ${highlight(firstName)}!</p>
        <p>O time Migma criou uma nova pendência na sua conta que precisa da sua atenção:</p>
        ${data.task_description ? `<p style="background:#1a1a1a;border-left:3px solid #f5a623;padding:12px 16px;border-radius:4px;color:#ddd;">${data.task_description}</p>` : ""}
        ${btn("Resolver pendência", routes.studentDashboard)}
      `),
      whatsapp: `🔔 *Migma* — Nova pendência\n\nOlá ${firstName}${data.task_description ? `: ${data.task_description}` : ", há uma pendência na sua conta"}.\n\nAcesse: ${routes.studentDashboard}`,
    };

    // ── 11 ────────────────────────────────────────────────────────────────────
    case "deadline_alert_transfer": return {
      subject: `Alerta de prazo — ${data.days_remaining} dia(s) para seu Transfer`,
      emailHtml: emailWrapper("Alerta de prazo — Transfer", `
        <p>Olá, ${highlight(firstName)}!</p>
        <p>Atenção: você tem <strong>${data.days_remaining} dia(s)</strong> antes do prazo limite do seu processo de Transfer.</p>
        <p>Certifique-se de que todos os documentos e etapas estão completos para evitar complicações no processo.</p>
        ${btn("Verificar meu processo", routes.studentDashboard)}
      `),
      whatsapp: `⏰ *Migma* — Alerta de prazo!\n\nOlá ${firstName}, faltam *${data.days_remaining} dia(s)* para o prazo do seu Transfer. Verifique seu progresso: ${routes.studentDashboard}`,
    };

    // ── 12 ────────────────────────────────────────────────────────────────────
    case "deadline_alert_cos": return {
      subject: `Alerta de prazo — ${data.days_remaining} dia(s) para expirar seu I-94 / COS`,
      emailHtml: emailWrapper("Alerta de prazo — COS / I-94", `
        <p>Olá, ${highlight(firstName)}!</p>
        <p>Atenção: seu I-94 / prazo de mudança de status (COS) expira em <strong>${data.days_remaining} dia(s)</strong>.</p>
        <p>É fundamental que todas as etapas do processo estejam concluídas antes desta data.</p>
        ${btn("Verificar meu processo", routes.studentDashboard)}
      `),
      whatsapp: `⏰ *Migma* — Prazo COS urgente!\n\nOlá ${firstName}, seu I-94 expira em *${data.days_remaining} dia(s)*. Verifique urgentemente: ${routes.studentDashboard}`,
    };

    // ── 13 ────────────────────────────────────────────────────────────────────
    case "dependent_pending": return {
      subject: "Pendência de dependente — dados ou documentos necessários",
      emailHtml: emailWrapper("Pendência de dependente", `
        <p>Olá, ${highlight(firstName)}!</p>
        <p>Há uma pendência relacionada a <strong>dependentes</strong> na sua conta:</p>
        ${data.task_description ? `<p style="background:#1a1a1a;border-left:3px solid #f5a623;padding:12px 16px;border-radius:4px;color:#ddd;">${data.task_description}</p>` : "<p>Por favor, acesse o portal para verificar os dados ou documentos necessários.</p>"}
        ${btn("Resolver pendência", routes.studentDashboard)}
      `),
      whatsapp: `👨‍👩‍👧 *Migma* — Pendência de dependente\n\nOlá ${firstName}${data.task_description ? `: ${data.task_description}` : ", há pendência de dados de dependente"}.\n\nAcesse: ${routes.studentDashboard}`,
    };

    // ── 14 ────────────────────────────────────────────────────────────────────
    case "referral_goal_reached": return {
      subject: "Parabéns! Você atingiu 10 indicações — mensalidade Migma zerada",
      emailHtml: emailWrapper("Meta de indicações atingida!", `
        <p>Olá, ${highlight(firstName)}!</p>
        <p>🏆 Incrível! Você atingiu a meta de <strong>10 indicações</strong> fechadas!</p>
        <p>Como prometido, sua mensalidade Migma foi <strong>zerada automaticamente</strong>. O benefício já está aplicado na sua conta.</p>
        ${btn("Ver minha conta", routes.studentRewards)}
      `),
      whatsapp: `🏆 *Migma* — Meta atingida!\n\nParabéns ${firstName}! Você fechou 10 indicações e sua mensalidade Migma foi zerada automaticamente. Veja: ${routes.studentRewards}`,
    };

    // ── 15 ────────────────────────────────────────────────────────────────────
    case "new_referral_closed": return {
      subject: `Nova indicação fechada — ${data.closures_count ?? "?"} no total`,
      emailHtml: emailWrapper("Nova indicação fechada", `
        <p>Olá, ${highlight(firstName)}!</p>
        <p>Sua indicação <strong>${data.referral_name ?? "recente"}</strong> foi convertida em cliente Migma!</p>
        <p>Você tem agora <strong>${data.closures_count ?? "?"} indicação(ões)</strong> no total. Continue indicando para zerar sua mensalidade Migma!</p>
        ${btn("Ver meu painel de rewards", routes.studentRewards)}
      `),
      whatsapp: `🎯 *Migma* — Indicação fechada!\n\nOlá ${firstName}, ${data.referral_name ?? "sua indicação"} acaba de virar cliente! Total: *${data.closures_count ?? "?"}* indicações. Veja: ${routes.studentRewards}`,
    };

    // ── 16 — ADMIN ────────────────────────────────────────────────────────────
    case "admin_new_documents": return {
      subject: `[Admin] Novos documentos para revisão — ${data.client_name ?? "cliente"}`,
      emailHtml: emailWrapper("[Admin] Novos documentos", `
        <p>Novos documentos foram enviados por <strong>${data.client_name ?? "cliente"}</strong> e aguardam revisão.</p>
        ${data.client_id ? btn("Revisar documentos", routes.adminUser(data.client_id)) : ""}
      `),
      whatsapp: `📥 *Migma Admin* — Novos documentos\n\n${data.client_name ?? "Cliente"} enviou documentos para revisão.\n${data.client_id ? routes.adminUser(data.client_id) : routes.adminUser()}`,
    };

    // ── 17 — ADMIN ────────────────────────────────────────────────────────────
    case "admin_package_complete": return {
      subject: `[Admin] Pacote completo — ${data.client_name ?? "cliente"} pronto para MatriculaUSA`,
      emailHtml: emailWrapper("[Admin] Pacote completo", `
        <p>O pacote de <strong>${data.client_name ?? "cliente"}</strong> está completo e pronto para envio ao MatriculaUSA.</p>
        ${data.client_id ? btn("Ver pacote", routes.adminUser(data.client_id)) : ""}
      `),
      whatsapp: `✅ *Migma Admin* — Pacote completo\n\n${data.client_name ?? "Cliente"} tem pacote pronto para MatriculaUSA.\n${data.client_id ? routes.adminUser(data.client_id) : routes.adminUser()}`,
    };

    // ── 19 — BILLING ──────────────────────────────────────────────────────────
    case "billing_started": return {
      subject: "Billing Migma ativado — sua mensalidade foi configurada",
      emailHtml: emailWrapper("Billing ativado", `
        <p>Olá, ${highlight(firstName)}!</p>
        <p>Seu plano de mensalidades Migma foi ativado com sucesso.</p>
        <ul style="color:#ccc;line-height:2;">
          <li>Valor mensal: <strong>US$ ${data.monthly_usd?.toLocaleString("en-US") ?? "–"}</strong></li>
          <li>Parcelas: <strong>${data.installments_total ?? "–"}x</strong></li>
          <li>Curso: <strong>${data.degree_level ?? "–"}</strong></li>
        </ul>
        <p>Você receberá o link de pagamento todo mês com antecedência. Em caso de dúvidas, fale com o time Migma.</p>
        ${btn("Acessar minha conta", routes.studentDashboard)}
      `),
      whatsapp: `💳 *Migma* — Billing ativado!\n\nOlá ${firstName}, sua mensalidade de *US$ ${data.monthly_usd?.toLocaleString("en-US") ?? "–"}* em ${data.installments_total ?? "–"}x foi configurada. Você receberá o link de pagamento mensalmente. Dúvidas: ${routes.studentDashboard}`,
    };

    // ── 20 — BILLING ──────────────────────────────────────────────────────────
    case "billing_installment_due": return {
      subject: `Parcela ${(data.installments_paid ?? 0) + 1}/${data.installments_total ?? "–"} disponível — US$ ${data.monthly_usd?.toLocaleString("en-US") ?? "–"}`,
      emailHtml: emailWrapper("Link de pagamento disponível", `
        <p>Olá, ${highlight(firstName)}!</p>
        <p>Sua parcela <strong>${(data.installments_paid ?? 0) + 1} de ${data.installments_total ?? "–"}</strong> está disponível para pagamento.</p>
        <p>Valor: <strong>US$ ${data.monthly_usd?.toLocaleString("en-US") ?? "–"}</strong></p>
        ${data.billing_link
          ? btn("Pagar agora", data.billing_link)
          : `<p style="color:#888;">Link de pagamento em processamento. Acesse ${routes.studentDashboard} para mais informações.</p>`}
        <p style="margin-top:20px;color:#888;font-size:13px;">Próxima parcela: ${data.next_billing_date ?? "–"}.</p>
      `),
      whatsapp: `💳 *Migma* — Parcela ${(data.installments_paid ?? 0) + 1}/${data.installments_total ?? "–"} disponível!\n\nOlá ${firstName}, sua mensalidade de *US$ ${data.monthly_usd?.toLocaleString("en-US") ?? "–"}* está pronta para pagamento.\n\n${data.billing_link ? `Pague aqui: ${data.billing_link}` : "Link em breve pelo portal."}`,
    };

    // ── 21 — BILLING ──────────────────────────────────────────────────────────
    case "billing_suspended": return {
      subject: "Billing Migma suspenso — entre em contato",
      emailHtml: emailWrapper("Billing suspenso", `
        <p>Olá, ${highlight(firstName)}!</p>
        <p>Seu billing Migma foi <strong>suspenso</strong>.</p>
        ${data.suspend_reason ? `<p style="background:#1a1a1a;border-left:3px solid #e55;padding:12px 16px;border-radius:4px;color:#ddd;">${data.suspend_reason}</p>` : ""}
        <p>Entre em contato com o time Migma para regularizar sua situação e reativar o plano.</p>
        ${btn("Falar com o time Migma", routes.studentSupport)}
      `),
      whatsapp: `⚠️ *Migma* — Billing suspenso\n\nOlá ${firstName}, seu plano de mensalidades foi suspenso.${data.suspend_reason ? `\n\nMotivo: ${data.suspend_reason}` : ""}\n\nEntre em contato: ${routes.studentSupport}`,
    };

    // ── 18 — ADMIN ────────────────────────────────────────────────────────────
    case "admin_no_university_match": return {
      subject: `[Admin] ⚠️ Cliente sem Caroline/Oikos — intervenção necessária: ${data.client_name ?? "cliente"}`,
      emailHtml: emailWrapper("[Admin] Sem universidade compatível", `
        <p>⚠️ <strong>${data.client_name ?? "Cliente"}</strong> não teve match com Caroline University nem Oikos University.</p>
        <p>Intervenção humana necessária para definir alternativa.</p>
        ${data.client_id ? btn("Ver perfil do cliente", routes.adminUser(data.client_id)) : ""}
      `),
      whatsapp: `⚠️ *Migma Admin* — Sem match universitário\n\n${data.client_name ?? "Cliente"} não tem Caroline/Oikos disponível. Intervenção necessária.\n${data.client_id ? routes.adminUser(data.client_id) : routes.adminUser()}`,
    };

    // ── 19 — ADMIN support handoff ────────────────────────────────────────────
    case "admin_support_handoff": return {
      subject: `[Suporte] 🙋 Aluno aguarda atendimento humano: ${data.client_name ?? "aluno"}`,
      emailHtml: emailWrapper("[Suporte] Transferência para atendente", `
        <p>O agente de IA transferiu <strong>${data.client_name ?? "um aluno"}</strong> para atendimento humano.</p>
        ${data.reason ? `<p><strong>Motivo:</strong> ${data.reason}</p>` : ""}
        ${data.last_message ? `<p><strong>Última mensagem:</strong><br><em>"${data.last_message}"</em></p>` : ""}
        ${data.client_id ? btn("Abrir conversa", routes.adminUser(data.client_id)) : ""}
      `),
      whatsapp: `🙋 *Migma Suporte* — Transferência solicitada\n\nAluno: ${data.client_name ?? "N/D"}\n${data.reason ? `Motivo: ${data.reason}\n` : ""}${data.client_id ? routes.adminUser(data.client_id) : routes.adminUser()}`,
    };

    default:
      throw new Error(`Unknown trigger: ${trigger}`);
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const appBaseUrl = Deno.env.get("APP_BASE_URL") ?? "https://migmainc.com";
  const adminNotifyEmail = Deno.env.get("ADMIN_NOTIFY_EMAIL") ?? "";

  try {
    const payload: NotifyPayload = await req.json();
    const { trigger, user_id, data = {} } = payload;

    if (!trigger) {
      return new Response(JSON.stringify({ error: "trigger is required" }), { status: 400, headers: CORS });
    }

    const isAdminTrigger = trigger.startsWith("admin_");

    // ── Resolve recipient ────────────────────────────────────────────────────
    let recipientEmail = "";
    let recipientPhone = "";
    let recipientName = "Cliente";

    if (isAdminTrigger) {
      recipientEmail = payload.admin_email ?? adminNotifyEmail;
      recipientName = "Admin";
      if (!recipientEmail) {
        console.warn("[migma-notify] ADMIN_NOTIFY_EMAIL not set — email skipped");
      }
    } else {
      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id is required for client triggers" }), { status: 400, headers: CORS });
      }
      const { data: profile, error: profileErr } = await supabase
        .from("user_profiles")
        .select("full_name, email, phone")
        .eq("id", user_id)
        .single();

      if (profileErr || !profile) {
        return new Response(JSON.stringify({ error: "User not found", detail: profileErr?.message }), { status: 404, headers: CORS });
      }

      recipientEmail = profile.email ?? "";
      recipientPhone = profile.phone ?? "";
      recipientName = profile.full_name ?? "Cliente";
    }

    // ── Build template ───────────────────────────────────────────────────────
    const template = buildTemplate(trigger, recipientName, data, appBaseUrl);

    // ── Send email ───────────────────────────────────────────────────────────
    let emailResult: { success: boolean; error?: string } = { success: false };
    if (recipientEmail) {
      const { error: invokeErr } = await supabase.functions.invoke("send-email", {
        body: {
          to: recipientEmail,
          subject: template.subject,
          html: template.emailHtml,
        },
      });
      emailResult = invokeErr ? { success: false, error: invokeErr.message } : { success: true };
      if (invokeErr) console.error("[migma-notify][email] invoke error:", invokeErr.message);
    } else {
      emailResult = { success: false, error: "no_email_address" };
      console.warn(`[migma-notify][email] No email for trigger ${trigger}`);
    }

    // ── Send WhatsApp ────────────────────────────────────────────────────────
    let whatsappResult: { sent: boolean; reason?: string; provider?: string } = { sent: false, reason: "no_phone" };
    if (recipientPhone) {
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
