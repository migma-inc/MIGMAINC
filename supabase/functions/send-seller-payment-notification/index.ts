import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
    // Handle CORS
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        console.log("[Seller Notification] Function started");

        const {
            sellerEmail,
            sellerName,
            orderNumber,
            clientName,
            productSlug,
            totalAmount,
            paymentMethod,
            currency,
            finalAmount
        } = await req.json();

        if (!sellerEmail || !orderNumber) {
            return new Response(
                JSON.stringify({ error: "Missing required fields" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Get Supabase client
        const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Get Supabase URL for logo
        const logoUrl = `${supabaseUrl}/storage/v1/object/public/logo/logo2.png`;

        // Escape HTML
        const escapeHtml = (text: string | null | undefined) => {
            if (!text) return "";
            return String(text)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        };

        const safeSellerName = escapeHtml(sellerName || "Partner");
        const safeOrderNumber = escapeHtml(orderNumber);
        const safeClientName = escapeHtml(clientName || "Client");
        const safeProductSlug = escapeHtml(productSlug || "Visa Service");

        // Determine currency and amount
        const orderCurrency = (currency || "USD").toUpperCase();
        const displayAmount = finalAmount ? parseFloat(finalAmount) : parseFloat(totalAmount || "0");
        
        const formatCurrencyAmount = (amount: number, curr: string) => {
            if (curr === "BRL") {
                return amount.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
            }
            return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        };

        const safeTotalAmount = formatCurrencyAmount(displayAmount, orderCurrency);
        const currencySymbol = orderCurrency === "BRL" ? "R$" : "US$";

        // Format payment method
        const paymentMethodDisplay = (() => {
            if (paymentMethod === "parcelow") return "International Split Payment";
            if (paymentMethod === "stripe_pix" || paymentMethod === "pix") return "PIX";
            if (paymentMethod === "stripe_card" || paymentMethod === "card") return "Credit/Debit Card";
            if (paymentMethod === "zelle") return "Zelle";
            return paymentMethod || "Confirmed Method";
        })();

        // Email HTML (Premium Black & Gold)
        const emailHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #000000; color: #e0e0e0;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #000000;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; background-color: #000000; border-radius: 8px;">
                    <!-- Logo Header -->
                    <tr>
                        <td align="center" style="padding: 0px 20px 40px;">
                            <img src="${logoUrl}" alt="MIGMA Logo" width="180" style="display: block; max-width: 180px; height: auto;">
                        </td>
                    </tr>
                    <!-- Main Content -->
                    <tr>
                        <td style="padding: 0;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="padding: 40px; background: linear-gradient(135deg, #121212 0%, #000000 100%); border-radius: 12px; border: 1px solid #CE9F48; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                                        <h1 style="margin: 0 0 24px 0; font-size: 26px; font-weight: 700; color: #F3E196; text-align: center; text-transform: uppercase; letter-spacing: 1px;">
                                            New Payment Received! 🎉
                                        </h1>
                                        
                                        <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #ffffff;">
                                            Hello <strong style="color: #CE9F48;">${safeSellerName}</strong>,
                                        </p>
                                        
                                        <p style="margin: 0 0 30px 0; font-size: 16px; line-height: 1.6; color: #b0b0b0;">
                                            Congratulations! One of your sales has been successfully paid and confirmed.
                                        </p>
                                        
                                        <!-- Details Table -->
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: rgba(206, 159, 72, 0.05); border-radius: 8px; border: 1px dashed rgba(206, 159, 72, 0.3);">
                                            <tr>
                                                <td style="padding: 24px;">
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                        <tr>
                                                            <td style="padding-bottom: 15px;">
                                                                <span style="color: #CE9F48; font-size: 12px; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 4px;">Order Number</span>
                                                                <span style="color: #ffffff; font-size: 15px; font-weight: 500;">${safeOrderNumber}</span>
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td style="padding-bottom: 15px;">
                                                                <span style="color: #CE9F48; font-size: 12px; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 4px;">Client Name</span>
                                                                <span style="color: #ffffff; font-size: 15px; font-weight: 500;">${safeClientName}</span>
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td style="padding-bottom: 15px;">
                                                                <span style="color: #CE9F48; font-size: 12px; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 4px;">Visa Service</span>
                                                                <span style="color: #ffffff; font-size: 15px; font-weight: 500;">${safeProductSlug}</span>
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td style="padding-bottom: 15px;">
                                                                <span style="color: #CE9F48; font-size: 12px; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 4px;">Payment Method</span>
                                                                <span style="color: #ffffff; font-size: 15px; font-weight: 500;">${paymentMethodDisplay}</span>
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td>
                                                                <span style="color: #CE9F48; font-size: 12px; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 4px;">Total Value</span>
                                                                <span style="color: #F3E196; font-size: 22px; font-weight: 700;">${currencySymbol} ${safeTotalAmount}</span>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                        </table>
                                        
                                        <p style="margin: 30px 0 0 0; font-size: 15px; line-height: 1.6; color: #b0b0b0; text-align: center;">
                                            You can track this sale and your commissions in your personalized dashboard.
                                        </p>
                                        
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top: 30px;">
                                            <tr>
                                                <td align="center">
                                                    <p style="margin: 0; font-size: 16px; font-weight: 600; color: #CE9F48;">MIGMA INC.</p>
                                                    <p style="margin: 4px 0 0 0; font-size: 14px; color: #666666;">Empowering your global journey</p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td align="center" style="padding: 30px 40px;">
                            <p style="margin: 0; font-size: 11px; color: #444444; text-transform: uppercase; letter-spacing: 1px;">
                                © 2026 MIGMA INC. Confidential Property.
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

        // Send email
        const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${supabaseServiceKey}`,
                "apikey": supabaseServiceKey,
            },
            body: JSON.stringify({
                to: sellerEmail,
                subject: `Sale Confirmed! Order #${safeOrderNumber}`,
                html: emailHtml,
            }),
        });

        const emailResult = await emailResponse.json();
        console.log("[Seller Notification] Result:", emailResult);

        return new Response(
            JSON.stringify({ success: true }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("[Seller Notification] Exception:", error);
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});

