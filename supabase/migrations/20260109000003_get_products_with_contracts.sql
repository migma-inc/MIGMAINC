-- Migration: Create function to get product slugs with active contract templates
-- This function allows sellers to check which products have contract templates
-- without needing direct access to the contract_templates table

CREATE OR REPLACE FUNCTION get_products_with_contracts()
RETURNS TABLE (product_slug TEXT) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT ct.product_slug
  FROM contract_templates ct
  WHERE ct.template_type = 'visa_service'
    AND ct.is_active = true
    AND ct.product_slug IS NOT NULL;
END;
$$;

-- Grant execute permission to authenticated users (sellers)
GRANT EXECUTE ON FUNCTION get_products_with_contracts() TO authenticated;

-- Add comment
COMMENT ON FUNCTION get_products_with_contracts() IS 'Returns product slugs that have active contract templates. Accessible by sellers.';
