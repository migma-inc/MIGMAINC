/**
 * ANNEX I — UNIVERSAL PAYMENT AUTHORIZATION & ANTI-FRAUD AGREEMENT
 * 
 * This Annex is an integral and inseparable part of any and all service agreements
 * entered into between MIGMA INC. and the CLIENT.
 * 
 * NOTE: This is a fallback static version. The system now uses dynamic templates from the database.
 * This file is kept for backward compatibility and as a fallback if no template is found.
 */

// HTML version for frontend display (FALLBACK - prefer database template)
export const ANNEX_I_HTML = `
<div class="annex-i-content">
  <h2 style="font-size: 1.25rem; font-weight: bold; margin-bottom: 1rem;">ANNEX I — UNIVERSAL PAYMENT AUTHORIZATION & ANTI-FRAUD AGREEMENT</h2>
  <p style="font-size: 0.9rem; font-weight: 600; margin-bottom: 1rem;">(PAYMENT TERMS & NON-DISPUTE COMMITMENT)</p>
  
  <p style="margin-bottom: 1rem;">
    This Annex is an integral and inseparable part of any and all service agreements entered into between MIGMA INC. and the CLIENT. By proceeding with the payment, the CLIENT acknowledges and accepts these terms.
  </p>

  <section style="margin-bottom: 1.5rem;">
    <h3 style="font-size: 1.2rem; font-weight: bold; margin-bottom: 0.75rem;">1. SCOPE OF AUTHORIZATION</h3>
    <p style="margin-bottom: 0.5rem;">The CLIENT expressly authorizes the charge(s) related to the contracted educational, mentorship, or operational services. This authorization applies to:</p>
    <ul style="list-style-type: disc; margin-left: 1.5rem; margin-bottom: 0.5rem;">
      <li style="margin-bottom: 0.25rem;"><strong>Initial Fees:</strong> Selection process fees, academic matching, or onboarding fees.</li>
      <li style="margin-bottom: 0.25rem;"><strong>Service Balances:</strong> Remaining payments for full service packages.</li>
      <li style="margin-bottom: 0.25rem;"><strong>Extra Operational Fees:</strong> Document corrections, rescheduling, or additional support.</li>
      <li style="margin-bottom: 0.25rem;"><strong>Dependent Fees:</strong> Charges for family members or additional applicants.</li>
    </ul>
  </section>

  <section style="margin-bottom: 1.5rem;">
    <h3 style="font-size: 1.2rem; font-weight: bold; margin-bottom: 0.75rem;">2. NATURE OF SERVICES & COMMENCEMENT</h3>
    <p style="margin-bottom: 0.5rem;">The CLIENT acknowledges that MIGMA INC. provides intangible, intellectual, and personalized services.</p>
    <ul style="list-style-type: disc; margin-left: 1.5rem; margin-bottom: 0.5rem;">
      <li style="margin-bottom: 0.25rem;">Execution of the services (profile analysis, portal access, institutional contact, or document review) begins immediately upon payment confirmation.</li>
      <li style="margin-bottom: 0.25rem;">The CLIENT understands that MIGMA INC. is an educational consultancy, not a law firm, and cannot guarantee outcomes dependent on third parties (e.g., U.S. Consulates, USCIS, or Universities).</li>
    </ul>
  </section>

  <section style="margin-bottom: 1.5rem;">
    <h3 style="font-size: 1.2rem; font-weight: bold; margin-bottom: 0.75rem;">3. IRREVOCABLE NON-DISPUTE COMMITMENT</h3>
    <p style="margin-bottom: 0.5rem;">The CLIENT irrevocably agrees not to initiate chargebacks, payment disputes, or reversals with their bank or card issuer based on the following:</p>
    <ul style="list-style-type: disc; margin-left: 1.5rem; margin-bottom: 0.5rem;">
      <li style="margin-bottom: 0.25rem;"><strong>Subjective Dissatisfaction:</strong> Dissatisfaction with decisions made by government authorities or educational institutions (e.g., visa denials or admission rejections).</li>
      <li style="margin-bottom: 0.25rem;"><strong>External Delays:</strong> Changes in processing times or policies imposed by third parties.</li>
      <li style="margin-bottom: 0.25rem;"><strong>Financial Surcharges:</strong> Applied taxes (IOF), currency exchange fluctuations, or credit card interest/installment fees.</li>
      <li style="margin-bottom: 0.25rem;"><strong>Transaction Recognition:</strong> Claims of "unrecognized transaction" when the CLIENT has signed the main agreement or accessed the service portal.</li>
    </ul>
  </section>

  <section style="margin-bottom: 1.5rem;">
    <h3 style="font-size: 1.2rem; font-weight: bold; margin-bottom: 0.75rem;">4. MANDATORY PRE-DISPUTE RESOLUTION</h3>
    <p>Before initiating any formal dispute with a financial institution, the CLIENT is contractually obligated to contact MIGMA INC. via official support channels to seek an internal resolution. Initiating a chargeback without prior written contact with the COMPANY constitutes a material breach of contract.</p>
  </section>

  <section style="margin-bottom: 1.5rem;">
    <h3 style="font-size: 1.2rem; font-weight: bold; margin-bottom: 0.75rem;">5. EVIDENCE FOR DISPUTE DEFENSE</h3>
    <p style="margin-bottom: 0.5rem;">In the event of a chargeback attempt, the CLIENT expressly authorizes MIGMA INC. to submit the following evidence to banks and payment processors:</p>
    <ul style="list-style-type: disc; margin-left: 1.5rem; margin-bottom: 0.5rem;">
      <li style="margin-bottom: 0.25rem;"><strong>Logs:</strong> IP address, device metadata, date/time stamps of the transaction, and portal login records.</li>
      <li style="margin-bottom: 0.25rem;"><strong>Identity:</strong> Electronic signatures and any uploaded identification documents (Selfie/ID).</li>
      <li style="margin-bottom: 0.25rem;"><strong>Engagement:</strong> Records of communications (WhatsApp/Email) and proof of digital delivery of the services (e.g., school lists, DS-160 drafts, or mentorship materials).</li>
    </ul>
  </section>

  <section style="margin-bottom: 1.5rem;">
    <h3 style="font-size: 1.2rem; font-weight: bold; margin-bottom: 0.75rem;">6. INTERNATIONAL PROCESSING & CURRENCY</h3>
    <p style="margin-bottom: 0.5rem;">The CLIENT acknowledges that:</p>
    <ul style="list-style-type: disc; margin-left: 1.5rem; margin-bottom: 0.5rem;">
      <li style="margin-bottom: 0.25rem;">Charges may appear on statements under the name MIGMA INC. or the name of the Payment Processor (e.g., Parcelow, Wise, Stripe, etc.).</li>
      <li style="margin-bottom: 0.25rem;">MIGMA INC. is a U.S. corporation; therefore, all local taxes and conversion fees are the sole responsibility of the CLIENT. The COMPANY must receive the net USD amount agreed upon.</li>
    </ul>
  </section>

  <section style="margin-bottom: 1.5rem;">
    <h3 style="font-size: 1.2rem; font-weight: bold; margin-bottom: 0.75rem;">7. FINAL DECLARATION</h3>
    <p>The CLIENT declares they have read this Annex, understand its legal implications regarding the prevention of payment fraud and unjustified chargebacks, and voluntarily proceed with this transaction.</p>
  </section>
</div>
`;

