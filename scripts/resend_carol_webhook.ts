import axios from 'axios';

/**
 * Script para reenviar os webhooks da Carol Anne Rosa para o n8n.
 * Ordem: ORD-INT-20260311233249-805
 */

const WEBHOOK_URL = "https://n8n.wartully.com.br/webhook/mentoriamigma";

const payloads = [
  // Dependente 1: Miguel
  {
    "tipo": "dependente",
    "nome_completo_cliente_principal": "Carol Anne Rosa",
    "nome_completo_dependente": "Miguel Rosa Da Silva",
    "valor_servico": "150.00",
    "servico": "Change of Status - Full Process Payment",
    "plano_servico": "Change of Status - Full Process Payment",
    "email": "carolannerosa84@icloud.com",
    "whatsapp": "+14075876748",
    "vendedor": "Seller"
  },
  // Dependente 2: Davi
  {
    "tipo": "dependente",
    "nome_completo_cliente_principal": "Carol Anne Rosa",
    "nome_completo_dependente": "Davi Rosa Da Silva",
    "valor_servico": "150.00",
    "servico": "Change of Status - Full Process Payment",
    "plano_servico": "Change of Status - Full Process Payment",
    "email": "carolannerosa84@icloud.com",
    "whatsapp": "+14075876748",
    "vendedor": "Seller"
  },
  // Payload Principal: Carol Anne
  {
    "servico": "Change of Status - Full Process Payment",
    "plano_servico": "Change of Status - Full Process Payment",
    "nome_completo": "Carol Anne Rosa",
    "whatsapp": "+14075876748",
    "email": "carolannerosa84@icloud.com",
    "valor_servico": "2200.00",
    "vendedor": "Seller",
    "quantidade_dependentes": 2
  }
];

async function resendWebhooks() {
  console.log(`🚀 Iniciando reenvio de ${payloads.length} webhooks para: ${WEBHOOK_URL}\n`);

  for (const [index, payload] of payloads.entries()) {
    const label = payload.tipo === 'dependente' 
      ? `Dependente: ${payload.nome_completo_dependente}` 
      : `Principal: ${payload.nome_completo}`;

    try {
      console.log(`[${index + 1}/${payloads.length}] Enviando ${label}...`);
      const response = await axios.post(WEBHOOK_URL, payload);
      console.log(`✅ Sucesso! Status: ${response.status}`);
    } catch (error: any) {
      console.error(`❌ Erro ao enviar ${label}:`, error.response?.status || error.message);
      if (error.response?.data) {
        console.error('Detalhes do erro:', error.response.data);
      }
    }
  }

  console.log('\n🏁 Processo concluído.');
}

resendWebhooks();
