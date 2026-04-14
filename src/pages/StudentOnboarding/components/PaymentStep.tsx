/**
 * Etapa 7 — Application Fee (Taxa de Inscrição).
 * Valor varia por bolsa escolhida (busca application_fee_amount da scholarship).
 * Registra pagamento via /api/migma/payment-completed.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  CheckCircle, Building, Shield, Loader2, DollarSign,
} from 'lucide-react';
import { useStudentAuth } from '../../../contexts/StudentAuthContext';
import { supabase } from '../../../lib/supabase';
import { calculateCardAmountWithFees } from '../../../utils/stripeFeeCalculator';
import type { StepProps } from '../types';

interface ApplicationWithScholarship {
  id: string;
  is_application_fee_paid: boolean;
  scholarship_id: string;
  scholarships: {
    id: string;
    title?: string;
    name?: string;
    application_fee_amount: number | null;
    annual_value_with_scholarship?: number;
    universities: { name: string } | null;
  } | null;
}

export const PaymentStep: React.FC<StepProps> = ({ onNext }) => {
  const { userProfile } = useStudentAuth();
  const [applications, setApplications] = useState<ApplicationWithScholarship[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchApplications = useCallback(async () => {
    if (!userProfile?.id) return;
    try {
      const { data } = await supabase
        .from('scholarship_applications')
        .select(`
          id, is_application_fee_paid, scholarship_id,
          scholarships(id, title, name, application_fee_amount, annual_value_with_scholarship, universities(name))
        `)
        .eq('student_id', userProfile.id);

      setApplications((data as unknown as ApplicationWithScholarship[]) || []);
    } catch (err) {
      console.error('[PaymentStep]', err);
    } finally {
      setLoading(false);
    }
  }, [userProfile?.id]);

  useEffect(() => { fetchApplications(); }, [fetchApplications]);

  const alreadyPaid = userProfile?.is_application_fee_paid || applications.some(a => a.is_application_fee_paid);

  const firstApp = applications[0];
  const scholarship = firstApp?.scholarships;
  const applicationFee = scholarship?.application_fee_amount ?? 400;
  const amountWithFees = calculateCardAmountWithFees(applicationFee);

  const scholarshipName = scholarship?.title || scholarship?.name || 'Selected Scholarship';
  const universityName = scholarship?.universities?.name || '';

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-gold-medium" />
      </div>
    );
  }

  if (alreadyPaid) {
    return (
      <div className="space-y-8 pb-12 max-w-2xl mx-auto px-4">
        <div className="border border-emerald-500/20 bg-emerald-500/5 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
            <CheckCircle className="w-10 h-10 text-emerald-400" />
          </div>
          <h3 className="text-2xl font-black text-white mb-2 uppercase tracking-tight">
            Application Fee Paid!
          </h3>
          <p className="text-gray-400 mb-6">Your application fee has been confirmed.</p>
          <button
            onClick={onNext}
            className="bg-gold-medium hover:bg-gold-dark text-black py-3 px-8 rounded-xl font-black uppercase tracking-widest transition-colors"
          >
            Continue →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 max-w-4xl mx-auto px-4">
      <div className="space-y-1">
        <p className="text-xs font-black uppercase tracking-widest text-gold-medium">Etapa 7</p>
        <h2 className="text-2xl font-black text-white uppercase tracking-tight">Application Fee</h2>
        <p className="text-sm text-gray-400 font-medium">
          Pay the application fee to submit your scholarship application.
        </p>
      </div>

      {/* Resumo da bolsa */}
      {scholarship && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
            <Building className="w-6 h-6 text-gray-400" />
          </div>
          <div>
            <div className="font-bold text-white">{scholarshipName}</div>
            <div className="text-sm text-gray-500">{universityName}</div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-2xl font-black text-white">${applicationFee}</div>
            <div className="text-xs text-gray-500">Application Fee</div>
          </div>
        </div>
      )}

      {/* Fee breakdown */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
        <div className="flex justify-between text-sm text-gray-400">
          <span>Application Fee</span>
          <span className="font-semibold text-white">${applicationFee.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm text-gray-400">
          <span>Processing Fee (Stripe 3.9% + $0.30)</span>
          <span className="font-semibold text-white">${(amountWithFees - applicationFee).toFixed(2)}</span>
        </div>
        <div className="border-t border-white/10 pt-3 flex justify-between font-bold text-white">
          <span>Total Charged</span>
          <span className="text-xl">${amountWithFees.toFixed(2)}</span>
        </div>
      </div>

      {/* Info de segurança */}
      <div className="flex items-center gap-2 text-sm text-gray-500 bg-white/5 border border-white/10 rounded-xl p-3">
        <Shield className="w-4 h-4 text-gold-medium flex-shrink-0" />
        Secure payment processed by Stripe. Your card data is never stored.
      </div>

      {/* Placeholder de pagamento — integração Stripe a ser implementada */}
      <div className="bg-gold-medium/5 border border-gold-medium/20 rounded-2xl p-6 text-center space-y-3">
        <DollarSign className="w-10 h-10 text-gold-medium mx-auto" />
        <p className="text-white font-medium">
          Payment integration is being configured.
        </p>
        <p className="text-gray-400 text-sm">
          Contact your advisor to complete this payment.
        </p>
      </div>
    </div>
  );
};
