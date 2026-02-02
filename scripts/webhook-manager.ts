
/**
 * MIGMA WEBHOOK MANAGER (STANDALONE)
 * 
 * Script para simular e disparar webhooks de aprovação de contrato.
 */

import { createClient } from '@supabase/supabase-js';

// Hardcoded fallbacks from .env
const SUPABASE_URL = 'https://ekxftwrjvxtpnqbraszv.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVreGZ0d3Jqdnh0cG5xYnJhc3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2ODY3ODEsImV4cCI6MjA4MDI2Mjc4MX0.6DjFMOtKnB5BSJN4wnHTwTcQf-Rrci6XXyqhORhhGP0';
const WEBHOOK_URL = 'https://nwh.suaiden.com/webhook/zelle-migma';

const supabase = createClient(SUPABASE_URL, ANON_KEY);

// Parsing simples de argumentos
const args = process.argv.slice(2);
const orderQuery = args.find(a => a.startsWith('--order='))?.split('=')[1];
const shouldSend = args.includes('--send');
const onlyDeps = args.includes('--only-dependents');
const manuallySpecifiedDeps = args.find(a => a.startsWith('--dependents='))?.split('=')[1]?.split(',').map(n => n.trim());

function normalizeServiceName(productSlug: string, productName: string): string {
    if (productSlug.startsWith('initial-')) return 'F1 Initial';
    if (productSlug.startsWith('cos-') || productSlug.startsWith('transfer-')) return 'COS & Transfer';
    return productName;
}

async function run() {
    console.log('\n--- 🛠️ MIGMA WEBHOOK MANAGER ---');

    if (!orderQuery) {
        console.error('❌ Erro: Especifique um pedido com --order=ID ou --order=ORD-NUM');
        process.exit(1);
    }

    console.log(`🔍 Buscando pedido: ${orderQuery}...`);

    // Busca por ID ou Order Number (Tratamento robusto de tipos)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderQuery);

    let query = supabase.from('visa_orders').select('*');
    if (isUuid) {
        query = query.or(`id.eq.${orderQuery},order_number.eq.${orderQuery}`);
    } else {
        query = query.eq('order_number', orderQuery);
    }

    const { data: order, error } = await query.single();

    if (error || !order) {
        console.error('❌ Pedido não encontrado ou erro no banco:', error?.message);
        process.exit(1);
    }

    console.log(`✅ Pedido encontrado: ${order.order_number} (${order.client_name})`);

    // 1. Normalização do Serviço
    const { data: product } = await supabase
        .from('visa_products')
        .select('name')
        .eq('slug', order.product_slug)
        .single();
    const serviceName = normalizeServiceName(order.product_slug, product?.name || order.product_slug);

    // 2. Preparação dos Dependentes
    const dependentNames = manuallySpecifiedDeps || order.dependent_names || [];

    // 3. Cálculo do Preço do Dependente
    let unitPrice = 0;
    const rawPrice = order.extra_unit_price_usd;
    if (typeof rawPrice === 'number') unitPrice = rawPrice;
    else if (typeof rawPrice === 'string') unitPrice = parseFloat(rawPrice);

    if (unitPrice === 0 && (order.extra_units > 0 || dependentNames.length > 0)) {
        const base = parseFloat(String(order.base_price_usd || '0'));
        const total = parseFloat(String(order.total_price_usd || '0'));
        const qty = order.extra_units || dependentNames.length;
        if (total > base && qty > 0) {
            unitPrice = (total - base) / qty;
        }
    }

    // 4. Montagem dos Payloads
    const mainPayload = {
        servico: serviceName,
        plano_servico: order.product_slug,
        nome_completo: order.client_name,
        whatsapp: order.client_whatsapp || '',
        email: order.client_email,
        valor_servico: (parseFloat(order.base_price_usd || '0')).toFixed(2),
        vendedor: order.seller_id || '',
        quantidade_dependentes: dependentNames.length,
    };

    const depPayloads = dependentNames.map(depName => ({
        tipo: "dependente",
        nome_completo_cliente_principal: order.client_name,
        nome_completo_dependente: depName,
        valor_servico: unitPrice.toFixed(2),
        servico: serviceName,
        plano_servico: order.product_slug,
        email: order.client_email,
        whatsapp: order.client_whatsapp || '',
        vendedor: order.seller_id || '',
    }));

    // 5. Exibição da Simulação
    console.log('\n--- 📦 PAYLOAD PRINCIPAL ---');
    console.dir(mainPayload);

    if (depPayloads.length > 0) {
        console.log(`\n--- 📦 PAYLOADS DEPENDENTES (${depPayloads.length}) ---`);
        depPayloads.forEach((p, i) => {
            console.log(`[Dependente ${i + 1}]: ${p.nome_completo_dependente} - $${p.valor_servico}`);
        });
    }

    if (!shouldSend) {
        console.log('\n✨ MODO SIMULAÇÃO: Use --send para enviar.');
        process.exit(0);
    }

    // 6. Envio Real
    console.log('\n🚀 [LIVE] Enviando webhooks...');

    try {
        if (!onlyDeps) {
            console.log('📡 Enviando Principal...');
            const resp1 = await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(mainPayload)
            });
            console.log(`✅ Principal enviado. Status: ${resp1.status}`);
        }

        for (const p of depPayloads) {
            console.log(`📡 Enviando Dependente: ${p.nome_completo_dependente}...`);
            const resp = await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(p)
            });
            console.log(`✅ Dependente ${p.nome_completo_dependente} enviado. Status: ${resp.status}`);
        }
        console.log('\n✨ Todos os disparos concluídos!');
    } catch (err) {
        console.error('❌ Erro no envio:', err);
    }
}

run();
