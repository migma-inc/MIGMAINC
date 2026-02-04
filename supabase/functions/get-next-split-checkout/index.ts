import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GetNextCheckoutRequest {
    split_payment_id: string;
}

interface GetNextCheckoutResponse {
    success: boolean;
    has_next_checkout: boolean;
    next_checkout_url?: string;
    part_number?: number;
    overall_status?: string;
    message?: string;
    error?: string;
}

Deno.serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        console.log("[Get Next Checkout] 🔍 Buscando próximo checkout...");

        // Initialize Supabase client
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Parse request body
        const body: GetNextCheckoutRequest = await req.json();
        const { split_payment_id } = body;

        if (!split_payment_id) {
            throw new Error("split_payment_id é obrigatório");
        }

        console.log("[Get Next Checkout] 📦 Split Payment ID:", split_payment_id);

        // Buscar split payment
        const { data: splitPayment, error: splitError } = await supabase
            .from("split_payments")
            .select("*")
            .eq("id", split_payment_id)
            .single();

        if (splitError || !splitPayment) {
            throw new Error(`Split payment não encontrado: ${splitError?.message}`);
        }

        console.log("[Get Next Checkout] ✅ Split payment encontrado");
        console.log("[Get Next Checkout] 📊 Status:", splitPayment.overall_status);
        console.log("[Get Next Checkout] Part 1:", splitPayment.part1_payment_status);
        console.log("[Get Next Checkout] Part 2:", splitPayment.part2_payment_status);

        // Determinar qual é o próximo checkout
        let response: GetNextCheckoutResponse;

        // Caso 1: Part 1 ainda não foi paga
        if (splitPayment.part1_payment_status !== 'completed') {
            console.log("[Get Next Checkout] ➡️ Part 1 ainda não foi paga");

            response = {
                success: true,
                has_next_checkout: true,
                next_checkout_url: splitPayment.part1_parcelow_checkout_url,
                part_number: 1,
                overall_status: splitPayment.overall_status,
                message: "Redirecionando para Part 1 (primeiro pagamento)"
            };
        }
        // Caso 2: Part 1 paga, Part 2 pendente
        else if (splitPayment.part1_payment_status === 'completed' && splitPayment.part2_payment_status !== 'completed') {
            console.log("[Get Next Checkout] ➡️ Part 1 paga, redirecionando para Part 2");

            response = {
                success: true,
                has_next_checkout: true,
                next_checkout_url: splitPayment.part2_parcelow_checkout_url,
                part_number: 2,
                overall_status: splitPayment.overall_status,
                message: "Part 1 concluída! Redirecionando para Part 2 (segundo pagamento)"
            };
        }
        // Caso 3: Ambas as partes já foram pagas
        else if (splitPayment.part1_payment_status === 'completed' && splitPayment.part2_payment_status === 'completed') {
            console.log("[Get Next Checkout] ✅ Ambas as partes já foram pagas!");

            response = {
                success: true,
                has_next_checkout: false,
                overall_status: splitPayment.overall_status,
                message: "Pagamento completo! Ambas as partes foram pagas com sucesso."
            };
        }
        // Caso 4: Estado inesperado
        else {
            console.warn("[Get Next Checkout] ⚠️ Estado inesperado do split payment");

            response = {
                success: false,
                has_next_checkout: false,
                overall_status: splitPayment.overall_status,
                error: "Estado inesperado do split payment"
            };
        }

        console.log("[Get Next Checkout] 📤 Response:", response);

        return new Response(
            JSON.stringify(response),
            {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );

    } catch (error: any) {
        console.error("[Get Next Checkout] ❌ Erro:", error.message);
        console.error("[Get Next Checkout] Stack:", error.stack);

        const errorResponse: GetNextCheckoutResponse = {
            success: false,
            has_next_checkout: false,
            error: error.message || "Erro desconhecido ao buscar próximo checkout",
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
