/**
 * Etapa — Application Fee (Taxa de Matrícula).
 * Usa exclusivamente as keys do projeto MatriculaUSA (MATRICULAUSA_*).
 * Zelle: pay@matriculausa.com
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  CheckCircle, Building, Shield, Loader2, AlertCircle, Upload, Clock,
} from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';
import { useStudentAuth } from '../../../contexts/StudentAuthContext';
import { supabase } from '../../../lib/supabase';
import {
  getExchangeRate,
} from '../../../utils/stripeFeeCalculator';
import { ZelleUpload } from '../../../features/visa-checkout/components/steps/step3/ZelleUpload';
import { SplitPaymentSelector, type SplitPaymentConfig } from '../../../features/visa-checkout/components/steps/step3/SplitPaymentSelector';
import { uploadZelleReceipt } from '../../../lib/zelle-n8n-integration';
import type { StepProps } from '../types';

const MATRICULAUSA_ZELLE_EMAIL = 'pay@matriculausa.com';

interface ApplicationWithScholarship {
  id: string;
  is_application_fee_paid: boolean;
  type: 'legacy' | 'v11';
  fee_amount: number;
  scholarship_name: string;
  university_name: string;
}

type PaymentMethod = 'stripe' | 'parcelow_card' | 'parcelow_pix' | 'parcelow_ted' | 'zelle';

// ─── Icon components ───────────────────────────────────────────────────────────
const ParcelowIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <rect x="2" y="2" width="20" height="20" rx="5" />
    <text x="12" y="16" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">P</text>
  </svg>
);

const ZelleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.56 8.5H13.4l4.16-5h-9.88L5.44 10h4.72L5.44 15.5h4.16l-4.16 5h9.88L17.44 14h-4.72L17.56 8.5z" />
  </svg>
);

// ─── Componente ───────────────────────────────────────────────────────────────
export const PaymentStep: React.FC<StepProps> = ({ onNext }) => {
  const { t } = useTranslation();
  const { userProfile, user } = useStudentAuth();
  const [applications, setApplications] = useState<ApplicationWithScholarship[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [cpf, setCpf] = useState('');
  const [processing, setProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [zelleFile, setZelleFile] = useState<File | null>(null);
  const [zelleUploading, setZelleUploading] = useState(false);
  const [zelleSubmitted, setZelleSubmitted] = useState(false);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [, setExchangeRate] = useState(5.6);
  const [splitConfig, setSplitConfig] = useState<SplitPaymentConfig | null>(null);
  const [cardOwnership, setCardOwnership] = useState<'own' | 'third_party'>('own');
  const [payerName, setPayerName] = useState('');
  const [payerEmail, setPayerEmail] = useState('');
  const [payerPhone, setPayerPhone] = useState('');

  // Limpar params af_return ao montar (após redirect do Stripe)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('af_return')) {
      localStorage.removeItem('af_draft');
      const newParams = new URLSearchParams(window.location.search);
      newParams.delete('af_return');
      newParams.delete('session_id');
      window.history.replaceState({}, '', `?${newParams.toString()}`);
    }
  }, []);

  const fetchApplications = useCallback(async (silent = false) => {
    if (!userProfile?.id) return;
    try {
      if (!silent) setLoading(true);
      
      // Consultamos as aplicações e o status de pagamento
      const { data, error } = await supabase
        .from('institution_applications')
        .select(`
          id, status, is_application_fee_paid,
          institutions(name, application_fee_usd)
        `)
        .eq('profile_id', userProfile.id);

      if (error) {
        console.error('[PaymentStep] Error fetching applications:', error);
        throw error;
      }

      const numDependents = userProfile?.num_dependents || 0;
      const migmaFee = 350 + (numDependents * 100);

      const normalizedV11: ApplicationWithScholarship[] = (data || []).map((app: any) => ({
        id: app.id,
        is_application_fee_paid: !!app.is_application_fee_paid,
        type: 'v11',
        fee_amount: migmaFee,
        scholarship_name: 'University Application',
        university_name: app.institutions?.name || '',
      }));

      setApplications(normalizedV11);

      // Verificar se já existe um comprovante Zelle pendente ou rejeitado
      if (!normalizedV11.some(a => a.is_application_fee_paid)) {
        const { data: zelleRecords, error: zelleErr } = await supabase
          .from('application_fee_zelle_pending')
          .select('id, status, rejection_reason')
          .eq('profile_id', userProfile.id)
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (!zelleErr && zelleRecords && zelleRecords.length > 0) {
          const latest = zelleRecords[0];
          if (latest.status === 'pending_verification') {
            setZelleSubmitted(true);
            setRejectionReason(null);
          } else if (latest.status === 'rejected') {
            setZelleSubmitted(false);
            setRejectionReason(latest.rejection_reason);
          }
        }
      }
    } catch (err) {
      console.error('[PaymentStep] fetchApplications error:', err);
    } finally {
      setLoading(false);
    }
  }, [userProfile?.id, userProfile?.num_dependents]);

  useEffect(() => {
    fetchApplications();
    getExchangeRate().then(setExchangeRate);
  }, [fetchApplications]);

  const alreadyPaid = userProfile?.is_application_fee_paid || applications.some(a => a.is_application_fee_paid);

  // Polling para atualizar status do Zelle automaticamente
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (zelleSubmitted && !alreadyPaid) {
      interval = setInterval(() => {
        fetchApplications(true);
      }, 5000); // Verifica a cada 5 segundos
    }
    return () => clearInterval(interval);
  }, [zelleSubmitted, alreadyPaid, fetchApplications]);
  const firstApp = applications[0];
  const applicationFee = firstApp?.fee_amount ?? 400;
  const scholarshipName = firstApp?.scholarship_name === 'University Application'
    ? t('student_onboarding.payment_ui.university_application', 'University Application')
    : firstApp?.scholarship_name || t('student_onboarding.payment_ui.selected_scholarship', 'Selected Scholarship');
  const universityName = firstApp?.university_name || '';

  const needsCpf = !!selectedMethod && ['parcelow_card', 'parcelow_pix', 'parcelow_ted'].includes(selectedMethod);
  const isParcelowCard = selectedMethod === 'parcelow_card';
  const isThirdParty = isParcelowCard && cardOwnership === 'third_party';
  const canPay = !!selectedMethod && selectedMethod !== 'zelle' && (
    !needsCpf || (
      isThirdParty
        ? cpf.replace(/\D/g, '').length >= 11 && payerName.trim().length > 2 && payerEmail.includes('@') && payerPhone.replace(/\D/g, '').length >= 10
        : cpf.replace(/\D/g, '').length >= 11
    )
  );

  const handleProcessPayment = useCallback(async () => {
    if (!selectedMethod || !firstApp || !userProfile?.id || !user?.id) return;
    setPaymentError(null);
    setProcessing(true);

    try {
      // ── Split payment (Parcelow MatriculaUSA) ────────────────────────────────
      if (splitConfig?.enabled) {
        const methodMap: Record<string, string> = {
          parcelow_card: 'parcelow_card',
          parcelow_pix: 'parcelow_pix',
          parcelow_ted: 'parcelow_ted',
        };
        const { data, error } = await supabase.functions.invoke('matriculausa-split-parcelow-checkout', {
          body: {
            user_id: user.id,
            scholarship_application_id: firstApp.id,
            email: isThirdParty ? payerEmail : userProfile.email,
            full_name: isThirdParty ? payerName : userProfile.full_name,
            phone: isThirdParty ? payerPhone : undefined,
            cpf: cpf || undefined,
            total_amount: applicationFee,
            part1_amount: splitConfig.part1_amount,
            part1_method: methodMap[selectedMethod] ?? splitConfig.part1_method,
            part2_amount: splitConfig.part2_amount,
            part2_method: splitConfig.part2_method,
            origin: window.location.origin,
          },
        });
        if (error) throw error;
        if (!data?.part1_checkout_url) throw new Error(t('student_onboarding.payment_ui.error_split_url', 'Split URL not received'));
        if (data?.split_payment_id) sessionStorage.setItem('last_split_payment_id', data.split_payment_id);
        window.location.href = data.part1_checkout_url;
        return;
      }

      // ── Pagamento normal (Stripe ou Parcelow MatriculaUSA) ───────────────────
      localStorage.setItem('af_draft', JSON.stringify({ applicationId: firstApp.id, method: selectedMethod }));
      const { data, error } = await supabase.functions.invoke('create-application-fee-checkout', {
        body: {
          scholarship_application_id: firstApp.id,
          payment_method: selectedMethod,
          cpf: cpf || undefined,
          origin: window.location.origin,
          ...(isThirdParty && {
            payer_name: payerName,
            payer_email: payerEmail,
            payer_phone: payerPhone,
          }),
        },
      });
      if (error) throw error;
      if (!data?.checkout_url) throw new Error(t('student_onboarding.payment_ui.error_checkout_url', 'Checkout URL not received'));
      window.location.href = data.checkout_url;
    } catch (err: any) {
      console.error('[PaymentStep] handleProcessPayment:', err);
      setPaymentError(err.message || t('student_onboarding.payment_ui.error_process_payment', 'Error processing payment. Please try again.'));
      setProcessing(false);
    }
  }, [selectedMethod, cpf, splitConfig, applicationFee, firstApp, userProfile, user, isThirdParty, payerEmail, payerName, payerPhone, t]);

  const handleZelleUpload = useCallback(async () => {
    if (!zelleFile || !firstApp || !userProfile?.id || !user?.id) return;
    setZelleUploading(true);
    setPaymentError(null);
    try {
      // 1. Upload to Migma Storage
      const { imageUrl } = await uploadZelleReceipt(zelleFile, user.id);
      
      // 2. Insert into Migma DB (application_fee_zelle_pending)
      const { error: insertErr } = await supabase.from('application_fee_zelle_pending').insert({
        institution_application_id: firstApp.id,
        profile_id: userProfile.id,
        migma_user_id: user.id,
        amount_usd: applicationFee,
        receipt_url: imageUrl,
        status: 'pending_verification',
      });
      if (insertErr) throw insertErr;

      // 3. POST to MatriculaUSA (New Secure External Insert Endpoint)
      // This endpoint handles both the DB insert and the n8n trigger securely.
      const externalInsertUrl = import.meta.env.VITE_MATRICULAUSA_EXTERNAL_ZELLE_INSERT_URL;
      const webhookSecret = import.meta.env.VITE_MATRICULAUSA_ZELLE_WEBHOOK_SECRET;
      
      if (externalInsertUrl) {
        await fetch(externalInsertUrl, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-migma-webhook-secret': webhookSecret || ''
          },
          body: JSON.stringify({
            amount: applicationFee,
            screenshot_url: imageUrl,
            metadata: {
              source: 'migma',
              migma_application_id: firstApp.id,
              migma_profile_id: userProfile.id,
              migma_user_id: user.id,
              migma_student_name: userProfile.full_name,
              migma_student_email: userProfile.email,
            },
          }),
        });
      }

      setZelleSubmitted(true);
    } catch (err: any) {
      console.error('[PaymentStep] handleZelleUpload:', err);
      setPaymentError(t('student_onboarding.payment_ui.error_upload_receipt', 'Error uploading receipt. Please try again.'));
    } finally {
      setZelleUploading(false);
    }
  }, [zelleFile, firstApp, userProfile, user, applicationFee, t]);

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
        <div className="border border-emerald-500/20 bg-emerald-500/5 rounded-3xl p-10 text-center">
          <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/20">
            <CheckCircle className="w-10 h-10 text-emerald-400" />
          </div>
          <h3 className="text-3xl font-black text-white mb-3 uppercase tracking-tight">
            {t('student_onboarding.payment.already_paid_title')}
          </h3>
          <p className="text-gray-400 mb-8">{t('student_onboarding.payment.already_paid_desc')}</p>
          <button
            onClick={onNext}
            className="w-full bg-gold-medium hover:bg-gold-dark text-black py-4 px-8 rounded-2xl font-black uppercase tracking-widest transition-all"
          >
            {t('student_onboarding.payment.continue')}
          </button>
        </div>
      </div>
    );
  }

  if (!firstApp) {
    return (
      <div className="space-y-8 pb-12 max-w-2xl mx-auto px-4">
        <div className="border border-red-500/20 bg-red-500/5 rounded-3xl p-10 text-center">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20">
            <AlertCircle className="w-10 h-10 text-red-400" />
          </div>
          <h3 className="text-2xl font-black text-white mb-3 uppercase tracking-tight">
            {t('student_onboarding.payment.no_university_selected_title')}
          </h3>
          <p className="text-gray-400 text-sm leading-relaxed max-w-sm mx-auto mb-8">
            {t('student_onboarding.payment.no_university_selected_desc')}
          </p>
          <button
            onClick={() => window.location.href = '?step=scholarship_selection'}
            className="w-full bg-white/10 hover:bg-white/20 text-white py-4 px-8 rounded-2xl font-black uppercase tracking-widest transition-all"
          >
            {t('student_onboarding.payment.back_to_selection')}
          </button>
        </div>
      </div>
    );
  }

  if (zelleSubmitted) {
    return (
      <div className="space-y-8 pb-12 max-w-2xl mx-auto px-4">
        <div className="border border-amber-500/20 bg-amber-500/5 rounded-3xl p-10 text-center">
          <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-amber-500/20">
            <Clock className="w-10 h-10 text-amber-400" />
          </div>
          <h3 className="text-2xl font-black text-white mb-3 uppercase tracking-tight">
            {t('student_onboarding.payment_ui.receipt_sent', 'Receipt Sent')}
          </h3>
          <p className="text-gray-400 text-sm leading-relaxed max-w-sm mx-auto">
            <Trans
              i18nKey="student_onboarding.payment_ui.receipt_processing_desc_48h"
              defaults="Your payment is being processed and may take up to <strong>48 business hours</strong>. You will receive a notification once confirmed."
              components={{ strong: <strong /> }}
            />
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 max-w-2xl mx-auto px-4">

      {/* Security badge */}
      <div className="inline-flex items-center gap-2 border border-gold-medium/30 rounded-full px-3 py-1.5">
        <Shield className="w-3 h-3 text-gold-medium" />
        <span className="text-[10px] font-black uppercase tracking-widest text-gold-medium">{t('student_onboarding.payment_ui.secure_encrypted', 'Secure & Encrypted Payment')}</span>
      </div>

      {/* Title */}
      <div>
        <h2 className="text-4xl font-black text-white uppercase tracking-tight leading-none">
          {t('student_onboarding.payment_ui.application_fee_title', 'Application Fee')}
        </h2>
        <p className="text-gray-400 text-sm mt-2 leading-relaxed">
          {t('student_onboarding.payment_ui.application_fee_desc', 'Pay the application fee for the selected scholarship to officially confirm your choice and secure your seat.')}
        </p>
      </div>

      {/* Main card */}
      <div className="bg-white/[0.04] border border-white/10 rounded-3xl overflow-hidden">

        {/* Scholarship info row */}
        {firstApp && (
          <div className="p-5 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center shrink-0">
              <Building className="w-6 h-6 text-gray-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-white text-sm uppercase tracking-wide leading-tight truncate">
                {scholarshipName}
              </p>
              <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                <Building className="w-3 h-3 shrink-0" />
                {universityName}
              </p>
              {userProfile?.num_dependents ? (
                <p className="text-[10px] text-gold-medium/80 font-bold mt-1 uppercase tracking-wider">
                  {t('student_onboarding.payment_ui.includes_dependents', {
                    count: userProfile.num_dependents,
                    defaultValue: 'Includes {{count}} dependent(s) (+$100 each)',
                  })}
                </p>
              ) : (
                <p className="text-[10px] text-gray-600 font-bold mt-1 uppercase tracking-wider">
                  {t('student_onboarding.payment_ui.individual_no_dependents', 'Individual (No dependents)')}
                </p>
              )}
            </div>
            <div className="text-right shrink-0 ml-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-0.5">{t('student_onboarding.payment_ui.application_fee_label', 'Application Fee')}</p>
              <p className="text-3xl font-black text-white leading-none">
                ${applicationFee.toLocaleString()}
                <span className="text-base font-bold text-gray-400">.00</span>
              </p>
            </div>
          </div>
        )}

        <div className="border-t border-white/8 mx-5" />
        
        {/* Rejection Alert */}
        {rejectionReason && (
          <div className="m-5 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 font-black text-xs uppercase tracking-widest mb-1">{t('student_onboarding.payment_ui.payment_rejected', 'Payment Rejected')}</p>
              <p className="text-gray-400 text-sm leading-relaxed">{rejectionReason}</p>
              <p className="text-[10px] text-gray-500 mt-2 italic">{t('student_onboarding.payment_ui.rejection_help', '* Please check the reason and send the correct receipt below.')}</p>
            </div>
          </div>
        )}

        <div className="border-t border-white/8 mx-5" />

        {/* Payment methods */}
        <div className="p-5 space-y-3">

          {/* Parcelow — Cartão */}
          <button
            onClick={() => { setSelectedMethod('parcelow_card'); setPaymentError(null); }}
            className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left ${
              selectedMethod === 'parcelow_card'
                ? 'border-gold-medium/50 bg-gold-medium/5'
                : 'border-white/10 bg-white/[0.02] hover:border-white/20'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-[#1a1a4e]/60 border border-[#4040aa]/30 flex items-center justify-center shrink-0">
              <ParcelowIcon className="w-5 h-5 text-[#6060dd]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-black text-sm uppercase tracking-wide ${selectedMethod === 'parcelow_card' ? 'text-white' : 'text-gray-200'}`}>
                {t('student_onboarding.payment_ui.parcelow_card', 'Parcelow — Card')}
              </p>
              <p className="text-[10px] text-gray-600 uppercase tracking-wider font-bold mt-0.5">
                {t('student_onboarding.payment_ui.parcelow_fees_may_apply', '* Operator and platform processing fees may apply')}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className={`font-black text-lg ${selectedMethod === 'parcelow_card' ? 'text-gold-medium' : 'text-white'}`}>
                ${applicationFee.toLocaleString()}.00
              </p>
              <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest">{t('student_onboarding.payment_ui.up_to_12x', 'Up to 12x')}</p>
            </div>
          </button>

          {/* Parcelow — PIX */}
          <button
            onClick={() => { setSelectedMethod('parcelow_pix'); setPaymentError(null); }}
            className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left ${
              selectedMethod === 'parcelow_pix'
                ? 'border-gold-medium/50 bg-gold-medium/5'
                : 'border-white/10 bg-white/[0.02] hover:border-white/20'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-[#1a1a4e]/60 border border-[#4040aa]/30 flex items-center justify-center shrink-0">
              <ParcelowIcon className="w-5 h-5 text-[#6060dd]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-black text-sm uppercase tracking-wide ${selectedMethod === 'parcelow_pix' ? 'text-white' : 'text-gray-200'}`}>
                Parcelow — PIX
              </p>
              <p className="text-[10px] text-gray-600 uppercase tracking-wider font-bold mt-0.5">
                {t('student_onboarding.payment_ui.via_parcelow_fees', 'Via Parcelow · Fees may apply')}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className={`font-black text-lg ${selectedMethod === 'parcelow_pix' ? 'text-gold-medium' : 'text-white'}`}>
                ${applicationFee.toLocaleString()}.00
              </p>
            </div>
          </button>

          {/* Parcelow — TED */}
          <button
            onClick={() => { setSelectedMethod('parcelow_ted'); setPaymentError(null); }}
            className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left ${
              selectedMethod === 'parcelow_ted'
                ? 'border-gold-medium/50 bg-gold-medium/5'
                : 'border-white/10 bg-white/[0.02] hover:border-white/20'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-[#1a1a4e]/60 border border-[#4040aa]/30 flex items-center justify-center shrink-0">
              <ParcelowIcon className="w-5 h-5 text-[#6060dd]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-black text-sm uppercase tracking-wide ${selectedMethod === 'parcelow_ted' ? 'text-white' : 'text-gray-200'}`}>
                Parcelow — TED
              </p>
              <p className="text-[10px] text-gray-600 uppercase tracking-wider font-bold mt-0.5">
                {t('student_onboarding.payment_ui.via_parcelow_fees', 'Via Parcelow · Fees may apply')}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className={`font-black text-lg ${selectedMethod === 'parcelow_ted' ? 'text-gold-medium' : 'text-white'}`}>
                ${applicationFee.toLocaleString()}.00
              </p>
            </div>
          </button>

          {/* Zelle — pay@matriculausa.com */}
          <button
            onClick={() => { setSelectedMethod('zelle'); setPaymentError(null); }}
            className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left ${
              selectedMethod === 'zelle'
                ? 'border-gold-medium/50 bg-gold-medium/5'
                : 'border-white/10 bg-white/[0.02] hover:border-white/20'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-[#6D1ED4]/20 flex items-center justify-center shrink-0">
              <ZelleIcon className="w-5 h-5 text-[#6D1ED4]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-black text-sm uppercase tracking-wide ${selectedMethod === 'zelle' ? 'text-white' : 'text-gray-200'}`}>
                Zelle
              </p>
              <p className="text-[10px] text-gray-600 uppercase tracking-wider font-bold mt-0.5">
                {t('student_onboarding.payment_ui.zelle_processing_48h', 'Processing may take up to 48 hours')}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className={`font-black text-lg ${selectedMethod === 'zelle' ? 'text-gold-medium' : 'text-white'}`}>
                ${applicationFee.toLocaleString()}.00
              </p>
              <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest">{t('student_onboarding.payment_ui.no_fees', 'No fees')}</p>
            </div>
          </button>

          {/* Parcelow Card — seleção de titular */}
          {isParcelowCard && (
            <div className="space-y-3 p-4 bg-white/[0.03] border border-white/10 rounded-2xl">
              <p className="text-xs font-black uppercase tracking-widest text-gray-400">{t('checkout.is_card_owner_question', "Is the credit card you are going to use yours or someone else's?")}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => { setCardOwnership('own'); setPayerName(''); setPayerEmail(''); setPayerPhone(''); }}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
                    cardOwnership === 'own'
                      ? 'bg-gold-medium/20 border-gold-medium/50 text-gold-light shadow-lg shadow-gold-medium/10'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                  }`}
                >
                  {t('checkout.my_card', 'My Card')}
                </button>
                <button
                  onClick={() => setCardOwnership('third_party')}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
                    cardOwnership === 'third_party'
                      ? 'bg-gold-medium/20 border-gold-medium/50 text-gold-light shadow-lg shadow-gold-medium/10'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                  }`}
                >
                  {t('checkout.third_party_card', 'Third Party Card')}
                </button>
              </div>

              {cardOwnership === 'own' && (
                <input
                  value={cpf}
                  onChange={e => setCpf(e.target.value)}
                  placeholder={t('student_onboarding.payment_ui.your_cpf_placeholder', 'Your CPF (numbers only)')}
                  maxLength={14}
                  className="w-full bg-white/5 border border-white/10 focus:border-gold-medium/50 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 outline-none transition-colors"
                />
              )}

              {cardOwnership === 'third_party' && (
                <div className="space-y-2">
                  <p className="text-[10px] text-amber-400/80 font-bold uppercase tracking-wider">{t('checkout.payer_data_title', 'Cardholder Data')}</p>
                  <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-100/80">
                    {t(
                      'checkout.payer_data_notice',
                      'We use this information only to process this payment with the payment provider and contact the cardholder if validation is required.'
                    )}
                  </p>
                  <input
                    value={payerName}
                    onChange={e => setPayerName(e.target.value.toUpperCase())}
                    placeholder={t('student_onboarding.payment_ui.payer_name_placeholder', 'Cardholder full name')}
                    className="w-full bg-white/5 border border-white/10 focus:border-gold-medium/50 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 outline-none transition-colors"
                  />
                  <input
                    value={cpf}
                    onChange={e => setCpf(e.target.value)}
                    placeholder={t('student_onboarding.payment_ui.payer_cpf_placeholder', 'Cardholder CPF (numbers only)')}
                    maxLength={14}
                    className="w-full bg-white/5 border border-white/10 focus:border-gold-medium/50 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 outline-none transition-colors"
                  />
                  <input
                    value={payerEmail}
                    onChange={e => setPayerEmail(e.target.value)}
                    placeholder={t('student_onboarding.payment_ui.payer_email_placeholder', 'Cardholder email')}
                    type="email"
                    className="w-full bg-white/5 border border-white/10 focus:border-gold-medium/50 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 outline-none transition-colors"
                  />
                  <input
                    value={payerPhone}
                    onChange={e => setPayerPhone(e.target.value)}
                    placeholder={t('student_onboarding.payment_ui.payer_phone_placeholder', 'Cardholder WhatsApp')}
                    className="w-full bg-white/5 border border-white/10 focus:border-gold-medium/50 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 outline-none transition-colors"
                  />
                </div>
              )}
            </div>
          )}

          {/* CPF para PIX / TED */}
          {(selectedMethod === 'parcelow_pix' || selectedMethod === 'parcelow_ted') && (
            <input
              value={cpf}
              onChange={e => setCpf(e.target.value)}
              placeholder={t('student_onboarding.payment_ui.cpf_placeholder', 'CPF (numbers only)')}
              maxLength={14}
              className="w-full bg-white/5 border border-white/10 focus:border-gold-medium/50 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 outline-none transition-colors"
            />
          )}

          {/* Split payment selector — Parcelow */}
          {needsCpf && (
            <SplitPaymentSelector
              totalAmount={applicationFee}
              onSplitChange={setSplitConfig}
              disabled={processing}
            />
          )}

          {/* Zelle upload — MatriculaUSA */}
          {selectedMethod === 'zelle' && (
            <div className="space-y-3">
              <ZelleUpload
                onFileSelect={file => { setZelleFile(file); setPaymentError(null); }}
                currentFile={zelleFile}
                onClear={() => setZelleFile(null)}
                recipientEmail={MATRICULAUSA_ZELLE_EMAIL}
              />
              <button
                onClick={handleZelleUpload}
                disabled={!zelleFile || zelleUploading}
                className="flex items-center justify-center gap-2 w-full bg-gold-medium hover:bg-gold-light disabled:opacity-50 text-black py-3 rounded-2xl font-black uppercase tracking-widest text-sm transition-all"
              >
                {zelleUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {zelleUploading
                  ? t('student_onboarding.payment_ui.uploading_validating', 'Uploading and validating...')
                  : t('student_onboarding.payment_ui.send_receipt', 'Send Receipt')}
              </button>
            </div>
          )}

          {/* Error */}
          {paymentError && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">{paymentError}</p>
            </div>
          )}

          {/* CTA */}
          {selectedMethod && selectedMethod !== 'zelle' && (
            <>
              <button
                onClick={handleProcessPayment}
                disabled={!canPay || processing}
                className="flex items-center justify-center gap-2 w-full bg-gold-medium hover:bg-gold-light disabled:opacity-50 text-black py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl shadow-gold-medium/10 mt-2"
              >
                {processing && <Loader2 className="w-5 h-5 animate-spin" />}
                {processing
                  ? t('student_onboarding.payment_ui.redirecting', 'Redirecting...')
                  : t('student_onboarding.payment_ui.pay_amount', {
                      amount: applicationFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                      defaultValue: 'Pay ${{amount}}',
                    })}
              </button>
              <p className="text-[10px] text-center text-gray-600 font-bold uppercase tracking-tighter">
                {t('student_onboarding.payment_ui.secure_100', '100% secure and encrypted payment')}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
