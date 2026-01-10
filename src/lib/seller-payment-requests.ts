/**
 * Helper functions for managing seller payment requests
 */

import { supabase } from './supabase';
import type { SellerPaymentRequest, PaymentRequestFormData, SellerBalance } from '@/types/seller';

/**
 * Get seller available balance and payment request eligibility
 */
export async function getSellerBalance(sellerId: string): Promise<SellerBalance> {
  try {
    const { data, error } = await supabase.rpc('get_seller_available_balance', {
      p_seller_id: sellerId,
    });

    if (error) {
      console.error('[PAYMENT_REQUESTS] Error fetching balance:', error);
      return {
        available_balance: 0,
        pending_balance: 0,
        next_withdrawal_date: null,
        can_request: false,
        last_request_date: null,
        next_request_window_start: null,
        next_request_window_end: null,
        is_in_request_window: false,
      };
    }

    // RPC returns TABLE, so it's an array - get first row
    const result = Array.isArray(data) ? data[0] : data;
    
    console.log('[PAYMENT_REQUESTS] Balance RPC result:', { 
      rawData: data, 
      result, 
      sellerId,
      isArray: Array.isArray(data),
      dataLength: Array.isArray(data) ? data.length : 'not array'
    });

    if (!result) {
      console.warn('[PAYMENT_REQUESTS] No balance data returned for seller:', sellerId);
      return {
        available_balance: 0,
        pending_balance: 0,
        next_withdrawal_date: null,
        can_request: false,
        last_request_date: null,
        next_request_window_start: null,
        next_request_window_end: null,
        is_in_request_window: false,
      };
    }

    return {
      available_balance: parseFloat(result.available_balance || '0'),
      pending_balance: parseFloat(result.pending_balance || '0'),
      next_withdrawal_date: result.next_withdrawal_date || null,
      can_request: result.can_request || false,
      last_request_date: result.last_request_date || null,
      next_request_window_start: result.next_request_window_start || null,
      next_request_window_end: result.next_request_window_end || null,
      is_in_request_window: result.is_in_request_window || false,
    };
  } catch (error) {
    console.error('[PAYMENT_REQUESTS] Exception fetching balance:', error);
    return {
      available_balance: 0,
      pending_balance: 0,
      next_withdrawal_date: null,
      can_request: false,
      last_request_date: null,
    };
  }
}

/**
 * Check if seller can request payment
 * No frequency limit - only checks if there's available balance
 */
export async function canRequestPayment(sellerId: string): Promise<boolean> {
  const balance = await getSellerBalance(sellerId);
  return balance.available_balance > 0;
}

/**
 * Get all payment requests for a seller
 */
export async function getSellerPaymentRequests(
  sellerId: string,
  filters?: {
    status?: 'pending' | 'approved' | 'rejected' | 'completed';
    limit?: number;
  }
): Promise<SellerPaymentRequest[]> {
  try {
    let query = supabase
      .from('seller_payment_requests')
      .select('*')
      .eq('seller_id', sellerId)
      .order('requested_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[PAYMENT_REQUESTS] Error fetching requests:', error);
      return [];
    }

    return (data || []).map((req: any) => ({
      ...req,
      payment_details: typeof req.payment_details === 'string' 
        ? JSON.parse(req.payment_details) 
        : req.payment_details,
      amount: parseFloat(req.amount || req.amount_usd || '0'),
      requested_at: req.requested_at || req.created_at,
    }));
  } catch (error) {
    console.error('[PAYMENT_REQUESTS] Exception fetching requests:', error);
    return [];
  }
}

/**
 * Create a new payment request
 */
export async function createPaymentRequest(
  sellerId: string,
  formData: PaymentRequestFormData
): Promise<{ success: boolean; requestId?: string; error?: string }> {
  try {
    // Validate form data
    if (formData.amount <= 0) {
      return { success: false, error: 'Amount must be greater than zero' };
    }

    if (!formData.email || formData.email.trim() === '') {
      return { success: false, error: 'Email is required' };
    }

    // Build payment_details JSONB
    const paymentDetails: any = {
      email: formData.email.trim(),
    };

    if (formData.account_id) {
      paymentDetails.account_id = formData.account_id.trim();
    }

    // Call RPC function
    const { data, error } = await supabase.rpc('create_seller_payment_request', {
      p_seller_id: sellerId,
      p_amount: formData.amount,
      p_payment_method: formData.payment_method,
      p_payment_details: paymentDetails,
    });

    if (error) {
      console.error('[PAYMENT_REQUESTS] Error creating request:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to create payment request' 
      };
    }

    // Send notification emails asynchronously via Edge Function (non-blocking)
    // This prevents the UI from freezing while emails are being sent
    supabase.functions.invoke('send-payment-request-notifications', {
      body: { requestId: data },
    }).catch((emailError) => {
      console.error('[PAYMENT_REQUESTS] Error triggering email notifications:', emailError);
      // Don't fail the request creation if email trigger fails
    });

    return { success: true, requestId: data };
  } catch (error: any) {
    console.error('[PAYMENT_REQUESTS] Exception creating request:', error);
    return { 
      success: false, 
      error: error.message || 'An unexpected error occurred' 
    };
  }
}

/**
 * Get a single payment request by ID
 */
export async function getPaymentRequestById(
  requestId: string
): Promise<SellerPaymentRequest | null> {
  try {
    const { data, error } = await supabase
      .from('seller_payment_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (error) {
      console.error('[PAYMENT_REQUESTS] Error fetching request:', error);
      return null;
    }

    return {
      ...data,
      payment_details: typeof data.payment_details === 'string' 
        ? JSON.parse(data.payment_details) 
        : data.payment_details,
      amount: parseFloat(data.amount),
    };
  } catch (error) {
    console.error('[PAYMENT_REQUESTS] Exception fetching request:', error);
    return null;
  }
}
