-- Migration: Create wise_transfers table
-- This table stores detailed information about Wise transfers for visa orders

CREATE TABLE IF NOT EXISTS wise_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visa_order_id UUID REFERENCES visa_orders(id) ON DELETE CASCADE,
  wise_transfer_id TEXT UNIQUE NOT NULL,
  wise_quote_uuid TEXT,
  wise_recipient_id TEXT,
  source_currency TEXT NOT NULL DEFAULT 'USD',
  target_currency TEXT NOT NULL,
  source_amount DECIMAL(10, 2) NOT NULL,
  target_amount DECIMAL(10, 2),
  exchange_rate DECIMAL(10, 6),
  fee_amount DECIMAL(10, 2),
  status TEXT NOT NULL DEFAULT 'incoming_payment_waiting',
  status_details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_wise_transfers_visa_order_id ON wise_transfers(visa_order_id);
CREATE INDEX IF NOT EXISTS idx_wise_transfers_wise_transfer_id ON wise_transfers(wise_transfer_id);
CREATE INDEX IF NOT EXISTS idx_wise_transfers_status ON wise_transfers(status);
CREATE INDEX IF NOT EXISTS idx_wise_transfers_created_at ON wise_transfers(created_at);

-- Add comments
COMMENT ON TABLE wise_transfers IS 'Stores detailed information about Wise transfers for visa order payments';
COMMENT ON COLUMN wise_transfers.visa_order_id IS 'Reference to the visa order this transfer belongs to';
COMMENT ON COLUMN wise_transfers.wise_transfer_id IS 'Unique transfer ID from Wise API';
COMMENT ON COLUMN wise_transfers.wise_quote_uuid IS 'Quote UUID used to create this transfer';
COMMENT ON COLUMN wise_transfers.wise_recipient_id IS 'Recipient account ID (Migma account)';
COMMENT ON COLUMN wise_transfers.source_currency IS 'Currency the customer pays in';
COMMENT ON COLUMN wise_transfers.target_currency IS 'Currency Migma receives (typically USD)';
COMMENT ON COLUMN wise_transfers.source_amount IS 'Amount in source currency';
COMMENT ON COLUMN wise_transfers.target_amount IS 'Amount in target currency (after conversion)';
COMMENT ON COLUMN wise_transfers.exchange_rate IS 'Exchange rate used for conversion';
COMMENT ON COLUMN wise_transfers.fee_amount IS 'Wise fee amount';
COMMENT ON COLUMN wise_transfers.status IS 'Wise transfer status: incoming_payment_waiting, processing, funds_converted, outgoing_payment_sent, bounced_back, funds_refunded, cancelled, charged_back';
COMMENT ON COLUMN wise_transfers.status_details IS 'Additional status information from Wise API';

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_wise_transfers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_wise_transfers_updated_at
  BEFORE UPDATE ON wise_transfers
  FOR EACH ROW
  EXECUTE FUNCTION update_wise_transfers_updated_at();
