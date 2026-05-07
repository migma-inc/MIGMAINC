import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Configurações
const SUPABASE_URL = "https://ekxftwrjvxtpnqbraszv.supabase.co";
// NOTA: Substitua pelo valor de SUPABASE_SERVICE_ROLE_KEY do seu .env
const SUPABASE_SERVICE_KEY = "SUA_SERVICE_ROLE_KEY_AQUI"; 
const N8N_WEBHOOK_URL = "https://nwh.suaiden.com/webhook/zelle-migma";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function normalizeServiceName(productSlug: string, productName: string): string {
    if (productSlug.startsWith('initial-')) return 'F1 Initial';
    if (productSlug.startsWith('cos-') || productSlug.startsWith('transfer-')) return 'COS & Transfer';
    return productName;
}

async function fixMissingWebhooks() {
    console.log("🚀 Iniciando recuperação de webhooks (13/04 a 16/04)...");

    // 1. Buscar ordens aprovadas no período
    const { data: orders, error: ordersError } = await supabase
        .from('visa_orders')
        .select('*')
        .or('contract_approval_status.eq.approved,annex_approval_status.eq.approved')
        .gte('contract_approval_reviewed_at', '2026-04-13')
        .lte('contract_approval_reviewed_at', '2026-04-16T23:59:59')
        .is('is_test', false);

    if (ordersError) {
        console.error("❌ Erro ao buscar ordens:", ordersError);
        return;
    }

    const filteredOrders = orders.filter(o => !o.client_name?.toLowerCase().includes('teste'));
    console.log(`📦 Encontradas ${filteredOrders.length} ordens aprovadas.`);

    for (const order of filteredOrders) {
        // Verificar se já existe evento bem sucedido para esta ordem no service_request_id
        if (order.service_request_id) {
            const { data: events } = await supabase
                .from('service_request_events')
                .select('id')
                .eq('service_request_id', order.service_request_id)
                .eq('event_type', 'n8n_webhook_dispatched')
                .limit(1);

            if (events && events.length > 0) {
                console.log(`⏭️ Ignorando ORD-${order.order_number}: Webhook já consta como disparado.`);
                continue;
            }
        }

        console.log(`⚙️ Processando ORD-${order.order_number} (${order.client_name})...`);

        try {
            // Busca detalhes do produto
            const { data: product } = await supabase
                .from('visa_products')
                .select('name, base_price_usd, price_per_dependent_usd')
                .eq('slug', order.product_slug)
                .single();

            const serviceName = normalizeServiceName(order.product_slug, product?.name || order.product_slug);

            // Cálculos de preço
            let basePrice = parseFloat(order.base_price_usd || '0');
            let unitPrice = parseFloat(order.extra_unit_price_usd || '0');
            
            if (unitPrice === 0 && order.extra_units > 0) {
                const total = parseFloat(String(order.total_price_usd || '0'));
                if (total > basePrice) unitPrice = (total - basePrice) / order.extra_units;
            }

            // Payloads
            const mainBody = {
                order_id: order.id,
                service_request_id: order.service_request_id || '',
                servico: serviceName,
                plano_servico: order.product_slug,
                nome_completo_cliente_principal: order.client_name,
                whatsapp: order.client_whatsapp || '',
                email: order.client_email,
                valor_servico: basePrice.toFixed(2),
                vendedor: order.seller_id || '',
                quantidade_dependentes: Array.isArray(order.dependent_names) ? order.dependent_names.length : 0,
            };

            // Disparo Principal
            console.log(`  📤 Enviando payload principal...`);
            const resMain = await fetch(N8N_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(mainBody),
            });

            if (!resMain.ok) throw new Error(`Erro n8n (main): ${resMain.status}`);

            // Disparo Dependentes
            if (Array.isArray(order.dependent_names) && order.dependent_names.length > 0) {
                for (const depName of order.dependent_names) {
                    const depBody = {
                        ...mainBody,
                        tipo: "dependente",
                        nome_completo_dependente: depName,
                        valor_servico: unitPrice.toFixed(2),
                    };
                    delete (depBody as any).quantidade_dependentes;
                    
                    console.log(`  📤 Enviando dependente: ${depName}...`);
                    await fetch(N8N_WEBHOOK_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(depBody),
                    });
                }
            }

            // Registrar Sucesso no Log de Eventos
            if (order.service_request_id) {
                await supabase.from('service_request_events').insert({
                    service_request_id: order.service_request_id,
                    event_type: 'n8n_webhook_dispatched',
                    event_source: 'system',
                    payload_json: {
                        recovery_run: true,
                        order_number: order.order_number,
                        timestamp: new Date().toISOString()
                    }
                });
            }

            console.log(`✅ ORD-${order.order_number} recuperada!`);

        } catch (err) {
            console.error(`❌ Falha na ORD-${order.order_number}:`, err);
        }
    }

    console.log("\n🏁 Processo de recuperação finalizado.");
}

fixMissingWebhooks();
