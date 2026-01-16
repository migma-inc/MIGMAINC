/**
 * TEST WEBHOOK - Parcelow Payment Simulator
 * 
 * Use this to simulate Parcelow payment approval while 3DS issue is being resolved.
 * 
 * USAGE:
 * 1. Complete the checkout flow until you get redirected to Parcelow
 * 2. Copy the order_id from the URL or database
 * 3. Run this function in the browser console:
 * 
 * testParcelowWebhook('YOUR_ORDER_ID_HERE')
 * 
 * Example:
 * testParcelowWebhook('d5c4acf2-8b1f-4ef5-be4b-11f80073a754')
 */

async function testParcelowWebhook(orderId: string) {
    const supabaseUrl = 'https://ekxftwrjvxtpnqbraszv.supabase.co';
    const functionUrl = `${supabaseUrl}/functions/v1/test-parcelow-webhook`;

    console.log('🧪 Simulating Parcelow payment approval for order:', orderId);

    try {
        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                order_id: orderId,
                // Optional: customize these values
                // parcelow_order_id: 12345,
                // amount_paid_brl: 550000, // R$ 5,500.00 in cents
            }),
        });

        const data = await response.json();

        if (data.success) {
            console.log('✅ Payment approved successfully!');
            console.log('📋 Order Details:', data.data);
            console.log('🔄 Contract generation triggered automatically');
            console.log('');
            console.log('Next steps:');
            console.log('1. Check the visa_orders table (status should be "completed")');
            console.log('2. Wait for contract generation');
            console.log('3. Check generated_files table for PDFs');
        } else {
            console.error('❌ Error:', data.error);
        }

        return data;
    } catch (error) {
        console.error('❌ Request failed:', error);
        throw error;
    }
}

// Example usage (copy to browser console):
// testParcelowWebhook('YOUR_ORDER_ID_HERE')

// Auto-execute for testing
testParcelowWebhook('d5c4acf2-8b1f-4ef5-be4b-11f80073a754');
