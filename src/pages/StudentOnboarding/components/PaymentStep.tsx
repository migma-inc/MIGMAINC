/**
 * Etapa — Application Fee (Taxa de Matrícula).
 * Usa exclusivamente as keys do projeto MatriculaUSA (MATRICULAUSA_*).
 * Zelle: pay@matriculausa.com
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  CheckCircle, Building, Shield, Loader2, AlertCircle, Upload, Clock,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useStudentAuth } from '../../../contexts/StudentAuthContext';
import { supabase } from '../../../lib/supabase';
import {
  calculateCardAmountWithFees,
  getExchangeRate,
  calculatePIXTotalWithIOF,
} from '../../../utils/stripeFeeCalculator';
import { ZelleUpload } from '../../../features/visa-checkout/components/steps/step3/ZelleUpload';
import { SplitPaymentSelector, type SplitPaymentConfig } from '../../../features/visa-checkout/components/steps/step3/SplitPaymentSelector';
import { processZellePaymentWithN8n } from '../../../lib/zelle-n8n-integration';
import type { StepProps } from '../types';

const MATRICULAUSA_ZELLE_EMAIL = 'pay@matriculausa.com';

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

type PaymentMethod = 'stripe' | 'parcelow_card' | 'parcelow_pix' | 'parcelow_ted' | 'zelle';

// ─── Icon components ───────────────────────────────────────────────────────────
const StripeIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" />
  </svg>
);

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
  const [couponOpen, setCouponOpen] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [exchangeRate, setExchangeRate] = useState(5.6);
  const [splitConfig, setSplitConfig] = useState<SplitPaymentConfig | null>(null);

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

  useEffect(() => {
    fetchApplications();
    getExchangeRate().then(setExchangeRate);
  }, [fetchApplications]);

  const alreadyPaid = userProfile?.is_application_fee_paid || applications.some(a => a.is_application_fee_paid);
  const firstApp = applications[0];
  const scholarship = firstApp?.scholarships;
  const applicationFee = scholarship?.application_fee_amount ?? 400;
  const cardAmount = calculateCardAmountWithFees(applicationFee);
  const pixTotal = calculatePIXTotalWithIOF(applicationFee, exchangeRate);
  const scholarshipName = scholarship?.title || scholarship?.name || 'Selected Scholarship';
  const universityName = scholarship?.universities?.name || '';

  const needsCpf = !!selectedMethod && ['parcelow_card', 'parcelow_pix', 'parcelow_ted'].includes(selectedMethod);
  const canPay = !!selectedMethod && selectedMethod !== 'zelle' &&
    (!needsCpf || cpf.replace(/\D/g, '').length >= 11);

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
            email: userProfile.email,
            full_name: userProfile.full_name,
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
        if (!data?.part1_checkout_url) throw new Error('URL do split não recebida');
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
        },
      });
      if (error) throw error;
      if (!data?.checkout_url) throw new Error('Checkout URL não recebida');
      window.location.href = data.checkout_url;
    } catch (err: any) {
      console.error('[PaymentStep] handleProcessPayment:', err);
      setPaymentError(err.message || 'Erro ao processar pagamento. Tente novamente.');
      setProcessing(false);
    }
  }, [selectedMethod, cpf, splitConfig, applicationFee, firstApp, userProfile, user]);

  const handleZelleUpload = useCallback(async () => {
    if (!zelleFile || !firstApp || !userProfile?.id || !user?.id) return;
    setZelleUploading(true);
    setPaymentError(null);
    try {
      const n8nResult = await processZellePaymentWithN8n(zelleFile, applicationFee, 'application-fee', user.id);
      const { error: insertErr } = await supabase.from('application_fee_zelle_pending').insert({
        scholarship_application_id: firstApp.id,
        profile_id: userProfile.id,
        migma_user_id: user.id,
        amount_usd: applicationFee,
        receipt_url: n8nResult.imageUrl,
        n8n_payment_id: n8nResult.paymentId,
        n8n_response: n8nResult.n8nResponse,
      });
      if (insertErr) throw insertErr;
      setZelleSubmitted(true);
    } catch (err: any) {
      console.error('[PaymentStep] handleZelleUpload:', err);
      setPaymentError('Erro ao enviar comprovante. Tente novamente.');
    } finally {
      setZelleUploading(false);
    }
  }, [zelleFile, firstApp, userProfile?.id, user?.id, applicationFee]);

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
            {t('student_onboarding.payment.paid_title')}
          </h3>
          <p className="text-gray-400 mb-8">{t('student_onboarding.payment.paid_desc')}</p>
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

  if (zelleSubmitted) {
    return (
      <div className="space-y-8 pb-12 max-w-2xl mx-auto px-4">
        <div className="border border-amber-500/20 bg-amber-500/5 rounded-3xl p-10 text-center">
          <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-amber-500/20">
            <Clock className="w-10 h-10 text-amber-400" />
          </div>
          <h3 className="text-2xl font-black text-white mb-3 uppercase tracking-tight">
            Comprovante Enviado
          </h3>
          <p className="text-gray-400 text-sm leading-relaxed max-w-sm mx-auto">
            Nosso time irá confirmar seu pagamento Zelle em até <strong>24h úteis</strong>.
            Você receberá uma notificação quando confirmado.
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
        <span className="text-[10px] font-black uppercase tracking-widest text-gold-medium">Pagamento Seguro &amp; Criptografado</span>
      </div>

      {/* Title */}
      <div>
        <h2 className="text-4xl font-black text-white uppercase tracking-tight leading-none">
          Taxa de Matrícula
        </h2>
        <p className="text-gray-400 text-sm mt-2 leading-relaxed">
          Pague a taxa de matrícula da bolsa selecionada para confirmar oficialmente sua escolha e garantir sua vaga.
        </p>
      </div>

      {/* Main card */}
      <div className="bg-white/[0.04] border border-white/10 rounded-3xl overflow-hidden">

        {/* Scholarship info row */}
        {scholarship && (
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
            </div>
            <div className="text-right shrink-0 ml-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-0.5">Taxa de Matrícula</p>
              <p className="text-3xl font-black text-white leading-none">
                ${applicationFee.toLocaleString()}
                <span className="text-base font-bold text-gray-400">.00</span>
              </p>
            </div>
          </div>
        )}

        <div className="border-t border-white/8 mx-5" />

        {/* Coupon section */}
        <div className="p-5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setCouponOpen(!couponOpen); setCouponCode(''); }}
              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all shrink-0 ${
                couponOpen ? 'bg-gold-medium border-gold-medium' : 'border-white/30 hover:border-white/50'
              }`}
            >
              {couponOpen && <CheckCircle className="w-3.5 h-3.5 text-black" />}
            </button>
            <span className="font-black text-white text-sm">Cupom Promocional</span>
            {couponOpen && (
              <>
                <input
                  value={couponCode}
                  onChange={e => setCouponCode(e.target.value)}
                  placeholder="Digite o código"
                  className="flex-1 bg-white/5 border border-white/15 rounded-xl px-4 py-2 text-white text-sm placeholder-gray-600 outline-none focus:border-gold-medium/50 transition-colors min-w-0"
                />
                <button className="shrink-0 bg-white/10 hover:bg-white/15 border border-white/20 text-white text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-xl transition-all">
                  Validar Código
                </button>
              </>
            )}
          </div>
        </div>

        <div className="border-t border-white/8 mx-5" />

        {/* Payment methods */}
        <div className="p-5 space-y-3">

          {/* Cartão de Crédito — Stripe MatriculaUSA */}
          <button
            onClick={() => { setSelectedMethod('stripe'); setPaymentError(null); }}
            className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left ${
              selectedMethod === 'stripe'
                ? 'border-gold-medium/50 bg-gold-medium/5'
                : 'border-white/10 bg-white/[0.02] hover:border-white/20'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-[#635BFF]/20 flex items-center justify-center shrink-0">
              <StripeIcon className="w-5 h-5 text-[#635BFF]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-black text-sm uppercase tracking-wide ${selectedMethod === 'stripe' ? 'text-white' : 'text-gray-200'}`}>
                Cartão de Crédito
              </p>
              <p className="text-[10px] text-gray-600 uppercase tracking-wider font-bold mt-0.5">
                * Podem incluir taxas de processamento
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className={`font-black text-lg ${selectedMethod === 'stripe' ? 'text-gold-medium' : 'text-white'}`}>
                ${cardAmount.toFixed(2)}
              </p>
            </div>
          </button>

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
                Parcelow — Cartão
              </p>
              <p className="text-[10px] text-gray-600 uppercase tracking-wider font-bold mt-0.5">
                * Podem incluir taxas de operadora e processamento da plataforma
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className={`font-black text-lg ${selectedMethod === 'parcelow_card' ? 'text-gold-medium' : 'text-white'}`}>
                ${applicationFee.toLocaleString()}.00
              </p>
              <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest">Em até 12x</p>
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
                Via Parcelow · Podem incluir taxas
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
                Via Parcelow · Podem incluir taxas
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
                ⏱ Processamento pode levar até 48 horas
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className={`font-black text-lg ${selectedMethod === 'zelle' ? 'text-gold-medium' : 'text-white'}`}>
                ${applicationFee.toLocaleString()}.00
              </p>
              <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest">Sem taxas</p>
            </div>
          </button>

          {/* CPF para Parcelow */}
          {needsCpf && (
            <input
              value={cpf}
              onChange={e => setCpf(e.target.value)}
              placeholder="CPF (apenas números)"
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
                {zelleUploading ? 'Enviando e Validando...' : 'Enviar Comprovante'}
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
                {processing ? 'Redirecionando...' : `Pagar $${applicationFee.toLocaleString()}.00`}
              </button>
              <p className="text-[10px] text-center text-gray-600 font-bold uppercase tracking-tighter">
                🔒 Pagamento 100% Seguro e Criptografado
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
