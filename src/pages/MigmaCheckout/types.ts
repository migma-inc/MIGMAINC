export type PaymentMethod = 'square' | 'parcelow' | 'pix' | 'zelle' | 'stripe' | 'parcelow_card' | 'parcelow_pix' | 'parcelow_ted';
export type CardOwnership = 'own' | 'third_party';
export type IPRegion = 'US' | 'BR' | 'OTHER';

export interface PayerInfo {
  name: string;
  cpf: string;
  email: string;
  phone: string;
  postal_code?: string;
  address_street?: string;
  address_number?: string;
  address_neighborhood?: string;
  address_city?: string;
  address_state?: string;
  address_complement?: string;
}
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

/** Step 1 — dados pessoais, termos, assinatura e pagamento. */
export interface Step1Data {
  full_name: string;
  email: string;
  phone: string;
  password: string;
  confirm_password: string;
  num_dependents: number | null;
  terms_accepted: boolean;
  data_accepted: boolean;
  signature_data_url: string | null;
  payment_method?: PaymentMethod;
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
  /** Zelle submitted and pending admin approval — student redirected to onboarding but not yet marked as paid */
  zelleProcessing: boolean;
  userId: string | null;
  totalPrice: number;
}
