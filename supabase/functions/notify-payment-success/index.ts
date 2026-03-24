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
        const { orderNumber } = await req.json();

        if (!orderNumber) {
            return new Response(JSON.stringify({ error: "Missing orderNumber" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 1. Fetch Order Details
        const { data: order, error: orderError } = await supabase
            .from('visa_orders')
            .select('*')
            .eq('order_number', orderNumber)
            .maybeSingle();

        if (orderError || !order) {
            console.error("[Notify Success] Order not found:", orderNumber, orderError);
            return new Response(JSON.stringify({ error: "Order not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        console.log(`[Notify Success] Processing order ${orderNumber} for seller ${order.seller_id}`);

        // 2. Prepare Common Notification Data
        const commonData = {
            orderNumber: order.order_number,
            clientName: order.client_name,
            clientEmail: order.client_email,
            productSlug: order.product_slug,
            totalAmount: order.total_amount,
            paymentMethod: order.payment_method,
            currency: order.currency,
            finalAmount: order.final_amount,
            is_bundle: order.product_slug?.includes('bundle') || false, // Fallback if is_bundle is not in schema
            extraUnits: order.extra_units || 0
        };

        // 3. Trigger Client & Admin Notifications (Already existing functions)
        await Promise.all([
            supabase.functions.invoke("send-payment-confirmation-email", { body: commonData }),
            supabase.functions.invoke("send-admin-payment-notification", { body: commonData })
        ]);

        // 4. Handle Seller & HoS Notifications
        if (order.seller_id) {
            // Find the seller in the database
            const { data: seller, error: sellerError } = await supabase
                .from('sellers')
                .select('*')
                .eq('seller_id_public', order.seller_id)
                .maybeSingle();

            if (seller && !sellerError) {
                // Determine if it's an HoS sale or a regular seller sale
                if (seller.role === 'head_of_sales') {
                    // It's a sale by the HoS themselves
                    await supabase.functions.invoke("send-hos-payment-notification", {
                        body: {
                            ...commonData,
                            hosEmail: seller.email,
                            hosName: seller.full_name,
                            type: 'own_sale'
                        }
                    });
                    
                    // Also notify them as a seller to be safe (optional, but requested visual differentiation)
                    await supabase.functions.invoke("send-seller-payment-notification", {
                        body: {
                            ...commonData,
                            sellerEmail: seller.email,
                            sellerName: seller.full_name
                        }
                    });
                } else {
                    // It's a sale by a regular seller
                    // Notify the seller
                    await supabase.functions.invoke("send-seller-payment-notification", {
                        body: {
                            ...commonData,
                            sellerEmail: seller.email,
                            sellerName: seller.full_name
                        }
                    });

                    // Check if they have an HoS
                    if (seller.head_of_sales_id) {
                        const { data: hos, error: hosError } = await supabase
                            .from('sellers')
                            .select('*')
                            .eq('id', seller.head_of_sales_id)
                            .maybeSingle();

                        if (hos && !hosError) {
                            await supabase.functions.invoke("send-hos-payment-notification", {
                                body: {
                                    ...commonData,
                                    hosEmail: hos.email,
                                    hosName: hos.full_name,
                                    sellerName: seller.full_name,
                                    type: 'team_sale'
                                }
                            });
                        }
                    }
                }
            } else {
                console.warn("[Notify Success] Seller not found in database:", order.seller_id);
            }
        }

        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (error) {
        console.error("[Notify Success] Fatal error:", error);
        return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
});
