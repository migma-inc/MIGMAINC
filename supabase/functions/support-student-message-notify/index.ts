import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SupportMessage = {
  id: string;
  profile_id: string;
  role: string;
  content: string;
  created_at: string;
  sender_user_id: string | null;
  sender_display_name: string | null;
  sender_role_label: string | null;
};

type StudentProfile = {
  id: string;
  user_id: string | null;
  full_name: string | null;
  email: string | null;
  mentor_id: string | null;
};

type UserProfile = {
  id: string;
  user_id: string | null;
  full_name: string | null;
  email: string | null;
};

type ReferralMentor = {
  profile_id: string;
  display_name: string | null;
  active: boolean;
};

type ReadReceipt = {
  last_read_at: string | null;
  last_read_message_id: string | null;
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function getEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function getSupabaseUrl(): string {
  return Deno.env.get("MIGMA_REMOTE_URL") || getEnv("SUPABASE_URL");
}

function getServiceRoleKey(): string {
  return Deno.env.get("MIGMA_REMOTE_SERVICE_ROLE_KEY")
    || Deno.env.get("REMOTE_SUPABASE_SERVICE_ROLE_KEY")
    || getEnv("SUPABASE_SERVICE_ROLE_KEY");
}

function bearerToken(req: Request): string | null {
  const header = req.headers.get("Authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function cleanString(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeBaseUrl(value: string | null | undefined): string {
  return (value || "https://migmainc.com").replace(/\/+$/, "");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function firstName(value: string | null | undefined, fallback: string): string {
  const cleaned = cleanString(value);
  if (!cleaned) return fallback;
  return cleaned.split(/\s+/)[0] || fallback;
}

function metadataRole(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function isAdminRole(value: unknown): boolean {
  return ["admin", "superadmin", "super_admin"].includes(metadataRole(value));
}

function isAlreadyRead(receipt: ReadReceipt | null, message: SupportMessage): boolean {
  if (!receipt?.last_read_at) return false;
  const lastRead = Date.parse(receipt.last_read_at);
  const messageCreated = Date.parse(message.created_at);
  return Number.isFinite(lastRead) && Number.isFinite(messageCreated) && lastRead >= messageCreated;
}

function readReceiptKey(receipt: ReadReceipt | null): string {
  if (!receipt?.last_read_at) return "no-read-receipt";
  const timestamp = Date.parse(receipt.last_read_at);
  return Number.isFinite(timestamp)
    ? new Date(timestamp).toISOString()
    : receipt.last_read_at;
}

function buildStudentEmail(args: {
  studentName: string;
  senderName: string;
  senderLabel: string;
  supportUrl: string;
}) {
  const studentName = escapeHtml(args.studentName);
  const senderName = escapeHtml(args.senderName);
  const senderLabel = escapeHtml(args.senderLabel);
  const supportUrl = escapeHtml(args.supportUrl);
  const subject = `[Migma Support] New message / Nova mensagem / Nuevo mensaje`;
  const sections = [
    {
      label: "English",
      title: "New support message",
      greeting: "Hi",
      body: `<strong style="color:#ffffff;">${senderName}</strong> <span style="color:#9ca3af;">(${senderLabel})</span> sent a new message in your Migma support conversation.`,
      notice: "This notice is sent only for the first unread message. After you open support, the next team message will generate a new notice.",
    },
    {
      label: "Portugues",
      title: "Nova mensagem no suporte",
      greeting: "Ola",
      body: `<strong style="color:#ffffff;">${senderName}</strong> <span style="color:#9ca3af;">(${senderLabel})</span> enviou uma nova mensagem na sua conversa de suporte da Migma.`,
      notice: "Este aviso e enviado somente para a primeira mensagem nao lida. Depois que voce abrir o suporte, a proxima mensagem da equipe gerara um novo aviso.",
    },
    {
      label: "Espanol",
      title: "Nuevo mensaje en soporte",
      greeting: "Hola",
      body: `<strong style="color:#ffffff;">${senderName}</strong> <span style="color:#9ca3af;">(${senderLabel})</span> envio un nuevo mensaje en tu conversacion de soporte de Migma.`,
      notice: "Este aviso se envia solo para el primer mensaje no leido. Despues de abrir soporte, el proximo mensaje del equipo generara un nuevo aviso.",
    },
  ].map((section, index) => `
              ${index > 0 ? '<div style="height:1px;background:#2a2a2a;margin:24px 0 20px;"></div>' : ""}
              <p style="margin:0 0 10px;color:#CE9F48;font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;">${section.label}</p>
              <h1 style="margin:0 0 16px;color:#F3E196;font-size:22px;line-height:1.25;text-align:left;">${section.title}</h1>
              <p style="margin:0 0 14px;color:#d1d5db;font-size:15px;line-height:1.6;">${section.greeting}, <strong style="color:#ffffff;">${studentName}</strong>.</p>
              <p style="margin:0 0 14px;color:#d1d5db;font-size:15px;line-height:1.6;">
                ${section.body}
              </p>
              <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.6;">
                ${section.notice}
              </p>`).join("");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New message / Nova mensagem / Nuevo mensaje</title>
</head>
<body style="margin:0;padding:0;background:#000000;color:#e5e7eb;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#000000;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#0a0a0a;border:1px solid #CE9F48;border-radius:10px;">
          <tr>
            <td align="center" style="padding:34px 28px 18px;">
              <img src="https://migmainc.com/logo2.png" alt="MIGMA" width="150" style="display:block;border:0;max-width:150px;">
            </td>
          </tr>
          <tr>
            <td style="padding:0 34px 34px;">
              ${sections}
              <table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin-top:24px;">
                <tr>
                  <td align="center" style="border-radius:6px;background:#CE9F48;">
                    <a href="${supportUrl}" style="display:inline-block;padding:14px 24px;color:#000000;text-decoration:none;font-weight:700;font-size:14px;line-height:1.35;">Open support / Abrir suporte / Abrir soporte</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

async function sendEmail(args: {
  supabaseUrl: string;
  serviceRoleKey: string;
  to: string;
  subject: string;
  html: string;
}): Promise<{ success: boolean; result: Record<string, unknown> }> {
  const response = await fetch(`${args.supabaseUrl}/functions/v1/send-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${args.serviceRoleKey}`,
      "apikey": args.serviceRoleKey,
    },
    body: JSON.stringify({
      to: args.to,
      subject: args.subject,
      html: args.html,
    }),
  });

  const text = await response.text();
  let parsed: Record<string, unknown> = {};
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }
  }

  if (!response.ok || parsed.error || parsed.success === false) {
    return {
      success: false,
      result: {
        status: response.status,
        body: parsed,
      },
    };
  }

  return {
    success: true,
    result: {
      status: response.status,
      body: parsed,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = getServiceRoleKey();
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const token = bearerToken(req);
    if (!token) return json({ error: "missing_authorization" }, 401);

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return json({ error: "invalid_authorization", detail: userError?.message }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const profileId = cleanString(body.profile_id);
    const messageId = cleanString(body.message_id);

    if (!profileId || !messageId) {
      return json({ error: "missing_required_fields", required: ["profile_id", "message_id"] }, 400);
    }

    const { data: student, error: studentError } = await supabase
      .from("user_profiles")
      .select("id, user_id, full_name, email, mentor_id")
      .eq("id", profileId)
      .maybeSingle<StudentProfile>();

    if (studentError) return json({ error: "student_lookup_failed", detail: studentError.message }, 500);
    if (!student) return json({ error: "student_not_found" }, 404);
    if (!student.user_id) return json({ ok: true, skipped: true, reason: "student_without_auth_user" });

    const { data: message, error: messageError } = await supabase
      .from("support_chat_messages")
      .select("id, profile_id, role, content, created_at, sender_user_id, sender_display_name, sender_role_label")
      .eq("id", messageId)
      .eq("profile_id", profileId)
      .maybeSingle<SupportMessage>();

    if (messageError) return json({ error: "message_lookup_failed", detail: messageError.message }, 500);
    if (!message) return json({ error: "message_not_found" }, 404);
    if (message.role !== "admin" && message.role !== "mentor") {
      return json({ ok: true, skipped: true, reason: "not_human_team_message" });
    }
    if (message.sender_user_id && message.sender_user_id !== userData.user.id) {
      return json({ error: "message_not_sent_by_authenticated_user" }, 403);
    }

    const appRole = userData.user.app_metadata?.role;
    const isAdmin = isAdminRole(appRole);
    let isAssignedMentor = false;

    if (message.role === "mentor" || !isAdmin) {
      const { data: senderProfile, error: senderProfileError } = await supabase
        .from("user_profiles")
        .select("id, user_id, full_name, email")
        .eq("user_id", userData.user.id)
        .maybeSingle<UserProfile>();

      if (senderProfileError) {
        return json({ error: "sender_profile_lookup_failed", detail: senderProfileError.message }, 500);
      }

      if (senderProfile?.id && student.mentor_id === senderProfile.id) {
        const { data: referralMentor, error: referralMentorError } = await supabase
          .from("referral_mentors")
          .select("profile_id, display_name, active")
          .eq("profile_id", senderProfile.id)
          .maybeSingle<ReferralMentor>();

        if (referralMentorError) {
          return json({ error: "referral_mentor_lookup_failed", detail: referralMentorError.message }, 500);
        }

        isAssignedMentor = referralMentor?.active === true;
      }
    }

    if (!isAdmin && !isAssignedMentor) {
      return json({ error: "not_authorized_for_student_support" }, 403);
    }

    let studentEmail = cleanString(student.email);
    if (!studentEmail) {
      const { data: studentAuth } = await supabase.auth.admin.getUserById(student.user_id);
      studentEmail = cleanString(studentAuth.user?.email);
    }

    if (!studentEmail) {
      return json({ ok: true, skipped: true, reason: "student_without_email" });
    }

    const { data: receipt, error: receiptError } = await supabase
      .from("support_chat_read_receipts")
      .select("last_read_at, last_read_message_id")
      .eq("profile_id", profileId)
      .eq("viewer_user_id", student.user_id)
      .maybeSingle<ReadReceipt>();

    if (receiptError && receiptError.code !== "42P01" && receiptError.code !== "PGRST205") {
      return json({ error: "read_receipt_lookup_failed", detail: receiptError.message }, 500);
    }

    const currentReceipt = receiptError ? null : receipt;
    if (isAlreadyRead(currentReceipt, message)) {
      return json({ ok: true, skipped: true, reason: "message_already_read" });
    }

    const windowKey = readReceiptKey(currentReceipt);
    const now = new Date().toISOString();
    const { data: notification, error: notificationError } = await supabase
      .from("support_chat_student_email_notifications")
      .insert({
        profile_id: profileId,
        student_user_id: student.user_id,
        message_id: message.id,
        sender_user_id: message.sender_user_id ?? userData.user.id,
        sender_role: message.role,
        read_receipt_key: windowKey,
        read_receipt_last_read_at: currentReceipt?.last_read_at ?? null,
        sent_to_email: studentEmail,
        status: "pending",
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single();

    if (notificationError) {
      if (notificationError.code === "23505") {
        return json({ ok: true, skipped: true, reason: "student_already_notified_for_unread_window" });
      }
      return json({ error: "notification_window_claim_failed", detail: notificationError.message }, 500);
    }

    const appBaseUrl = normalizeBaseUrl(Deno.env.get("APP_BASE_URL") || Deno.env.get("PUBLIC_APP_BASE_URL"));
    const supportUrl = `${appBaseUrl}/student/dashboard/support`;
    const studentName = firstName(student.full_name || student.email, "student");
    const senderName = cleanString(message.sender_display_name) || (message.role === "mentor" ? "Migma Mentor" : "Migma Team");
    const senderLabel = cleanString(message.sender_role_label) || (message.role === "mentor" ? "Mentor" : "Migma Team");
    const template = buildStudentEmail({
      studentName,
      senderName,
      senderLabel,
      supportUrl,
    });

    const email = await sendEmail({
      supabaseUrl,
      serviceRoleKey,
      to: studentEmail,
      subject: template.subject,
      html: template.html,
    });

    if (!email.success) {
      await supabase
        .from("support_chat_student_email_notifications")
        .delete()
        .eq("id", notification.id);

      return json({ error: "email_send_failed", detail: email.result }, 502);
    }

    const { error: updateError } = await supabase
      .from("support_chat_student_email_notifications")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        email_result: email.result,
        updated_at: new Date().toISOString(),
      })
      .eq("id", notification.id);

    if (updateError) {
      console.error("[support-student-message-notify] sent email but failed to update notification row", updateError);
    }

    return json({
      ok: true,
      sent: true,
      student_email: studentEmail,
      profile_id: profileId,
      message_id: messageId,
      notification_id: notification.id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[support-student-message-notify] Unhandled error:", message);
    return json({ error: "internal_error", detail: message }, 500);
  }
});
