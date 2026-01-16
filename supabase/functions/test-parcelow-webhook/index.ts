import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TestWebhookRequest {
    order_id: string; // visa_orders.id (UUID)
    parcelow_order_id?: number; // Optional: simulated Parcelow order ID
    amount_paid_brl?: number; // Optional: simulated amount paid in BRL
}

Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        console.log('🧪 [TEST WEBHOOK] Starting simulated Parcelow payment approval...');

        // Initialize Supabase client
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Parse request body
        const body: TestWebhookRequest = await req.json();
        const { order_id, parcelow_order_id, amount_paid_brl } = body;

        if (!order_id) {
            throw new Error('Missing required field: order_id');
        }

        console.log(`🧪 [TEST WEBHOOK] Processing order: ${order_id}`);

        // 1. Fetch the order from database
        const { data: order, error: fetchError } = await supabase
            .from('visa_orders')
            .select('*')
            .eq('id', order_id)
            .single();

        if (fetchError || !order) {
            throw new Error(`Order not found: ${order_id}`);
        }

        console.log(`🧪 [TEST WEBHOOK] Order found: ${order.order_number}`);
        console.log(`🧪 [TEST WEBHOOK] Current status: ${order.order_status}`);

        // 2. Prepare simulated payment data
        const simulatedParcelowId = parcelow_order_id || Math.floor(Math.random() * 90000) + 10000;
        const simulatedAmountBRL = amount_paid_brl || (order.total_price_usd * 5.5); // Simple conversion

        const paymentMetadata = {
            ...(order.payment_metadata || {}),
            parcelow_order_id: simulatedParcelowId,
            total_brl: simulatedAmountBRL,
            base_brl: simulatedAmountBRL * 0.95, // Simulate base without fees
            simulated: true,
            simulated_at: new Date().toISOString(),
            test_mode: true,
        };

        console.log(`🧪 [TEST WEBHOOK] Simulated Parcelow Order ID: ${simulatedParcelowId}`);
        console.log(`🧪 [TEST WEBHOOK] Simulated Amount (BRL): R$ ${(simulatedAmountBRL / 100).toFixed(2)}`);

        // 3. Update order status to completed
        const { error: updateError } = await supabase
            .from('visa_orders')
            .update({
                // order_status: 'completed', // Column does not exist
                payment_status: 'paid',
                parcelow_status: 'Completed',
                payment_metadata: paymentMetadata,
                parcelow_order_id: simulatedParcelowId.toString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', order_id);

        if (updateError) {
            throw new Error(`Failed to update order: ${updateError.message}`);
        }

        console.log(`🧪 [TEST WEBHOOK] ✅ Order status updated to 'completed'`);

        // 4. Trigger contract generation (if needed)
        // The database trigger should handle this automatically when status changes to 'completed'
        console.log(`🧪 [TEST WEBHOOK] 📄 Contract generation will be triggered by database trigger`);

        // 5. Return success response
        return new Response(
            JSON.stringify({
                success: true,
                message: 'Payment approved successfully (TEST MODE)',
                data: {
                    order_id: order.id,
                    order_number: order.order_number,
                    parcelow_order_id: simulatedParcelowId,
                    amount_paid_brl: simulatedAmountBRL,
                    status: 'completed',
                    payment_status: 'paid',
                    test_mode: true,
                },
            }),
            {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        );
    } catch (error) {
        console.error('🧪 [TEST WEBHOOK] ❌ Error:', error);

        return new Response(
            JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }),
            {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        );
    }
});
