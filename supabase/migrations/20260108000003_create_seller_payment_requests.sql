-- Migration: Create seller_payment_requests table
-- Stores payment withdrawal requests from sellers

CREATE TABLE IF NOT EXISTS seller_payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('stripe', 'wise')),
  payment_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  completed_at TIMESTAMPTZ,
  payment_proof_url TEXT,
  payment_proof_file_path TEXT,
  processed_by UUID, -- Admin user ID
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_seller_payment_requests_seller_id 
ON seller_payment_requests(seller_id);

CREATE INDEX IF NOT EXISTS idx_seller_payment_requests_status 
ON seller_payment_requests(status);

CREATE INDEX IF NOT EXISTS idx_seller_payment_requests_requested_at 
ON seller_payment_requests(requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_seller_payment_requests_seller_status 
ON seller_payment_requests(seller_id, status);

-- Add comments
COMMENT ON TABLE seller_payment_requests IS 'Stores payment withdrawal requests from sellers';
COMMENT ON COLUMN seller_payment_requests.seller_id IS 'Reference to seller_id_public from sellers table';
COMMENT ON COLUMN seller_payment_requests.amount IS 'Amount requested for withdrawal';
COMMENT ON COLUMN seller_payment_requests.payment_method IS 'Payment method: stripe or wise';
COMMENT ON COLUMN seller_payment_requests.payment_details IS 'Payment details JSON: { email: string, account_id?: string }';
COMMENT ON COLUMN seller_payment_requests.status IS 'Request status: pending, approved, rejected, completed';
COMMENT ON COLUMN seller_payment_requests.reserved_amount IS 'Amount reserved in commissions when request is created';
COMMENT ON COLUMN seller_payment_requests.processed_by IS 'Admin user ID who processed the request';

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_seller_payment_request_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
CREATE TRIGGER trigger_update_seller_payment_request_updated_at
  BEFORE UPDATE ON seller_payment_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_seller_payment_request_updated_at();
