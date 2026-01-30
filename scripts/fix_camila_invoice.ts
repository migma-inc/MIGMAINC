
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ekxftwrjvxtpnqbraszv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVreGZ0d3Jqdnh0cG5xYnJhc3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2ODY3ODEsImV4cCI6MjA4MDI2Mjc4MX0.6DjFMOtKnB5BSJN4wnHTwTcQf-Rrci6XXyqhORhhGP0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    // Camila's Order ID
    const orderId = '0b32c899-7c6c-469e-9ab5-2da902435bfc';

    console.log(`Updating order: ${orderId}...`);

    // 1. Update the order in the database to have correct extra_units
    // This fixes the data root cause so the invoice generation logic (and other parts of the system) works naturally.
    const { error: updateError } = await supabase
        .from('visa_orders')
        .update({
            extra_units: 1, // She has 1 dependent
            extra_unit_label: 'Additional Dependent' // Ensure label is set
        })
        .eq('id', orderId);

    if (updateError) {
        console.error('Error updating order:', updateError);
        return;
    }
    console.log('Order updated in DB (extra_units set to 1).');

    // 2. Regenerate the Invoice PDF
    console.log('Invoking generate-invoice-pdf...');
    const { data, error } = await supabase.functions.invoke('generate-invoice-pdf', {
        body: { order_id: orderId }
    });

    if (error) {
        console.error('Error invoking function:', error);
        return;
    }

    console.log('Success! Invoice Re-generated.');
    console.log('New Invoice URL:', data.pdf_url);
}

run();
