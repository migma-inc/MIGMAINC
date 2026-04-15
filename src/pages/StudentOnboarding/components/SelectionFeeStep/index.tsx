/**
 * Etapa 1 — Confirmação do pagamento da Taxa de Processo Seletivo.
 * O aluno chega aqui após o checkout da StudentRegistration page.
 * Se já pagou: mostra tela de confirmação e botão para continuar.
 * Se tem Zelle pendente: mostra tela de "em processamento".
 * Se não pagou: mostra tela de pagamento requerido.
 */
import React, { useEffect, useState } from 'react';
import { CheckCircle, ArrowRight, Clock, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStudentAuth } from '../../../../contexts/StudentAuthContext';
import { supabase } from '../../../../lib/supabase';
import type { StepProps } from '../../types';

export const SelectionFeeStep: React.FC<StepProps> = ({ onNext }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { userProfile, user, loading: authLoading } = useStudentAuth();
  const hasPaid = userProfile?.has_paid_selection_process_fee;
  const isMigma = userProfile?.source === 'migma';
  const migmaCompleted = !!userProfile?.migma_checkout_completed_at;
  const [zellePending, setZellePending] = useState<boolean | null>(null);

  useEffect(() => {
    if (authLoading) return; // Espera o perfil carregar
    
    if (isMigma && !migmaCompleted) {
      const service = userProfile?.service_type || 'transfer';
      navigate(`/student/checkout/${service}`);
    }
  }, [isMigma, migmaCompleted, userProfile?.service_type, navigate, authLoading]);

  useEffect(() => {
    if (hasPaid || !user?.id) {
      setZellePending(false);
      return;
    }
    supabase
      .from('migma_checkout_zelle_pending')
      .select('id')
      .eq('migma_user_id', user.id)
      .eq('status', 'pending_verification')
      .limit(1)
      .then(({ data }) => setZellePending((data?.length ?? 0) > 0));
  }, [hasPaid, user?.id]);

  if (!hasPaid && zellePending === null) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gold-medium" />
      </div>
    );
  }

  if (!hasPaid && zellePending) {
    return (
      <div className="space-y-8 pb-12 max-w-2xl mx-auto px-4">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-gold-medium mb-1">{t('student_onboarding.selection_fee.step_label')}</p>
          <h2 className="text-2xl font-black text-white uppercase tracking-tight">{t('student_onboarding.selection_fee.almost_there')}</h2>
        </div>

        <div className="border border-gold-medium/20 bg-gold-medium/5 rounded-2xl p-8 text-center">
          <div className="w-20 h-20 bg-gold-medium/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-gold-medium/20">
            <Clock className="w-12 h-12 text-gold-medium animate-pulse" />
          </div>
          <h3 className="text-2xl font-black text-white mb-3 uppercase tracking-tight">
            {t('student_onboarding.selection_fee.payment_processing')}
          </h3>
          <p className="text-gray-400 max-w-md mx-auto mb-6 font-medium leading-relaxed">
            {t('student_onboarding.selection_fee.processing_desc')}
          </p>
          <p className="text-gold-medium font-bold text-sm mb-8">
            {t('student_onboarding.selection_fee.time_notice')}
          </p>
          <div className="inline-flex items-center gap-3 bg-white/5 border border-white/10 text-gray-500 py-3 px-8 rounded-xl font-black uppercase tracking-widest text-sm">
            <span className="w-2 h-2 bg-gold-medium rounded-full animate-ping" />
            {t('student_onboarding.selection_fee.waiting_approval')}
          </div>
        </div>
      </div>
    );
  }

  if (!hasPaid) {
    return (
      <div className="space-y-8 pb-12 max-w-2xl mx-auto px-4">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-gold-medium mb-1">{t('student_onboarding.selection_fee.step_label')}</p>
          <h2 className="text-2xl font-black text-white uppercase tracking-tight">{t('student_onboarding.selection_fee.payment_required')}</h2>
        </div>

        <div className="border border-white/10 bg-white/5 rounded-2xl p-8 text-center">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20">
            <Clock className="w-12 h-12 text-red-400" />
          </div>
          <h3 className="text-2xl font-black text-white mb-3 uppercase tracking-tight">
            {t('student_onboarding.selection_fee.pending_fee')}
          </h3>
          <p className="text-gray-400 max-w-md mx-auto mb-8 font-medium leading-relaxed">
            {t('student_onboarding.selection_fee.pending_fee_desc')}
          </p>
          <a
            href="/student/checkout/transfer"
            className="inline-flex items-center gap-3 bg-gold-medium hover:bg-gold-dark text-black py-3 px-10 rounded-xl font-black uppercase tracking-widest transition-colors"
          >
            {t('student_onboarding.selection_fee.go_to_checkout')} <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 max-w-2xl mx-auto px-4">
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-gold-medium mb-1">{t('student_onboarding.selection_fee.step_label')}</p>
        <h2 className="text-2xl font-black text-white uppercase tracking-tight">{t('student_onboarding.selection_fee.paid_title')}</h2>
      </div>

      <div className="border border-emerald-500/20 bg-emerald-500/5 rounded-2xl p-8 text-center">
        <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/20">
          <CheckCircle className="w-12 h-12 text-emerald-400" />
        </div>
        <h3 className="text-2xl font-black text-white mb-3 uppercase tracking-tight">
          {t('student_onboarding.selection_fee.payment_confirmed')}
        </h3>
        <p className="text-gray-400 mb-8 font-medium">
          {t('student_onboarding.selection_fee.payment_confirmed_desc')}
        </p>
        <button
          onClick={onNext}
          className="inline-flex items-center gap-2 bg-gold-medium hover:bg-gold-dark text-black py-3 px-8 rounded-xl transition-colors font-black uppercase tracking-widest"
        >
          {t('student_onboarding.selection_fee.continue')} <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
