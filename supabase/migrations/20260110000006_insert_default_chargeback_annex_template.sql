-- Migration: Insert default chargeback annex template
-- This creates a global chargeback annex template with the original ANNEX I content
-- Admins can later edit this template or create product-specific versions

-- Insert the default global chargeback annex template
INSERT INTO contract_templates (
  name,
  description,
  content,
  is_active,
  template_type,
  product_slug,
  created_by
) VALUES (
  'ANNEX I - Payment Authorization & Non-Dispute Agreement (Global)',
  'Default global chargeback annex template (ANNEX I). Used for all products that require chargeback protection when no product-specific template exists.',
  '<div class="annex-i-content">
  <h2 style="font-size: 1.25rem; font-weight: bold; margin-bottom: 1rem;">ANNEX I – PAYMENT AUTHORIZATION & NON-DISPUTE AGREEMENT</h2>
  
  <p style="margin-bottom: 1rem;">
    This Annex is an integral part of the Educational Services Agreement entered into between MIGMA INC. and the CLIENT.
  </p>

  <section style="margin-bottom: 1.5rem;">
    <h3 style="font-size: 1.2rem; font-weight: bold; margin-bottom: 0.75rem;">1. CLIENT IDENTIFICATION</h3>
    <p>The individual identified at the end of this Agreement ("CLIENT").</p>
  </section>

  <section style="margin-bottom: 1.5rem;">
    <h3 style="font-size: 1.2rem; font-weight: bold; margin-bottom: 0.75rem;">2. PAYMENT AUTHORIZATION</h3>
    <p style="margin-bottom: 0.5rem;">The CLIENT expressly declares that:</p>
    <ul style="list-style-type: lower-alpha; margin-left: 1.5rem; margin-bottom: 0.5rem;">
      <li style="margin-bottom: 0.25rem;">All payments made to MIGMA INC. are voluntary, informed, and authorized;</li>
      <li style="margin-bottom: 0.25rem;">The CLIENT is fully aware of the service contracted, its nature, scope, and limitations;</li>
      <li style="margin-bottom: 0.25rem;">Payments may be processed through international or intermediary platforms;</li>
      <li style="margin-bottom: 0.25rem;">The total amount charged may include administrative processing fees (e.g., credit card fees) as agreed in the main Agreement.</li>
    </ul>
  </section>

  <section style="margin-bottom: 1.5rem;">
    <h3 style="font-size: 1.2rem; font-weight: bold; margin-bottom: 0.75rem;">3. NATURE OF SERVICES & NO CHARGEBACK BASIS</h3>
    <p style="margin-bottom: 0.5rem;">The CLIENT acknowledges that:</p>
    <ul style="list-style-type: lower-alpha; margin-left: 1.5rem; margin-bottom: 0.5rem;">
      <li style="margin-bottom: 0.25rem;">The services are personalized, intellectual, and initiated immediately upon payment;</li>
      <li style="margin-bottom: 0.25rem;">The COMPANY provides educational mentorship and academic guidance, not legal services;</li>
      <li style="margin-bottom: 0.25rem;">Once services commence, payments are non-refundable, except as expressly stated in the main Agreement.</li>
    </ul>
  </section>

  <section style="margin-bottom: 1.5rem;">
    <h3 style="font-size: 1.2rem; font-weight: bold; margin-bottom: 0.75rem;">4. NON-DISPUTE COMMITMENT</h3>
    <p style="margin-bottom: 0.5rem;">The CLIENT agrees that they will not initiate chargebacks, payment disputes, or claims based on:</p>
    <ul style="list-style-type: disc; margin-left: 1.5rem; margin-bottom: 0.5rem;">
      <li style="margin-bottom: 0.25rem;">alleged lack of recognition of the transaction;</li>
      <li style="margin-bottom: 0.25rem;">dissatisfaction with outcomes dependent on third parties;</li>
      <li style="margin-bottom: 0.25rem;">discrepancies related to currency exchange rates, local taxes (IOF), or credit card processing fees;</li>
      <li style="margin-bottom: 0.25rem;">processing times of institutions or authorities;</li>
      <li style="margin-bottom: 0.25rem;">misunderstanding of service scope already clarified in the Agreement.</li>
    </ul>
  </section>

  <section style="margin-bottom: 1.5rem;">
    <h3 style="font-size: 1.2rem; font-weight: bold; margin-bottom: 0.75rem;">5. PRIOR INTERNAL RESOLUTION</h3>
    <p>Before initiating any bank or platform dispute, the CLIENT agrees to first contact MIGMA INC. through official support channels for resolution.</p>
  </section>

  <section style="margin-bottom: 1.5rem;">
    <h3 style="font-size: 1.2rem; font-weight: bold; margin-bottom: 0.75rem;">6. EVIDENCE AUTHORIZATION</h3>
    <p style="margin-bottom: 0.5rem;">In case of a payment dispute, the CLIENT authorizes MIGMA INC. to use the following as evidence:</p>
    <ul style="list-style-type: disc; margin-left: 1.5rem; margin-bottom: 0.5rem;">
      <li style="margin-bottom: 0.25rem;">electronic signature</li>
      <li style="margin-bottom: 0.25rem;">selfie holding identification document (if applicable)</li>
      <li style="margin-bottom: 0.25rem;">IP address, date, and time logs</li>
      <li style="margin-bottom: 0.25rem;">signed Agreement and Annex</li>
      <li style="margin-bottom: 0.25rem;">communication records related to service delivery</li>
    </ul>
  </section>

  <section style="margin-bottom: 1.5rem;">
    <h3 style="font-size: 1.2rem; font-weight: bold; margin-bottom: 0.75rem;">7. INTERNATIONAL PROCESSING & CURRENCY CONSENT</h3>
    <p>The CLIENT acknowledges that charges may appear under different corporate or platform descriptors due to international payment processing. Furthermore, if paying in a currency other than USD, the CLIENT accepts sole responsibility for exchange rates and conversion fees applied by their bank or card issuer.</p>
  </section>

  <section style="margin-bottom: 1.5rem;">
    <h3 style="font-size: 1.2rem; font-weight: bold; margin-bottom: 0.75rem;">8. FINAL DECLARATION</h3>
    <p>The CLIENT declares that they have read, understood, and voluntarily accepted this Payment Authorization and Non-Dispute Agreement.</p>
  </section>
</div>',
  true,
  'chargeback_annex',
  NULL,
  'system'
)
ON CONFLICT DO NOTHING;

-- Add comment
COMMENT ON TABLE contract_templates IS 'Contract templates for different services. Types: global_partner (Global Partner contracts), visa_service (Visa service contracts with product_slug), chargeback_annex (ANNEX I - Payment Authorization & Non-Dispute Agreement, can be global or product-specific)';
