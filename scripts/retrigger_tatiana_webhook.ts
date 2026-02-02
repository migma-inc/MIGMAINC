
// Script to manually re-trigger webhook for Tatiana Santin da Silva
// Run with: npx ts-node scripts/retrigger_tatiana_webhook.ts

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from root
dotenv.config({ path: path.join(__dirname, '../.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || ''; // Preferably Service Role Key if possible for RLS bypass, but manual read might be ok
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

// If you don't have SERVICE_ROLE_KEY in .env, you might need to add it or use anon key if policies allow read
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const ORDER_ID = '18423ba0-8536-40c9-aeba-9e180655e78e'; // Tatiana's Order ID
const WEBHOOK_URL = 'https://n8n.wartully.com.br/webhook/mentoriamigma';

function normalizeServiceName(productSlug: string, productName: string): string {
    if (productSlug.startsWith('initial-')) return 'F1 Initial';
    if (productSlug.startsWith('cos-') || productSlug.startsWith('transfer-')) return 'COS & Transfer';
    return productName;
}

async function main() {
    console.log('🔄 Fetching Order for Tatiana...');

    const { data: order, error } = await supabase
        .from('visa_orders')
        .select('*')
        .eq('id', ORDER_ID)
        .single();

    if (error || !order) {
        console.error('❌ Error fetching order:', error);
        return;
    }

    console.log('✅ Order found:', order.order_number);

    // 1. Fetch Product Name for Normalization
    const { data: product } = await supabase
        .from('visa_products')
        .select('name')
        .eq('slug', order.product_slug)
        .single();

    const serviceName = normalizeServiceName(order.product_slug, product?.name || order.product_slug);

    // 2. Prepare Main Payload
    let basePrice = 0;
    if (order.calculation_type === 'units_only') {
        basePrice = parseFloat(order.extra_unit_price_usd || '0');
    } else {
        basePrice = parseFloat(order.base_price_usd || '0');
    }

    const mainPayload = {
        servico: serviceName,
        plano_servico: order.product_slug,
        nome_completo: order.client_name,
        whatsapp: order.client_whatsapp || '',
        email: order.client_email,
        valor_servico: basePrice.toFixed(2),
        vendedor: order.seller_id || '',
        quantidade_dependentes: Array.isArray(order.dependent_names) ? order.dependent_names.length : 0,
    };

    console.log('📦 Main Payload Prepared:');
    console.log(JSON.stringify(mainPayload, null, 2));

    // 3. Prepare Dependent Payloads
    const dependents = [];
    if (Array.isArray(order.dependent_names) && order.dependent_names.length > 0) {

        let unitPrice = 0;
        // Mirroring the logic from Edge Function
        const rawPrice = order.extra_unit_price_usd;
        if (typeof rawPrice === 'number') {
            unitPrice = rawPrice;
        } else if (typeof rawPrice === 'string') {
            unitPrice = parseFloat(rawPrice);
        }

        // Fallback logic
        if (unitPrice === 0 && order.extra_units > 0) {
            const base = parseFloat(String(order.base_price_usd || '0'));
            const total = parseFloat(String(order.total_price_usd || '0'));
            if (total > base) {
                unitPrice = (total - base) / order.extra_units;
                console.log(`⚠️ Unit price was 0, recalculated to: ${unitPrice}`);
            }
        }

        for (const depName of order.dependent_names) {
            const depPayload = {
                tipo: "dependente",

                // Legacy
                nome_completo_cliente_principal: order.client_name,
                nome_completo_dependente: depName,
                valor_servico: unitPrice.toFixed(2),

                // Enriched
                servico: serviceName,
                plano_servico: order.product_slug,
                email: order.client_email,
                whatsapp: order.client_whatsapp || '',
                vendedor: order.seller_id || '',
                nome_completo: depName,
            };
            dependents.push(depPayload);
        }
    }

    console.log(`📦 Prepared ${dependents.length} Dependent Payloads:`);
    dependents.forEach((d, i) => {
        console.log(`--- Dependent ${i + 1} ---`);
        console.log(JSON.stringify(d, null, 2));
    });

    // ASK FOR PERMISSION TO SEND
    console.log('\n🛑 WAITING FOR CONFIRMATION TO SEND...');
    // In a real interactive script I would prompt, but here I will just exit.
    // Uncomment below to send.

    /*
    console.log('🚀 Sending Main Webhook...');
    await fetch(WEBHOOK_URL, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(mainPayload) 
    });
    console.log('✅ Main Webhook Sent.');
  
    for (const dep of dependents) {
        console.log(`🚀 Sending Dependent (${dep.nome_completo})...`);
        await fetch(WEBHOOK_URL, { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify(dep) 
        });
        console.log('✅ Dependent Sent.');
    }
    */
}

main();
