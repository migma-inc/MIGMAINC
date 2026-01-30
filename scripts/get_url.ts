
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ekxftwrjvxtpnqbraszv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVreGZ0d3Jqdnh0cG5xYnJhc3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2ODY3ODEsImV4cCI6MjA4MDI2Mjc4MX0.6DjFMOtKnB5BSJN4wnHTwTcQf-Rrci6XXyqhORhhGP0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: order, error } = await supabase
        .from('visa_orders')
        .select('payment_metadata')
        .eq('order_number', 'ORD-ZEL-1769637705149')
        .single();

    if (error) {
        console.error(error);
        return;
    }

    const url = order.payment_metadata.invoice_pdf_url;
    console.log('PART1:' + url.substring(0, 50));
    console.log('PART2:' + url.substring(50, 100));
    console.log('PART3:' + url.substring(100, 150));
    console.log('PART4:' + url.substring(150, 200));
    console.log('PART5:' + url.substring(200));
}

run();
