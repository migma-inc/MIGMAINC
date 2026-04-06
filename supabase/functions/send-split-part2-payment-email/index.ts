import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type EmailType = "initial" | "reminder";

interface SendSplitPart2EmailRequest {
  split_payment_id: string;
  email_type?: EmailType;
}

const REMINDER_DELAY_MS = 2 * 60 * 60 * 1000;

function escapeHtml(text: string | null | undefined) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatMethod(method: string | null | undefined) {
  switch (method) {
    case "card":
      return "Credit/Debit Card";
    case "pix":
      return "PIX";
    case "ted":
      return "Bank Transfer (TED)";
    default:
      return method || "Payment";
  }
}

function buildEmailHtml(params: {
  supabaseUrl: string;
  clientName: string;
  orderNumber: string;
  amountUsd: number;
  paymentMethod: string;
  checkoutUrl: string;
  emailType: EmailType;
}) {
  const title =
    params.emailType === "reminder"
      ? "Reminder: your second payment is still pending"
      : "Your second payment link is ready";
  const intro =
    params.emailType === "reminder"
      ? "We noticed that the second part of your split payment is still pending. You can continue your checkout using the button below."
      : "The first part of your split payment has been confirmed. You can now complete the second part using the button below.";
  const helper =
    params.emailType === "reminder"
      ? "If you already completed this payment, you can ignore this email."
      : "If your browser was closed or the redirect did not happen, this email keeps your journey active.";
  const cta =
    params.emailType === "reminder"
      ? "Complete Second Payment"
      : "Pay Second Part Now";
  const logoUrl = `${params.supabaseUrl}/storage/v1/object/public/logo/logo2.png`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', Arial, sans-serif; background-color: #000000;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #000000;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; background-color: #000000; border-radius: 8px;">
          <tr>
            <td align="center" style="padding: 0 20px 30px;">
              <img src="${logoUrl}" alt="MIGMA Logo" width="200" style="display: block; max-width: 200px; height: auto;">
            </td>
          </tr>
          <tr>
            <td style="padding: 30px; background: #1a1a1a; border-radius: 8px; border: 1px solid #CE9F48;">
              <h1 style="margin: 0 0 20px 0; font-size: 28px; font-weight: 700; color: #F3E196; text-align: center;">
                ${title}
              </h1>
              <p style="margin: 0 0 16px 0; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                Hello <strong style="color: #CE9F48;">${params.clientName}</strong>,
              </p>
              <p style="margin: 0 0 16px 0; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                ${intro}
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0;">
                <tr>
                  <td style="padding: 20px; background-color: #0f0f0f; border: 1px solid #2b2b2b; border-radius: 8px;">
                    <p style="margin: 0 0 6px 0; color: #CE9F48; font-size: 13px; font-weight: 700;">Order Number</p>
                    <p style="margin: 0 0 14px 0; color: #e0e0e0; font-size: 15px;">${params.orderNumber}</p>
                    <p style="margin: 0 0 6px 0; color: #CE9F48; font-size: 13px; font-weight: 700;">Second Payment Method</p>
                    <p style="margin: 0 0 14px 0; color: #e0e0e0; font-size: 15px;">${params.paymentMethod}</p>
                    <p style="margin: 0 0 6px 0; color: #CE9F48; font-size: 13px; font-weight: 700;">Second Payment Amount</p>
                    <p style="margin: 0; color: #F3E196; font-size: 24px; font-weight: 700;">US$ ${params.amountUsd.toFixed(2)}</p>
                  </td>
                </tr>
              </table>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${params.checkoutUrl}" style="display: inline-block; padding: 16px 36px; background: linear-gradient(180deg, #F3E196 0%, #CE9F48 100%); color: #000000; text-decoration: none; font-weight: 700; border-radius: 8px; font-size: 16px;">
                  ${cta}
                </a>
              </div>
              <p style="margin: 0; color: #b8b8b8; font-size: 14px; line-height: 1.6;">
                ${helper}
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
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: SendSplitPart2EmailRequest = await req.json();
    const splitPaymentId = body.split_payment_id;
    const emailType: EmailType = body.email_type === "reminder" ? "reminder" : "initial";

    if (!splitPaymentId) {
      return new Response(JSON.stringify({ error: "split_payment_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: splitPayment, error: splitError } = await supabase
      .from("split_payments")
      .select("*")
      .eq("id", splitPaymentId)
      .single();

    if (splitError || !splitPayment) {
      return new Response(JSON.stringify({ error: "Split payment not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (splitPayment.part1_payment_status !== "completed") {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "part1_not_completed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (splitPayment.part2_payment_status === "completed" || splitPayment.overall_status === "fully_completed") {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "part2_already_completed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: orderDetails, error: orderError } = await supabase
      .from("visa_orders")
      .select("order_number, client_name, client_email")
      .eq("id", splitPayment.order_id)
      .single();

    if (orderError || !orderDetails) {
      return new Response(JSON.stringify({ error: "Related order not found for split payment" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!orderDetails?.client_email || !splitPayment.part2_parcelow_checkout_url) {
      return new Response(JSON.stringify({ error: "Split payment is missing client email or part 2 checkout URL" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (emailType === "initial" && splitPayment.part2_checkout_email_sent_at) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "initial_email_already_sent" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (emailType === "reminder") {
      if (!splitPayment.part2_checkout_email_sent_at) {
        return new Response(JSON.stringify({ success: true, skipped: true, reason: "initial_email_not_sent" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (splitPayment.part2_checkout_email_reminder_sent_at) {
        return new Response(JSON.stringify({ success: true, skipped: true, reason: "reminder_email_already_sent" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const firstEmailSentAt = new Date(splitPayment.part2_checkout_email_sent_at).getTime();
      if (!Number.isFinite(firstEmailSentAt) || Date.now() - firstEmailSentAt < REMINDER_DELAY_MS) {
        return new Response(JSON.stringify({ success: true, skipped: true, reason: "reminder_window_not_reached" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const safeClientName = escapeHtml(orderDetails?.client_name || "Client");
    const safeOrderNumber = escapeHtml(orderDetails?.order_number || splitPayment.order_id);
    const formattedMethod = escapeHtml(formatMethod(splitPayment.part2_payment_method));
    const checkoutUrl = splitPayment.part2_parcelow_checkout_url;
    const amountUsd = Number(splitPayment.part2_amount_usd || 0);

    const emailHtml = buildEmailHtml({
      supabaseUrl,
      clientName: safeClientName,
      orderNumber: safeOrderNumber,
      amountUsd,
      paymentMethod: formattedMethod,
      checkoutUrl,
      emailType,
    });

    const subject =
      emailType === "reminder"
        ? `Reminder: complete the second payment for order ${safeOrderNumber}`
        : `Second payment link for order ${safeOrderNumber}`;

    const { data: emailData, error: emailError } = await supabase.functions.invoke("send-email", {
      body: {
        to: orderDetails.client_email,
        subject,
        html: emailHtml,
      },
    });

    if (emailError || emailData?.error) {
      throw new Error(emailError?.message || emailData?.error || "Failed to send split payment email");
    }

    const updatePayload =
      emailType === "reminder"
        ? {
            part2_checkout_email_reminder_sent_at: new Date().toISOString(),
            part2_checkout_email_send_count: (splitPayment.part2_checkout_email_send_count || 0) + 1,
          }
        : {
            part2_checkout_email_sent_at: new Date().toISOString(),
            part2_checkout_email_send_count: (splitPayment.part2_checkout_email_send_count || 0) + 1,
          };

    const { error: updateError } = await supabase
      .from("split_payments")
      .update(updatePayload)
      .eq("id", splitPaymentId);

    if (updateError) {
      throw new Error(`Email sent but failed to persist tracking fields: ${updateError.message}`);
    }

    return new Response(JSON.stringify({ success: true, sent: true, email_type: emailType }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[Split Part2 Email] Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
