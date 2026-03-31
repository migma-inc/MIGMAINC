// ==========================================
// CONFIGURATION
// ==========================================
// ==========================================
// CONFIGURATION
// ==========================================
// PRODUCTION URL - n8n DO CLIENTE PRINCIPAL (WARTULLY)
const WEBHOOK_URL = "https://n8n.wartully.com.br/webhook/mentoriamigma"; 
const DELAY_MS = 60000; // 1 minute between requests (60,000 ms)

const products = [
  { slug: "initial-selection-process", name: "U.S. Visa - Initial Application - Selection Process", base_price_usd: "400.00" },
  { slug: "canada-work", name: "Canada Work Consultancy (Main applicant)", base_price_usd: "1800.00" },
  { slug: "b1-revolution", name: "U.S. B1 Revolution Plan (Main applicant)", base_price_usd: "299.00" },
  { slug: "rfe-defense", name: "RFE Defense", base_price_usd: "0.00" },
  { slug: "visa-retry-defense", name: "Defense per applicant – retry after refused visa", base_price_usd: "0.00" },
  { slug: "initial-scholarship", name: "U.S. Visa - Initial Application - Scholarship", base_price_usd: "900.00" },
  { slug: "initial-i20-control", name: "U.S. Visa - Initial Application - I-20 Control", base_price_usd: "900.00" },
  { slug: "cos-selection-process", name: "U.S. Visa - Change of Status - Selection Process", base_price_usd: "400.00" },
  { slug: "cos-scholarship", name: "U.S. Visa - Change of Status - Scholarship", base_price_usd: "900.00" },
  { slug: "cos-i20-control", name: "U.S. Visa - Change of Status - I-20 Control", base_price_usd: "900.00" },
  { slug: "transfer-selection-process", name: "U.S. Visa - Transfer - Selection Process", base_price_usd: "400.00" },
  { slug: "transfer-scholarship", name: "U.S. Visa - Transfer - Scholarship", base_price_usd: "900.00" },
  { slug: "transfer-i20-control", name: "U.S. Visa - Transfer - I-20 Control", base_price_usd: "900.00" },
  { slug: "consultation-brant", name: "Consulta com Matheus Brant", base_price_usd: "500.00" },
  { slug: "o1-visa", name: "U.S. Visa O-1 (Main applicant)", base_price_usd: "11000.00" },
  { slug: "e2-l1-visa", name: "U.S. Visa E-2, L-1 (Main applicant)", base_price_usd: "12999.00" },
  { slug: "eb2-visa", name: "EB-2 - Full Process Payment", base_price_usd: "24750.00" },
  { slug: "canada-tourist-premium", name: "Canada Tourist Visa – Premium Plan (Main applicant)", base_price_usd: "900.00" },
  { slug: "b1-premium", name: "U.S. B1 Premium Plan (Main applicant)", base_price_usd: "900.00" },
  { slug: "scholarship-maintenance-fee", name: "Scholarship Maintenance Fee", base_price_usd: "105.00" },
  { slug: "eb3-step-initial", name: "EB-3 Step Plan – Initial Payment (Contract & Annex)", base_price_usd: "5000.00" },
  { slug: "eb3-step-catalog", name: "EB-3 Step Plan – Job Catalog Delivery Payment (Annex)", base_price_usd: "5000.00" },
  { slug: "canada-tourist-revolution", name: "Canada Tourist Visa – Revolution ETA (Main applicant)", base_price_usd: "299.00" },
  { slug: "consultation-common", name: "Common consultation", base_price_usd: "29.00" },
  { slug: "eb3-visa", name: "EB-3 - Full Process Payment", base_price_usd: "23750.00" },
  { slug: "eb3-installment-catalog", name: "EB-3 Installment Plan – Job Catalog Delivery Payment (Annex)", base_price_usd: "3000.00" },
  { slug: "eb3-installment-monthly", name: "EB-3 Installment Plan – Monthly Installment (Annex)", base_price_usd: "650.00" },
  { slug: "eb3-installment-initial", name: "EB-3 Installment Plan – Initial Payment (Contract & Annex)", base_price_usd: "3000.00" },
  { slug: "visto-b1-b2", name: "Guia Visto Americano B1/B2", base_price_usd: "200.00" },
  { slug: "visto-f1", name: "Guia Visto Americano F-1", base_price_usd: "350.00" },
  { slug: "extensao-status", name: "Guia Extensão de Status (I-539)", base_price_usd: "200.00" },
  { slug: "troca-status", name: "Guia Troca de Status", base_price_usd: "350.00" },
  { slug: "eb2-niw-initial-payment", name: "U.S. Visa EB-2 (Main Applicant) – Initial Payment", base_price_usd: "5000.00" },
  { slug: "INITIAL Application - Full Process Payment", name: "INITIAL Application - Full Process Payment", base_price_usd: "2200.00" },
  { slug: "Change of Status - Full Process Payment", name: "Change of Status - Full Process Payment", base_price_usd: "2200.00" },
  { slug: "TRANSFER - Full Process Payment", name: "TRANSFER - Full Process Payment", base_price_usd: "2200.00" }
];

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeServiceName(productSlug, productName) {
  if (productSlug.startsWith('initial-')) return 'F1 Initial';
  if (productSlug.startsWith('cos-') || productSlug.startsWith('transfer-')) return 'COS & Transfer';
  return productName;
}

async function runTests() {
  console.log(`🚀 Starting series of ${products.length} tests to: ${WEBHOOK_URL}`);
  console.log(`⏱️ Interval per request: ${DELAY_MS / 1000} seconds\n`);

  for (let i = 0; i < products.length; i++) {
    const product = products[i];

    const serviceName = normalizeServiceName(product.slug, product.name);

    const payload = {
      servico: serviceName,
      plano_servico: product.slug,
      nome_completo_cliente_principal: "Cliente Teste Automatizado",
      whatsapp: "+5531999999999",
      email: "teste-webhook@migmainc.com",
      valor_servico: product.base_price_usd,
      vendedor: "TEST-BOT-ADMIN",
      quantidade_dependentes: 0
    };

    try {
      const timestamp = new Date().toLocaleTimeString();
      console.log(`[${timestamp}] [${i + 1}/${products.length}] 📤 Enviando payload para: ${product.slug}...`);

      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        console.log(`✅ [HTTP ${response.status}] SUCESSO! O n8n recebeu o payload de "${product.slug}".`);
      } else {
        console.error(`❌ [HTTP ${response.status}] ERRO no n8n ao processar "${product.slug}".`);
        const text = await response.text();
        console.error(`   Detalhes do erro:`, text);
      }
    } catch (error) {
      console.error(`🚨 [ERRO DE REDE] Falha ao tentar conectar com a URL "${WEBHOOK_URL}" para o serviço "${product.slug}":`, error.message);
    }

    if (i < products.length - 1) {
      console.log(`😴 Waiting ${DELAY_MS / 1000} seconds...`);
      await sleep(DELAY_MS);
    }
  }

  console.log("\n✨ All tests completed!");
}

runTests();
