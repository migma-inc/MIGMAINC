-- Migration: Create checkout_prefill_tokens table
-- Allows sellers to pre-fill Step 1 data and generate links for clients

CREATE TABLE IF NOT EXISTS checkout_prefill_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  seller_id TEXT NOT NULL,
  product_slug TEXT NOT NULL,
  client_data JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_checkout_prefill_tokens_token ON checkout_prefill_tokens(token);
CREATE INDEX IF NOT EXISTS idx_checkout_prefill_tokens_seller_id ON checkout_prefill_tokens(seller_id);
CREATE INDEX IF NOT EXISTS idx_checkout_prefill_tokens_expires_at ON checkout_prefill_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_checkout_prefill_tokens_used_at ON checkout_prefill_tokens(used_at);

















