
/**
 * REGENERATE INVOICES SCRIPT
 * 
 * Chama a Edge Function 'generate-invoice-pdf' para os pedidos especificados 
 * para gerar PDFs individuais e únicos.
 */

const SUPABASE_URL = 'https://ekxftwrjvxtpnqbraszv.supabase.co';
// Usaremos a ANON_KEY pois a função gera o PDF internamente com Service Role
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVreGZ0d3Jqdnh0cG5xYnJhc3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2ODY3ODEsImV4cCI6MjA4MDI2Mjc4MX0.6DjFMOtKnB5BSJN4wnHTwTcQf-Rrci6XXyqhORhhGP0';

const ordersToRegenerate = [
    { id: 'cca2ce4c-4b3a-4c94-9b81-1b016ebcaf0f', num: 'ORD-20260202-8603' },
    { id: 'ffc9c6c2-c951-4cde-8017-7c759e992c6c', num: 'ORD-20260202-1013' },
    { id: 'e98eb668-2d97-4d5d-967b-8956e5dad624', num: 'ORD-20260202-8852' }
];

async function regenerate() {
    console.log('🚀 Iniciando regeração de Invoices...\n');

    for (const order of ordersToRegenerate) {
        console.log(`📄 Processando ${order.num} (${order.id})...`);

        try {
            const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-invoice-pdf`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${ANON_KEY}`
                },
                body: JSON.stringify({ order_id: order.id })
            });

            const result = await response.json();

            if (result.success) {
                console.log(`✅ Sucesso! Novo PDF: ${result.pdf_url}`);
            } else {
                console.log(`❌ Erro no pedido ${order.num}:`, result.error);
            }
        } catch (err) {
            console.error(`💥 Falha fatal ao processar ${order.num}:`, err);
        }
        console.log('------------------------------------------');
    }

    console.log('\n✨ Processo concluído.');
}

regenerate();
