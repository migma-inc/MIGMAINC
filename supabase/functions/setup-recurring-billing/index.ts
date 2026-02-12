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
        const { order_id } = await req.json();

        const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        console.log(`[Setup Recurring] Processing order: ${order_id}`);

        // 1. Get order details
        const { data: order, error: orderError } = await supabase
            .from('visa_orders')
            .select('*')
            .eq('id', order_id)
            .single();

        if (orderError || !order) {
            console.error("[Setup Recurring] Order not found", orderError);
            return new Response(JSON.stringify({ error: "Order not found" }), { status: 404 });
        }

        // Check if schedule already exists
        const { data: existingSchedule } = await supabase
            .from('recurring_billing_schedules')
            .select('id')
            .eq('order_id', order.id)
            .maybeSingle();

        if (existingSchedule) {
            console.log("[Setup Recurring] Schedule already exists for this order");
            return new Response(JSON.stringify({ success: true, message: "Schedule already exists" }), { status: 200 });
        }

        // 2. Create Schedule
        // Default EB-3 Installment plan: 8 months (Updated per user request)
        const totalInstallments = 8;
        const amountPerInstallment = 650.00;

        const { data: schedule, error: scheduleError } = await supabase
            .from('recurring_billing_schedules')
            .insert({
                order_id: order.id,
                product_slug: order.product_slug,
                total_installments: totalInstallments,
                amount_per_installment: amountPerInstallment,
                status: 'active',
                next_billing_date: new Date(new Date().setMonth(new Date().getMonth() + 1))
            })
            .select()
            .single();

        if (scheduleError) {
            console.error("[Setup Recurring] Schedule error", scheduleError);
            return new Response(JSON.stringify({ error: scheduleError.message }), { status: 500 });
        }

        // 3. Generate Installments
        const installments = [];
        for (let i = 1; i <= totalInstallments; i++) {
            const dueDate = new Date();
            // Set to same day of next months
            dueDate.setMonth(dueDate.getMonth() + i);

            installments.push({
                schedule_id: schedule.id,
                installment_number: i,
                amount: amountPerInstallment,
                due_date: dueDate.toISOString().split('T')[0],
                status: 'pending'
            });
        }

        const { error: insError } = await supabase
            .from('billing_installments')
            .insert(installments);

        if (insError) {
            console.error("[Setup Recurring] Installments creation error", insError);
        }

        return new Response(
            JSON.stringify({ success: true, schedule_id: schedule.id }),
            {
                status: 200,
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
            }
        );

    } catch (error) {
        console.error("[Setup Recurring] Exception:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
});
