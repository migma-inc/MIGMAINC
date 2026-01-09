-- Migration: Create RLS policies for seller_payment_requests
-- Sellers can only see their own requests, admins can see all

-- Enable RLS
ALTER TABLE seller_payment_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Sellers can view their own payment requests
CREATE POLICY "Sellers can view their own payment requests"
ON seller_payment_requests
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM sellers
    WHERE sellers.seller_id_public = seller_payment_requests.seller_id
      AND sellers.user_id = auth.uid()
      AND sellers.status = 'active'
  )
);

-- Policy: Sellers can create their own payment requests
CREATE POLICY "Sellers can create their own payment requests"
ON seller_payment_requests
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM sellers
    WHERE sellers.seller_id_public = seller_payment_requests.seller_id
      AND sellers.user_id = auth.uid()
      AND sellers.status = 'active'
  )
);

-- Policy: Admins can view all payment requests
CREATE POLICY "Admins can view all payment requests"
ON seller_payment_requests
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM auth.users
    WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'role')::text = 'admin'
  )
);

-- Policy: Admins can update all payment requests
CREATE POLICY "Admins can update all payment requests"
ON seller_payment_requests
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM auth.users
    WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'role')::text = 'admin'
  )
);

-- Add comments
COMMENT ON POLICY "Sellers can view their own payment requests" ON seller_payment_requests IS 'Allows sellers to view only their own payment requests';
COMMENT ON POLICY "Sellers can create their own payment requests" ON seller_payment_requests IS 'Allows sellers to create payment requests for themselves';
COMMENT ON POLICY "Admins can view all payment requests" ON seller_payment_requests IS 'Allows admins to view all payment requests';
COMMENT ON POLICY "Admins can update all payment requests" ON seller_payment_requests IS 'Allows admins to update (approve/reject/complete) all payment requests';
