import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    try {
        const {
            hosEmail,
            hosName,
            sellerName,
            orderNumber,
            clientName,
            productSlug,
            totalAmount,
            paymentMethod,
            currency,
            finalAmount,
            type // 'own_sale' or 'team_sale'
        } = await req.json();

        if (!hosEmail || !orderNumber || !type) {
            return new Response(
                JSON.stringify({ error: "Missing required fields: hosEmail, orderNumber, type" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
        const logoUrl = `${supabaseUrl}/storage/v1/object/public/logo/logo2.png`;

        const escapeHtml = (text: string | null | undefined) => {
            if (!text) return "";
            return String(text)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        };

        const safeHosName = escapeHtml(hosName || "Head of Sales");
        const safeSellerName = escapeHtml(sellerName || "Partner");
        const safeOrderNumber = escapeHtml(orderNumber);
        const safeClientName = escapeHtml(clientName || "Client");
        const safeProductSlug = escapeHtml(productSlug || "Visa Service");

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

        const isOwnSale = type === 'own_sale';
        const titleText = isOwnSale ? "Direct Sale Confirmed! 🎯" : "Team Member Sale! 🚀";
        const heroMessage = isOwnSale 
            ? "Congratulations! You've just closed another direct sale." 
            : `Success! One of your team members, <span style="color:#F3E196; font-weight:700;">${safeSellerName}</span>, has completed a sale.`;

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
                        <td align="center" style="padding: 0px 20px 40px;">
                            <img src="${logoUrl}" alt="MIGMA Logo" width="180" style="display: block; max-width: 180px; height: auto;">
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 0;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="padding: 40px; background: linear-gradient(135deg, #121212 0%, #000000 100%); border-radius: 12px; border: 1px solid #CE9F48; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                                        <h1 style="margin: 0 0 24px 0; font-size: 26px; font-weight: 700; color: #F3E196; text-align: center; text-transform: uppercase;">
                                            ${titleText}
                                        </h1>
                                        <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #ffffff;">
                                            Hello <strong style="color: #CE9F48;">${safeHosName}</strong>,
                                        </p>
                                        <p style="margin: 0 0 30px 0; font-size: 16px; line-height: 1.6; color: #b0b0b0; text-align: center;">
                                            ${heroMessage}
                                        </p>
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: rgba(206, 159, 72, 0.05); border-radius: 8px; border: 1px dashed rgba(206, 159, 72, 0.3);">
                                            <tr>
                                                <td style="padding: 24px;">
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                        <tr><td style="padding-bottom: 15px;"><span style="color: #CE9F48; font-size: 12px; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 4px;">Order Status</span><span style="color: #4CAF50; font-size: 15px; font-weight: 700;">CONFIRMED</span></td></tr>
                                                        <tr><td style="padding-bottom: 15px;"><span style="color: #CE9F48; font-size: 12px; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 4px;">Order Number</span><span style="color: #ffffff; font-size: 15px;">${safeOrderNumber}</span></td></tr>
                                                        <tr><td style="padding-bottom: 15px;"><span style="color: #CE9F48; font-size: 12px; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 4px;">Client</span><span style="color: #ffffff; font-size: 15px;">${safeClientName}</span></td></tr>
                                                        ${!isOwnSale ? `<tr><td style="padding-bottom: 15px;"><span style="color: #CE9F48; font-size: 12px; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 4px;">Seller</span><span style="color: #ffffff; font-size: 15px;">${safeSellerName}</span></td></tr>` : ''}
                                                        <tr><td style="padding-bottom: 15px;"><span style="color: #CE9F48; font-size: 12px; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 4px;">Service</span><span style="color: #ffffff; font-size: 15px;">${safeProductSlug}</span></td></tr>
                                                        <tr><td><span style="color: #CE9F48; font-size: 12px; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 4px;">Total Value</span><span style="color: #F3E196; font-size: 22px; font-weight: 700;">${currencySymbol} ${safeTotalAmount}</span></td></tr>
                                                    </table>
                                                </td>
                                            </tr>
                                        </table>
                                        <p style="margin: 30px 0 0 0; font-size: 15px; line-height: 1.6; color: #b0b0b0; text-align: center;">
                                            Check your Leader Dashboard for specialized insights and metrics.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="padding: 30px 40px;">
                            <p style="margin: 0; font-size: 11px; color: #444444; text-transform: uppercase; letter-spacing: 1px;">
                                © 2026 MIGMA INC. Leadership Notification.
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

        await fetch(`${supabaseUrl}/functions/v1/send-email`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${supabaseServiceKey}`,
                "apikey": supabaseServiceKey,
            },
            body: JSON.stringify({
                to: hosEmail,
                subject: isOwnSale ? `Direct Sale Confirmed! #${safeOrderNumber}` : `Team Performance: New Sale by ${safeSellerName}`,
                html: emailHtml,
            }),
        });

        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (error) {
        return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
});
