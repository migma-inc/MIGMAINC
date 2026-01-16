
import { createClient } from "npm:@supabase/supabase-js@2";

// Configurações
const CLIENT_ID = 212; // Confirmado que é numérico
const CLIENT_SECRET = "aivk8oGKuCkgFk0e3zl1fTNyEdAbu5ovR2EyH3kL";
const BASE_URL = "https://sandbox-2.parcelow.com.br";
const ORDER_ID = 12062; // O pedido que está travado

console.log("🔍 Iniciando debug do Pedido Parcelow:", ORDER_ID);

async function getAccessToken() {
    console.log("🔑 Obtendo token de acesso...");
    const authBody = {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'client_credentials'
    };

    const response = await fetch(`${BASE_URL}/oauth/token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify(authBody)
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Falha na autenticação: ${response.status} - ${text}`);
    }

    const data = await response.json();
    console.log("✅ Token obtido com sucesso.");
    return data.access_token;
}

async function checkOrderStatus() {
    try {
        const token = await getAccessToken();

        console.log(`📡 Consultando API: ${BASE_URL}/api/order/${ORDER_ID}`);
        const response = await fetch(`${BASE_URL}/api/order/${ORDER_ID}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            }
        });

        const text = await response.text();
        console.log("\n📦 RESPOSTA DA API (Raw):");
        console.log("---------------------------------------------------");
        console.log(text);
        console.log("---------------------------------------------------");

        try {
            const json = JSON.parse(text);
            console.log("\n📊 Análise do Status:");
            if (json.data) {
                console.log("Status ID:", json.data.status);
                console.log("Status Texto:", json.data.status_text);
                console.log("Status Público:", json.data.status_public);
                console.log("Última atualização:", json.data.updated_at);
                console.log("Pagamentos:", JSON.stringify(json.data.payments, null, 2));
                console.log("Histórico:", JSON.stringify(json.data.history_log, null, 2));
            }
        } catch (e) {
            console.log("Não foi possível fazer parse do JSON.");
        }

    } catch (error) {
        console.error("❌ Erro fatal:", error);
    }
}

checkOrderStatus();
