/**
 * Script de Teste: Simulador de Fluxo de Split Payments
 * Como usar: 
 * 1. Certifique-se de que o Supabase CLI está rodando localmente (supabase functions serve)
 * 2. Configure as variáveis abaixo
 * 3. Execute: node test-split-flow.js
 */

const SUPABASE_URL = "https://ekxftwrjvxtpnqbraszv.supabase.co"; // URL de produção do Supabase
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVreGZ0d3Jqdnh0cG5xYnJhc3p2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDY4Njc4MSwiZXhwIjoyMDgwMjYyNzgxfQ.ANP7P9uOZiBTgSCjZoM2VjeaC_Z9Svrzt_901ycA5vQ"; 

async function simulateSplitFlow() {
    console.log("🚀 Iniciando Simulação de Split Payment...");

    // 1. Criar um pedido Mock (ou usar um ID existente)
    // Para simplificar, este script assume que você já tem um order_id de teste no DB.
    const orderId = "d4982b46-b6b7-4aa4-a8ac-c0872c3d3b1f"; 

    console.log(`\n1. Chamando create-split-parcelow-checkout para Order: ${orderId}`);
    
    try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/create-split-parcelow-checkout`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
                'Origin': 'https://app.migmainc.com',
                'Referer': 'https://app.migmainc.com/'
            },
            body: JSON.stringify({
                order_id: orderId,
                part1_amount: 500,
                part1_method: 'card',
                part2_amount: 500,
                part2_method: 'pix',
                parcelow_environment: 'staging'
            })
        });
        const responseText = await response.text();
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            data = { error: responseText };
        }

        if (!response.ok) {
            console.error('❌ Erro na Edge Function:', responseText);
            throw new Error(`Edge Function returned a non-2xx status code: ${response.status}`);
        }
        console.log("✅ Split iniciado com sucesso!");
        console.log("🔗 Part 1 URL:", data.part1_checkout_url);
        console.log("🆔 Split Payment ID:", data.split_payment_id);

        const splitPaymentId = data.split_payment_id;

        // 2. Simular confirmação da Parte 1 via Webhook
        console.log("\n2. Simulando Webhook de confirmação da PART 1...");
        await simulateWebhook(splitPaymentId, 1, "authorized");

        // 3. Simular confirmação da Parte 2 via Webhook
        console.log("\n3. Simulando Webhook de confirmação da PART 2...");
        await simulateWebhook(splitPaymentId, 2, "authorized");

        console.log("\n✨ Fluxo de teste concluído! Verifique o dashboard de contratos.");

    } catch (error) {
        console.error("❌ Erro na simulação:", error.message);
    }
}

async function simulateWebhook(splitPaymentId, partNumber, status) {
    const payload = {
        event: "order.status_changed",
        data: {
            object: {
                id: `mock_parcelow_${splitPaymentId}_part${partNumber}`,
                status: status,
                external_id: `SPLIT_${splitPaymentId}_P${partNumber}` // Formato esperado pela nossa function
            }
        }
    };

    const response = await fetch(`${SUPABASE_URL}/functions/v1/parcelow-webhook`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify(payload)
    });

    if (response.ok) {
        console.log(`✅ Webhook Parte ${partNumber} enviado (${status})`);
    } else {
        const err = await response.text();
        console.error(`❌ Erro ao enviar webhook Parte ${partNumber}:`, err);
    }
}

simulateSplitFlow(); 
