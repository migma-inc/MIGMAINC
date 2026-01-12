// Wise API Types

export interface WiseQuote {
  id: string;
  sourceCurrency: string;
  targetCurrency: string;
  sourceAmount?: number;
  targetAmount?: number;
  rate: number;
  fee: number;
  feeDetails: {
    transferwise: number;
    payIn: number;
    discount: number;
    total: number;
  };
  rateType: 'FIXED' | 'FLOATING';
  deliveryEstimate: string;
  expirationTime: string;
}

export interface WiseRecipient {
  id: string;
  profile: string;
  accountHolderName: string;
  currency: string;
  type: 'iban' | 'sort_code' | 'aba' | 'swift' | 'routing_number';
  legalType: 'PRIVATE' | 'BUSINESS';
  details: {
    iban?: string;
    sortCode?: string;
    accountNumber?: string;
    aba?: string;
    swift?: string;
    bankName?: string;
    bankAddress?: string;
    city?: string;
    country?: string;
    address?: {
      country?: string;
      addressFirstLine?: string;
      city?: string;
      postCode?: string;
      state?: string;
    };
  };
  active: boolean;
  ownedByCustomer: boolean;
  profileId: number;
}

export interface WiseTransfer {
  id: string;
  profileId: string;
  quoteId: string;
  recipientId: string;
  sourceCurrency: string;
  targetCurrency: string;
  sourceAmount: number;
  targetAmount: number;
  rate: number;
  status:
    | 'incoming_payment_waiting'
    | 'processing'
    | 'funds_converted'
    | 'outgoing_payment_sent'
    | 'bounced_back'
    | 'funds_refunded'
    | 'cancelled'
    | 'charged_back';
  reference: string;
  customerTransactionId: string;
  created: string;
  updated: string;
}

export interface WisePayment {
  id: string;
  type: 'BALANCE' | 'BANK_TRANSFER' | 'SWIFT' | 'INTERAC';
  status: 'processing' | 'completed' | 'failed';
  transferId: string;
  created: string;
}

export interface WiseWebhookEvent {
  subscription_id: string;
  event_type: string;
  data: {
    resource: string;
    current_state: string;
    previous_state?: string;
    occurred_at: string;
    transfer_id?: string;
    profile_id?: string;
    [key: string]: any;
  };
}

export interface CreateQuoteParams {
  sourceCurrency: string;
  targetCurrency: string;
  sourceAmount?: number;
  targetAmount?: number;
}

export interface CreateRecipientParams {
  currency: string;
  type: 'iban' | 'sort_code' | 'aba' | 'swift';
  accountHolderName: string;
  legalType: 'PRIVATE' | 'BUSINESS';
  details: {
    iban?: string;
    sortCode?: string;
    accountNumber?: string;
    aba?: string;
    swift?: string;
    bankName?: string;
    bankAddress?: string;
    city?: string;
    country?: string;
    address?: {
      country?: string;
      addressFirstLine?: string;
      city?: string;
      postCode?: string;
      state?: string;
    };
  };
}

export interface CreateTransferParams {
  quoteUuid: string;
  recipientId: string;
  customerTransactionId: string;
  reference?: string;
}

export interface WiseCheckoutResult {
  transfer: WiseTransfer;
  quote: WiseQuote;
  recipient: WiseRecipient;
  paymentUrl?: string;
  transferId: string;
}

export interface WiseClientConfig {
  personalToken: string;
  environment: 'sandbox' | 'production';
  profileId?: string;
}
