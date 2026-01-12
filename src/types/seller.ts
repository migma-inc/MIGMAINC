/**
 * TypeScript interfaces for seller-related data structures
 */

export interface SellerInfo {
  id: string;
  seller_id_public: string;
  full_name: string;
  email: string;
  status: string;
}

export interface SellerCommission {
  id: string;
  seller_id: string;
  order_id: string;
  net_amount_usd: number;
  commission_percentage: number;
  commission_amount_usd: number;
  calculation_method: 'individual' | 'monthly_accumulated';
  available_for_withdrawal_at: string | null;
  withdrawn_amount: number;
  reserved_amount: number;
  created_at: string;
  updated_at: string;
}

export interface CommissionStats {
  currentMonth: number;
  totalPending: number;
  totalPaid: number;
  totalAmount: number;
}

export interface SellerPaymentRequest {
  id: string;
  seller_id: string;
  amount: number;
  payment_method: 'stripe' | 'wise';
  payment_details: {
    email: string;
    account_id?: string;
  };
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  requested_at: string;
  approved_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  completed_at: string | null;
  payment_proof_url: string | null;
  payment_proof_file_path: string | null;
  processed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentRequestFormData {
  amount: number;
  payment_method: 'stripe' | 'wise';
  email: string;
  account_id?: string;
}

export interface SellerBalance {
  available_balance: number;
  pending_balance: number;
  next_withdrawal_date: string | null;
  can_request: boolean;
  last_request_date: string | null;
  next_request_window_start?: string | null;
  next_request_window_end?: string | null;
  is_in_request_window?: boolean;
}
