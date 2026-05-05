import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  CheckCircle, Building, Shield, Loader2,
  Clock, AlertCircle, Building2, Upload,
} from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';
import { useStudentAuth } from '../../../contexts/StudentAuthContext';
import { supabase } from '../../../lib/supabase';
import { ZelleUpload } from '../../../features/visa-checkout/components/steps/step3/ZelleUpload';
import { SplitPaymentSelector, type SplitPaymentConfig } from '../../../features/visa-checkout/components/steps/step3/SplitPaymentSelector';
import { processZellePaymentWithN8n } from '../../../lib/zelle-n8n-integration';
import type { StepProps } from '../types';

interface InstitutionApplication {
  id: string;
  status: string;
  payment_link_url: string | null;
  placement_fee_paid_at: string | null;
  placement_fee_installments: number | null;
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
  const { t } = useTranslation();
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
  const [couponCode, setCouponCode] = useState('');
  const [couponOpen, setCouponOpen] = useState(false);
  const [splitConfig, setSplitConfig] = useState<SplitPaymentConfig | null>(null);
  const [cardOwnership, setCardOwnership] = useState<'own' | 'third_party'>('own');
  const [payerName, setPayerName] = useState('');
  const [payerEmail, setPayerEmail] = useState('');
  const [payerPhone, setPayerPhone] = useState('');
  const [installments, setInstallments] = useState<1 | 2>(1);

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

