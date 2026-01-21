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
        console.log("[Admin Notification] Function started");

        const {
            orderNumber,
            clientName,
            clientEmail,
            sellerName,
            productSlug,
            totalAmount,
            paymentMethod,
            currency,
            finalAmount
        } = await req.json();

        console.log("[Admin Notification] Received data:", {
            orderNumber,
            clientName,
            clientEmail,
            sellerName,
            productSlug,
            totalAmount,
            paymentMethod
        });

        if (!orderNumber) {
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

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Get all admin emails via RPC
        console.log("[Admin Notification] Fetching admin emails via RPC...");
        const { data: adminEmails, error: adminsError } = await supabase
            .rpc('get_admin_emails');

        if (adminsError) {
            console.error("[Admin Notification] Error fetching admins:", adminsError);
            return new Response(
                JSON.stringify({ error: "Failed to fetch admin users" }),
                {
                    status: 500,
                    headers: {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*",
                    },
                }
            );
        }

        const admins = adminEmails ? adminEmails.map((email: string) => ({ email, name: "Admin" })) : [];



        if (!admins || admins.length === 0) {
            console.warn("[Admin Notification] No admin users found");
            return new Response(
                JSON.stringify({ success: true, message: "No admins to notify" }),
                {
                    status: 200,
                    headers: {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*",
                    },
                }
            );
        }

        console.log(`[Admin Notification] Found ${admins.length} admin(s) to notify`);

        // Get Supabase URL for logo
        const logoUrl = `${supabaseUrl}/storage/v1/object/public/logo/logo2.png`;

        // Escape HTML
        const escapeHtml = (text: string) => {
            if (!text) return "";
            return text
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        };

        const safeOrderNumber = escapeHtml(orderNumber);
        const safeClientName = escapeHtml(clientName || "N/A");
        const safeClientEmail = escapeHtml(clientEmail || "N/A");
        const safeSellerName = escapeHtml(sellerName || "Direct Sale");
        const safeProductSlug = escapeHtml(productSlug || "Visa Service");

        // Determine currency and amount
        const orderCurrency = (currency || "USD").toUpperCase();
        const displayAmount = finalAmount ? parseFloat(finalAmount) : parseFloat(totalAmount || "0");
        const safeTotalAmount = displayAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const currencySymbol = orderCurrency === "BRL" ? "R$" : "US$";

        // Format payment method
        const paymentMethodDisplay = paymentMethod === "parcelow" ? "Parcelow" : paymentMethod;

        // Build email HTML template
        const buildEmailHtml = (adminName: string) => `
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
                                            New Payment Notification 💰
                                        </h1>
                                        <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                            Hello <strong style="color: #CE9F48;">${escapeHtml(adminName)}</strong>,
                                        </p>
                                        <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                            A new payment has been successfully processed on the platform.
                                        </p>
                                        <!-- Payment Details Box -->
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="padding: 20px; background-color: #1a1a1a; border-left: 4px solid #CE9F48; border-radius: 4px; margin: 20px 0;">
                                                    <p style="margin: 0 0 10px 0; color: #CE9F48; font-weight: bold; font-size: 16px;">Order Number:</p>
                                                    <p style="margin: 0 0 20px 0; color: #e0e0e0; font-size: 14px; line-height: 1.6;">
                                                        ${safeOrderNumber}
                                                    </p>
                                                    <p style="margin: 0 0 10px 0; color: #CE9F48; font-weight: bold; font-size: 16px;">Client:</p>
                                                    <p style="margin: 0 0 20px 0; color: #e0e0e0; font-size: 14px; line-height: 1.6;">
                                                        ${safeClientName} (${safeClientEmail})
                                                    </p>
                                                    <p style="margin: 0 0 10px 0; color: #CE9F48; font-weight: bold; font-size: 16px;">Seller:</p>
                                                    <p style="margin: 0 0 20px 0; color: #e0e0e0; font-size: 14px; line-height: 1.6;">
                                                        ${safeSellerName}
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
                                            You can view the complete order details in the admin dashboard.
                                        </p>
                                        <p style="margin: 20px 0 0 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                            Best regards,<br>
                                            <strong style="color: #CE9F48;">MIGMA Platform</strong>
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
                                © MIGMA. All rights reserved.
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

        // Send emails to all admins in parallel
        const emailPromises = admins.map(async (admin) => {
            try {
                const emailHtml = buildEmailHtml(admin.name || "Admin");

                const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${supabaseServiceKey}`,
                        "apikey": supabaseServiceKey,
                    },
                    body: JSON.stringify({
                        to: admin.email,
                        subject: `New Payment - Order ${safeOrderNumber}`,
                        html: emailHtml,
                    }),
                });

                if (!emailResponse.ok) {
                    const errorText = await emailResponse.text();
                    console.error(`[Admin Notification] Email error for ${admin.email}:`, errorText);
                    return { success: false, email: admin.email, error: errorText };
                } else {
                    const emailData = await emailResponse.json();
                    console.log(`[Admin Notification] Email sent successfully to ${admin.email}`);
                    return { success: true, email: admin.email };
                }
            } catch (emailErr) {
                console.error(`[Admin Notification] Exception sending email to ${admin.email}:`, emailErr);
                return { success: false, email: admin.email, error: emailErr instanceof Error ? emailErr.message : String(emailErr) };
            }
        });

        const results = await Promise.allSettled(emailPromises);
        const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;

        console.log(`[Admin Notification] Sent ${successCount}/${admins.length} emails successfully`);

        return new Response(
            JSON.stringify({
                success: true,
                message: `Admin notifications sent to ${successCount}/${admins.length} admins`,
                results: results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: 'Promise rejected' })
            }),
            {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
            }
        );
    } catch (error) {
        console.error("[Admin Notification] Exception:", error);
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
