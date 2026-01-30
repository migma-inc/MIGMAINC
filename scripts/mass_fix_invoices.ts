
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ekxftwrjvxtpnqbraszv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVreGZ0d3Jqdnh0cG5xYnJhc3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2ODY3ODEsImV4cCI6MjA4MDI2Mjc4MX0.6DjFMOtKnB5BSJN4wnHTwTcQf-Rrci6XXyqhORhhGP0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixInvoices() {
    console.log('--- Initing Fix Process ---');

    // 1. Fetch relevant orders
    const { data: orders, error: fetchError } = await supabase
        .from('visa_orders')
        .select('*')
        .gt('extra_units', 0);

    if (fetchError) {
        console.error('Error fetching orders:', fetchError);
        return;
    }

    console.log(`Found ${orders.length} orders to review.`);

    for (const order of orders) {
        console.log(`\nProcessing Order: ${order.order_number} (${order.client_name})`);

        // Check if we need to fix the labels/prices
        if (order.extra_unit_label !== 'Additional Dependent' || parseFloat(order.extra_unit_price_usd || '0') === 0) {
            console.log('Updating/Fixing data labels...');
            const { error: updateError } = await supabase
                .from('visa_orders')
                .update({
                    extra_unit_label: 'Additional Dependent',
                    extra_unit_price_usd: order.price_per_dependent_usd || 0
                })
                .eq('id', order.id);

            if (updateError) {
                console.error(`Failed to update data for ${order.order_number}:`, updateError);
                continue;
            }
            console.log('Order data updated.');
        }

        // Only regenerate if status is completed or paid (to avoid creating invoices for cancelled ones unless needed)
        if (['completed', 'paid', 'pending'].includes(order.payment_status)) {
            console.log(`Triggering invoice regeneration for status: ${order.payment_status}...`);
            const { data, error: invokeError } = await supabase.functions.invoke('generate-invoice-pdf', {
                body: { order_id: order.id }
            });

            if (invokeError) {
                console.error(`Failed to invoke PDF function for ${order.order_number}:`, invokeError);
            } else {
                console.log(`Success! New Invoice: ${data.pdf_url}`);
            }
        } else {
            console.log(`Skipping PDF generation due to status: ${order.payment_status}`);
        }
    }

    console.log('\n--- Fix Process Completed ---');
}

fixInvoices();
