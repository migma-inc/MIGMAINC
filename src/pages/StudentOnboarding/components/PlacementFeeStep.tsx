import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  CheckCircle, Building, Shield, Loader2, Award, DollarSign,
  Clock, AlertCircle, MapPin, CreditCard, QrCode,
  Building2, Upload, X,
} from 'lucide-react';
import { useStudentAuth } from '../../../contexts/StudentAuthContext';
import { supabase } from '../../../lib/supabase';
import type { StepProps } from '../types';

// ─── Tipos ────────────────────────────────────────────────────────────────────
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

type PaymentMethod = 'parcelow_card' | 'parcelow_pix' | 'parcelow_ted' | 'stripe' | 'zelle';

const PAYMENT_METHODS: {
  id: PaymentMethod;
  label: string;
  sublabel: string;
  Icon: React.FC<{ className?: string }>;
  fee?: string;
  needsCpf?: boolean;
}[] = [
  { id: 'parcelow_card', label: 'Cartão de Crédito',    sublabel: 'Via Parcelow', Icon: CreditCard,  needsCpf: true },
  { id: 'parcelow_pix',  label: 'PIX',                  sublabel: 'Via Parcelow', Icon: QrCode,      needsCpf: true },
  { id: 'parcelow_ted',  label: 'TED Bancário',          sublabel: 'Via Parcelow', Icon: Building2,   needsCpf: true },
  { id: 'stripe',        label: 'Cartão Internacional', sublabel: 'Via Stripe',   Icon: CreditCard,  fee: '+3.9%' },
  { id: 'zelle',         label: 'Zelle',                sublabel: 'Envio manual', Icon: DollarSign },
];

