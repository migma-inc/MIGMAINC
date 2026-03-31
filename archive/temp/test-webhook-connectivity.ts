// Script para testar se o webhook está acessível e funcionando
// Simula exatamente o que a Parcelow deveria enviar

const WEBHOOK_URL = "https://ekxftwrjvxtpnqbraszv.supabase.co/functions/v1/parcelow-webhook";

// Payload mínimo que a Parcelow envia
const payload = {
    event: "event_order_paid",
    data: {
        id: 99999, // ID de teste
        reference: "TEST-WEBHOOK",
        status: 1,
        status_text: "Paid",
        order_amount: 40000,
        total_usd: 44086
    }
};

console.log("🧪 Testando webhook...");
console.log("URL:", WEBHOOK_URL);
console.log("Payload:", JSON.stringify(payload, null, 2));

async function testWebhook() {
    try {
        const response = await fetch(WEBHOOK_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        console.log("\n📡 Resposta:");
        console.log("Status:", response.status, response.statusText);

        const text = await response.text();
        console.log("Body:", text);

        if (response.ok) {
            console.log("\n✅ Webhook está FUNCIONANDO!");
            console.log("👉 O problema é que a Parcelow não está chamando.");
        } else {
            console.log("\n❌ Webhook retornou erro.");
            console.log("👉 Verifique os logs no Supabase Dashboard.");
        }

    } catch (error) {
        console.error("\n❌ Erro ao chamar webhook:", error);
        console.log("👉 Verifique se a URL está correta.");
    }
}

testWebhook();
