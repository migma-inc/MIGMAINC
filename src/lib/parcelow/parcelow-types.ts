// Parcelow API Types

export interface ParcelowTokenResponse {
  token_type: string;
  expires_in: number;
  access_token: string;
}

export interface ParcelowSimulateResponse {
  data: {
    order: string; // Valor em reais
    dolar: string; // Taxa de câmbio
    ted: {
      amount: string; // Valor TED
    };
    creditcard: ParcelowInstallmentOption[];
  };
}

export interface ParcelowInstallmentOption {
  installment: number; // Número de parcelas
  monthly: string; // Valor mensal
  total: string; // Valor total
}

export interface ParcelowOrder {
  id: number;
  reference: string;
  partner_reference?: string;
  disable_email_notifications: boolean;
  order_amount: number; // Em centavos
  total_usd: number; // Em centavos
  total_brl: number; // Em centavos
  installments: number;
  order_date: string;
  status: number; // 0 = Open, etc.
  status_text: string; // "Open", "Paid", etc.
  account: ParcelowAccount;
  client: ParcelowClient;
  items: ParcelowOrderItem[];
  history_log?: ParcelowHistoryLog[];
  coupon?: ParcelowCoupon;
  redirect_success?: string;
  redirect_failed?: string;
  url_checkout: string;
}

export interface ParcelowAccount {
  name: string;
  email: string;
  phone: string;
  address: string;
}

export interface ParcelowClient {
  name: string;
  email: string;
  phone: string;
  cpf: string; // CPF ou CNPJ
  cep?: string;
  created_at?: string;
  rg?: string;
  birthday?: string;
  address_street?: string;
  address_number?: string;
  address_complement?: string;
  address_neighborhood?: string;
  address_city?: string;
  address_state?: string;
  is_diferent_card_address?: string;
  card_address_cep?: string;
  card_address_street?: string;
  card_address_number?: string;
  card_address_complement?: string;
  card_address_neighborhood?: string;
  card_address_city?: string;
  card_address_state?: string;
}

export interface ParcelowOrderItem {
  reference: string;
  description: string;
  quantity: number;
  amount: number; // Em centavos
  created_at?: string;
}

export interface ParcelowHistoryLog {
  message: string;
  created_at: string;
}

export interface ParcelowCoupon {
  code: string;
  value: string;
  issuer: string;
}

export interface ParcelowCreateOrderRequest {
  reference: string;
  partner_reference?: string;
  client: ParcelowClientData;
  items: ParcelowOrderItemData[];
  coupon?: ParcelowCouponData;
  shipping?: ParcelowShippingData;
  redirect?: ParcelowRedirectData;
}

export interface ParcelowClientData {
  cpf: string; // CPF ou CNPJ
  name: string;
  email: string;
  birthdate?: string; // "YYYY-MM-DD"
  cep?: string;
  phone: string;
  address_street?: string;
  address_number?: number;
  address_neighborhood?: string;
  address_city?: string;
  address_state?: string;
  address_complement?: string;
}

export interface ParcelowOrderItemData {
  reference: string;
  description: string;
  quantity: string | number;
  amount: number; // Em centavos
}

export interface ParcelowCouponData {
  code: string;
  value: number; // Em centavos
  issuer: string; // "merchant_api"
}

export interface ParcelowShippingData {
  amount: number; // Em centavos
}

export interface ParcelowRedirectData {
  success: string;
  failed: string;
}

export interface ParcelowCreateOrderResponse {
  success: boolean;
  data: {
    order_id: number;
    url_checkout: string;
  };
}

export interface ParcelowPaymentQuestions {
  success: boolean;
  data: {
    questions: ParcelowQuestion[];
  };
}

export interface ParcelowQuestion {
  id: number;
  question: string;
  answers: ParcelowAnswer[];
}

export interface ParcelowAnswer {
  id: number;
  answer: string;
}

export interface ParcelowPaymentRequest {
  method: 'credit-card' | 'pix';
  installment?: string; // Número de parcelas (apenas para credit-card)
  card?: ParcelowCardData; // Apenas para credit-card
}

export interface ParcelowCardData {
  number: number; // Número do cartão (sem espaços)
  holder: string; // Nome do portador
  exp_month: number; // Mês de expiração (1-12)
  exp_year: number; // Ano de expiração (4 dígitos)
  cvv: number; // CVV
  brand: string; // "visa", "mastercard", etc.
  address_cep?: string;
  address_street?: string;
  address_number?: number;
  address_complement?: string;
  address_neighborhood?: string;
  address_city?: string;
  address_state?: string;
}

export interface ParcelowPaymentResponse {
  success: boolean;
  message: string;
  qrcode?: string; // URL do QR Code (apenas para PIX)
  order?: ParcelowOrder;
}

export interface ParcelowWebhookEvent {
  event: string; // "event_order_paid", "event_order_declined", etc.
  data: ParcelowOrder; // Order completa atualizada
}

export interface ParcelowClientConfig {
  clientId: number;
  clientSecret: string;
  environment: 'staging' | 'production';
  webhookUrl?: string;
}

export interface ParcelowCheckoutResult {
  order: ParcelowOrder;
  orderId: number;
  checkoutUrl: string;
}
