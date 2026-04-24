import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  CheckCircle, Building, Shield, Loader2,
  Clock, AlertCircle, Building2, Upload,
} from 'lucide-react';
import { useStudentAuth } from '../../../contexts/StudentAuthContext';
import { supabase } from '../../../lib/supabase';
import { calculateCardAmountWithFees } from '../../../utils/stripeFeeCalculator';
import { ZelleUpload } from '../../../features/visa-checkout/components/steps/step3/ZelleUpload';
import { SplitPaymentSelector, type SplitPaymentConfig } from '../../../features/visa-checkout/components/steps/step3/SplitPaymentSelector';
import { processZellePaymentWithN8n } from '../../../lib/zelle-n8n-integration';
import type { StepProps } from '../types';

interface InstitutionApplication {
  id: string;
  status: string;
  payment_link_url: string | null;
  placement_fee_paid_at: string | null;
  admin_approved_at: string | null;
  institutions: { name: string; city: string; state: string } | null;
  institution_scholarships: {
    scholarship_level: string | null;
    placement_fee_usd: number;
    discount_percent: number;
    tuition_annual_usd: number;
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
export const PlacementFeeStep: React.FC<StepProps> = ({ onNext }) => {
  const { userProfile, user } = useStudentAuth();

  const [applications, setApplications] = useState<InstitutionApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [cpf, setCpf] = useState('');
  const [processing, setProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [zelleFile, setZelleFile] = useState<File | null>(null);
  const [zelleUploading, setZelleUploading] = useState(false);
  const [zelleSubmitted, setZelleSubmitted] = useState(false);
  const [confirmingZero, setConfirmingZero] = useState(false);
  const [couponOpen, setCouponOpen] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [splitConfig, setSplitConfig] = useState<SplitPaymentConfig | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('pf_return')) {
      localStorage.removeItem('pf_draft');
      const newParams = new URLSearchParams(window.location.search);
      newParams.delete('pf_return');
      newParams.delete('session_id');
      window.history.replaceState({}, '', `?${newParams.toString()}`);
    }
  }, []);

  const fetchApplications = useCallback(async () => {
    if (!userProfile?.id) return;
    try {
      const { data, error } = await supabase
        .from('institution_applications')
        .select(`
          id, status, payment_link_url, placement_fee_paid_at, admin_approved_at,
          institutions ( name, city, state ),
          institution_scholarships ( scholarship_level, placement_fee_usd, discount_percent, tuition_annual_usd )
        `)
        .eq('profile_id', userProfile.id);
      if (error) throw error;
      setApplications((data as unknown as InstitutionApplication[]) || []);
    } catch (err) {
      console.error('[PlacementFeeStep]', err);
    } finally {
      setLoading(false);
    }
  }, [userProfile?.id]);

