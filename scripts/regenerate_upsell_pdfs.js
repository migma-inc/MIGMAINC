
const orderId = 'd6fc1086-50d2-45d3-8369-35cbe4ef4640';
const upsellSlug = 'canada-tourist-premium';
const supabaseUrl = 'https://ekxftwrjvxtpnqbraszv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVreGZ0d3Jqdnh0cG5xYnJhc3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2ODY3ODEsImV4cCI6MjA4MDI2Mjc4MX0.6DjFMOtKnB5BSJN4wnHTwTcQf-Rrci6XXyqhORhhGP0';

async function generatePdf(functionName, body) {
    console.log(`Calling ${functionName}...`);
    try {
        const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();
        console.log(`${functionName} result:`, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error(`Error calling ${functionName}:`, error);
    }
}

async function run() {
    console.log('Regenerating upsell PDFs...');

    // 1. Generate Upsell Contract
    await generatePdf('generate-visa-contract-pdf', {
        order_id: orderId,
        is_upsell: true,
        product_slug_override: upsellSlug
    });

    // 2. Generate Upsell Annex
    await generatePdf('generate-annex-pdf', {
        order_id: orderId,
        is_upsell: true,
        product_slug_override: upsellSlug
    });

    console.log('Done!');
}

run();
