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
  | "questionnaire_received"
  | "contract_approved"
  | "scholarship_approved"
  | "placement_fee_paid"
  | "document_rejected"
  | "all_documents_approved"
  | "forms_generated"
  | "package_sent_matriculausa"
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
  | "admin_no_university_match";

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
    // Billing (Fase 9)
    monthly_usd?: number;
    installments_total?: number;
    installments_paid?: number;
    degree_level?: string;
    next_billing_date?: string;
    billing_link?: string;
    suspend_reason?: string;
  };
}

// ─── Evolution API ────────────────────────────────────────────────────────────
// Required env vars: EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE

async function sendWhatsApp(phone: string, message: string): Promise<{ sent: boolean; reason?: string }> {
  const apiUrl  = Deno.env.get("EVOLUTION_API_URL");
  const apiKey  = Deno.env.get("EVOLUTION_API_KEY");
  const instance = Deno.env.get("EVOLUTION_INSTANCE");

  if (!apiUrl || !apiKey || !instance) {
    console.log(`[migma-notify][whatsapp:stub] Evolution API not configured. Would send to ${phone}: ${message.slice(0, 80)}...`);
    return { sent: false, reason: "evolution_not_configured" };
  }

  // Normalise: digits only, ensure country code (min 10 digits)
  const normalised = phone.replace(/\D/g, "");
  if (normalised.length < 10) {
    console.warn(`[migma-notify][whatsapp] Invalid phone: ${phone}`);
    return { sent: false, reason: "invalid_phone" };
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
      return { sent: false, reason: `evolution_${res.status}` };
    }
    const result = await res.json().catch(() => ({}));
    console.log(`[migma-notify][whatsapp] Sent to ${normalised}, key=${result?.key?.id ?? "?"}`);
    return { sent: true };
  } catch (err: any) {
    console.error("[migma-notify][whatsapp] Fetch error:", err.message);
    return { sent: false, reason: err.message };
  }
}

// ─── Email helper ─────────────────────────────────────────────────────────────

