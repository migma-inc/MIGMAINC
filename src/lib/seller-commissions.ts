/**
 * Helper functions for managing seller commissions
 */

import { supabase } from './supabase';

export interface SellerCommission {
  id: string;
  seller_id: string;
  order_id: string;
  net_amount_usd: number;
  commission_percentage: number;
  commission_amount_usd: number;
  commission_status: 'pending' | 'paid' | 'cancelled';
  payment_date: string | null;
  calculation_method: 'individual' | 'monthly_accumulated';
  created_at: string;
  updated_at: string;
}

export type CommissionStats = {
  currentMonth: number;
  totalPending: number;
  totalPaid: number;
  totalAmount: number;
};

/**
 * Calculate net amount from order (total_price_usd - fee_amount)
 * Helper function to extract net amount from order data
 */
export function calculateNetAmount(order: any): number {
  const totalPrice = parseFloat(order.total_price_usd || '0');
  const metadata = order.payment_metadata as any;
  
  // If payment_metadata has fee_amount, subtract it
  if (metadata?.fee_amount) {
    const feeAmount = parseFloat(metadata.fee_amount);
    return Math.max(totalPrice - feeAmount, 0); // Ensure non-negative
  }
  
  // Zelle or other methods without fees: return total_price
  return Math.max(totalPrice, 0);
}

/**
 * Get all commissions for a seller
 * @param sellerId - Seller ID (seller_id_public)
 * @param period - Optional: 'month' for current month, 'all' for all time
 * @returns Array of commission records
 */
export async function getSellerCommissions(
  sellerId: string,
  period?: 'month' | 'all'
): Promise<SellerCommission[]> {
  try {
    let query = supabase
      .from('seller_commissions')
      .select('*')
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false });

    // Filter by period if specified
    if (period === 'month') {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      query = query.gte('created_at', startOfMonth.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      console.error('[SELLER_COMMISSIONS] Error fetching commissions:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[SELLER_COMMISSIONS] Exception fetching commissions:', error);
    return [];
  }
}

/**
 * Get aggregated commission statistics for a seller
 * @param sellerId - Seller ID (seller_id_public)
 * @param period - Optional: 'month' for current month, 'all' for all time
 * @returns Commission statistics
 */
export async function getSellerCommissionStats(
  sellerId: string,
  period?: 'month' | 'all'
): Promise<CommissionStats> {
  try {
    // Get start date for current month if period is 'month'
    const startDate = period === 'month' 
      ? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
      : null;

    // Build query for current month commissions
    let monthQuery = supabase
      .from('seller_commissions')
      .select('commission_amount_usd, commission_status')
      .eq('seller_id', sellerId);

    if (startDate) {
      monthQuery = monthQuery.gte('created_at', startDate);
    }

    const { data: monthData, error: monthError } = await monthQuery;

    if (monthError) {
      console.error('[SELLER_COMMISSIONS] Error fetching month stats:', monthError);
      return {
        currentMonth: 0,
        totalPending: 0,
        totalPaid: 0,
        totalAmount: 0,
      };
    }

    // Calculate current month total
    const currentMonth = (monthData || []).reduce(
      (sum, c) => sum + parseFloat(c.commission_amount_usd || '0'),
      0
    );

    // Get all commissions for pending/paid stats
    const { data: allData, error: allError } = await supabase
      .from('seller_commissions')
      .select('commission_amount_usd, commission_status')
      .eq('seller_id', sellerId);

    if (allError) {
      console.error('[SELLER_COMMISSIONS] Error fetching all stats:', allError);
      return {
        currentMonth,
        totalPending: 0,
        totalPaid: 0,
        totalAmount: 0,
      };
    }

    // Calculate pending and paid totals
    const totalPending = (allData || [])
      .filter(c => c.commission_status === 'pending')
      .reduce((sum, c) => sum + parseFloat(c.commission_amount_usd || '0'), 0);

    const totalPaid = (allData || [])
      .filter(c => c.commission_status === 'paid')
      .reduce((sum, c) => sum + parseFloat(c.commission_amount_usd || '0'), 0);

    const totalAmount = (allData || []).reduce(
      (sum, c) => sum + parseFloat(c.commission_amount_usd || '0'),
      0
    );

    return {
      currentMonth: Math.round(currentMonth * 100) / 100, // Round to 2 decimals
      totalPending: Math.round(totalPending * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      totalAmount: Math.round(totalAmount * 100) / 100,
    };
  } catch (error) {
    console.error('[SELLER_COMMISSIONS] Exception fetching stats:', error);
    return {
      currentMonth: 0,
      totalPending: 0,
      totalPaid: 0,
      totalAmount: 0,
    };
  }
}