  useEffect(() => {
    fetchApplications();
    const channel = supabase
      .channel('placement-fee-changes')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'institution_applications',
        filter: `profile_id=eq.${userProfile?.id}`,
      }, () => fetchApplications())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchApplications, userProfile?.id]);

  const activeApp = useMemo(() =>
    applications.find(a => ['payment_pending', 'payment_confirmed', 'approved'].includes(a.status)) ||
    applications.find(a => a.status === 'pending_admin_approval'),
  [applications]);

  const scholar = activeApp?.institution_scholarships;
  const placementFee = scholar?.placement_fee_usd ?? 0;
  const isZeroFee = placementFee === 0 && activeApp?.status !== 'payment_confirmed';
  const needsCpf = !!selectedMethod && ['parcelow_card', 'parcelow_pix', 'parcelow_ted'].includes(selectedMethod);
  const canPay = !!selectedMethod && selectedMethod !== 'zelle' && (!needsCpf || cpf.replace(/\D/g, '').length >= 11);
  const cardAmount = calculateCardAmountWithFees(placementFee);

  const handleConfirmZeroFee = useCallback(async () => {
    if (!userProfile?.id || !activeApp) return;
    setConfirmingZero(true);
    try {
      const now = new Date().toISOString();
      await supabase.from('institution_applications')
        .update({ status: 'payment_confirmed', placement_fee_paid_at: now })
        .eq('id', activeApp.id);
      await supabase.from('user_profiles')
        .update({ is_placement_fee_paid: true })
        .eq('id', userProfile.id);
      onNext();
    } catch (err) {
      console.error('[PlacementFeeStep] handleConfirmZeroFee:', err);
    } finally {
      setConfirmingZero(false);
    }
  }, [userProfile?.id, activeApp, onNext]);

  const handleProcessPayment = useCallback(async () => {
    if (!selectedMethod || !activeApp || !userProfile?.id || !user?.id) return;
    setPaymentError(null);
    setProcessing(true);
    try {
      // ── Split payment (Parcelow) ─────────────────────────────────────────────
      if (splitConfig?.enabled) {
        const methodMap: Record<string, string> = {
          parcelow_card: 'card',
          parcelow_pix: 'pix',
          parcelow_ted: 'ted',
        };
        const { data, error } = await supabase.functions.invoke('migma-split-parcelow-checkout', {
          body: {
            user_id: user.id,
            order_id: activeApp.id,
            email: userProfile.email,
            full_name: userProfile.full_name,
            cpf: cpf || undefined,
            service_type: 'placement_fee',
            total_amount: placementFee,
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

      // ── Pagamento normal ─────────────────────────────────────────────────────
      localStorage.setItem('pf_draft', JSON.stringify({ applicationId: activeApp.id, method: selectedMethod }));
      const { data, error } = await supabase.functions.invoke('create-placement-fee-checkout', {
        body: {
          application_id: activeApp.id,
          payment_method: selectedMethod,
          cpf: cpf || undefined,
          origin: window.location.origin,
        },
      });
      if (error) throw error;
      if (!data?.checkout_url) throw new Error('Checkout URL não recebida');
      window.location.href = data.checkout_url;
    } catch (err: any) {
      console.error('[PlacementFeeStep] handleProcessPayment:', err);
      setPaymentError(err.message || 'Erro ao processar pagamento. Tente novamente.');
      setProcessing(false);
    }
  }, [selectedMethod, cpf, splitConfig, placementFee, activeApp, userProfile, user]);

  const handleZelleUpload = useCallback(async () => {
    if (!zelleFile || !activeApp || !userProfile?.id || !user?.id) return;
    setZelleUploading(true);
    setPaymentError(null);
    try {
      const n8nResult = await processZellePaymentWithN8n(zelleFile, placementFee, 'placement-fee', user.id);
      const { error: insertErr } = await supabase.from('migma_placement_fee_zelle_pending').insert({
        application_id: activeApp.id,
        profile_id: userProfile.id,
        migma_user_id: user.id,
        amount_usd: placementFee,
        receipt_url: n8nResult.imageUrl,
        n8n_payment_id: n8nResult.paymentId,
        n8n_response: n8nResult.n8nResponse,
      });
      if (insertErr) throw insertErr;
      setZelleSubmitted(true);
    } catch (err: any) {
      console.error('[PlacementFeeStep] handleZelleUpload:', err);
      setPaymentError('Erro ao enviar comprovante. Tente novamente.');
    } finally {
      setZelleUploading(false);
    }
  }, [zelleFile, activeApp, userProfile?.id, user?.id, placementFee]);

  const isPaid = activeApp?.status === 'payment_confirmed';
  const isPendingApproval = activeApp?.status === 'pending_admin_approval';

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gold-medium" />
      </div>
    );
  }

  if (applications.length === 0) {
    return (
      <div className="text-center py-16 space-y-4">
        <Building className="w-12 h-12 text-gray-600 mx-auto opacity-20" />
        <p className="text-gray-500">Nenhuma aplicação encontrada. Selecione suas faculdades primeiro.</p>
      </div>
    );
  }

  if (isPaid) {
    return (
      <div className="space-y-8 pb-12 max-w-2xl mx-auto px-4">
        <div className="border border-emerald-500/20 bg-emerald-500/5 rounded-3xl p-10 text-center">
          <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/20">
            <CheckCircle className="w-10 h-10 text-emerald-400" />
          </div>
          <h3 className="text-3xl font-black text-white mb-3 uppercase tracking-tight">
            {placementFee === 0 ? 'Vaga Garantida!' : 'Pagamento Confirmado!'}
          </h3>
          <p className="text-gray-400 mb-8 max-w-sm mx-auto">
            {placementFee === 0
              ? <>Sua vaga na <strong>{activeApp?.institutions?.name}</strong> está confirmada com bolsa integral.</>
              : <>Sua vaga na <strong>{activeApp?.institutions?.name}</strong> está garantida. Nossa equipe entrará em contato para iniciar o processo do I-20.</>
            }
          </p>
          <button
            onClick={onNext}
            className="w-full bg-gold-medium hover:bg-gold-dark text-black py-4 px-8 rounded-2xl font-black uppercase tracking-widest transition-all shadow-lg hover:shadow-gold-medium/20"
          >
            Continuar para Próximos Passos
          </button>
        </div>
      </div>
    );
  }

  if (isPendingApproval) {
    return (
      <div className="space-y-8 pb-12 max-w-2xl mx-auto px-4">
        <div className="border border-white/5 bg-white/[0.02] rounded-3xl p-10 text-center">
          <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-amber-500/20">
            <Clock className="w-10 h-10 text-amber-400" />
          </div>
          <h3 className="text-2xl font-black text-white mb-3 uppercase tracking-tight leading-tight">
            Perfil em Revisão pela Banca Migma
          </h3>
          <p className="text-gray-400 mb-8 text-sm leading-relaxed">
            Nossa equipe está revisando sua escolha da <strong>{activeApp?.institutions?.name}</strong>.
            Assim que aprovado, você poderá realizar o pagamento aqui.
          </p>
          <div className="flex flex-col gap-3 p-4 bg-white/5 border border-white/10 rounded-2xl text-left">
            <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Sua Seleção:</p>
            <div className="flex justify-between items-center">
              <span className="text-white font-bold">{activeApp?.institutions?.name}</span>
              <span className="text-xs bg-gold-medium/10 text-gold-medium px-2 py-0.5 rounded-full font-bold">
                {scholar?.scholarship_level || `${scholar?.discount_percent}% OFF`}
              </span>
            </div>
          </div>
          <p className="mt-8 text-gray-600 text-xs">Aprovação costuma ocorrer em até 24h úteis.</p>
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

  // ── Main payment view ──────────────────────────────────────────────────────
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
          Taxa de Colocação
        </h2>
        <p className="text-gray-400 text-sm mt-2 leading-relaxed">
          Taxa de colocação calculada com base no valor anual da sua bolsa selecionada.
        </p>
      </div>

      {/* Main card */}
      <div className="bg-white/[0.04] border border-white/10 rounded-3xl overflow-hidden">

        {/* Scholarship info row */}
        <div className="p-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center shrink-0">
            <Building2 className="w-6 h-6 text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-white text-sm uppercase tracking-wide leading-tight">
              {scholar?.scholarship_level || 'Scholarship'}
            </p>
            <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
              <Building className="w-3 h-3 shrink-0" />
              {activeApp?.institutions?.name}
            </p>
            {scholar?.tuition_annual_usd && (
              <p className="text-xs text-blue-400 font-bold mt-0.5">
                Valor anual da bolsa: ${scholar.tuition_annual_usd.toLocaleString()}
              </p>
            )}
          </div>
          <div className="text-right shrink-0 ml-2">
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-0.5">Taxa de Colocação</p>
            <p className="text-3xl font-black text-white leading-none">
              ${placementFee.toLocaleString()}
              <span className="text-base font-bold text-gray-400">.00</span>
            </p>
          </div>
        </div>

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
        {isZeroFee ? (
          <div className="p-5">
            <button
              onClick={handleConfirmZeroFee}
              disabled={confirmingZero}
              className="flex items-center justify-center gap-2 w-full bg-gold-medium hover:bg-gold-light disabled:opacity-60 text-black py-4 rounded-2xl font-black uppercase tracking-widest transition-all"
            >
              {confirmingZero ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
              {confirmingZero ? 'Confirmando...' : 'Confirmar Vaga'}
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-3">

            {/* Cartão de Crédito — Stripe */}
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

            {/* Parcelow */}
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
                  ${placementFee.toLocaleString()}.00
                </p>
                <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest">Em até 12x</p>
              </div>
            </button>

            {/* Parcelow PIX */}
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
                  ${placementFee.toLocaleString()}.00
                </p>
              </div>
            </button>

            {/* Parcelow TED */}
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
                  ${placementFee.toLocaleString()}.00
                </p>
              </div>
            </button>

            {/* Zelle */}
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
                  ${placementFee.toLocaleString()}.00
                </p>
                <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest">Sem taxas</p>
              </div>
            </button>

            {/* CPF for Parcelow */}
            {needsCpf && (
              <input
                value={cpf}
                onChange={e => setCpf(e.target.value)}
                placeholder="CPF (apenas números)"
                maxLength={14}
                className="w-full bg-white/5 border border-white/10 focus:border-gold-medium/50 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 outline-none transition-colors"
              />
            )}

            {/* Split payment selector — só para Parcelow */}
            {needsCpf && (
              <SplitPaymentSelector
                totalAmount={placementFee}
                onSplitChange={setSplitConfig}
                disabled={processing}
              />
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
                  className="flex items-center justify-center gap-2 w-full bg-gold-medium hover:bg-gold-light disabled:opacity-50 text-black py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl shadow-gold-medium/10"
                >
                  {processing && <Loader2 className="w-5 h-5 animate-spin" />}
                  {processing ? 'Redirecionando...' : `Pagar $${placementFee.toLocaleString()}.00`}
                </button>
                <p className="text-[10px] text-center text-gray-600 font-bold uppercase tracking-tighter">
                  🔒 Pagamento 100% Seguro e Criptografado
                </p>
              </>
            )}
          </div>
        )}
      </div>

    </div>
  );
};
