
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ekxftwrjvxtpnqbraszv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVreGZ0d3Jqdnh0cG5xYnJhc3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2ODY3ODEsImV4cCI6MjA4MDI2Mjc4MX0.6DjFMOtKnB5BSJN4wnHTwTcQf-Rrci6XXyqhORhhGP0'
);

async function check() {
  const { data: sellers, error } = await supabase
    .from('sellers')
    .select('seller_id_public, full_name');

  if (error) {
    console.error('Error fetching sellers:', error);
    return;
  }

  console.log('All Sellers:', JSON.stringify(sellers, null, 2));
}

check();
