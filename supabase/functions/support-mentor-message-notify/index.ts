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
};

type StudentProfile = {
  id: string;
  user_id: string | null;
  full_name: string | null;
  email: string | null;
  mentor_id: string | null;
};

type MentorProfile = {
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

function normalizeBaseUrl(value: string | null | undefined): string {
  return (value || "https://migmainc.com").replace(/\/+$/, "");
}

function cleanString(value: unknown): string {
  return String(value ?? "").trim();
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

function buildMentorEmail(args: {
  mentorName: string;
  studentName: string;
  studentEmail: string;
  crmUrl: string;
}) {
  const mentorName = escapeHtml(args.mentorName);
  const studentName = escapeHtml(args.studentName);
  const studentEmail = escapeHtml(args.studentEmail);
  const crmUrl = escapeHtml(args.crmUrl);

  const subject = `[Migma Support] Nova mensagem de ${args.studentName}`;
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nova mensagem no suporte</title>
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
              <h1 style="margin:0 0 18px;color:#F3E196;font-size:24px;line-height:1.25;text-align:center;">Nova mensagem no suporte</h1>
              <p style="margin:0 0 14px;color:#d1d5db;font-size:15px;line-height:1.6;">Ola, <strong style="color:#ffffff;">${mentorName}</strong>.</p>
              <p style="margin:0 0 14px;color:#d1d5db;font-size:15px;line-height:1.6;">
                <strong style="color:#ffffff;">${studentName}</strong> enviou uma nova mensagem na conversa de suporte da Migma.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:22px 0;background:#151515;border:1px solid #2a2a2a;border-radius:8px;">
                <tr>
                  <td style="padding:16px 18px;">
                    <p style="margin:0 0 6px;color:#8aa0c6;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Aluno</p>
                    <p style="margin:0;color:#ffffff;font-size:16px;font-weight:700;">${studentName}</p>
                    <p style="margin:4px 0 0;color:#9ca3af;font-size:13px;">${studentEmail}</p>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 22px;color:#9ca3af;font-size:13px;line-height:1.6;">
                Este aviso e enviado somente para a primeira mensagem nao lida. Depois que voce abrir a conversa no CRM, a proxima mensagem do aluno gerara um novo aviso.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" align="center">
                <tr>
                  <td align="center" style="border-radius:6px;background:#CE9F48;">
                    <a href="${crmUrl}" style="display:inline-block;padding:14px 24px;color:#000000;text-decoration:none;font-weight:700;font-size:14px;">Abrir conversa no CRM</a>
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
    if (student.user_id !== userData.user.id) return json({ error: "profile_not_owned_by_user" }, 403);

    const { data: message, error: messageError } = await supabase
      .from("support_chat_messages")
      .select("id, profile_id, role, content, created_at")
      .eq("id", messageId)
      .eq("profile_id", profileId)
      .maybeSingle<SupportMessage>();

    if (messageError) return json({ error: "message_lookup_failed", detail: messageError.message }, 500);
    if (!message) return json({ error: "message_not_found" }, 404);
    if (message.role !== "user") return json({ ok: true, skipped: true, reason: "not_student_message" });

    if (!student.mentor_id) {
      return json({ ok: true, skipped: true, reason: "student_without_mentor" });
    }

    const { data: referralMentor, error: referralMentorError } = await supabase
      .from("referral_mentors")
      .select("profile_id, display_name, active")
      .eq("profile_id", student.mentor_id)
      .maybeSingle<ReferralMentor>();

    if (referralMentorError) {
      return json({ error: "referral_mentor_lookup_failed", detail: referralMentorError.message }, 500);
    }
    if (!referralMentor?.active) {
      return json({ ok: true, skipped: true, reason: "mentor_not_active" });
    }

    const { data: mentorProfile, error: mentorProfileError } = await supabase
      .from("user_profiles")
      .select("id, user_id, full_name, email")
      .eq("id", student.mentor_id)
      .maybeSingle<MentorProfile>();

    if (mentorProfileError) {
      return json({ error: "mentor_profile_lookup_failed", detail: mentorProfileError.message }, 500);
    }
    if (!mentorProfile?.user_id) {
      return json({ ok: true, skipped: true, reason: "mentor_without_auth_user" });
    }

    let mentorEmail = cleanString(mentorProfile.email);
    if (!mentorEmail) {
      const { data: mentorAuth } = await supabase.auth.admin.getUserById(mentorProfile.user_id);
      mentorEmail = cleanString(mentorAuth.user?.email);
    }

    if (!mentorEmail) {
      return json({ ok: true, skipped: true, reason: "mentor_without_email" });
    }

    const { data: receipt, error: receiptError } = await supabase
      .from("support_chat_read_receipts")
      .select("last_read_at, last_read_message_id")
      .eq("profile_id", profileId)
      .eq("viewer_user_id", mentorProfile.user_id)
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
      .from("support_chat_mentor_email_notifications")
      .insert({
        profile_id: profileId,
        mentor_user_id: mentorProfile.user_id,
        mentor_profile_id: mentorProfile.id,
        message_id: message.id,
        read_receipt_key: windowKey,
        read_receipt_last_read_at: currentReceipt?.last_read_at ?? null,
        sent_to_email: mentorEmail,
        status: "pending",
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single();

    if (notificationError) {
      if (notificationError.code === "23505") {
        return json({ ok: true, skipped: true, reason: "mentor_already_notified_for_unread_window" });
      }
      return json({ error: "notification_window_claim_failed", detail: notificationError.message }, 500);
    }

    const appBaseUrl = normalizeBaseUrl(Deno.env.get("APP_BASE_URL") || Deno.env.get("PUBLIC_APP_BASE_URL"));
    const crmUrl = `${appBaseUrl}/dashboard/users/${student.id}`;
    const studentName = cleanString(student.full_name) || cleanString(student.email) || "Student";
    const mentorName = firstName(referralMentor.display_name || mentorProfile.full_name || mentorEmail, "mentor");
    const template = buildMentorEmail({
      mentorName,
      studentName,
      studentEmail: cleanString(student.email) || "-",
      crmUrl,
    });

    const email = await sendEmail({
      supabaseUrl,
      serviceRoleKey,
      to: mentorEmail,
      subject: template.subject,
      html: template.html,
    });

    if (!email.success) {
      await supabase
        .from("support_chat_mentor_email_notifications")
        .delete()
        .eq("id", notification.id);

      return json({ error: "email_send_failed", detail: email.result }, 502);
    }

    const { error: updateError } = await supabase
      .from("support_chat_mentor_email_notifications")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        email_result: email.result,
        updated_at: new Date().toISOString(),
      })
      .eq("id", notification.id);

    if (updateError) {
      console.error("[support-mentor-message-notify] sent email but failed to update notification row", updateError);
    }

    return json({
      ok: true,
      sent: true,
      mentor_email: mentorEmail,
      profile_id: profileId,
      message_id: messageId,
      notification_id: notification.id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[support-mentor-message-notify] Unhandled error:", message);
    return json({ error: "internal_error", detail: message }, 500);
  }
});