// ─── Componente ───────────────────────────────────────────────────────────────
export const PlacementFeeStep: React.FC<StepProps> = ({ onNext }) => {
  const { userProfile, user } = useStudentAuth();

  // ── State ──────────────────────────────────────────────────────────────────
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

  // ── Detectar retorno de redirect (Parcelow/Stripe) ─────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pfReturn = params.get('pf_return');
    if (pfReturn) {
      localStorage.removeItem('pf_draft');
      const newParams = new URLSearchParams(window.location.search);
      newParams.delete('pf_return');
      newParams.delete('session_id');
      window.history.replaceState({}, '', `?${newParams.toString()}`);
    }
  }, []);

  // ── Fetch applications ─────────────────────────────────────────────────────
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

  // ── Derived state — declarado ANTES dos callbacks que os utilizam ──────────
  const activeApp = useMemo(() =>
    applications.find(a => ['payment_pending', 'payment_confirmed', 'approved'].includes(a.status)) ||
    applications.find(a => a.status === 'pending_admin_approval'),
  [applications]);

  const scholar = activeApp?.institution_scholarships;
  const placementFee = scholar?.placement_fee_usd ?? 0;
  const isZeroFee = placementFee === 0 && activeApp?.status !== 'payment_confirmed';
  const needsCpf = !!selectedMethod && ['parcelow_card', 'parcelow_pix', 'parcelow_ted'].includes(selectedMethod);
  const canPay = !!selectedMethod && selectedMethod !== 'zelle' && (!needsCpf || cpf.replace(/\D/g, '').length >= 11);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleConfirmZeroFee = useCallback(async () => {
    if (!userProfile?.id || !activeApp) return;
    setConfirmingZero(true);
    try {
      const now = new Date().toISOString();
      await supabase
        .from('institution_applications')
        .update({ status: 'payment_confirmed', placement_fee_paid_at: now })
        .eq('id', activeApp.id);
      await supabase
        .from('user_profiles')
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
    if (!selectedMethod || !activeApp) return;
    setPaymentError(null);
    setProcessing(true);
    try {
      localStorage.setItem('pf_draft', JSON.stringify({ applicationId: activeApp.id, method: selectedMethod }));

      // supabase.functions.invoke() de contexto autenticado encaminha o JWT automaticamente
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
      // Não reseta processing — página vai redirecionar
    } catch (err: any) {
      console.error('[PlacementFeeStep] handleProcessPayment:', err);
      setPaymentError(err.message || 'Erro ao processar pagamento. Tente novamente.');
      setProcessing(false);
    }
  }, [selectedMethod, cpf, activeApp]);

  const handleZelleUpload = useCallback(async () => {
    if (!zelleFile || !activeApp || !userProfile?.id || !user?.id) return;
    setZelleUploading(true);
    setPaymentError(null);
    try {
      const ext = zelleFile.name.split('.').pop();
      const path = `zelle/${user.id}/${activeApp.id}-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('migma-placement-receipts')
        .upload(path, zelleFile, { upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: { publicUrl } } = supabase.storage
        .from('migma-placement-receipts')
        .getPublicUrl(path);

      // RLS permite INSERT pois auth.uid() = profile_id
      const { error: insertErr } = await supabase.from('migma_placement_fee_zelle_pending').insert({
        application_id: activeApp.id,
        profile_id: user.id,
        amount_usd: placementFee,
        receipt_url: publicUrl,
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

  // ── Render helpers ─────────────────────────────────────────────────────────
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

  // ── Pago ───────────────────────────────────────────────────────────────────
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

  // ── Aguardando Aprovação ───────────────────────────────────────────────────
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

  // ── Zelle enviado — aguardando confirmação ─────────────────────────────────
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

  // ── Pagamento ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 pb-12 max-w-4xl mx-auto px-4">
      <div className="space-y-1">
        <p className="text-xs font-black uppercase tracking-widest text-gold-medium">Próximo Passo — Step 4</p>
        <h2 className="text-3xl font-black text-white uppercase tracking-tight">Garantia da Vaga</h2>
        <p className="text-gray-400 font-medium">
          Sua bolsa foi aprovada! Realize o pagamento do Placement Fee para garantir sua vaga.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ── Coluna esq: detalhes da bolsa ── */}
        <div className="space-y-6">
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gold-medium/10 border border-gold-medium/20 flex items-center justify-center shrink-0">
                <Building className="w-7 h-7 text-gold-medium" />
              </div>
              <div>
                <h4 className="font-black text-white uppercase tracking-tight">{activeApp?.institutions?.name}</h4>
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {activeApp?.institutions?.city}, {activeApp?.institutions?.state}
                </p>
              </div>
            </div>
            <div className="space-y-3 pt-4 border-t border-white/5">
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Bolsa Concedida</span>
                <span className="text-emerald-400 font-black">
                  {scholar?.scholarship_level || `${scholar?.discount_percent}% OFF`}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Tuition Anual (Bolsista)</span>
                <span className="text-white font-bold">${scholar?.tuition_annual_usd.toLocaleString()}/yr</span>
              </div>
            </div>
          </div>

          <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-3xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-emerald-400" />
              <span className="text-sm font-black text-white uppercase tracking-widest">Proteção Migma</span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              Após o pagamento do Placement Fee, o valor da sua tuition anual é congelado por contrato.
            </p>
          </div>
        </div>

        {/* ── Coluna dir: pagamento ── */}
        <div className="bg-white/5 border border-white/10 rounded-3xl p-8 flex flex-col ring-1 ring-white/10">
          <div className="flex items-center gap-3 mb-6">
            <Award className="w-6 h-6 text-gold-medium" />
            <h3 className="font-black text-white uppercase tracking-widest text-sm">Investimento Único</h3>
          </div>

          <div className="space-y-1 mb-6">
            <p className="text-gray-500 text-xs font-black uppercase tracking-widest">Valor do Placement Fee</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-white">${placementFee.toLocaleString()}</span>
              <span className="text-gray-500 text-sm font-bold">USD</span>
            </div>
          </div>

          <div className="space-y-3 mb-6">
            {[
              'Garantia vitalícia da bolsa negociada',
              'Suporte prioritário na emissão do I-20',
              'Redução drástica no custo total da graduação',
            ].map(item => (
              <div key={item} className="flex items-start gap-3 text-xs text-gray-400">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{item}</span>
              </div>
            ))}
          </div>

          <div className="mt-auto space-y-4">
            {isZeroFee ? (
              /* $0 — confirmação direta */
              <button
                onClick={handleConfirmZeroFee}
                disabled={confirmingZero}
                className="flex items-center justify-center gap-2 w-full bg-gold-medium hover:bg-gold-light disabled:opacity-60 text-black py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl shadow-gold-medium/10"
              >
                {confirmingZero ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                {confirmingZero ? 'Confirmando...' : 'Confirmar Vaga'}
              </button>
            ) : (
              <div className="space-y-3">
                {/* Seletor de método */}
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                  Escolha o método de pagamento:
                </p>

                <div className="space-y-2">
                  {PAYMENT_METHODS.map(m => (
                    <button
                      key={m.id}
                      onClick={() => { setSelectedMethod(m.id); setPaymentError(null); }}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                        selectedMethod === m.id
                          ? 'border-gold-medium bg-gold-medium/10'
                          : 'border-white/10 bg-white/5 hover:border-white/20'
                      }`}
                    >
                      <m.Icon className={`w-5 h-5 shrink-0 ${selectedMethod === m.id ? 'text-gold-medium' : 'text-gray-400'}`} />
                      <div className="flex-1 min-w-0">
                        <span className={`font-bold text-sm block ${selectedMethod === m.id ? 'text-white' : 'text-gray-300'}`}>
                          {m.label}
                        </span>
                        <span className="text-[10px] text-gray-600">{m.sublabel}</span>
                      </div>
                      {m.fee && <span className="text-[10px] text-amber-400 font-bold shrink-0">{m.fee}</span>}
                      {selectedMethod === m.id && <CheckCircle className="w-4 h-4 text-gold-medium shrink-0" />}
                    </button>
                  ))}
                </div>

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

                {/* Zelle: upload */}
                {selectedMethod === 'zelle' && (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-400 leading-relaxed">
                      Envie o valor para <strong className="text-white">zelle@migmainc.com</strong> e anexe o comprovante:
                    </p>
                    <label className="flex flex-col items-center gap-2 p-4 border border-dashed border-white/20 rounded-xl cursor-pointer hover:border-white/40 transition-colors">
                      {zelleFile ? (
                        <div className="flex items-center gap-2 text-sm text-white">
                          <CheckCircle className="w-4 h-4 text-emerald-400" />
                          <span className="truncate max-w-[180px]">{zelleFile.name}</span>
                          <button
                            onClick={e => { e.preventDefault(); setZelleFile(null); }}
                            className="text-gray-500 hover:text-white ml-1"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <Upload className="w-6 h-6 text-gray-500" />
                          <span className="text-xs text-gray-500">Clique para selecionar (PDF, PNG, JPG)</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg"
                        className="hidden"
                        onChange={e => setZelleFile(e.target.files?.[0] || null)}
                      />
                    </label>
                    <button
                      onClick={handleZelleUpload}
                      disabled={!zelleFile || zelleUploading}
                      className="flex items-center justify-center gap-2 w-full bg-gold-medium hover:bg-gold-light disabled:opacity-50 text-black py-3 rounded-2xl font-black uppercase tracking-widest text-sm transition-all"
                    >
                      {zelleUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {zelleUploading ? 'Enviando...' : 'Enviar Comprovante'}
                    </button>
                  </div>
                )}

                {/* Erro */}
                {paymentError && (
                  <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-300">{paymentError}</p>
                  </div>
                )}

                {/* CTA Parcelow/Stripe */}
                {selectedMethod && selectedMethod !== 'zelle' && (
                  <>
                    <button
                      onClick={handleProcessPayment}
                      disabled={!canPay || processing}
                      className="flex items-center justify-center gap-2 w-full bg-gold-medium hover:bg-gold-light disabled:opacity-50 text-black py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl shadow-gold-medium/10"
                    >
                      {processing && <Loader2 className="w-5 h-5 animate-spin" />}
                      {processing ? 'Redirecionando...' : `Pagar $${placementFee.toLocaleString()}`}
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
      </div>
    </div>
  );
};
