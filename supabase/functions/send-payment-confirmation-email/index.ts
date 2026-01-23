import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    console.log("[Payment Confirmation] Function started");
    console.log("[Payment Confirmation] Request method:", req.method);

    const {
      clientName,
      clientEmail,
      orderNumber,
      productSlug,
      totalAmount,
      paymentMethod,
      currency,
      finalAmount
    } = await req.json();

    console.log("[Payment Confirmation] Received data:", {
      clientName,
      clientEmail,
      orderNumber,
      productSlug,
      totalAmount,
      paymentMethod,
      currency,
      finalAmount
    });

    if (!clientName || !clientEmail || !orderNumber || !paymentMethod) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Get Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    console.log("[Payment Confirmation] Environment check:", {
      supabaseUrl: supabaseUrl ? "✓ Set" : "✗ Missing",
      supabaseServiceKey: supabaseServiceKey ? `✓ Set (length: ${supabaseServiceKey.length})` : "✗ Missing",
    });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log("[Payment Confirmation] Supabase client created with Service Role Key");


    // Get Supabase URL for logo
    const logoUrl = `${supabaseUrl}/storage/v1/object/public/logo/logo2.png`;

    // Escape HTML to prevent XSS
    const escapeHtml = (text: string) => {
      if (!text) return "";
      return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    };

    const safeClientName = escapeHtml(clientName);
    const safeClientEmail = escapeHtml(clientEmail);
    const safeOrderNumber = escapeHtml(orderNumber);
    const safeProductSlug = escapeHtml(productSlug || "Visa Service");

    // Determine currency and amount
    // If currency and finalAmount are provided, use them (for Stripe payments with fees)
    // Otherwise, use totalAmount (for Zelle, which has no fees)
    const orderCurrency = currency || (paymentMethod === "stripe_pix" || paymentMethod === "pix" ? "BRL" : "USD");
    const displayAmount = finalAmount ? parseFloat(finalAmount) : parseFloat(totalAmount || "0");
    const safeTotalAmount = displayAmount.toFixed(2);

    // Format currency symbol
    const currencySymbol = (orderCurrency === "BRL" || orderCurrency === "brl") ? "R$" : "US$";

    // Format payment method for display
    // Also check currency to ensure correct method (PIX should show as PIX, not Card)
    const paymentMethodDisplay = (() => {
      // For Parcelow, always show Parcelow regardless of currency
      if (paymentMethod === "parcelow") {
        return "Parcelow";
      }

      // If currency is BRL, it's definitely PIX (for Stripe)
      if (orderCurrency === "BRL" || orderCurrency === "brl") {
        return "PIX";
      }

      switch (paymentMethod) {
        case "stripe_card":
        case "card":
          return "Credit/Debit Card";
        case "stripe_pix":
        case "pix":
          return "PIX";
        case "zelle":
          return "Zelle";
        default:
          return paymentMethod;
      }
    })();

    // Call send-email function with MIGMA standard template
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, &quot;Helvetica Neue&quot;, Arial, sans-serif; background-color: #000000;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #000000;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; background-color: #000000; border-radius: 8px;">
                    <!-- Logo Header -->
                    <tr>
                        <td align="center" style="padding: 40px 20px 30px; background-color: #000000;">
                            <img src="${logoUrl}" alt="MIGMA Logo" width="200" style="display: block; max-width: 200px; height: auto;">
                        </td>
                    </tr>
                    <!-- Main Content -->
                    <tr>
                        <td style="padding: 0 40px 40px; background-color: #000000;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="padding: 30px; background: linear-gradient(135deg, #1a1a1a 0%, #000000 100%); border-radius: 8px; border: 1px solid #CE9F48;">
                                        <h1 style="margin: 0 0 20px 0; font-size: 28px; font-weight: bold; color: #F3E196; text-align: center; background: linear-gradient(180deg, #8E6E2F 0%, #F3E196 25%, #CE9F48 50%, #F3E196 75%, #8E6E2F 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                                            Payment Confirmed
                                        </h1>
                                        <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                            Hello <strong style="color: #CE9F48;">${safeClientName}</strong>,
                                        </p>
                                        <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                            We are pleased to confirm that your payment has been received and processed successfully.
                                        </p>
                                        <!-- Payment Details Box -->
                                            <tr>
                                                <td style="padding: 20px; background-color: #1a1a1a; border-left: 4px solid #CE9F48; border-radius: 4px; margin: 20px 0;">
                                                    <p style="margin: 0 0 10px 0; color: #CE9F48; font-weight: bold; font-size: 16px;">Order Number:</p>
                                                    <p style="margin: 0 0 20px 0; color: #e0e0e0; font-size: 14px; line-height: 1.6;">
                                                        ${safeOrderNumber}
                                                    </p>
                                                    <p style="margin: 0 0 10px 0; color: #CE9F48; font-weight: bold; font-size: 16px;">Product:</p>
                                                    <p style="margin: 0 0 20px 0; color: #e0e0e0; font-size: 14px; line-height: 1.6;">
                                                        ${safeProductSlug}
                                                    </p>
                                                    <p style="margin: 0 0 10px 0; color: #CE9F48; font-weight: bold; font-size: 16px;">Payment Method:</p>
                                                    <p style="margin: 0 0 20px 0; color: #e0e0e0; font-size: 14px; line-height: 1.6;">
                                                        ${paymentMethodDisplay}
                                                    </p>
                                                    <p style="margin: 0 0 10px 0; color: #CE9F48; font-weight: bold; font-size: 16px;">Total Amount:</p>
                                                    <p style="margin: 0; color: #e0e0e0; font-size: 18px; line-height: 1.6; font-weight: bold;">
                                                        ${currencySymbol} ${safeTotalAmount}
                                                    </p>
                                                </td>
                                            </tr>
                                        </table>

                                        <p style="margin: 20px 0 0 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                            Our team will contact you shortly at <strong style="color: #CE9F48;">${safeClientEmail}</strong> to begin processing your visa application.
                                        </p>
                                        <p style="margin: 20px 0 0 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                            Thank you for choosing MIGMA INC.!
                                        </p>
                                        <p style="margin: 20px 0 0 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                            Best regards,<br>
                                            <strong style="color: #CE9F48;">MIGMA INC. Team</strong>
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td align="center" style="padding: 20px 40px; background-color: #000000;">
                            <p style="margin: 0; font-size: 12px; color: #666666; line-height: 1.5;">
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

    // Invoke send-email function using fetch directly with Service Role Key
    console.log("[Payment Confirmation] Preparing to invoke send-email function");
    console.log("[Payment Confirmation] Email payload:", {
      to: clientEmail,
      subject: `Payment Confirmed - Order ${safeOrderNumber}`,
      htmlLength: emailHtml.length,
    });

    try {
      console.log("[Payment Confirmation] Invoking send-email via fetch with Service Role Key...");
      const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
          "apikey": supabaseServiceKey,
        },
        body: JSON.stringify({
          to: clientEmail,
          subject: `Payment Confirmed - Order ${safeOrderNumber}`,
          html: emailHtml,
        }),
      });

      console.log("[Payment Confirmation] Email response status:", emailResponse.status);

      if (!emailResponse.ok) {
        const errorText = await emailResponse.text();
        console.error("[Payment Confirmation] Email error details:", {
          status: emailResponse.status,
          statusText: emailResponse.statusText,
          errorBody: errorText,
        });
        // Don't fail if email fails, just log it
      } else {
        const emailData = await emailResponse.json();
        console.log("[Payment Confirmation] Email sent successfully:", emailData);
      }
    } catch (emailErr) {
      console.error("[Payment Confirmation] Exception sending email:", {
        errorType: emailErr.constructor.name,
        errorMessage: emailErr.message,
        errorStack: emailErr.stack,
      });
      // Don't fail if email fails, just log it
    }

    return new Response(
      JSON.stringify({ success: true, message: "Payment confirmation email sent" }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("[Payment Confirmation] Exception:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});

