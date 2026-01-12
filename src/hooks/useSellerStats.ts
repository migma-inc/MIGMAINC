/**
 * Shared hook for seller statistics
 * Centralizes data fetching for Overview, Commissions, and Analytics pages
 * Ensures all pages use the same data source to avoid discrepancies
 */

import { useState, useEffect, useCallback } from 'react';
import { getSellerBalance } from '@/lib/seller-payment-requests';
import { getSellerCommissionStats } from '@/lib/seller-commissions';
// PAYMENT REQUEST - COMENTADO TEMPORARIAMENTE
// import { getSellerPaymentRequests } from '@/lib/seller-payment-requests';
import type { SellerBalance } from '@/types/seller';
import type { CommissionStats } from '@/lib/seller-commissions';

export interface SellerStats {
  balance: SellerBalance;
  commissionStats: CommissionStats;
  totalReceived: number; // Total from completed payment requests
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useSellerStats(sellerId: string | undefined): SellerStats {
  const [balance, setBalance] = useState<SellerBalance>({
    available_balance: 0,
    pending_balance: 0,
    next_withdrawal_date: null,
    can_request: false,
    last_request_date: null,
    next_request_window_start: null,
    next_request_window_end: null,
    is_in_request_window: false,
  });
  const [commissionStats, setCommissionStats] = useState<CommissionStats>({
    currentMonth: 0,
    totalPending: 0,
    totalPaid: 0,
    totalAmount: 0,
  });
  const [totalReceived, setTotalReceived] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    if (!sellerId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Load all stats in parallel
      const [balanceData, commissionData] = await Promise.all([
        getSellerBalance(sellerId),
        getSellerCommissionStats(sellerId, 'all'), // Always use 'all' for consistency
        // PAYMENT REQUEST - COMENTADO TEMPORARIAMENTE
        // getSellerPaymentRequests(sellerId, { status: 'completed' }),
      ]);

      setBalance(balanceData);
      setCommissionStats(commissionData);

      // PAYMENT REQUEST - COMENTADO TEMPORARIAMENTE
      // Calculate total received from completed payment requests
      // const received = paymentRequests.reduce((sum, req) => sum + req.amount, 0);
      setTotalReceived(0); // paymentRequests.reduce((sum, req) => sum + req.amount, 0);
    } catch (err: any) {
      console.error('[useSellerStats] Error loading stats:', err);
      setError(err.message || 'Failed to load statistics');
    } finally {
      setLoading(false);
    }
  }, [sellerId]);

  useEffect(() => {
    loadStats();
    
    // Set up interval to refresh stats periodically
    // This ensures the request window status updates when dates change
    // Refresh every minute to catch window changes (when day 1-5 starts/ends)
    const interval = setInterval(() => {
      loadStats();
    }, 60000); // Refresh every minute
    
    return () => {
      clearInterval(interval);
    };
  }, [loadStats]);

  return {
    balance,
    commissionStats,
    totalReceived,
    loading,
    error,
    refresh: loadStats,
  };
}
