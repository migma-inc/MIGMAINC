import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SplitCheckoutRequest {
    order_id: string;
    part1_amount: number;
    part1_method: 'card' | 'pix' | 'ted';
    part2_amount: number;
    part2_method: 'card' | 'pix' | 'ted';
}

interface SplitCheckoutResponse {
    success: boolean;
    split_payment_id?: string;
    part1_checkout_url?: string;
    part2_checkout_url?: string;
    error?: string;
}

Deno.serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        console.log("[Split Checkout] 📋 Iniciando criação de split payment...");

        // Initialize Supabase client
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error("Missing Supabase environment variables (URL or SERVICE_ROLE_KEY)");
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Parse request body
        const body: any = await req.json();
        const { order_id, part1_amount, part1_method, part2_amount, part2_method, parcelow_environment, app_url } = body;

        console.log("[Split Checkout] 📦 Request:", {
            order_id,
            part1: `${part1_method} - $${part1_amount}`,
            part2: `${part2_method} - $${part2_amount}`,
        });

        // Validar request
        if (!order_id || !part1_amount || !part1_method || !part2_amount || !part2_method) {
            throw new Error("Parâmetros obrigatórios faltando");
        }

        // 1. Buscar order do banco
        console.log("[Split Checkout] 🔍 Buscando order...");
        const { data: order, error: orderError } = await supabase
            .from("visa_orders")
            .select("*")
            .eq("id", order_id)
            .single();

        if (orderError || !order) {
            throw new Error(`Order não encontrada: ${orderError?.message}`);
        }

        console.log("[Split Checkout] ✅ Order encontrada:", order.order_number);

        // 2. Validar split usando função SQL
        console.log("[Split Checkout] 🔍 Validando split...");
        const { data: validation, error: validationError } = await supabase
            .rpc("validate_split_payment", {
                p_total_amount: parseFloat(order.total_price_usd),
                p_part1_amount: part1_amount,
                p_part2_amount: part2_amount,
                p_part1_method: part1_method,
                p_part2_method: part2_method,
            });

        if (validationError) {
            throw new Error(`Erro na validação: ${validationError.message}`);
        }

        if (validation && validation.length > 0 && !validation[0].is_valid) {
            throw new Error(`Validação falhou: ${validation[0].error_message}`);
        }

        console.log("[Split Checkout] ✅ Validação OK");

        // 3. Criar ou atualizar registro de split_payment
        console.log("[Split Checkout] 💾 Criando/Atualizando registro de split payment...");
        const { data: splitPayment, error: splitError } = await supabase
            .from("split_payments")
            .upsert({
                order_id: order.id,
                total_amount_usd: parseFloat(order.total_price_usd),
                split_count: 2,
                part1_amount_usd: part1_amount,
                part1_payment_method: part1_method,
                part2_amount_usd: part2_amount,
                part2_payment_method: part2_method,
                overall_status: 'pending', // Reset status as we are regenerating checkouts
                part2_checkout_email_sent_at: null,
                part2_checkout_email_reminder_sent_at: null,
                part2_checkout_email_send_count: 0,
            }, {
                onConflict: 'order_id',
                ignoreDuplicates: false // We want to update the data if it exists
            })
            .select()
            .single();

        if (splitError || !splitPayment) {
            throw new Error(`Erro ao criar split payment: ${splitError?.message}`);
        }

        console.log("[Split Checkout] ✅ Split payment criado:", splitPayment.id);

        // 4. Atualizar visa_orders com referência ao split
        const { error: updateOrderError } = await supabase
            .from("visa_orders")
            .update({
                is_split_payment: true,
                split_payment_id: splitPayment.id,
            })
            .eq("id", order.id);

        if (updateOrderError) {
            console.error("[Split Checkout] ⚠️ Erro ao atualizar order:", updateOrderError);
        }

        // 5. Criar primeiro checkout Parcelow (Part 1)
        console.log(`[Split Checkout] 🔄 Chamando create-parcelow-checkout para Part 1...`);
        // Usamos headers explícitos para garantir o bypass do JWT se o service_role for usado
        const { data: part1Data, error: part1Error } = await supabase.functions.invoke('create-parcelow-checkout', {
            headers: {
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'apikey': supabaseServiceKey,
            },
            body: {
                order_id: order.id,
                currency: 'USD',
                amount_usd: part1_amount,
                is_split_part: true,
                split_payment_id: splitPayment.id,
                split_part_number: 1,
                // Passamos o método de pagamento específico desta parte
                payment_method_override: part1_method,
                parcelow_environment: parcelow_environment,
                app_url,
            }
        });

        if (part1Error) {
            console.error(`[Split Checkout] ❌ Erro Part 1:`, part1Error);
            let detailedMsg = part1Error.message;
            try {
                const errBody = await part1Error.context.json();
                console.error(`[Split Checkout] ❌ Detalhes do Erro Part 1 (Body):`, errBody);
                if (errBody.error || errBody.message) {
                    detailedMsg = `${part1Error.message} - ${errBody.error || errBody.message}`;
                }
            } catch (e) {
                console.error(`[Split Checkout] ⚠️ Não foi possível ler o body do erro do checkout.`);
            }
            throw new Error(`Erro ao criar checkout Part 1: ${detailedMsg}`);
        }

        if (!part1Data?.order_id || !part1Data?.checkout_url) {
            console.error("[Split Checkout] Invalid Part 1 response:", part1Data);
            throw new Error("Checkout Part 1 retornou sem order_id ou checkout_url");
        }

        console.log(`[Split Checkout] ✅ Part 1 criada:`, part1Data.checkout_url);

        console.log(`[Split Checkout] 🔄 Chamando create-parcelow-checkout para Part 2...`);
        const { data: part2Data, error: part2Error } = await supabase.functions.invoke('create-parcelow-checkout', {
            headers: {
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'apikey': supabaseServiceKey,
            },
            body: {
                order_id: order.id,
                currency: 'USD',
                amount_usd: part2_amount,
                is_split_part: true,
                split_payment_id: splitPayment.id,
                split_part_number: 2,
                // Passamos o método de pagamento específico desta parte
                payment_method_override: part2_method,
                parcelow_environment: parcelow_environment,
                app_url,
            }
        });

        if (part2Error) {
            console.error(`[Split Checkout] ❌ Erro Part 2:`, part2Error);
            throw new Error(`Erro ao criar checkout Part 2: ${part2Error.message}`);
        }

        if (!part2Data?.order_id || !part2Data?.checkout_url) {
            console.error("[Split Checkout] Invalid Part 2 response:", part2Data);
            throw new Error("Checkout Part 2 retornou sem order_id ou checkout_url");
        }

        console.log("[Split Checkout] ✅ Checkout Part 2 criado:", part2Data.checkout_url);

        // 7. Atualizar split_payment com os IDs e URLs dos checkouts Parcelow
        console.log("[Split Checkout] 💾 Salvando IDs e URLs dos checkouts...");
        const { data: persistedSplitPayment, error: updateSplitError } = await supabase
            .from('split_payments')
            .update({
                part1_parcelow_order_id: part1Data.order_id?.toString(),
                part1_parcelow_checkout_url: part1Data.checkout_url,
                part1_parcelow_status: part1Data.status || 'Open',
                part1_payment_status: 'pending',
                part2_parcelow_order_id: part2Data.order_id?.toString(),
                part2_parcelow_checkout_url: part2Data.checkout_url,
                part2_parcelow_status: part2Data.status || 'Open',
                part2_payment_status: 'pending',
                overall_status: 'pending',
                part2_checkout_email_sent_at: null,
                part2_checkout_email_reminder_sent_at: null,
                part2_checkout_email_send_count: 0
            })
            .eq('id', splitPayment.id)
            .select(`
                id,
                overall_status,
                part1_parcelow_order_id,
                part1_parcelow_checkout_url,
                part2_parcelow_order_id,
                part2_parcelow_checkout_url
            `)
            .single();

        if (updateSplitError) {
            console.error("[Split Checkout] Failed to persist split payment checkout data:", updateSplitError);
            throw new Error(`Erro ao persistir dados do split payment: ${updateSplitError.message}`);
        }

        if (
            !persistedSplitPayment?.part1_parcelow_order_id ||
            !persistedSplitPayment?.part1_parcelow_checkout_url ||
            !persistedSplitPayment?.part2_parcelow_order_id ||
            !persistedSplitPayment?.part2_parcelow_checkout_url
        ) {
            console.error("[Split Checkout] Persisted split payment is missing checkout data:", persistedSplitPayment);
            throw new Error("Split payment foi criado, mas os dados dos checkouts não foram persistidos corretamente");
        }

        // 8. Retornar resposta de sucesso
        const response: SplitCheckoutResponse = {
            success: true,
            split_payment_id: splitPayment.id,
            part1_checkout_url: part1Data.checkout_url,
            part2_checkout_url: part2Data.checkout_url,
        };

        console.log("[Split Checkout] 🎉 Split payment criado com sucesso!");
        console.log("[Split Checkout] 📊 Response:", response);

        return new Response(
            JSON.stringify(response),
            {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );

    } catch (error: any) {
        console.error("[Split Checkout] ❌ Erro:", error.message);
        console.error("[Split Checkout] Stack:", error.stack);

        const errorResponse: SplitCheckoutResponse = {
            success: false,
            error: error.message || "Erro desconhecido ao criar split payment",
        };

        return new Response(
            JSON.stringify(errorResponse),
            {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    }
});
