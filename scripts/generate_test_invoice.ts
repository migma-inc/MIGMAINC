
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ekxftwrjvxtpnqbraszv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVreGZ0d3Jqdnh0cG5xYnJhc3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2ODY3ODEsImV4cCI6MjA4MDI2Mjc4MX0.6DjFMOtKnB5BSJN4wnHTwTcQf-Rrci6XXyqhORhhGP0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const orderNumber = 'ORD-ZEL-1769637705149';
    console.log(`Checking order: ${orderNumber}`);

    const { data: order, error: orderError } = await supabase
        .from('visa_orders')
        .select('*')
        .eq('order_number', orderNumber)
        .single();

    if (orderError) {
        console.error('Error finding order:', orderError);
        return;
    }

    console.log('Order found:', order.id);
    console.log('Current extra_units:', order.extra_units);
    console.log('Current total_price_usd:', order.total_price_usd);

    // If it's the specific order mentioned ($550 total, cos-selection-process)
    // base price is usually $400, so $150 extra means 1 dependent at $150.
    if (order.extra_units === 0 || !order.extra_unit_label) {
        console.log('Updating order with dependent data for test...');
        const { error: updateError } = await supabase
            .from('visa_orders')
            .update({
                extra_units: 1,
                extra_unit_price_usd: 150,
                extra_unit_label: 'Number of dependents',
                price_per_dependent_usd: 150,
                base_price_usd: 400
            })
            .eq('id', order.id);

        if (updateError) {
            console.error('Error updating order:', updateError);
            return;
        }
        console.log('Order updated.');
    }

    console.log('Invoking generate-invoice-pdf...');
    const { data, error } = await supabase.functions.invoke('generate-invoice-pdf', {
        body: { order_id: order.id }
    });

    if (error) {
        console.error('Error invoking function:', error);
        return;
    }

    console.log('Success! Invoice URL:', data.pdf_url);
}

run();
