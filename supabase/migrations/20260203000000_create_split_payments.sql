-- Migration: Create Split Payments System
-- Description: Permite que clientes dividam pagamentos em múltiplas formas de pagamento via Parcelow
-- Date: 2026-02-03

-- ============================================================================
-- 1. Criar tabela split_payments
-- ============================================================================

CREATE TABLE IF NOT EXISTS split_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES visa_orders(id) ON DELETE CASCADE,
  
  -- Configuração do Split
  total_amount_usd DECIMAL(10, 2) NOT NULL,
  split_count INTEGER NOT NULL DEFAULT 2 CHECK (split_count = 2), -- Fixado em 2 partes
  
  -- Parte 1
  part1_amount_usd DECIMAL(10, 2) NOT NULL CHECK (part1_amount_usd > 0),
  part1_payment_method TEXT NOT NULL CHECK (part1_payment_method IN ('card', 'pix', 'ted')),
  part1_parcelow_order_id TEXT,
  part1_parcelow_checkout_url TEXT,
  part1_parcelow_status TEXT,
  part1_payment_status TEXT DEFAULT 'pending' CHECK (part1_payment_status IN ('pending', 'completed', 'failed', 'cancelled')),
  part1_completed_at TIMESTAMPTZ,
  part1_payment_metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Parte 2
  part2_amount_usd DECIMAL(10, 2) NOT NULL CHECK (part2_amount_usd > 0),
  part2_payment_method TEXT NOT NULL CHECK (part2_payment_method IN ('card', 'pix', 'ted')),
  part2_parcelow_order_id TEXT,
  part2_parcelow_checkout_url TEXT,
  part2_parcelow_status TEXT,
  part2_payment_status TEXT DEFAULT 'pending' CHECK (part2_payment_status IN ('pending', 'completed', 'failed', 'cancelled')),
  part2_completed_at TIMESTAMPTZ,
  part2_payment_metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Controle geral
  overall_status TEXT DEFAULT 'pending' CHECK (overall_status IN ('pending', 'part1_completed', 'fully_completed', 'failed', 'cancelled')),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_split_sum CHECK (part1_amount_usd + part2_amount_usd = total_amount_usd),
  CONSTRAINT unique_order_split UNIQUE (order_id)
);

-- Comentários
COMMENT ON TABLE split_payments IS 'Gerencia pagamentos divididos em múltiplas formas de pagamento via Parcelow';
COMMENT ON COLUMN split_payments.split_count IS 'Número de partes do split (fixado em 2)';
COMMENT ON COLUMN split_payments.overall_status IS 'Status geral: pending, part1_completed, fully_completed, failed, cancelled';
COMMENT ON CONSTRAINT valid_split_sum ON split_payments IS 'Garante que a soma das partes seja igual ao total';
COMMENT ON CONSTRAINT different_payment_methods ON split_payments IS 'Garante que os métodos de pagamento sejam diferentes';

-- ============================================================================
-- 2. Criar índices para performance
-- ============================================================================

CREATE INDEX idx_split_payments_order_id ON split_payments(order_id);
CREATE INDEX idx_split_payments_part1_parcelow ON split_payments(part1_parcelow_order_id) WHERE part1_parcelow_order_id IS NOT NULL;
CREATE INDEX idx_split_payments_part2_parcelow ON split_payments(part2_parcelow_order_id) WHERE part2_parcelow_order_id IS NOT NULL;
CREATE INDEX idx_split_payments_overall_status ON split_payments(overall_status);
CREATE INDEX idx_split_payments_created_at ON split_payments(created_at DESC);

-- ============================================================================
-- 3. Adicionar campos em visa_orders
-- ============================================================================

ALTER TABLE visa_orders 
  ADD COLUMN IF NOT EXISTS is_split_payment BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS split_payment_id UUID REFERENCES split_payments(id) ON DELETE SET NULL;

CREATE INDEX idx_visa_orders_split_payment_id ON visa_orders(split_payment_id) WHERE split_payment_id IS NOT NULL;

COMMENT ON COLUMN visa_orders.is_split_payment IS 'Indica se este pedido usa pagamento dividido';
COMMENT ON COLUMN visa_orders.split_payment_id IS 'Referência para o registro de split payment';

-- ============================================================================
-- 4. Criar função para atualizar updated_at automaticamente
-- ============================================================================

CREATE OR REPLACE FUNCTION update_split_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_split_payments_updated_at
  BEFORE UPDATE ON split_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_split_payments_updated_at();

-- ============================================================================
-- 5. Criar função helper para validar split payment
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_split_payment(
  p_total_amount DECIMAL(10, 2),
  p_part1_amount DECIMAL(10, 2),
  p_part2_amount DECIMAL(10, 2),
  p_part1_method TEXT,
  p_part2_method TEXT
)
RETURNS TABLE(is_valid BOOLEAN, error_message TEXT) AS $$
BEGIN
  -- Validar soma
  IF p_part1_amount + p_part2_amount != p_total_amount THEN
    RETURN QUERY SELECT FALSE, 'A soma das partes não é igual ao total';
    RETURN;
  END IF;
  
  -- Validar valores positivos
  IF p_part1_amount <= 0 OR p_part2_amount <= 0 THEN
    RETURN QUERY SELECT FALSE, 'Ambas as partes devem ter valor maior que zero';
    RETURN;
  END IF;
  
  -- Validar métodos válidos
  IF p_part1_method NOT IN ('card', 'pix', 'ted') OR p_part2_method NOT IN ('card', 'pix', 'ted') THEN
    RETURN QUERY SELECT FALSE, 'Métodos de pagamento inválidos (use: card, pix ou ted)';
    RETURN;
  END IF;
  
  -- Tudo OK
  RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION validate_split_payment IS 'Valida os parâmetros de um split payment antes de criar';

-- ============================================================================
-- 6. Criar RLS (Row Level Security) policies
-- ============================================================================

-- Habilitar RLS
ALTER TABLE split_payments ENABLE ROW LEVEL SECURITY;

-- Policy: Admins podem ver tudo
CREATE POLICY "Admins can view all split payments"
  ON split_payments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Policy: Admins podem inserir
CREATE POLICY "Admins can insert split payments"
  ON split_payments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Policy: Admins podem atualizar
CREATE POLICY "Admins can update split payments"
  ON split_payments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Policy: Service role pode fazer tudo (para Edge Functions)
CREATE POLICY "Service role has full access to split payments"
  ON split_payments
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 7. Criar view para facilitar consultas
-- ============================================================================

CREATE OR REPLACE VIEW split_payments_with_order_details AS
SELECT 
  sp.*,
  vo.order_number,
  vo.client_name,
  vo.client_email,
  vo.product_slug,
  vo.payment_status as order_payment_status,
  vo.seller_id
FROM split_payments sp
JOIN visa_orders vo ON sp.order_id = vo.id;

COMMENT ON VIEW split_payments_with_order_details IS 'View que combina split_payments com detalhes do pedido';

-- Grant permissions na view
GRANT SELECT ON split_payments_with_order_details TO authenticated;
GRANT SELECT ON split_payments_with_order_details TO service_role;