  // Auto-avançar para a próxima etapa quando pagamento confirmado via redirect de split payment
  const isPaidForAutoAdvance = applications.length > 0 && applications.some(a => a.status === 'payment_confirmed');
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') !== 'true' || !isPaidForAutoAdvance) return;
    const timer = setTimeout(() => onNext(), 2500);
    return () => clearTimeout(timer);
  }, [isPaidForAutoAdvance, onNext]);

  const fetchApplications = useCallback(async () => {
    if (!userProfile?.id) return;
    try {
      const { data, error } = await supabase
        .from('institution_applications')
        .select(`
          id, status, payment_link_url, placement_fee_paid_at, placement_fee_installments, admin_approved_at,
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
  const isParcelowCard = selectedMethod === 'parcelow_card';
  const isThirdParty = isParcelowCard && cardOwnership === 'third_party';
  const canPay = !!selectedMethod && selectedMethod !== 'zelle' && (
    !needsCpf || (
      isThirdParty
        ? cpf.replace(/\D/g, '').length >= 11 && payerName.trim().length > 2 && payerEmail.includes('@') && payerPhone.replace(/\D/g, '').length >= 10
        : cpf.replace(/\D/g, '').length >= 11
    )
  );
  const canInstall2x = placementFee >= 1000;
  const amountDueNow = (installments === 2 && canInstall2x) ? Math.floor(placementFee / 2) : placementFee;
  const handleConfirmZeroFee = useCallback(async () => {
    if (!userProfile?.id || !activeApp) return;
    setConfirmingZero(true);
    try {
      const now = new Date().toISOString();
      await supabase.from('institution_applications')
        .update({ status: 'payment_confirmed', placement_fee_paid_at: now, placement_fee_installments: 1 })
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
      // Save installment choice to DB before redirecting to gateway
      await supabase.from('institution_applications')
        .update({ placement_fee_installments: installments })
        .eq('id', activeApp.id);

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
            email: isThirdParty ? payerEmail : userProfile.email,
            full_name: isThirdParty ? payerName : userProfile.full_name,
            phone: isThirdParty ? payerPhone : undefined,
            cpf: cpf || undefined,
            service_type: 'placement_fee',
            total_amount: amountDueNow,
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

      // ── Pagamento normal ─────────────────────────────────────────────────────
      localStorage.setItem('pf_draft', JSON.stringify({ applicationId: activeApp.id, method: selectedMethod }));
      const { data, error } = await supabase.functions.invoke('create-placement-fee-checkout', {
        body: {
          application_id: activeApp.id,
          payment_method: selectedMethod,
          cpf: cpf || undefined,
          origin: window.location.origin,
          placement_fee_installments: installments,
          amount_override: amountDueNow,
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
      console.error('[PlacementFeeStep] handleProcessPayment:', err);
      setPaymentError(err.message || t('student_onboarding.payment_ui.error_process_payment', 'Error processing payment. Try again.'));
      setProcessing(false);
    }
  }, [selectedMethod, cpf, splitConfig, amountDueNow, installments, activeApp, userProfile, user, isThirdParty, payerEmail, payerName, payerPhone, t]);

  const handleZelleUpload = useCallback(async () => {
    if (!zelleFile || !activeApp || !userProfile?.id || !user?.id) return;
    setZelleUploading(true);
    setPaymentError(null);
    try {
      // Save installment choice before uploading
      await supabase.from('institution_applications')
        .update({ placement_fee_installments: installments })
        .eq('id', activeApp.id);

      const n8nResult = await processZellePaymentWithN8n(zelleFile, amountDueNow, 'placement-fee', user.id);
      const { error: insertErr } = await supabase.from('migma_placement_fee_zelle_pending').insert({
        application_id: activeApp.id,
        profile_id: userProfile.id,
        migma_user_id: user.id,
        amount_usd: amountDueNow,
        receipt_url: n8nResult.imageUrl,
        n8n_payment_id: n8nResult.paymentId,
        n8n_response: n8nResult.n8nResponse,
      });
      if (insertErr) throw insertErr;
      setZelleSubmitted(true);
    } catch (err: any) {
      console.error('[PlacementFeeStep] handleZelleUpload:', err);
      setPaymentError(t('student_onboarding.payment_ui.error_upload_receipt', 'Error uploading receipt. Try again.'));
    } finally {
      setZelleUploading(false);
    }
  }, [zelleFile, activeApp, userProfile?.id, user?.id, amountDueNow, installments, t]);

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
        <p className="text-gray-500">{t('student_onboarding.placement_fee.no_applications_select_first', 'No applications found. Select your universities first.')}</p>
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
            {placementFee === 0
              ? t('student_onboarding.placement_fee.seat_secured', 'Seat Secured!')
              : t('student_onboarding.placement_fee.payment_confirmed', 'Payment Confirmed!')}
          </h3>
          <p className="text-gray-400 mb-8 max-w-sm mx-auto">
            {placementFee === 0
              ? <Trans
                  i18nKey="student_onboarding.placement_fee.full_scholarship_confirmed"
                  defaults="Your seat at <strong>{{university}}</strong> is confirmed with a full scholarship."
                  values={{ university: activeApp?.institutions?.name }}
                  components={{ strong: <strong /> }}
                />
              : <Trans
                  i18nKey="student_onboarding.placement_fee.seat_confirmed"
                  defaults="Your seat at <strong>{{university}}</strong> is secured."
                  values={{ university: activeApp?.institutions?.name }}
                  components={{ strong: <strong /> }}
                />
            }
          </p>
          <button
            onClick={onNext}
            className="w-full bg-gold-medium hover:bg-gold-dark text-black py-4 px-8 rounded-2xl font-black uppercase tracking-widest transition-all shadow-lg hover:shadow-gold-medium/20"
          >
            {t('student_onboarding.placement_fee.continue_next_steps', 'Continue to Next Steps')}
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
            {t('student_onboarding.placement_fee.profile_review_title', 'Profile Under Review by Migma Board')}
          </h3>
          <p className="text-gray-400 mb-8 text-sm leading-relaxed">
            <Trans
              i18nKey="student_onboarding.placement_fee.profile_review_desc"
              defaults="Our team is reviewing your choice of <strong>{{university}}</strong>. Once approved, you will be able to make the payment here."
              values={{ university: activeApp?.institutions?.name }}
              components={{ strong: <strong /> }}
            />
          </p>
          <div className="flex flex-col gap-3 p-4 bg-white/5 border border-white/10 rounded-2xl text-left">
            <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest">{t('student_onboarding.placement_fee.your_selection', 'Your Selection:')}</p>
            <div className="flex justify-between items-center">
              <span className="text-white font-bold">{activeApp?.institutions?.name}</span>
              <span className="text-xs bg-gold-medium/10 text-gold-medium px-2 py-0.5 rounded-full font-bold">
                {scholar?.scholarship_level || `${scholar?.discount_percent}% OFF`}
              </span>
            </div>
          </div>
          <p className="mt-8 text-gray-600 text-xs">{t('student_onboarding.placement_fee.approval_time', 'Approval usually happens within 24 business hours.')}</p>
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
              i18nKey="student_onboarding.payment_ui.receipt_processing_desc_24h"
              defaults="Our team will confirm your Zelle payment within <strong>24 business hours</strong>. You will receive a notification once confirmed."
              components={{ strong: <strong /> }}
            />
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
        <span className="text-[10px] font-black uppercase tracking-widest text-gold-medium">{t('student_onboarding.payment_ui.secure_encrypted', 'Secure & Encrypted Payment')}</span>
      </div>

      {/* Title */}
      <div>
        <h2 className="text-4xl font-black text-white uppercase tracking-tight leading-none">
          {t('student_onboarding.placement_fee.title', 'Placement Fee')}
        </h2>
        <p className="text-gray-400 text-sm mt-2 leading-relaxed">
          {t('student_onboarding.placement_fee.subtitle_calc_selected', 'Placement fee calculated based on the annual value of your selected scholarship.')}
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
                {t('student_onboarding.placement_fee.annual_scholarship_value', {
                  amount: scholar.tuition_annual_usd.toLocaleString(),
                  defaultValue: 'Annual scholarship value: ${{amount}}',
                })}
              </p>
            )}
          </div>
          <div className="text-right shrink-0 ml-2">
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-0.5">
              {installments === 2
                ? t('student_onboarding.placement_fee.first_installment_label', '1st Installment (of 2)')
                : t('student_onboarding.placement_fee.fee_label', 'Placement Fee')}
            </p>
            <p className="text-3xl font-black text-white leading-none">
              ${amountDueNow.toLocaleString()}
              <span className="text-base font-bold text-gray-400">.00</span>
            </p>
            {installments === 2 && (
              <p className="text-[9px] text-gray-500 font-bold mt-0.5">
                Total: ${placementFee.toLocaleString()}
              </p>
            )}
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
            <span className="font-black text-white text-sm">{t('student_onboarding.payment_ui.coupon_title', 'Promotional Coupon')}</span>
            {couponOpen && (
              <>
                <input
                  value={couponCode}
                  onChange={e => setCouponCode(e.target.value)}
                  placeholder={t('student_onboarding.payment_ui.coupon_placeholder', 'Enter code')}
                  className="flex-1 bg-white/5 border border-white/15 rounded-xl px-4 py-2 text-white text-sm placeholder-gray-600 outline-none focus:border-gold-medium/50 transition-colors min-w-0"
                />
                <button className="shrink-0 bg-white/10 hover:bg-white/15 border border-white/20 text-white text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-xl transition-all">
                  {t('student_onboarding.payment_ui.validate_code', 'Validate Code')}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="border-t border-white/8 mx-5" />

        {/* Installments selector — only for fees >= $1.000 */}
        {!isZeroFee && placementFee >= 1000 && (
          <div className="p-5 space-y-2">
            <p className="text-xs font-black uppercase tracking-widest text-gray-400">{t('student_onboarding.placement_fee.payment_form_title', 'Placement Fee Payment Form')}</p>
            <div className="flex gap-3">
              {([1, 2] as const).map(n => (
                <button
                  key={n}
                  onClick={() => setInstallments(n)}
                  className={`flex-1 rounded-xl border px-4 py-3 text-sm font-black transition-colors ${
                    installments === n
                      ? 'border-gold-medium/60 bg-gold-medium/10 text-gold-light'
                      : 'border-white/10 bg-transparent text-gray-400 hover:border-white/20 hover:text-white'
                  }`}
                >
                  {n === 1
                    ? t('student_onboarding.placement_fee.pay_in_full', 'Pay in full (1x)')
                    : t('student_onboarding.placement_fee.pay_installments', 'Installments (2x)')}
                </button>
              ))}
            </div>
            {installments === 2 && (
              <p className="text-[11px] text-amber-400 leading-relaxed">
                <Trans
                  i18nKey="student_onboarding.placement_fee.installments_notice"
                  defaults="You pay <strong>${{first}}</strong> now and <strong>${{second}}</strong> after the acceptance letter is issued. The acceptance letter will only be released after payment of the 2nd installment."
                  values={{
                    first: Math.floor(placementFee / 2).toLocaleString(),
                    second: Math.ceil(placementFee / 2).toLocaleString(),
                  }}
                  components={{ strong: <strong /> }}
                />
              </p>
            )}
          </div>
        )}

        {!isZeroFee && placementFee >= 1000 && <div className="border-t border-white/8 mx-5" />}

        {/* Payment methods */}
        {isZeroFee ? (
          <div className="p-5">
            <button
              onClick={handleConfirmZeroFee}
              disabled={confirmingZero}
              className="flex items-center justify-center gap-2 w-full bg-gold-medium hover:bg-gold-light disabled:opacity-60 text-black py-4 rounded-2xl font-black uppercase tracking-widest transition-all"
            >
              {confirmingZero ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
              {confirmingZero
                ? t('student_onboarding.placement_fee.confirming', 'Confirming...')
                : t('student_onboarding.placement_fee.confirm_seat', 'Confirm Seat')}
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-3">

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
                  {t('student_onboarding.payment_ui.parcelow_card', 'Parcelow — Card')}
                </p>
                <p className="text-[10px] text-gray-600 uppercase tracking-wider font-bold mt-0.5">
                  {t('student_onboarding.payment_ui.parcelow_fees_may_apply', '* Operator and platform processing fees may apply')}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className={`font-black text-lg ${selectedMethod === 'parcelow_card' ? 'text-gold-medium' : 'text-white'}`}>
                  ${amountDueNow.toLocaleString()}.00
                </p>
                <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest">{t('student_onboarding.payment_ui.up_to_12x', 'Up to 12x')}</p>
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
                  {t('student_onboarding.payment_ui.via_parcelow_fees', 'Via Parcelow · Fees may apply')}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className={`font-black text-lg ${selectedMethod === 'parcelow_pix' ? 'text-gold-medium' : 'text-white'}`}>
                  ${amountDueNow.toLocaleString()}.00
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
                  {t('student_onboarding.payment_ui.via_parcelow_fees', 'Via Parcelow · Fees may apply')}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className={`font-black text-lg ${selectedMethod === 'parcelow_ted' ? 'text-gold-medium' : 'text-white'}`}>
                  ${amountDueNow.toLocaleString()}.00
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
                  {t('student_onboarding.payment_ui.zelle_processing_48h', 'Processing may take up to 48 hours')}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className={`font-black text-lg ${selectedMethod === 'zelle' ? 'text-gold-medium' : 'text-white'}`}>
                  ${amountDueNow.toLocaleString()}.00
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

            {/* Split payment selector — só para Parcelow */}
            {needsCpf && (
              <SplitPaymentSelector
                totalAmount={amountDueNow}
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
                  className="flex items-center justify-center gap-2 w-full bg-gold-medium hover:bg-gold-light disabled:opacity-50 text-black py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl shadow-gold-medium/10"
                >
                  {processing && <Loader2 className="w-5 h-5 animate-spin" />}
                  {processing
                    ? t('student_onboarding.payment_ui.redirecting', 'Redirecting...')
                    : t(installments === 2 ? 'student_onboarding.payment_ui.pay_amount_first_installment' : 'student_onboarding.payment_ui.pay_amount', {
                        amount: amountDueNow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                        defaultValue: installments === 2 ? 'Pay ${{amount}} (1st installment)' : 'Pay ${{amount}}',
                      })}
                </button>
                <p className="text-[10px] text-center text-gray-600 font-bold uppercase tracking-tighter">
                  {t('student_onboarding.payment_ui.secure_100', '100% secure and encrypted payment')}
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
    );
};
