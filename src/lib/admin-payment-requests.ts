/**
 * Helper functions for admin to manage payment requests
 */

import { supabase } from './supabase';
import type { SellerPaymentRequest } from '@/types/seller';

export interface PaymentRequestFilters {
  status?: 'pending' | 'approved' | 'rejected' | 'completed';
  seller_id?: string;
  payment_method?: 'stripe' | 'wise';
  start_date?: string;
  end_date?: string;
  limit?: number;
}

/**
 * Get all payment requests with optional filters
 */
export async function getAllPaymentRequests(
  filters?: PaymentRequestFilters
): Promise<SellerPaymentRequest[]> {
  try {
    let query = supabase
      .from('seller_payment_requests')
      .select(`
        *,
        sellers (
          seller_id_public,
          full_name,
          email
        )
      `)
      .order('requested_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.seller_id) {
      query = query.eq('seller_id', filters.seller_id);
    }

    if (filters?.payment_method) {
      query = query.eq('payment_method', filters.payment_method);
    }

    if (filters?.start_date) {
      query = query.gte('requested_at', filters.start_date);
    }

    if (filters?.end_date) {
      query = query.lte('requested_at', filters.end_date);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[ADMIN_PAYMENT_REQUESTS] Error fetching requests:', error);
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
    console.error('[ADMIN_PAYMENT_REQUESTS] Exception fetching requests:', error);
    return [];
  }
}

/**
 * Get payment request by ID with seller details
 */
export async function getPaymentRequestWithSeller(
  requestId: string
): Promise<(SellerPaymentRequest & { seller?: any }) | null> {
  try {
    const { data, error } = await supabase
      .from('seller_payment_requests')
      .select(`
        *,
        sellers (
          seller_id_public,
          full_name,
          email,
          phone
        )
      `)
      .eq('id', requestId)
      .single();

    if (error) {
      console.error('[ADMIN_PAYMENT_REQUESTS] Error fetching request:', error);
      return null;
    }

    return {
      ...data,
      payment_details: typeof data.payment_details === 'string' 
        ? JSON.parse(data.payment_details) 
        : data.payment_details,
      amount: parseFloat(data.amount || data.amount_usd || '0'),
      requested_at: data.requested_at || data.created_at,
      seller: data.sellers,
    };
  } catch (error) {
    console.error('[ADMIN_PAYMENT_REQUESTS] Exception fetching request:', error);
    return null;
  }
}

/**
 * Approve a payment request
 */
export async function approvePaymentRequest(
  requestId: string,
  adminId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get request details before approval for email
    const request = await getPaymentRequestWithSeller(requestId);
    if (!request) {
      return { success: false, error: 'Request not found' };
    }

    const { error } = await supabase.rpc('process_payment_request_approval', {
      p_request_id: requestId,
      p_admin_id: adminId,
    });

    if (error) {
      console.error('[ADMIN_PAYMENT_REQUESTS] Error approving request:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to approve payment request' 
      };
    }

    // Send notification email to seller
    if (request.seller?.email) {
      try {
        const { sendPaymentRequestApprovedEmail } = await import('@/lib/emails');
        await sendPaymentRequestApprovedEmail(
          request.seller.email,
          request.seller.full_name || request.seller.seller_id_public,
          request.amount,
          requestId
        );
      } catch (emailError) {
        console.error('[ADMIN_PAYMENT_REQUESTS] Error sending approval email:', emailError);
        // Don't fail the approval if email fails
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error('[ADMIN_PAYMENT_REQUESTS] Exception approving request:', error);
    return { 
      success: false, 
      error: error.message || 'An unexpected error occurred' 
    };
  }
}

/**
 * Reject a payment request
 */
export async function rejectPaymentRequest(
  requestId: string,
  adminId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!reason || reason.trim() === '') {
      return { success: false, error: 'Rejection reason is required' };
    }

    // Get request details before rejection for email
    const request = await getPaymentRequestWithSeller(requestId);
    if (!request) {
      return { success: false, error: 'Request not found' };
    }

    const { error } = await supabase.rpc('process_payment_request_rejection', {
      p_request_id: requestId,
      p_admin_id: adminId,
      p_reason: reason.trim(),
    });

    if (error) {
      console.error('[ADMIN_PAYMENT_REQUESTS] Error rejecting request:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to reject payment request' 
      };
    }

    // Send notification email to seller
    if (request.seller?.email) {
      try {
        const { sendPaymentRequestRejectedEmail } = await import('@/lib/emails');
        await sendPaymentRequestRejectedEmail(
          request.seller.email,
          request.seller.full_name || request.seller.seller_id_public,
          request.amount,
          reason.trim(),
          requestId
        );
      } catch (emailError) {
        console.error('[ADMIN_PAYMENT_REQUESTS] Error sending rejection email:', emailError);
        // Don't fail the rejection if email fails
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error('[ADMIN_PAYMENT_REQUESTS] Exception rejecting request:', error);
    return { 
      success: false, 
      error: error.message || 'An unexpected error occurred' 
    };
  }
}

/**
 * Complete a payment request (mark as paid)
 */
export async function completePaymentRequest(
  requestId: string,
  proofUrl?: string,
  proofFilePath?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get request details before completion for email
    const request = await getPaymentRequestWithSeller(requestId);
    if (!request) {
      return { success: false, error: 'Request not found' };
    }

    const { error } = await supabase.rpc('complete_payment_request', {
      p_request_id: requestId,
      p_proof_url: proofUrl || null,
      p_proof_file_path: proofFilePath || null,
    });

    if (error) {
      console.error('[ADMIN_PAYMENT_REQUESTS] Error completing request:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to complete payment request' 
      };
    }

    // Send notification email to seller
    if (request.seller?.email) {
      try {
        const { sendPaymentRequestCompletedEmail } = await import('@/lib/emails');
        await sendPaymentRequestCompletedEmail(
          request.seller.email,
          request.seller.full_name || request.seller.seller_id_public,
          request.amount,
          requestId,
          proofUrl
        );
      } catch (emailError) {
        console.error('[ADMIN_PAYMENT_REQUESTS] Error sending completion email:', emailError);
        // Don't fail the completion if email fails
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error('[ADMIN_PAYMENT_REQUESTS] Exception completing request:', error);
    return { 
      success: false, 
      error: error.message || 'An unexpected error occurred' 
    };
  }
}

/**
 * Get payment request statistics
 */
export async function getPaymentRequestStats(): Promise<{
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  completed: number;
  totalAmount: number;
  pendingAmount: number;
}> {
  try {
    const { data, error } = await supabase
      .from('seller_payment_requests')
      .select('status, amount');

    if (error) {
      console.error('[ADMIN_PAYMENT_REQUESTS] Error fetching stats:', error);
      return {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        completed: 0,
        totalAmount: 0,
        pendingAmount: 0,
      };
    }

    const stats = {
      total: data?.length || 0,
      pending: data?.filter((r: any) => r.status === 'pending').length || 0,
      approved: data?.filter((r: any) => r.status === 'approved').length || 0,
      rejected: data?.filter((r: any) => r.status === 'rejected').length || 0,
      completed: data?.filter((r: any) => r.status === 'completed').length || 0,
      totalAmount: data?.reduce((sum: number, r: any) => sum + parseFloat(r.amount || '0'), 0) || 0,
      pendingAmount: data?.filter((r: any) => r.status === 'pending')
        .reduce((sum: number, r: any) => sum + parseFloat(r.amount || '0'), 0) || 0,
    };

    return stats;
  } catch (error) {
    console.error('[ADMIN_PAYMENT_REQUESTS] Exception fetching stats:', error);
    return {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      completed: 0,
      totalAmount: 0,
      pendingAmount: 0,
    };
  }
}
