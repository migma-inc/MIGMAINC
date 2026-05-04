import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle, ArrowLeft, Building, Building2, CheckCircle,
  Loader2, Shield, Upload,
} from 'lucide-react';
import { useStudentAuth } from '@/contexts/StudentAuthContext';
import { supabase } from '@/lib/supabase';
import { calculateCardAmountWithFees } from '@/utils/stripeFeeCalculator';
import { ZelleUpload } from '@/features/visa-checkout/components/steps/step3/ZelleUpload';
import { processZellePaymentWithN8n } from '@/lib/zelle-n8n-integration';

// ── Icon components ──────────────────────────────────────────────────────────
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

type PaymentMethod = 'stripe' | 'parcelow_card' | 'parcelow_pix' | 'parcelow_ted' | 'zelle';

interface AppData {
  id: string;
  status: string;
  placement_fee_paid_at: string | null;
  placement_fee_installments: number | null;
  placement_fee_2nd_installment_paid_at: string | null;
  institutions: { name: string; city: string; state: string; logo_url: string | null } | null;
  institution_scholarships: {
    scholarship_level: string | null;
    placement_fee_usd: number;
    discount_percent: number;
  } | null;
}

export function PlacementFee2ndInstallmentPage() {
  const navigate = useNavigate();
  const { userProfile, user } = useStudentAuth();

  const [app, setApp] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [cpf, setCpf] = useState('');
  const [processing, setProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [zelleFile, setZelleFile] = useState<File | null>(null);
  const [zelleUploading, setZelleUploading] = useState(false);
  const [zelleSubmitted, setZelleSubmitted] = useState(false);

  const fetchApp = useCallback(async () => {
    if (!userProfile?.id) return;
    const { data } = await supabase
      .from('institution_applications')
      .select(`
        id, status, placement_fee_paid_at, placement_fee_installments,
        placement_fee_2nd_installment_paid_at,
        institutions ( name, city, state, logo_url ),
        institution_scholarships ( scholarship_level, placement_fee_usd, discount_percent )
      `)
      .eq('profile_id', userProfile.id)
      .eq('placement_fee_installments', 2)
      .is('placement_fee_2nd_installment_paid_at', null)
      .maybeSingle();
    setApp(data as AppData | null);
    setLoading(false);
  }, [userProfile?.id]);

  useEffect(() => { fetchApp(); }, [fetchApp]);

  const placementFee = app?.institution_scholarships?.placement_fee_usd ?? 0;
  const amountDue = Math.ceil(placementFee / 2);
  const cardAmountDue = calculateCardAmountWithFees(amountDue);

  const needsCpf = !!selectedMethod && ['parcelow_card', 'parcelow_pix', 'parcelow_ted'].includes(selectedMethod);
  const canPay = !!selectedMethod && selectedMethod !== 'zelle' &&
    (!needsCpf || cpf.replace(/\D/g, '').length >= 11);

  const handleProcessPayment = useCallback(async () => {
    if (!selectedMethod || !app || !userProfile?.id || !user?.id) return;
    setPaymentError(null);
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-placement-fee-checkout', {
        body: {
          application_id: app.id,
          payment_method: selectedMethod,
          cpf: cpf || undefined,
          origin: window.location.origin,
          placement_fee_installments: 2,
          amount_override: amountDue,
          is_2nd_installment: true,
        },
      });
      if (error) throw error;
      if (!data?.checkout_url) throw new Error('Checkout URL não recebida');
      window.location.href = data.checkout_url;
    } catch (err: any) {
      setPaymentError(err.message || 'Erro ao processar pagamento. Tente novamente.');
      setProcessing(false);
    }
  }, [selectedMethod, cpf, amountDue, app, userProfile, user]);

  const handleZelleUpload = useCallback(async () => {
    if (!zelleFile || !app || !userProfile?.id || !user?.id) return;
    setZelleUploading(true);
    setPaymentError(null);
    try {
      const n8nResult = await processZellePaymentWithN8n(zelleFile, amountDue, 'placement-fee-2nd', user.id);
      const { error } = await supabase.from('migma_placement_fee_zelle_pending').insert({
        application_id: app.id,
        profile_id: userProfile.id,
        migma_user_id: user.id,
        amount_usd: amountDue,
        receipt_url: n8nResult.imageUrl,
        n8n_payment_id: n8nResult.paymentId,
        n8n_response: n8nResult.n8nResponse,
        is_2nd_installment: true,
      });
      if (error) throw error;
      setZelleSubmitted(true);
    } catch (err: any) {
      setPaymentError('Erro ao enviar comprovante. Tente novamente.');
    } finally {
      setZelleUploading(false);
    }
  }, [zelleFile, app, userProfile?.id, user?.id, amountDue]);

  // ── States ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0804] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#CE9F48]" />
      </div>
    );
  }

  if (!app) {
    return (
      <div className="min-h-screen bg-[#0a0804] flex flex-col items-center justify-center gap-4 p-6">
        <CheckCircle className="w-16 h-16 text-emerald-400" />
        <h2 className="text-2xl font-black text-white">Tudo em dia!</h2>
        <p className="text-gray-400 text-center max-w-sm">Não há parcela pendente de Placement Fee para pagamento.</p>
        <button
          onClick={() => navigate('/student/dashboard')}
          className="mt-4 bg-[#CE9F48] text-black px-6 py-3 rounded-xl font-black uppercase tracking-widest hover:bg-[#b8892f] transition-all"
        >
          Voltar ao Dashboard
        </button>
      </div>
    );
  }

  if (zelleSubmitted) {
    return (
      <div className="min-h-screen bg-[#0a0804] flex flex-col items-center justify-center gap-6 p-6">
        <div className="border border-amber-500/20 bg-amber-500/5 rounded-3xl p-10 text-center max-w-md w-full">
          <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-amber-500/20">
            <Loader2 className="w-10 h-10 text-amber-400" />
          </div>
          <h3 className="text-2xl font-black text-white mb-3 uppercase tracking-tight">Comprovante Enviado</h3>
          <p className="text-gray-400 text-sm leading-relaxed max-w-sm mx-auto">
            Nosso time irá confirmar seu pagamento Zelle em até <strong>24h úteis</strong>.
            Sua carta de aceite será liberada após a confirmação.
          </p>
          <button
            onClick={() => navigate('/student/dashboard')}
            className="mt-8 w-full bg-[#CE9F48] text-black py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-[#b8892f] transition-all"
          >
            Voltar ao Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ── Main view ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0804] text-white">
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">

        {/* Back */}
        <button
          onClick={() => navigate('/student/dashboard')}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm font-bold"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar ao Dashboard
        </button>

        {/* Security badge */}
        <div className="inline-flex items-center gap-2 border border-[#CE9F48]/30 rounded-full px-3 py-1.5">
          <Shield className="w-3 h-3 text-[#CE9F48]" />
          <span className="text-[10px] font-black uppercase tracking-widest text-[#CE9F48]">Pagamento Seguro &amp; Criptografado</span>
        </div>

        {/* Title */}
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tight leading-none">2ª Parcela</h1>
          <h2 className="text-4xl font-black uppercase tracking-tight leading-none text-[#CE9F48]">Placement Fee</h2>
          <p className="text-gray-400 text-sm mt-3 leading-relaxed">
            Realize o pagamento da 2ª parcela para liberar sua <strong className="text-white">Carta de Aceite</strong>.
          </p>
        </div>

        {/* Card */}
        <div className="bg-white/[0.04] border border-white/10 rounded-3xl overflow-hidden">

          {/* App info */}
          <div className="p-5 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 border border-white/10 bg-white flex items-center justify-center p-1.5">
              {app.institutions?.logo_url ? (
                <img
                  src={app.institutions.logo_url}
                  alt={app.institutions.name}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full bg-white/10 rounded-xl flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-gray-400" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-white text-sm uppercase tracking-wide leading-tight">
                {app.institution_scholarships?.scholarship_level || 'Scholarship'}
              </p>
              <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                <Building className="w-3 h-3 shrink-0" />
                {app.institutions?.name}
              </p>
            </div>
            <div className="text-right shrink-0 ml-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-0.5">2ª Parcela (Final)</p>
              <p className="text-3xl font-black text-white leading-none">
                ${amountDue.toLocaleString()}
                <span className="text-base font-bold text-gray-400">.00</span>
              </p>
              <p className="text-[9px] text-gray-500 font-bold mt-0.5">Total: ${placementFee.toLocaleString()}</p>
            </div>
          </div>

          <div className="border-t border-white/8 mx-5" />



          {/* Payment methods */}
          <div className="p-5 space-y-3">

            {/* Stripe */}
            <button
              onClick={() => { setSelectedMethod('stripe'); setPaymentError(null); }}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left ${
                selectedMethod === 'stripe' ? 'border-[#CE9F48]/50 bg-[#CE9F48]/5' : 'border-white/10 bg-white/[0.02] hover:border-white/20'
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-[#635BFF]/20 flex items-center justify-center shrink-0">
                <StripeIcon className="w-5 h-5 text-[#635BFF]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-black text-sm uppercase tracking-wide ${selectedMethod === 'stripe' ? 'text-white' : 'text-gray-200'}`}>
                  Cartão de Crédito
                </p>
                <p className="text-[10px] text-gray-600 uppercase tracking-wider font-bold mt-0.5">* Podem incluir taxas</p>
              </div>
              <p className={`font-black text-lg shrink-0 ${selectedMethod === 'stripe' ? 'text-[#CE9F48]' : 'text-white'}`}>
                ${cardAmountDue.toFixed(2)}
              </p>
            </button>

            {/* Parcelow Card */}
            <button
              onClick={() => { setSelectedMethod('parcelow_card'); setPaymentError(null); }}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left ${
                selectedMethod === 'parcelow_card' ? 'border-[#CE9F48]/50 bg-[#CE9F48]/5' : 'border-white/10 bg-white/[0.02] hover:border-white/20'
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-[#1a1a4e]/60 border border-[#4040aa]/30 flex items-center justify-center shrink-0">
                <ParcelowIcon className="w-5 h-5 text-[#6060dd]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-black text-sm uppercase tracking-wide ${selectedMethod === 'parcelow_card' ? 'text-white' : 'text-gray-200'}`}>
                  Parcelow — Cartão
                </p>
                <p className="text-[10px] text-gray-600 uppercase tracking-wider font-bold mt-0.5">Em até 12x</p>
              </div>
              <p className={`font-black text-lg shrink-0 ${selectedMethod === 'parcelow_card' ? 'text-[#CE9F48]' : 'text-white'}`}>
                ${amountDue.toLocaleString()}.00
              </p>
            </button>

            {/* Parcelow PIX */}
            <button
              onClick={() => { setSelectedMethod('parcelow_pix'); setPaymentError(null); }}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left ${
                selectedMethod === 'parcelow_pix' ? 'border-[#CE9F48]/50 bg-[#CE9F48]/5' : 'border-white/10 bg-white/[0.02] hover:border-white/20'
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-[#1a1a4e]/60 border border-[#4040aa]/30 flex items-center justify-center shrink-0">
                <ParcelowIcon className="w-5 h-5 text-[#6060dd]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-black text-sm uppercase tracking-wide ${selectedMethod === 'parcelow_pix' ? 'text-white' : 'text-gray-200'}`}>
                  Parcelow — PIX
                </p>
                <p className="text-[10px] text-gray-600 uppercase tracking-wider font-bold mt-0.5">Via Parcelow</p>
              </div>
              <p className={`font-black text-lg shrink-0 ${selectedMethod === 'parcelow_pix' ? 'text-[#CE9F48]' : 'text-white'}`}>
                ${amountDue.toLocaleString()}.00
              </p>
            </button>

            {/* Parcelow TED */}
            <button
              onClick={() => { setSelectedMethod('parcelow_ted'); setPaymentError(null); }}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left ${
                selectedMethod === 'parcelow_ted' ? 'border-[#CE9F48]/50 bg-[#CE9F48]/5' : 'border-white/10 bg-white/[0.02] hover:border-white/20'
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-[#1a1a4e]/60 border border-[#4040aa]/30 flex items-center justify-center shrink-0">
                <ParcelowIcon className="w-5 h-5 text-[#6060dd]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-black text-sm uppercase tracking-wide ${selectedMethod === 'parcelow_ted' ? 'text-white' : 'text-gray-200'}`}>
                  Parcelow — TED
                </p>
                <p className="text-[10px] text-gray-600 uppercase tracking-wider font-bold mt-0.5">Via Parcelow</p>
              </div>
              <p className={`font-black text-lg shrink-0 ${selectedMethod === 'parcelow_ted' ? 'text-[#CE9F48]' : 'text-white'}`}>
                ${amountDue.toLocaleString()}.00
              </p>
            </button>

            {/* Zelle */}
            <button
              onClick={() => { setSelectedMethod('zelle'); setPaymentError(null); }}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left ${
                selectedMethod === 'zelle' ? 'border-[#CE9F48]/50 bg-[#CE9F48]/5' : 'border-white/10 bg-white/[0.02] hover:border-white/20'
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
                  ⏱ Processamento pode levar até 48h
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className={`font-black text-lg ${selectedMethod === 'zelle' ? 'text-[#CE9F48]' : 'text-white'}`}>
                  ${amountDue.toLocaleString()}.00
                </p>
                <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest">Sem taxas</p>
              </div>
            </button>

            {/* CPF input for Parcelow */}
            {needsCpf && (
              <div className="p-4 bg-white/[0.03] border border-white/10 rounded-2xl space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400">CPF do Pagador</label>
                <input
                  value={cpf}
                  onChange={e => setCpf(e.target.value)}
                  placeholder="000.000.000-00"
                  className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 outline-none focus:border-[#CE9F48]/50 transition-colors"
                />
              </div>
            )}

            {/* Zelle upload */}
            {selectedMethod === 'zelle' && (
              <div className="space-y-3">
                <ZelleUpload
                  onFileSelect={file => { setZelleFile(file); setPaymentError(null); }}
                  currentFile={zelleFile}
                  onClear={() => setZelleFile(null)}
                />
                <button
                  onClick={handleZelleUpload}
                  disabled={!zelleFile || zelleUploading}
                  className="flex items-center justify-center gap-2 w-full bg-[#CE9F48] hover:bg-[#b8892f] disabled:opacity-50 text-black py-3 rounded-2xl font-black uppercase tracking-widest text-sm transition-all"
                >
                  {zelleUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {zelleUploading ? 'Enviando...' : 'Enviar Comprovante'}
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
                  className="flex items-center justify-center gap-2 w-full bg-[#CE9F48] hover:bg-[#b8892f] disabled:opacity-50 text-black py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl shadow-[#CE9F48]/10"
                >
                  {processing && <Loader2 className="w-5 h-5 animate-spin" />}
                  {processing ? 'Redirecionando...' : `Pagar $${(selectedMethod === 'stripe' ? cardAmountDue : amountDue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} — 2ª Parcela`}
                </button>
                <p className="text-[10px] text-center text-gray-600 font-bold uppercase tracking-tighter">
                  🔒 Pagamento 100% Seguro e Criptografado
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
