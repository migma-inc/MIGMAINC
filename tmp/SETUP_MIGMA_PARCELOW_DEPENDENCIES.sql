-- ============================================================
-- RODAR NO SUPABASE SQL EDITOR (Dashboard → SQL Editor → New query)
-- Cria as dependências do sistema Migma Parcelow Checkout
-- que estão faltando nas migrations.
-- ============================================================

-- ============================================================
-- 1. TABELA: migma_parcelow_pending
-- Usada por migma-parcelow-checkout para registrar pedidos
-- individuais (não-split) criados na Parcelow.
-- Referenciada em parcelow-webhook para marcar pagamento como completo.
-- ============================================================
CREATE TABLE IF NOT EXISTS migma_parcelow_pending (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  migma_user_id           UUID REFERENCES auth.users(id),
  parcelow_order_id       TEXT NOT NULL,
  parcelow_checkout_url   TEXT,
  amount                  DECIMAL(10,2),
  service_type            TEXT,
  service_request_id      UUID,
  status                  TEXT DEFAULT 'pending',
  migma_payment_completed BOOLEAN DEFAULT FALSE,
  updated_at              TIMESTAMPTZ DEFAULT NOW(),
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE migma_parcelow_pending ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_migma_parcelow_pending"
  ON migma_parcelow_pending
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "user_own_read_migma_parcelow_pending"
  ON migma_parcelow_pending
  FOR SELECT TO authenticated
  USING (migma_user_id = auth.uid());

-- ============================================================
-- 2. FUNÇÃO RPC: get_user_id_by_email
-- Usada por migma-create-student como fallback quando
-- auth.admin.createUser retorna "already exists".
-- Busca o UUID do usuário no auth.users por email.
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_id_by_email(p_email TEXT)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT id FROM auth.users WHERE email = lower(p_email) LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_user_id_by_email(TEXT) TO service_role;

-- ============================================================
-- VERIFICAÇÃO (rodar após o script acima)
-- ============================================================
-- SELECT * FROM migma_parcelow_pending LIMIT 1;
-- SELECT get_user_id_by_email('test@example.com');
