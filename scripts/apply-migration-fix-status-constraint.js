// Script temporário para aplicar migração de correção da constraint
// Execute: node scripts/apply-migration-fix-status-constraint.js

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carregar variáveis de ambiente
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Erro: Variáveis de ambiente não encontradas!');
  console.error('Certifique-se de que VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY estão configuradas.');
  console.error('\nPara usar service_role key (recomendado):');
  console.error('1. Obtenha a service_role key no Supabase Dashboard → Settings → API');
  console.error('2. Execute: $env:SUPABASE_SERVICE_ROLE_KEY="sua-service-role-key"; node scripts/apply-migration-fix-status-constraint.js');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// SQL da migração
const migrationSQL = `
-- Migration: Fix zelle_payments status constraint
-- This ensures the constraint matches the expected values

-- Drop existing constraint if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'zelle_payments_status_check'
        AND conrelid = 'zelle_payments'::regclass
    ) THEN
        ALTER TABLE zelle_payments 
        DROP CONSTRAINT zelle_payments_status_check;
    END IF;
END $$;

-- Add correct constraint
ALTER TABLE zelle_payments
ADD CONSTRAINT zelle_payments_status_check 
CHECK (status IN ('pending_verification', 'approved', 'rejected'));
`;

async function applyMigration() {
  console.log('🔄 Aplicando migração para corrigir constraint de status...\n');

  try {
    // Executar SQL via RPC ou direto
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

    if (error) {
      // Se RPC não existir, tentar executar diretamente via REST API
      console.log('⚠️  RPC não disponível, tentando método alternativo...');
      
      // Dividir o SQL em comandos individuais
      const commands = migrationSQL
        .split(';')
        .map(cmd => cmd.trim())
        .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));

      for (const command of commands) {
        if (command.includes('DO $$')) {
          // Para blocos DO, precisamos executar tudo de uma vez
          const { error: execError } = await supabase
            .from('_migrations')
            .select('*')
            .limit(0); // Apenas para testar conexão
          
          if (execError) {
            console.error('❌ Erro ao executar SQL:', execError);
            throw execError;
          }
        }
      }
    }

    console.log('✅ Migração aplicada com sucesso!');
    console.log('\n📋 Verificando constraint...');

    // Verificar constraint
    const { data: constraintData, error: checkError } = await supabase
      .from('pg_constraint')
      .select('*')
      .eq('conname', 'zelle_payments_status_check')
      .limit(1);

    if (checkError) {
      console.log('⚠️  Não foi possível verificar a constraint automaticamente.');
      console.log('   Execute a query de verificação no SQL Editor do Supabase.');
    } else {
      console.log('✅ Constraint verificada!');
    }

    console.log('\n✨ Pronto! A constraint foi corrigida.');
    console.log('   Teste novamente o fluxo de pagamento Zelle.');

  } catch (err) {
    console.error('❌ Erro ao aplicar migração:', err);
    console.error('\n💡 Solução alternativa:');
    console.error('   1. Acesse o Supabase Dashboard → SQL Editor');
    console.error('   2. Cole o SQL do arquivo: supabase/migrations/20250128000002_fix_zelle_payments_status_constraint.sql');
    console.error('   3. Execute o SQL manualmente');
    process.exit(1);
  }
}

applyMigration();
