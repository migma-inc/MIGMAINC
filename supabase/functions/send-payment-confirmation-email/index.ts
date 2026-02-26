import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("[Payment Confirmation] Function started");

    const body = await req.json();
    const {
      clientName,
      clientEmail,
      orderNumber,
      productSlug,
      totalAmount,
      paymentMethod,
      currency,
      finalAmount,
      is_bundle,
      extraUnits
    } = body;

    console.log("[Payment Confirmation] Received data for:", { clientEmail, orderNumber });

    if (!clientName || !clientEmail || !orderNumber || !paymentMethod) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Escape HTML to prevent XSS
    const escapeHtml = (text: string) => {
      if (!text) return "";
      return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    };

    const safeClientName = escapeHtml(clientName);
    const safeClientEmail = escapeHtml(clientEmail);
    const safeOrderNumber = escapeHtml(orderNumber);

    let productDisplayText = productSlug || "Visa Service";
    if (is_bundle) productDisplayText += " + World Cup Bundle";
    if (extraUnits && extraUnits > 0) {
      productDisplayText += ` (+ ${extraUnits} Dependent${extraUnits > 1 ? 's' : ''})`;
    }
    const safeProductSlug = escapeHtml(productDisplayText);

    // Determine currency and amount
    const orderCurrency = currency || (paymentMethod === "stripe_pix" || paymentMethod === "pix" ? "BRL" : "USD");
    const displayAmount = finalAmount ? parseFloat(finalAmount) : parseFloat(totalAmount || "0");

    // Format amount based on currency standards
    const formatCurrencyAmount = (amount: number, curr: string) => {
      if (curr === "BRL" || curr === "brl") {
        return amount.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
      }
      return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const safeTotalAmount = formatCurrencyAmount(displayAmount, orderCurrency);
    const currencySymbol = (orderCurrency === "BRL" || orderCurrency === "brl") ? "R$" : "US$";

    // Format payment method for display
    const paymentMethodDisplay = (() => {
      if (paymentMethod === "parcelow") return "International Split Payment (Parcelow)";
      if (orderCurrency === "BRL" || orderCurrency === "brl") return "PIX";

      switch (paymentMethod) {
        case "stripe_card":
        case "card": return "Credit/Debit Card";
        case "stripe_pix":
        case "pix": return "PIX";
        case "zelle": return "Zelle";
        default: return paymentMethod;
      }
    })();

    const logoUrl = `${supabaseUrl}/storage/v1/object/public/logo/logo2.png`;

    // Email Template
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', sans-serif; background-color: #000000; color: #e0e0e0;">
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
                                        <h1 style="margin: 0 0 20px 0; font-size: 28px; font-weight: bold; color: #F3E196; text-align: center; background: linear-gradient(180deg, #8E6E2F 0%, #F3E196 25%, #CE9F48 50%, #F3E196 75%, #8E6E2F 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                                            Payment Confirmed
                                        </h1>
                                        <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">
                                            Hello <strong style="color: #CE9F48;">${safeClientName}</strong>,
                                        </p>
                                        <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">
                                            We are pleased to confirm that your payment has been received and processed successfully.
                                        </p>
                                        
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 20px 0;">
                                            <tr>
                                                <td style="padding: 20px; background-color: #1a1a1a; border-left: 4px solid #CE9F48; border-radius: 4px;">
                                                    <p style="margin: 0 0 5px 0; color: #CE9F48; font-weight: bold; font-size: 14px;">Order Number:</p>
                                                    <p style="margin: 0 0 15px 0; color: #e0e0e0; font-size: 14px;">${safeOrderNumber}</p>
                                                    
                                                    <p style="margin: 0 0 5px 0; color: #CE9F48; font-weight: bold; font-size: 14px;">Product:</p>
                                                    <p style="margin: 0 0 15px 0; color: #e0e0e0; font-size: 14px;">${safeProductSlug}</p>
                                                    
                                                    <p style="margin: 0 0 5px 0; color: #CE9F48; font-weight: bold; font-size: 14px;">Payment Method:</p>
                                                    <p style="margin: 0 0 15px 0; color: #e0e0e0; font-size: 14px;">${paymentMethodDisplay}</p>
                                                    
                                                    <p style="margin: 0 0 5px 0; color: #CE9F48; font-weight: bold; font-size: 14px;">Total Amount:</p>
                                                    <p style="margin: 0; color: #F3E196; font-size: 20px; font-weight: bold;">${currencySymbol} ${safeTotalAmount}</p>
                                                </td>
                                            </tr>
                                        </table>

                                        <p style="margin: 20px 0 0 0; font-size: 16px; line-height: 1.6;">
                                            Our team will contact you shortly at <strong style="color: #CE9F48;">${safeClientEmail}</strong> to begin processing your visa application.
                                        </p>
                                        <p style="margin: 20px 0 0 0; font-size: 16px; line-height: 1.6;">
                                            Thank you for choosing MIGMA INC.!
                                        </p>
                                        <p style="margin: 20px 0 0 0; font-size: 16px; line-height: 1.6;">
                                            Best regards,<br>
                                            <strong style="color: #CE9F48;">MIGMA INC. Team</strong>
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

    console.log(`[Payment Confirmation] Sending to ${clientEmail} (Order: ${orderNumber})`);

    const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        to: clientEmail,
        subject: `Payment Confirmed - Order ${safeOrderNumber}`,
        html: emailHtml,
      }),
    });

    const emailResult = await emailResponse.json();
    console.log("[Payment Confirmation] Email logic result:", emailResult);

    return new Response(JSON.stringify({ success: emailResult.success }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[Payment Confirmation] Fatal error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
