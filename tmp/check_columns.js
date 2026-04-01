
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ekxftwrjvxtpnqbraszv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVreGZ0d3Jqdnh0cG5xYnJhc3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2ODY3ODEsImV4cCI6MjA4MDI2Mjc4MX0.6DjFMOtKnB5BSJN4wnHTwTcQf-Rrci6XXyqhORhhGP0'
);

async function check() {
  const { data, error } = await supabase
    .from('visa_products')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Columns in visa_products:', Object.keys(data[0] || {}));
  console.log('Sample data:', data[0]);
}

check();
