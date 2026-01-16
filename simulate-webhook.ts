
// Script para simular o webhook da Parcelow enviando um evento order_paid
// Isso serve para testar a geração de PDF, Email e atualização do banco enquanto a Parcelow aprova manualmente.

import { createClient } from "npm:@supabase/supabase-js@2";

// URL da sua função (copiada do seu dashboard, com /functions/v1)
const WEBHOOK_URL = "https://ekxftwrjvxtpnqbraszv.supabase.co/functions/v1/parcelow-webhook";
const ORDER_ID = 12062; // ID do pedido travado na Parcelow (mas que existe no seu banco)

// Payload simulado conforme documentação da Parcelow
const eventPayload = {
    event: "event_order_paid",
    order: {
        id: ORDER_ID,
        reference: "ORD-20260115-4183", // Referência que vimos no log do checkout
        status: 1, // 1 = Paid
        status_text: "Paid",
        status_public: "Paid",
        order_amount: 40000,
        total_usd: 40000,
        total_brl: 233655,
        installments: 1,
        order_date: new Date().toISOString(),
        client: {
            name: "Simulação Teste",
            cpf: "000.000.000-00",
            email: "teste@simulacao.com"
        },
        items: [
            {
                description: "Serviço de Mentoria MIGMA (Simulação)",
                amount: 40000,
                quantity: 1
            }
        ]
    }
};

console.log("🚀 Iniciando simulação de Webhook (event_order_paid)...");
console.log("URL Alvo:", WEBHOOK_URL);
console.log("Payload:", JSON.stringify(eventPayload, null, 2));

async function sendWebhook() {
    try {
        const response = await fetch(WEBHOOK_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(eventPayload)
        });

        console.log(`\n📡 Status da Resposta: ${response.status} ${response.statusText}`);
        const text = await response.text();
        console.log("📦 Corpo da Resposta:", text);

        if (response.ok) {
            console.log("\n✅ Webhook simulado com sucesso!");
            console.log("👉 Verifique no seu banco de dados se o status mudou.");
            console.log("👉 Verifique se o PDF apareceu no Storage.");
            console.log("👉 Verifique se recebeu o e-mail.");
        } else {
            console.error("\n❌ Falha ao simular webhook.");
        }

    } catch (error) {
        console.error("\n❌ Erro de conexão:", error);
    }
}

sendWebhook();