function emailWrapper(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#111;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">
        <!-- Header -->
        <tr><td style="background:#161616;padding:28px 40px;border-bottom:1px solid #222;">
          <span style="font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.5px;">MIGMA</span>
          <span style="font-size:22px;font-weight:300;color:#888;"> INC</span>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:36px 40px;color:#ccc;font-size:15px;line-height:1.7;">
          ${body}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:20px 40px;border-top:1px solid #222;color:#555;font-size:12px;">
          Migma Inc · Notificação automática · Não responda este email
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function btn(label: string, url: string): string {
  return `<p style="margin:28px 0 0;"><a href="${url}"
    style="display:inline-block;background:#fff;color:#000;font-weight:600;font-size:14px;
    padding:12px 28px;border-radius:8px;text-decoration:none;">${label}</a></p>`;
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

  switch (trigger) {
    // ── 01 ────────────────────────────────────────────────────────────────────
    case "selection_fee_paid": return {
      subject: "Pagamento confirmado — Processo Seletivo Migma",
      emailHtml: emailWrapper("Pagamento confirmado", `
        <p>Olá, ${highlight(firstName)}!</p>
        <p>Seu pagamento da <strong>Taxa do Processo Seletivo</strong> foi confirmado com sucesso.</p>
        <p>O próximo passo é preencher o questionário de perfil para que possamos apresentar sua candidatura às universidades parceiras.</p>
        ${btn("Acessar minha conta", `${dash}/student`)}
      `),
      whatsapp: `✅ *Migma* — Pagamento confirmado!\n\nOlá ${firstName}, sua taxa do processo seletivo foi recebida. Acesse sua conta e preencha o questionário: ${dash}/student`,
    };

    // ── 02 ────────────────────────────────────────────────────────────────────
    case "questionnaire_received": return {
      subject: "Questionário recebido — seu perfil foi enviado às universidades",
      emailHtml: emailWrapper("Questionário recebido", `
        <p>Olá, ${highlight(firstName)}!</p>
        <p>Recebemos seu questionário. Seu perfil já foi encaminhado para análise das universidades parceiras da Migma.</p>
        <p>Em breve nosso time de admissões entrará em contato com as opções disponíveis para você.</p>
        ${btn("Acompanhar status", `${dash}/student`)}
      `),
      whatsapp: `📋 *Migma* — Questionário recebido!\n\nOlá ${firstName}, seu perfil foi enviado para nossas universidades parceiras. Acompanhe: ${dash}/student`,
    };

    // ── 03 ────────────────────────────────────────────────────────────────────
    case "contract_approved": return {
      subject: "Contrato aprovado — próximo passo: escolha sua universidade",
      emailHtml: emailWrapper("Contrato aprovado", `
        <p>Olá, ${highlight(firstName)}!</p>
        <p>Boas notícias! Seu contrato foi <strong>aprovado</strong> pelo time Migma.</p>
        <p>Agora você pode acessar sua conta e escolher a universidade ideal para seu perfil.</p>
        ${btn("Escolher universidade", `${dash}/student`)}
      `),
      whatsapp: `🎉 *Migma* — Contrato aprovado!\n\nOlá ${firstName}, seu contrato foi aprovado! Acesse sua conta para escolher sua universidade: ${dash}/student`,
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
    case "placement_fee_paid": return {
      subject: "Placement Fee confirmado — envie seus documentos",
      emailHtml: emailWrapper("Placement Fee confirmado", `
        <p>Olá, ${highlight(firstName)}!</p>
        <p>Seu pagamento do <strong>Placement Fee</strong> foi confirmado.</p>
        <p>O próximo passo é enviar os documentos necessários para o processo. Acesse o portal e faça o upload de cada documento solicitado.</p>
        ${btn("Enviar documentos", data.app_url ?? `${dash}/student/documents`)}
      `),
      whatsapp: `💳 *Migma* — Placement Fee confirmado!\n\nOlá ${firstName}, pagamento recebido! Agora envie seus documentos: ${data.app_url ?? `${dash}/student/documents`}`,
    };

    // ── 06 ────────────────────────────────────────────────────────────────────
    case "document_rejected": return {
      subject: `Documento rejeitado — correção necessária: ${data.document_name ?? "documento"}`,
      emailHtml: emailWrapper("Documento rejeitado", `
        <p>Olá, ${highlight(firstName)}!</p>
        <p>O documento <strong>${data.document_name ?? "enviado"}</strong> precisa ser corrigido.</p>
        ${data.document_reason ? `<p style="background:#1a1a1a;border-left:3px solid #e55;padding:12px 16px;border-radius:4px;color:#ddd;">${data.document_reason}</p>` : ""}
        <p>Acesse o portal, corrija o documento e faça o reenvio.</p>
        ${btn("Reenviar documento", data.app_url ?? `${dash}/student/documents`)}
      `),
      whatsapp: `⚠️ *Migma* — Correção necessária\n\nOlá ${firstName}, o documento *${data.document_name ?? "enviado"}* precisa de ajuste.\n\n${data.document_reason ? `Motivo: ${data.document_reason}\n\n` : ""}Acesse: ${data.app_url ?? `${dash}/student/documents`}`,
    };

    // ── 07 ────────────────────────────────────────────────────────────────────
    case "all_documents_approved": return {
      subject: "Documentos aprovados — pague a Application Fee",
      emailHtml: emailWrapper("Documentos aprovados", `
        <p>Olá, ${highlight(firstName)}!</p>
        <p>Todos os seus documentos foram <strong>aprovados</strong>! 🎉</p>
        <p>O próximo passo é o pagamento da <strong>Application Fee</strong> para concluir a candidatura formal junto à universidade.</p>
        ${data.payment_link ? btn("Pagar Application Fee", data.payment_link) : btn("Acessar portal", `${dash}/student`)}
      `),
      whatsapp: `✅ *Migma* — Documentos aprovados!\n\nOlá ${firstName}, todos os documentos foram aprovados! Próximo passo: Application Fee.\n${data.payment_link ?? `${dash}/student`}`,
    };

    // ── 08 ────────────────────────────────────────────────────────────────────
    case "forms_generated": return {
      subject: "Formulários prontos — assine digitalmente",
      emailHtml: emailWrapper("Formulários para assinatura", `
        <p>Olá, ${highlight(firstName)}!</p>
        <p>Os formulários da sua candidatura foram gerados e estão prontos para assinatura digital.</p>
        <p>Acesse o portal, revise cada formulário e assine. Após a assinatura, o pacote será enviado automaticamente ao MatriculaUSA.</p>
        ${btn("Assinar formulários", data.app_url ?? `${dash}/student/forms`)}
      `),
      whatsapp: `📄 *Migma* — Formulários prontos!\n\nOlá ${firstName}, seus formulários estão prontos para assinatura digital. Acesse: ${data.app_url ?? `${dash}/student/forms`}`,
    };

    // ── 09 ────────────────────────────────────────────────────────────────────
    case "package_sent_matriculausa": return {
      subject: "Pacote enviado ao MatriculaUSA — aguarde processamento",
      emailHtml: emailWrapper("Pacote enviado", `
        <p>Olá, ${highlight(firstName)}!</p>
        <p>Seu pacote de candidatura foi <strong>enviado ao MatriculaUSA</strong> para processamento.</p>
        <p>A partir daqui, o escritório de admissões irá processar seu I-20 / Carta de Aceite. Assim que pronto, você será notificado.</p>
        ${btn("Acompanhar status", `${dash}/student`)}
      `),
      whatsapp: `🚀 *Migma* — Pacote enviado!\n\nOlá ${firstName}, seu pacote foi enviado ao MatriculaUSA. Aguarde o processamento do seu I-20. Acompanhe: ${dash}/student`,
    };

    // ── 10 ────────────────────────────────────────────────────────────────────
    case "new_pending_task": return {
      subject: "Nova pendência — ação necessária na sua conta",
      emailHtml: emailWrapper("Nova pendência", `
        <p>Olá, ${highlight(firstName)}!</p>
        <p>O time Migma criou uma nova pendência na sua conta que precisa da sua atenção:</p>
        ${data.task_description ? `<p style="background:#1a1a1a;border-left:3px solid #f5a623;padding:12px 16px;border-radius:4px;color:#ddd;">${data.task_description}</p>` : ""}
        ${btn("Resolver pendência", `${dash}/student`)}
      `),
      whatsapp: `🔔 *Migma* — Nova pendência\n\nOlá ${firstName}${data.task_description ? `: ${data.task_description}` : ", há uma pendência na sua conta"}.\n\nAcesse: ${dash}/student`,
    };

    // ── 11 ────────────────────────────────────────────────────────────────────
    case "deadline_alert_transfer": return {
      subject: `Alerta de prazo — ${data.days_remaining} dia(s) para seu Transfer`,
      emailHtml: emailWrapper("Alerta de prazo — Transfer", `
        <p>Olá, ${highlight(firstName)}!</p>
        <p>Atenção: você tem <strong>${data.days_remaining} dia(s)</strong> antes do prazo limite do seu processo de Transfer.</p>
        <p>Certifique-se de que todos os documentos e etapas estão completos para evitar complicações no processo.</p>
        ${btn("Verificar meu processo", `${dash}/student`)}
      `),
      whatsapp: `⏰ *Migma* — Alerta de prazo!\n\nOlá ${firstName}, faltam *${data.days_remaining} dia(s)* para o prazo do seu Transfer. Verifique seu progresso: ${dash}/student`,
    };

    // ── 12 ────────────────────────────────────────────────────────────────────
    case "deadline_alert_cos": return {
      subject: `Alerta de prazo — ${data.days_remaining} dia(s) para expirar seu I-94 / COS`,
      emailHtml: emailWrapper("Alerta de prazo — COS / I-94", `
        <p>Olá, ${highlight(firstName)}!</p>
        <p>Atenção: seu I-94 / prazo de mudança de status (COS) expira em <strong>${data.days_remaining} dia(s)</strong>.</p>
        <p>É fundamental que todas as etapas do processo estejam concluídas antes desta data.</p>
        ${btn("Verificar meu processo", `${dash}/student`)}
      `),
      whatsapp: `⏰ *Migma* — Prazo COS urgente!\n\nOlá ${firstName}, seu I-94 expira em *${data.days_remaining} dia(s)*. Verifique urgentemente: ${dash}/student`,
    };

    // ── 13 ────────────────────────────────────────────────────────────────────
    case "dependent_pending": return {
      subject: "Pendência de dependente — dados ou documentos necessários",
      emailHtml: emailWrapper("Pendência de dependente", `
        <p>Olá, ${highlight(firstName)}!</p>
        <p>Há uma pendência relacionada a <strong>dependentes</strong> na sua conta:</p>
        ${data.task_description ? `<p style="background:#1a1a1a;border-left:3px solid #f5a623;padding:12px 16px;border-radius:4px;color:#ddd;">${data.task_description}</p>` : "<p>Por favor, acesse o portal para verificar os dados ou documentos necessários.</p>"}
        ${btn("Resolver pendência", `${dash}/student`)}
      `),
      whatsapp: `👨‍👩‍👧 *Migma* — Pendência de dependente\n\nOlá ${firstName}${data.task_description ? `: ${data.task_description}` : ", há pendência de dados de dependente"}.\n\nAcesse: ${dash}/student`,
    };

    // ── 14 ────────────────────────────────────────────────────────────────────
    case "referral_goal_reached": return {
      subject: "Parabéns! Você atingiu 10 indicações — tuition reduzida",
      emailHtml: emailWrapper("Meta de indicações atingida!", `
        <p>Olá, ${highlight(firstName)}!</p>
        <p>🏆 Incrível! Você atingiu a meta de <strong>10 indicações</strong> fechadas!</p>
        <p>Como prometido, sua tuition Migma foi <strong>reduzida automaticamente</strong>. O desconto já está aplicado na sua conta.</p>
        ${btn("Ver minha conta", `${dash}/student/rewards`)}
      `),
      whatsapp: `🏆 *Migma* — Meta atingida!\n\nParabéns ${firstName}! Você fechou 10 indicações e sua tuition foi reduzida automaticamente. Veja: ${dash}/student/rewards`,
    };

    // ── 15 ────────────────────────────────────────────────────────────────────
    case "new_referral_closed": return {
      subject: `Nova indicação fechada — ${data.closures_count ?? "?"} no total`,
      emailHtml: emailWrapper("Nova indicação fechada", `
        <p>Olá, ${highlight(firstName)}!</p>
        <p>Sua indicação <strong>${data.referral_name ?? "recente"}</strong> foi convertida em cliente Migma!</p>
        <p>Você tem agora <strong>${data.closures_count ?? "?"} indicação(ões)</strong> no total. Continue indicando para zerar sua tuition!</p>
        ${btn("Ver meu painel de rewards", `${dash}/student/rewards`)}
      `),
      whatsapp: `🎯 *Migma* — Indicação fechada!\n\nOlá ${firstName}, ${data.referral_name ?? "sua indicação"} acaba de virar cliente! Total: *${data.closures_count ?? "?"}* indicações. Veja: ${dash}/student/rewards`,
    };

    // ── 16 — ADMIN ────────────────────────────────────────────────────────────
    case "admin_new_documents": return {
      subject: `[Admin] Novos documentos para revisão — ${data.client_name ?? "cliente"}`,
      emailHtml: emailWrapper("[Admin] Novos documentos", `
        <p>Novos documentos foram enviados por <strong>${data.client_name ?? "cliente"}</strong> e aguardam revisão.</p>
        ${data.client_id ? btn("Revisar documentos", `${dash}/admin/users/${data.client_id}`) : ""}
      `),
      whatsapp: `📥 *Migma Admin* — Novos documentos\n\n${data.client_name ?? "Cliente"} enviou documentos para revisão.\n${data.client_id ? `${dash}/admin/users/${data.client_id}` : dash}`,
    };

    // ── 17 — ADMIN ────────────────────────────────────────────────────────────
    case "admin_package_complete": return {
      subject: `[Admin] Pacote completo — ${data.client_name ?? "cliente"} pronto para MatriculaUSA`,
      emailHtml: emailWrapper("[Admin] Pacote completo", `
        <p>O pacote de <strong>${data.client_name ?? "cliente"}</strong> está completo e pronto para envio ao MatriculaUSA.</p>
        ${data.client_id ? btn("Ver pacote", `${dash}/admin/users/${data.client_id}`) : ""}
      `),
      whatsapp: `✅ *Migma Admin* — Pacote completo\n\n${data.client_name ?? "Cliente"} tem pacote pronto para MatriculaUSA.\n${data.client_id ? `${dash}/admin/users/${data.client_id}` : dash}`,
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
        ${btn("Acessar minha conta", `${dash}/student`)}
      `),
      whatsapp: `💳 *Migma* — Billing ativado!\n\nOlá ${firstName}, sua mensalidade de *US$ ${data.monthly_usd?.toLocaleString("en-US") ?? "–"}* em ${data.installments_total ?? "–"}x foi configurada. Você receberá o link de pagamento mensalmente. Dúvidas: ${dash}/student`,
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
          : `<p style="color:#888;">Link de pagamento em processamento. Acesse ${dash}/student para mais informações.</p>`}
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
        ${btn("Falar com o time Migma", `${dash}/student`)}
      `),
      whatsapp: `⚠️ *Migma* — Billing suspenso\n\nOlá ${firstName}, seu plano de mensalidades foi suspenso.${data.suspend_reason ? `\n\nMotivo: ${data.suspend_reason}` : ""}\n\nEntre em contato: ${dash}/student`,
    };

    // ── 18 — ADMIN ────────────────────────────────────────────────────────────
    case "admin_no_university_match": return {
      subject: `[Admin] ⚠️ Cliente sem Caroline/Oikos — intervenção necessária: ${data.client_name ?? "cliente"}`,
      emailHtml: emailWrapper("[Admin] Sem universidade compatível", `
        <p>⚠️ <strong>${data.client_name ?? "Cliente"}</strong> não teve match com Caroline University nem Oikos University.</p>
        <p>Intervenção humana necessária para definir alternativa.</p>
        ${data.client_id ? btn("Ver perfil do cliente", `${dash}/admin/users/${data.client_id}`) : ""}
      `),
      whatsapp: `⚠️ *Migma Admin* — Sem match universitário\n\n${data.client_name ?? "Cliente"} não tem Caroline/Oikos disponível. Intervenção necessária.\n${data.client_id ? `${dash}/admin/users/${data.client_id}` : dash}`,
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
    let whatsappResult: { sent: boolean; reason?: string } = { sent: false, reason: "no_phone" };
    if (recipientPhone) {
      whatsappResult = await sendWhatsApp(recipientPhone, template.whatsapp);
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
