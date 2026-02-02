
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ekxftwrjvxtpnqbraszv.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''; // I need the service role for list if private

async function check() {
    if (!SERVICE_ROLE_KEY) {
        console.log('Using Anon key as fallback...');
    }
    const key = SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVreGZ0d3Jqdnh0cG5xYnJhc3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2ODY3ODEsImV4cCI6MjA4MDI2Mjc4MX0.6DjFMOtKnB5BSJN4wnHTwTcQf-Rrci6XXyqhORhhGP0';
    const supabase = createClient(SUPABASE_URL, key);

    console.log('--- STORAGE CHECK ---');
    const { data: buckets } = await supabase.storage.listBuckets();
    console.log('Buckets:', buckets?.map(b => b.name).join(', '));

    const { data: files, error } = await supabase.storage.from('contracts').list('invoices', {
        limit: 100,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' }
    });

    if (error) {
        console.error('Error listing files:', error);
    } else {
        console.log('Recent Invoice Files:');
        files?.forEach(f => console.log(`- ${f.name} (${f.metadata?.size} bytes)`));
    }
}
check();
