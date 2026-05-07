/**
 * Context para detectar pagamentos Zelle pendentes ou rejeitados.
 * Usa o banco do Matricula USA (matriculaSupabase).
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { matriculaSupabase } from '../lib/matriculaSupabase';
import { useStudentAuth } from './StudentAuthContext';

interface ZellePayment {
  id: string;
  fee_type: string;
  amount: number;
  status: string;
  created_at: string;
  admin_notes?: string | null;
}

interface PaymentBlockedState {
  isBlocked: boolean;
  pendingPayment: ZellePayment | null;
  rejectedPayment: ZellePayment | null;
  approvedPayment: ZellePayment | null;
  totalPending: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const PaymentBlockedContext = createContext<PaymentBlockedState | null>(null);

export const PaymentBlockedProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useStudentAuth();
  const userIdRef = useRef<string | null>(null);

  const [state, setState] = useState<Omit<PaymentBlockedState, 'refetch'>>({
    isBlocked: false,
    pendingPayment: null,
    rejectedPayment: null,
    approvedPayment: null,
    totalPending: 0,
    loading: true,
    error: null,
  });

  const checkPayments = useCallback(async (userId: string) => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      // Tentar via RPC primeiro (igual ao Matricula USA)
      const { data, error } = await matriculaSupabase.rpc(
        'check_zelle_payments_status',
        { p_user_id: userId }
      );

      if (error) throw error;

      const result = data?.[0] ?? null;
      setState({
        isBlocked: !!result?.pending_payment,
        pendingPayment: result?.pending_payment ?? null,
        rejectedPayment: result?.rejected_payment ?? null,
        approvedPayment: result?.approved_payment ?? null,
        totalPending: result?.total_pending ?? 0,
        loading: false,
        error: null,
      });
    } catch (err: any) {
      // Fallback: query direta
      try {
        const { data: zelleData } = await matriculaSupabase
          .from('zelle_payments')
          .select('id, fee_type, amount, status, created_at, admin_notes')
          .eq('user_id', userId)
          .in('status', ['pending', 'rejected', 'approved'])
          .order('created_at', { ascending: false });

        const payments = zelleData || [];
        const pending = payments.find((p: any) => p.status === 'pending') ?? null;
        const rejected = payments.find((p: any) => p.status === 'rejected') ?? null;
        const approved = payments.find((p: any) => p.status === 'approved') ?? null;

        setState({
          isBlocked: !!pending,
          pendingPayment: pending,
          rejectedPayment: rejected,
          approvedPayment: approved,
          totalPending: payments.filter((p: any) => p.status === 'pending').length,
          loading: false,
          error: null,
        });
      } catch {
        setState(prev => ({
          ...prev,
          loading: false,
          error: 'Erro ao verificar pagamentos Zelle',
        }));
      }
    }
  }, []);

  const refetch = useCallback(() => {
    if (userIdRef.current) checkPayments(userIdRef.current);
  }, [checkPayments]);

  useEffect(() => {
    userIdRef.current = user?.id ?? null;
    if (user?.id) {
      checkPayments(user.id);
    } else {
      setState({ isBlocked: false, pendingPayment: null, rejectedPayment: null, approvedPayment: null, totalPending: 0, loading: false, error: null });
    }
  }, [user?.id, checkPayments]);

  return (
    <PaymentBlockedContext.Provider value={{ ...state, refetch }}>
      {children}
    </PaymentBlockedContext.Provider>
  );
};

export function usePaymentBlockedContext(): PaymentBlockedState {
  const ctx = useContext(PaymentBlockedContext);
  if (!ctx) throw new Error('usePaymentBlockedContext must be inside <PaymentBlockedProvider>');
  return ctx;
}
