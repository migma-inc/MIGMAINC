/**
 * Script de teste para re-enviar os dados do Igor Anderson da Costa (#ORD-20260308-8467) para o n8n.
 * Versão em JavaScript puro para execução rápida com Node.js.
 * 
 * Uso: node scripts/retrigger_igor_webhook.js
 */

import { createClient } from '@supabase/supabase-js';

// Configurações (Preencha se o .env não for carregado automaticamente)
const SUPABASE_URL = 'https://ekxftwrjvxtpnqbraszv.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVreGZ0d3Jqdnh0cG5xYnJhc3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2ODY3ODEsImV4cCI6MjA4MDI2Mjc4MX0.6DjFMOtKnB5BSJN4wnHTwTcQf-Rrci6XXyqhORhhGP0';

const supabase = createClient(SUPABASE_URL, ANON_KEY);

const ORDER_ID = '29a17596-c844-4ff5-b6ea-ceeabd8a7071';
const TEST_WEBHOOK_URL = 'https://nwh.suaiden.com/webhook/45665dbc-8751-41ff-afb8-6d17dd61d204';

function normalizeServiceName(productSlug, productName) {
    if (productSlug.startsWith('initial-')) return 'F1 Initial';
    if (productSlug.startsWith('cos-') || productSlug.startsWith('transfer-')) return 'COS & Transfer';
    return productName;
}

async function main() {
    console.log('🔄 Buscando dados do pedido ORD-20260308-8467 (Igor Anderson)...');

    const { data: order, error } = await supabase
        .from('visa_orders')
        .select('*')
        .eq('id', ORDER_ID)
        .single();

    if (error || !order) {
        console.error('❌ Erro ao buscar pedido:', error);
        return;
    }

    console.log('✅ Pedido encontrado:', order.order_number);

    // 1. Buscar nome do produto
    const { data: product } = await supabase
        .from('visa_products')
        .select('name')
        .eq('slug', order.product_slug)
        .single();

    const serviceName = normalizeServiceName(order.product_slug, product?.name || order.product_slug);

    // 2. Payload Principal
    const mainPayload = {
        servico: serviceName,
        plano_servico: order.product_slug,
        nome_completo_cliente_principal: order.client_name.trim(),
        whatsapp: order.client_whatsapp || '',
        email: order.client_email,
        valor_servico: parseFloat(order.base_price_usd || '0').toFixed(2),
        vendedor: order.seller_id || '',
        quantidade_dependentes: Array.isArray(order.dependent_names) ? order.dependent_names.length : 0,
    };

    console.log('\n📦 Payload Principal:');
    console.log(JSON.stringify(mainPayload, null, 2));

    // 3. Payloads dos Dependentes
    const dependents = [];
    if (Array.isArray(order.dependent_names) && order.dependent_names.length > 0) {
        let unitPrice = parseFloat(order.extra_unit_price_usd || '99.00');

        for (const depName of order.dependent_names) {
            if (!depName) continue;
            const depPayload = {
                tipo: "dependente",
                nome_completo_cliente_principal: order.client_name.trim(),
                nome_completo_dependente: depName.trim(),
                valor_servico: unitPrice.toFixed(2),
                servico: serviceName,
                plano_servico: order.product_slug,
                email: order.client_email,
                whatsapp: order.client_whatsapp || '',
                vendedor: order.seller_id || '',
            };
            dependents.push(depPayload);
        }
    }

    console.log(`\n📦 Preparados ${dependents.length} Payloads de Dependentes.`);

    console.log('\n🚀 ENVIANDO APENAS OS DEPENDENTES PARA O WEBHOOK DE TESTE...');
    
    // Enviar Dependentes
    for (const dep of dependents) {
        try {
            const respDep = await fetch(TEST_WEBHOOK_URL, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify(dep) 
            });
            console.log(`✅ Webhook Dependente (${dep.nome_completo_dependente}) enviado: ${respDep.status}`);
        } catch (e) {
            console.error(`❌ Erro enviando Dependente (${dep.nome_completo_dependente}):`, e.message);
        }
    }

    console.log('\n✨ Processo de teste concluído.');
}

main();