// Plain text version for PDF generation (FALLBACK - prefer database template)
export const ANNEX_I_TEXT = `ANNEX I — UNIVERSAL PAYMENT AUTHORIZATION & ANTI-FRAUD AGREEMENT
(PAYMENT TERMS & NON-DISPUTE COMMITMENT)

This Annex is an integral and inseparable part of any and all service agreements entered into between MIGMA INC. and the CLIENT. By proceeding with the payment, the CLIENT acknowledges and accepts these terms.

1. SCOPE OF AUTHORIZATION

The CLIENT expressly authorizes the charge(s) related to the contracted educational, mentorship, or operational services. This authorization applies to:

- Initial Fees: Selection process fees, academic matching, or onboarding fees.
- Service Balances: Remaining payments for full service packages.
- Extra Operational Fees: Document corrections, rescheduling, or additional support.
- Dependent Fees: Charges for family members or additional applicants.

2. NATURE OF SERVICES & COMMENCEMENT

The CLIENT acknowledges that MIGMA INC. provides intangible, intellectual, and personalized services.

- Execution of the services (profile analysis, portal access, institutional contact, or document review) begins immediately upon payment confirmation.
- The CLIENT understands that MIGMA INC. is an educational consultancy, not a law firm, and cannot guarantee outcomes dependent on third parties (e.g., U.S. Consulates, USCIS, or Universities).

3. IRREVOCABLE NON-DISPUTE COMMITMENT

The CLIENT irrevocably agrees not to initiate chargebacks, payment disputes, or reversals with their bank or card issuer based on the following:

- Subjective Dissatisfaction: Dissatisfaction with decisions made by government authorities or educational institutions (e.g., visa denials or admission rejections).
- External Delays: Changes in processing times or policies imposed by third parties.
- Financial Surcharges: Applied taxes (IOF), currency exchange fluctuations, or credit card interest/installment fees.
- Transaction Recognition: Claims of "unrecognized transaction" when the CLIENT has signed the main agreement or accessed the service portal.

4. MANDATORY PRE-DISPUTE RESOLUTION

Before initiating any formal dispute with a financial institution, the CLIENT is contractually obligated to contact MIGMA INC. via official support channels to seek an internal resolution. Initiating a chargeback without prior written contact with the COMPANY constitutes a material breach of contract.

5. EVIDENCE FOR DISPUTE DEFENSE

In the event of a chargeback attempt, the CLIENT expressly authorizes MIGMA INC. to submit the following evidence to banks and payment processors:

- Logs: IP address, device metadata, date/time stamps of the transaction, and portal login records.
- Identity: Electronic signatures and any uploaded identification documents (Selfie/ID).
- Engagement: Records of communications (WhatsApp/Email) and proof of digital delivery of the services (e.g., school lists, DS-160 drafts, or mentorship materials).

6. INTERNATIONAL PROCESSING & CURRENCY

The CLIENT acknowledges that:

- Charges may appear on statements under the name MIGMA INC. or the name of the Payment Processor (e.g., Parcelow, Wise, Stripe, etc.).
- MIGMA INC. is a U.S. corporation; therefore, all local taxes and conversion fees are the sole responsibility of the CLIENT. The COMPANY must receive the net USD amount agreed upon.

7. FINAL DECLARATION

The CLIENT declares they have read this Annex, understand its legal implications regarding the prevention of payment fraud and unjustified chargebacks, and voluntarily proceed with this transaction.`;
