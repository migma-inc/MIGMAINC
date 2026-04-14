/**
 * Wrapper para as Edge Functions da Migma (Dual-Save).
 * Usa um client Supabase dedicado SEM persistência de sessão de auth,
 * para evitar que refresh tokens travem as chamadas às Edge Functions.
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Client dedicado para Edge Functions — completamente isolado do cliente principal.
// storageKey diferente evita que os dois GoTrueClients compartilhem o mesmo
// BroadcastChannel e travem operações de auth (signIn/signUp) no cliente principal.
const fnClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    storageKey: 'migma-fn-client-auth',
  },
});

export interface CreateStudentPayload {
  email: string;
  full_name: string;
  phone?: string;
  country?: string;
  nationality?: string;
  password?: string;
  // Dados do checkout (para salvar na Migma)
  service_type?: string;
  num_dependents?: number;
  total_price?: number;
  payment_method?: string;
  migma_user_id?: string;
  migma_seller_id?: string;
  migma_agent_id?: string;
  service_request_id?: string;
  payment_metadata?: {
    cpf?: string;
    coupon_code?: string;
    discount_amount?: number;
    payer_info?: any;
    card_ownership?: string;
  };
}

export interface CreateStudentResponse {
  success?: boolean;
  user_id: string;
  profile_id: string;
  profile?: any;
  matricula_user_id?: string; // ID do aluno no sistema Matricula USA (cross-system link)
  // 409 — aluno já existe
  error?: string;
  message?: string;
  source?: string;
  order_id?: string; // ID da transação (visa_orders)
}

export type FeeType =
  | 'selection_process'
  | 'application'
  | 'scholarship'
  | 'placement'
  | 'college_enrollment'
  | 'i20_control';

export type PaymentMethod = 'stripe' | 'zelle' | 'manual' | 'parcelow';

export interface PaymentCompletedPayload {
  user_id: string;
  fee_type: FeeType;
  amount: number;
  payment_method: PaymentMethod;
  // Stripe
  payment_intent_id?: string;
  stripe_charge_id?: string;
  gross_amount_usd?: number;
  fee_amount_usd?: number;
  // Zelle
  zelle_payment_id?: string;
  // Parcelow
  parcelow_order_id?: string;
  parcelow_checkout_url?: string;
  parcelow_reference?: string;
  receipt_url?: string;
  // Cross-system
  matricula_user_id?: string;
  // Migma checkout extras
  service_type?: string;
  service_request_id?: string;
  finalize_contract_only?: boolean;
}

export interface PaymentCompletedResponse {
  success: boolean;
  payment_id: string;
  record_id: string;
  profile_flag_updated: string;
}

export interface StudentStatusResponse {
  profile: {
    user_id: string;
    email: string;
    full_name: string;
    source: string;
    migma_seller_id?: string;
    has_paid_selection_process_fee: boolean;
    selection_survey_passed: boolean;
    identity_verified?: boolean;
    is_application_fee_paid: boolean;
    is_scholarship_fee_paid: boolean;
    is_placement_fee_paid: boolean;
    has_paid_college_enrollment_fee: boolean;
    has_paid_i20_control_fee: boolean;
    documents_uploaded: boolean;
    documents_status: string | null;
    selected_scholarship_id: string | null;
    placement_fee_flow: boolean;
    student_process_type?: string;
    visa_transfer_active?: boolean;
    onboarding_completed?: boolean;
    onboarding_current_step?: string;
    has_paid_reinstatement_package?: boolean;
  };
  current_step: string;
  applications: any[];
  pending_document_requests: any[];
  student_documents: any[];
  payments: any[];
  unread_notifications: any[];
}

export interface SaveDocumentsPayload {
  user_id: string;
  service_request_id?: string;
  documents: Array<{
    type: 'passport' | 'passport_back' | 'selfie_with_doc';
    file_url: string;
    original_filename?: string;
    file_size_bytes?: number;
  }>;
}

export interface StudentStripeCheckoutPayload {
  amount: number;
  user_id: string;
  email: string;
  full_name: string;
  service_type: string;
  service_request_id?: string;
  origin?: string;
  payment_metadata?: {
    cpf?: string;
    payer_info?: any;
    card_ownership?: string;
  };
}

export interface StudentStripeCheckoutResponse {
  url: string;
  session_id: string;
}

export interface StudentParcelowCheckoutPayload {
  amount: number;
  user_id: string;
  order_id: string; // ID da transação gerado pelo migma-create-student
  email: string;
  full_name: string;
  payment_method: string;
  service_type: string;
  service_request_id?: string;
  origin?: string;
  cpf?: string;
  card_ownership?: string;
  payer_info?: any; // Dados de terceiros (PRD v7.0)
}

export interface StudentParcelowCheckoutResponse {
  url: string;
  order_id: string;
  url_checkout?: string;
  checkout_url?: string;
  error?: string;
  details?: unknown;
}

async function invokeFunction<T>(name: string, options: {
  method?: 'POST' | 'GET';
  body?: object;
  query?: Record<string, string>;
}): Promise<T> {
  const { method = 'POST', body, query } = options;
  const invokeBody = method === 'GET' ? query : body;

  console.log(`[matriculaApi] [${name}] Chamando Edge Function...`, { method, body: invokeBody });
  const start = Date.now();

  const invokePromise = fnClient.functions.invoke<T>(name, {
    body: invokeBody,
    method,
  }).then(res => {
    console.log(`[matriculaApi] [${name}] Resposta recebida em ${Date.now() - start}ms:`, res);
    
    if (res.error) {
      console.error(`[matriculaApi] [${name}] Erro retornado pela função:`, res.error);
      throw new Error(res.error.message || `Erro na Edge Function ${name}`);
    }
    
    return res.data;
  }).catch(err => {
    console.error(`[matriculaApi] [${name}] Falha na promessa invoke em ${Date.now() - start}ms:`, err);
    throw err;
  });

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => {
      console.warn(`[matriculaApi] [${name}] EXCEDEU 30s! Abortando...`);
      reject(new Error(`Edge Function '${name}' timeout após 30s`));
    }, 30_000)
  );

  // The 'invokePromise' already handles the extraction of 'res.data'
  // and throws if 'res.error' is present.
  const result = await Promise.race([invokePromise, timeoutPromise]);

  return result as T;
}

export interface SyncStudentPayload {
  user_id: string;
  email: string;
  full_name: string;
  phone?: string;
  country?: string;
  nationality?: string;
  service_type?: string;
  migma_seller_id?: string;
  migma_agent_id?: string;
}

export const matriculaApi = {
  /**
   * Sincroniza o aluno com o Matricula USA.
   * Fire-and-forget: não bloqueia o fluxo do usuário.
   * Use sem `await` no frontend.
   */
  syncStudent: (payload: SyncStudentPayload) =>
    invokeFunction<{ success: boolean; status: string }>('migma-sync-student', {
      method: 'POST',
      body: payload,
    }).catch((err) => {
      // Silencia erros no cliente — o log fica no banco (migma_sync_log)
      console.warn('[matriculaApi.syncStudent] Background sync failed (non-blocking):', err.message);
    }),

  paymentCompleted: (payload: PaymentCompletedPayload) =>
    invokeFunction<PaymentCompletedResponse>('migma-payment-completed', {
      method: 'POST',
      body: payload,
    }),

  getStudentStatus: (params: { user_id: string } | { email: string }) =>
    invokeFunction<StudentStatusResponse>('migma-student-status', {
      method: 'GET',
      query: params as Record<string, string>,
    }),

  saveDocuments: (payload: SaveDocumentsPayload) =>
    invokeFunction<{ success: boolean; documents_saved: number }>('migma-save-documents', {
      method: 'POST',
      body: payload,
    }),

  stripeStudentCheckout: (payload: StudentStripeCheckoutPayload) =>
    invokeFunction<StudentStripeCheckoutResponse>('migma-student-stripe-checkout', {
      method: 'POST',
      body: payload,
    }),

  createStudent: (payload: CreateStudentPayload) =>
    invokeFunction<CreateStudentResponse>('migma-create-student', {
      method: 'POST',
      body: payload,
    }),

  parcelowStudentCheckout: (payload: StudentParcelowCheckoutPayload) =>
    invokeFunction<StudentParcelowCheckoutResponse>('create-parcelow-checkout', {
      method: 'POST',
      body: payload,
    }),

  migmaParcelowCheckout: (payload: StudentParcelowCheckoutPayload) =>
    invokeFunction<StudentParcelowCheckoutResponse>('migma-parcelow-checkout', {
      method: 'POST',
      body: payload,
    }),
};
