export type ServiceType = 'transfer' | 'cos' | 'eb2' | 'eb3' | 'initial';
export type PaymentMethod = 'square' | 'parcelow' | 'pix' | 'zelle' | 'stripe';
export type CardOwnership = 'own' | 'third_party';
export type IPRegion = 'US' | 'BR' | 'OTHER';
export type CheckoutStep = 1 | 2 | 3;
export type DocType = 'passport' | 'rg' | 'cnh';
export type CivilStatus = 'single' | 'married' | 'divorced' | 'widowed';

export interface ServiceConfig {
  type: ServiceType;
  name: string;
  label: string;
  basePrice: number;
  dependentPrice: number;
  contractTitle: string;
  contractSlug?: string;
}

/** Step 1 — apenas dados pessoais, termos e assinatura. SEM pagamento. */
export interface Step1Data {
  full_name: string;
  email: string;
  phone: string;
  password: string;
  confirm_password: string;
  num_dependents: number;
  terms_accepted: boolean;
  data_accepted: boolean;
  signature_data_url: string | null;
}

/** Step 2 — documentos e dados adicionais do perfil. */
export interface Step2Data {
  birth_date: string;
  doc_type: DocType;
  doc_number: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  nationality: string;
  civil_status: CivilStatus;
  notes: string;
  doc_front: File | null;
  doc_back: File | null;
  selfie: File | null;
}

export interface CheckoutState {
  currentStep: CheckoutStep;
  step1Completed: boolean;
  step2Completed: boolean;
  paymentConfirmed: boolean;
  userId: string | null;
  totalPrice: number;
}
