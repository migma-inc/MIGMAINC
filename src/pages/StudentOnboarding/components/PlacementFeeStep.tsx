/**
 * Etapa 8 — Placement Fee (fluxo Migma).
 * Valor = 20% do annual_value_with_scholarship da bolsa escolhida.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  CheckCircle, Building, Shield, Loader2, Award, DollarSign,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useStudentAuth } from '../../../contexts/StudentAuthContext';
import { supabase } from '../../../lib/supabase';
import { getPlacementFee, formatPlacementFee } from '../../../utils/placementFeeCalculator';
import { calculateCardAmountWithFees } from '../../../utils/stripeFeeCalculator';
import type { StepProps } from '../types';

interface ApplicationWithScholarship {
  id: string;
  is_placement_fee_paid?: boolean;
  scholarship_id: string;
  scholarships: {
    id: string;
    title?: string;
    name?: string;
    annual_value_with_scholarship: number;
    placement_fee_amount?: number | null;
    universities: { name: string } | null;
  } | null;
}

export const PlacementFeeStep: React.FC<StepProps> = ({ onNext }) => {
  const { t } = useTranslation();
  const { userProfile } = useStudentAuth();
  const [applications, setApplications] = useState<ApplicationWithScholarship[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchApplications = useCallback(async () => {
    if (!userProfile?.id) return;
    try {
      const { data } = await supabase
        .from('scholarship_applications')
        .select(`
          id, is_placement_fee_paid, scholarship_id,
          scholarships(id, title, name, annual_value_with_scholarship, placement_fee_amount, universities(name))
        `)
        .eq('student_id', userProfile.id);
      setApplications((data as unknown as ApplicationWithScholarship[]) || []);
    } catch (err) {
      console.error('[PlacementFeeStep]', err);
    } finally {
      setLoading(false);
    }
  }, [userProfile?.id]);

  useEffect(() => { fetchApplications(); }, [fetchApplications]);

  const alreadyPaid = userProfile?.is_placement_fee_paid || applications.some(a => a.is_placement_fee_paid);

  const firstApp = applications[0];
  const scholarship = firstApp?.scholarships;
  const annualValue = scholarship?.annual_value_with_scholarship ?? 0;
  const placementFee = getPlacementFee(annualValue, scholarship?.placement_fee_amount);
  const amountWithFees = calculateCardAmountWithFees(placementFee);
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
            {t('student_onboarding.placement_fee.paid_title')}
          </h3>
          <p className="text-gray-400 mb-6">
            {t('student_onboarding.placement_fee.paid_desc')}
          </p>
          <button
            onClick={onNext}
            className="bg-gold-medium hover:bg-gold-dark text-black py-3 px-8 rounded-xl font-black uppercase tracking-widest transition-colors"
          >
            {t('student_onboarding.placement_fee.see_applications')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 max-w-4xl mx-auto px-4">
      <div className="space-y-1">
        <p className="text-xs font-black uppercase tracking-widest text-gold-medium">{t('student_onboarding.placement_fee.step_label')}</p>
        <h2 className="text-2xl font-black text-white uppercase tracking-tight">{t('student_onboarding.placement_fee.title')}</h2>
        <p className="text-sm text-gray-400 font-medium">
          {t('student_onboarding.placement_fee.subtitle')}
        </p>
      </div>

      {/* Resumo da bolsa */}
      {scholarship && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
            <Building className="w-6 h-6 text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-white truncate">{scholarshipName}</div>
            <div className="text-sm text-gray-500">{universityName}</div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-xs text-gray-500">{t('student_onboarding.placement_fee.annual_value')}</div>
            <div className="font-bold text-white">${annualValue.toLocaleString()}</div>
          </div>
        </div>
      )}

      {/* Cálculo do placement fee */}
      <div className="bg-gold-medium/5 border border-gold-medium/20 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Award className="w-6 h-6 text-gold-medium" />
          <span className="font-bold text-white">{t('student_onboarding.placement_fee.calc_title')}</span>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-gray-400">
            <span>{t('student_onboarding.placement_fee.annual_value')}</span>
            <span className="text-white">${annualValue.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-gray-400">
            <span>{t('student_onboarding.placement_fee.rate')}</span>
            <span className="text-white">20%</span>
          </div>
          <div className="border-t border-gold-medium/20 pt-2 flex justify-between font-bold text-lg">
            <span className="text-white">{t('student_onboarding.placement_fee.fee_label')}</span>
            <span className="text-gold-medium">{formatPlacementFee(placementFee)}</span>
          </div>
        </div>
      </div>

      {/* Fee breakdown total */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
        <div className="flex justify-between text-sm text-gray-400">
          <span>{t('student_onboarding.placement_fee.fee_label')}</span>
          <span className="font-semibold text-white">{formatPlacementFee(placementFee)}</span>
        </div>
        <div className="flex justify-between text-sm text-gray-400">
          <span>{t('student_onboarding.placement_fee.processing_fee')}</span>
          <span className="font-semibold text-white">${(amountWithFees - placementFee).toFixed(2)}</span>
        </div>
        <div className="border-t border-white/10 pt-3 flex justify-between font-bold text-white">
          <span>{t('student_onboarding.placement_fee.total')}</span>
          <span className="text-xl">${amountWithFees.toFixed(2)}</span>
        </div>
      </div>

      {/* Segurança */}
      <div className="flex items-center gap-2 text-sm text-gray-500 bg-white/5 border border-white/10 rounded-xl p-3">
        <Shield className="w-4 h-4 text-gold-medium flex-shrink-0" />
        {t('student_onboarding.placement_fee.secure')}
      </div>

      {/* Placeholder de pagamento */}
      <div className="bg-gold-medium/5 border border-gold-medium/20 rounded-2xl p-6 text-center space-y-3">
        <DollarSign className="w-10 h-10 text-gold-medium mx-auto" />
        <p className="text-white font-medium">
          {t('student_onboarding.placement_fee.integration_pending')}
        </p>
        <p className="text-gray-400 text-sm">
          {t('student_onboarding.placement_fee.contact_advisor')}
        </p>
      </div>
    </div>
  );
};
