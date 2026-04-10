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
import { matriculaSupabase } from '../../../lib/matriculaSupabase';
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
      const { data } = await matriculaSupabase
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
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (alreadyPaid) {
    return (
      <div className="space-y-8 pb-12 max-w-2xl mx-auto px-4">
        <div className="bg-white border border-emerald-500/30 rounded-[2.5rem] p-8 text-center shadow-xl">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-emerald-500" />
          </div>
          <h3 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">
            Application Fee Paid!
          </h3>
          <p className="text-slate-500 mb-6">Your application fee has been confirmed.</p>
          <button
            onClick={onNext}
            className="bg-blue-600 text-white py-3 px-8 rounded-xl hover:bg-blue-700 font-bold uppercase tracking-widest shadow-lg transition-all"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 max-w-4xl mx-auto px-4">
      <div className="text-center md:text-left space-y-3">
        <h2 className="text-3xl md:text-5xl font-black text-slate-900 uppercase tracking-tighter">
          Application Fee
        </h2>
        <p className="text-lg text-slate-600 font-medium">
          Pay the application fee to submit your scholarship application.
        </p>
      </div>

      {/* Resumo da bolsa */}
      {scholarship && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
            <Building className="w-6 h-6 text-slate-500" />
          </div>
          <div>
            <div className="font-bold text-slate-900">{scholarshipName}</div>
            <div className="text-sm text-slate-500">{universityName}</div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-2xl font-black text-slate-900">${applicationFee}</div>
            <div className="text-xs text-slate-400">Application Fee</div>
          </div>
        </div>
      )}

      {/* Fee breakdown */}
      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-3">
        <div className="flex justify-between text-sm text-slate-600">
          <span>Application Fee</span>
          <span className="font-semibold">${applicationFee.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm text-slate-600">
          <span>Processing Fee (Stripe 3.9% + $0.30)</span>
          <span className="font-semibold">${(amountWithFees - applicationFee).toFixed(2)}</span>
        </div>
        <div className="border-t border-slate-200 pt-3 flex justify-between font-bold text-slate-900">
          <span>Total Charged</span>
          <span className="text-xl">${amountWithFees.toFixed(2)}</span>
        </div>
      </div>

      {/* Info de segurança */}
      <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 rounded-xl p-3">
        <Shield className="w-4 h-4 text-blue-500 flex-shrink-0" />
        Secure payment processed by Stripe. Your card data is never stored.
      </div>

      {/* Placeholder de pagamento — integração Stripe a ser implementada */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 text-center space-y-3">
        <DollarSign className="w-10 h-10 text-blue-500 mx-auto" />
        <p className="text-blue-800 font-medium">
          Payment integration is being configured.
        </p>
        <p className="text-blue-600 text-sm">
          Contact your advisor to complete this payment.
        </p>
      </div>
    </div>
  );
};
