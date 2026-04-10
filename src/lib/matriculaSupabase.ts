import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_MATRICULAUSA_SUPABASE_URL;
const anonKey = import.meta.env.VITE_MATRICULAUSA_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing Matricula USA Supabase env vars.\n' +
    'Required: VITE_MATRICULAUSA_SUPABASE_URL and VITE_MATRICULAUSA_SUPABASE_ANON_KEY'
  );
}

/**
 * Cliente Supabase apontando para o banco do Matricula USA.
 * Usado para: user_profiles, scholarships, scholarship_applications, student_documents, etc.
 * A autenticação do aluno também usa este cliente.
 */
export const matriculaSupabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'matricula-student-auth', // chave diferente para não conflitar com auth do seller (Migma)
  },
});
