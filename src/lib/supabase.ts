import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env file.\n' +
    'Required: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY\n' +
    'Make sure to restart your dev server after updating .env file'
  );
}

// Validar formato da chave
if (!supabaseAnonKey.startsWith('eyJ')) {
  console.error('❌ VITE_SUPABASE_ANON_KEY format is incorrect!');
  console.error('Expected JWT token starting with "eyJ"');
  console.error('Current key starts with:', supabaseAnonKey.substring(0, 10));
}

// Log de debug (apenas primeiros caracteres por segurança)
console.log('[SUPABASE INIT] Client initialized:', {
  url: supabaseUrl ? '✓ Configured' : '✗ Missing',
  anonKey: supabaseAnonKey ? `✓ Configured (starts with: ${supabaseAnonKey.substring(0, 20)}...)` : '✗ Missing',
});

// Criar uma única instância do cliente Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true, // Enable session persistence
    autoRefreshToken: true, // Automatically refresh tokens
    detectSessionInUrl: true, // Detect session in URL (for OAuth redirects)
  },
});

