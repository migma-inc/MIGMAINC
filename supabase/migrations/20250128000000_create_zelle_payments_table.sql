-- Migration: Create zelle_payments table for n8n validation integration
-- This table stores Zelle payment receipts and n8n validation results

CREATE TABLE IF NOT EXISTS zelle_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id UUID UNIQUE NOT NULL, -- ID único gerado no frontend
  order_id UUID REFERENCES visa_orders(id) ON DELETE SET NULL,
  service_request_id UUID REFERENCES service_requests(id) ON DELETE SET NULL,
  user_id UUID, -- ID do cliente (se autenticado)
  
  -- Dados do pagamento
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  fee_type TEXT, -- product_slug (ex: 'initial', 'b1-premium')
  
  -- Comprovante
  screenshot_url TEXT NOT NULL,
  image_path TEXT, -- Path no storage
  
  -- Validação n8n
  n8n_response JSONB, -- Resposta completa do n8n
  n8n_confidence DECIMAL(3, 2), -- 0.00 a 1.00
  n8n_validated_at TIMESTAMPTZ,
  
  -- Status
  status TEXT DEFAULT 'pending_verification' CHECK (status IN ('pending_verification', 'approved', 'rejected')),
  
  -- Aprovação
  admin_approved_at TIMESTAMPTZ,
  admin_notes TEXT,
  
  -- Metadata
  metadata JSONB, -- Campos extras (scholarships_ids, promotional_coupon, etc.)
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_zelle_payments_order_id ON zelle_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_zelle_payments_status ON zelle_payments(status);
CREATE INDEX IF NOT EXISTS idx_zelle_payments_payment_id ON zelle_payments(payment_id);
CREATE INDEX IF NOT EXISTS idx_zelle_payments_service_request_id ON zelle_payments(service_request_id);

-- Comments
COMMENT ON TABLE zelle_payments IS 'Stores Zelle payment receipts and n8n validation results';
COMMENT ON COLUMN zelle_payments.payment_id IS 'Unique payment ID generated in frontend (UUID)';
COMMENT ON COLUMN zelle_payments.order_id IS 'Reference to visa_orders table';
COMMENT ON COLUMN zelle_payments.service_request_id IS 'Reference to service_requests table';
COMMENT ON COLUMN zelle_payments.fee_type IS 'Product slug (e.g., initial, b1-premium) used as fee_type in n8n payload';
COMMENT ON COLUMN zelle_payments.n8n_response IS 'Complete JSON response from n8n validation';
COMMENT ON COLUMN zelle_payments.n8n_confidence IS 'Confidence score from n8n (0.00 to 1.00)';
COMMENT ON COLUMN zelle_payments.status IS 'Payment status: pending_verification (awaiting review), approved (auto or manual), rejected';
COMMENT ON COLUMN zelle_payments.metadata IS 'Additional metadata (scholarships_ids, promotional_coupon, etc.)';

-- RLS Policies
ALTER TABLE zelle_payments ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role full access
CREATE POLICY "Service role can manage zelle_payments"
  ON zelle_payments
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Allow authenticated users to read their own payments
CREATE POLICY "Users can read their own zelle_payments"
  ON zelle_payments
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id::text OR user_id IS NULL);

-- Policy: Allow public to insert (for checkout flow)
CREATE POLICY "Public can insert zelle_payments"
  ON zelle_payments
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_zelle_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_zelle_payments_updated_at
  BEFORE UPDATE ON zelle_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_zelle_payments_updated_at();
