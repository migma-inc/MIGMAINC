import type { ServiceConfig, ServiceType } from './types';

// Texto do contrato é carregado do backend — este é o fallback estático.
// TODO: fetch from /api/migma/contract-text?service=transfer
export const CONTRACT_TEXT: Record<ServiceType, string> = {
  transfer: `SECTION 1 — TRANSFER — SELECTION PROCESS AGREEMENT

This agreement is entered into between MIGMA INC. ("Migma") and the student named in the registration form ("Student").

1. SERVICES
Migma agrees to provide student visa transfer consultation and placement services, including:
- Evaluation of Student's eligibility for transfer
- Matching with partner universities
- Full guidance throughout the transfer process
- Support until university acceptance is confirmed

2. SELECTION PROCESS FEE
The Student agrees to pay the Selection Process Fee as specified in the payment section. This fee covers the evaluation and selection process.

3. REFUND GUARANTEE
If the Student is not accepted by any partner university after completing all required steps, the Selection Process Fee will be fully refunded.

4. STUDENT OBLIGATIONS
The Student agrees to:
- Provide accurate and truthful information
- Submit all required documents within the requested timeframe
- Maintain valid F-1 visa status (for transfer applicants)
- Communicate promptly with the Migma team

5. TERM
This agreement is effective upon payment confirmation and remains active until university acceptance or refund, whichever occurs first.

---

SECTION 2 — ANNEX I — PAYMENT AUTHORIZATION

INITIAL FEES
• Selection Process Fee: As specified per service
• Per dependent: +US$150.00 each

SERVICE BALANCES
• Placement Fee: 20% of annual scholarship value — due after scholarship selection
• Application Fee: Defined per university — due after scholarship selection

EXTRA OPERATIONAL FEES
• Document re-submission: US$50.00
• Expedited processing: US$200.00

DEPENDENT FEES
• Each dependent included: US$150.00 per dependent added at registration

The Student authorizes Migma to charge the amounts specified above to the payment method provided, according to the timeline established in the main agreement.`,

  cos: `SECTION 1 — CHANGE OF STATUS (COS) — SELECTION PROCESS AGREEMENT

This agreement is entered into between MIGMA INC. ("Migma") and the student named in the registration form ("Student").

1. SERVICES
Migma agrees to provide Change of Status consultation and placement services, including:
- Evaluation of Student's eligibility for COS
- Matching with partner universities
- Full guidance throughout the COS process
- Support until university acceptance is confirmed

2. SELECTION PROCESS FEE
The Student agrees to pay the Selection Process Fee as specified. This fee covers the evaluation and selection process.

3. REFUND GUARANTEE
If the Student is not accepted by any partner university after completing all required steps, the Selection Process Fee will be fully refunded.

4. STUDENT OBLIGATIONS
The Student agrees to provide accurate information and submit all required documentation in a timely manner.

5. TERM
This agreement is effective upon payment confirmation.

---

SECTION 2 — ANNEX I — PAYMENT AUTHORIZATION

INITIAL FEES
• Selection Process Fee: As specified per service
• Per dependent: +US$150.00 each

SERVICE BALANCES
• Placement Fee: 20% of annual scholarship value
• Application Fee: Defined per university

EXTRA OPERATIONAL FEES
• Document re-submission: US$50.00

DEPENDENT FEES
• Each dependent: +US$150.00`,

  eb2: `EB-2 SERVICE AGREEMENT\n\n[Contract text to be provided by Migma legal team]\n\nANNEX I — PAYMENT AUTHORIZATION\n[Terms to be defined]`,
  eb3: `EB-3 SERVICE AGREEMENT\n\n[Contract text to be provided by Migma legal team]\n\nANNEX I — PAYMENT AUTHORIZATION\n[Terms to be defined]`,
  initial: `INITIAL VISA SERVICE AGREEMENT\n\n[Contract text to be provided by Migma legal team]\n\nANNEX I — PAYMENT AUTHORIZATION\n[Terms to be defined]`,
};

export const SERVICE_CONFIGS: Record<ServiceType, ServiceConfig> = {
  transfer: {
    type: 'transfer',
    name: 'F-1 Transfer',
    label: 'Transfer',
    basePrice: 400,
    dependentPrice: 150,
    contractTitle: 'Transfer — Selection Process Agreement',
    contractSlug: 'transfer-selection-process',
  },
  cos: {
    type: 'cos',
    name: 'Change of Status',
    label: 'COS',
    basePrice: 400,
    dependentPrice: 150,
    contractTitle: 'Change of Status — Selection Process Agreement',
    contractSlug: 'cos-selection-process',
  },
  eb2: {
    type: 'eb2',
    name: 'EB-2 Green Card',
    label: 'EB-2',
    basePrice: 400,
    dependentPrice: 150,
    contractTitle: 'EB-2 — Service Agreement',
    contractSlug: 'eb2-selection-process',
  },
  eb3: {
    type: 'eb3',
    name: 'EB-3 Green Card',
    label: 'EB-3',
    basePrice: 400,
    dependentPrice: 150,
    contractTitle: 'EB-3 — Service Agreement',
    contractSlug: 'eb3-selection-process',
  },
  initial: {
    type: 'initial',
    name: 'Initial Student Visa',
    label: 'Initial',
    basePrice: 400,
    dependentPrice: 150,
    contractTitle: 'Initial Visa — Selection Process Agreement',
    contractSlug: 'initial-selection-process',
  },
};

export function getServiceConfig(slug: string): ServiceConfig | null {
  return SERVICE_CONFIGS[slug as ServiceType] ?? null;
}

export function calcTotal(config: ServiceConfig, numDependents: number): number {
  return config.basePrice + numDependents * config.dependentPrice;
}
