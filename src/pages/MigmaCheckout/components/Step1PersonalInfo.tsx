import React, { useEffect, useState } from 'react';
import {
  User, Mail, Lock, Eye, EyeOff, Users, Loader2, ChevronDown, Check,
  DollarSign, CreditCard, Smartphone, Zap, FileText,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SignaturePadComponent } from '../../../components/ui/signature-pad';
import { PhoneInput } from 'react-international-phone';
import 'react-international-phone/style.css';
import { TermsModal } from './TermsModal';
import { ZelleUpload } from '../../../features/visa-checkout/components/steps/step3/ZelleUpload';
import type { Step1Data, ServiceConfig, PaymentMethod, IPRegion, CardOwnership, PayerInfo, SplitPaymentConfig } from '../types';
import { SplitPaymentSelector } from '../../../features/visa-checkout/components/steps/step3/SplitPaymentSelector';
import { calcTotal } from '../serviceConfigs';
import { getContractTemplateByProductSlug, getChargebackAnnexTemplate } from '../../../lib/contract-templates';

interface MethodOption {
  id: PaymentMethod;
  labelKey: string;
  sublabelKey: string;
  regions: IPRegion[];
}

const METHODS: MethodOption[] = [
  {
    id: 'stripe',
    labelKey: 'checkout.method_stripe_label',
    sublabelKey: 'checkout.method_stripe_sub',
    regions: ['US', 'BR', 'OTHER'],
  },
  {
    id: 'parcelow_card',
    labelKey: 'checkout.method_parcelow_card_label',
    sublabelKey: 'checkout.method_parcelow_card_sub',
    regions: ['BR'],
  },
  {
    id: 'parcelow_pix',
    labelKey: 'checkout.method_parcelow_pix_label',
    sublabelKey: 'checkout.method_parcelow_pix_sub',
    regions: ['BR'],
  },
  {
    id: 'parcelow_ted',
    labelKey: 'checkout.method_parcelow_ted_label',
    sublabelKey: 'checkout.method_parcelow_ted_sub',
    regions: ['BR', 'OTHER'],
  },
  {
    id: 'zelle',
    labelKey: 'checkout.method_zelle_label',
    sublabelKey: 'checkout.method_zelle_sub',
    regions: ['US', 'BR', 'OTHER'],
  },
];

interface Props {
  config: ServiceConfig;
  initialData?: Step1Data | null;
  existingUserId?: string | null;
  region: IPRegion;
  onComplete: (
    data: Step1Data,
    userId: string,
    total: number,
    payment: {
      method: PaymentMethod;
      receipt: File | null;
      cardOwnership?: CardOwnership;
      cpf?: string;
      payerInfo?: any;
      splitConfig?: SplitPaymentConfig;
    },
  ) => Promise<void>;
  onRegisterUser: (
    data: Pick<Step1Data, 'full_name' | 'email' | 'phone' | 'password'>,
    numDependents?: number | null,
    total?: number,
  ) => Promise<string>;
}

const INPUT_CLASS = `
  w-full px-4 py-3 rounded-xl border border-white/10 bg-[#1a1a1a] text-white
  placeholder:text-gray-500 text-sm
  focus:outline-none focus:ring-1 focus:ring-gold-medium focus:border-gold-medium
  transition-colors
`.trim();

export const Step1PersonalInfo: React.FC<Props> = ({
  config, initialData, existingUserId, region, onComplete, onRegisterUser,
}) => {
  const { t } = useTranslation();
  const [form, setForm] = useState<Step1Data>(initialData || {
    full_name: '', email: '', phone: '', password: '', confirm_password: '',
    num_dependents: null, terms_accepted: false, data_accepted: false,
    signature_data_url: null,
  });
  const [termsOpen, setTermsOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Contract loading
  const [contractLoading, setContractLoading] = useState(true);
  const [fullContractText, setFullContractText] = useState<string>('');
  const [contractError, setContractError] = useState<string | null>(null);

  // Registration state (separate from payment)
  const [regDone, setRegDone] = useState(!!existingUserId);
  const [regUserId, setRegUserId] = useState<string | null>(existingUserId || null);

  // Payment state
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [showParcelowConfirm, setShowParcelowConfirm] = useState(false);
  const [pendingSubmitPayload, setPendingSubmitPayload] = useState<{
    form: Step1Data; userId: string; total: number; payment: any;
  } | null>(null);
  const [cardOwnership, setCardOwnership] = useState<'own' | 'third_party'>('own');
  const [cpf, setCpf] = useState('');
  const [payerInfo, setPayerInfo] = useState<PayerInfo | null>(null);
  const [receipt, setReceipt] = useState<File | null>(null);

  // Split payment state
  const [activeSplitConfig, setActiveSplitConfig] = useState<SplitPaymentConfig | null>(null);
  const [splitCpf, setSplitCpf] = useState('');

  const total = calcTotal(config, form.num_dependents);
  const availableMethods = METHODS.filter(m => m.regions.includes(region));
  const needsReceipt = method === 'zelle';
  const isParcelow = method === 'parcelow_card' || method === 'parcelow_pix' || method === 'parcelow_ted';
  const isParcelowCard = method === 'parcelow_card';
  const needsCpfOnly = method === 'parcelow_pix' || method === 'parcelow_ted';

  const canUseSplit = region === 'BR' || region === 'OTHER';
  const isSplitEnabled = !!activeSplitConfig;

  // Helper to validate CPF checksum
  const validateCPF = (val: string) => {
    const cleaned = val.replace(/\D/g, '');
    if (cleaned.length !== 11 || /^(\d)\1{10}$/.test(cleaned)) return false;

    let sum = 0;
    let rest;
    for (let i = 1; i <= 9; i++) sum = sum + parseInt(cleaned.substring(i - 1, i)) * (11 - i);
    rest = (sum * 10) % 11;
    if ((rest === 10) || (rest === 11)) rest = 0;
    if (rest !== parseInt(cleaned.substring(9, 10))) return false;

    sum = 0;
    for (let i = 1; i <= 10; i++) sum = sum + parseInt(cleaned.substring(i - 1, i)) * (12 - i);
    rest = (sum * 10) % 11;
    if ((rest === 10) || (rest === 11)) rest = 0;
    if (rest !== parseInt(cleaned.substring(10, 11))) return false;

    return true;
  };

  useEffect(() => {
    async function loadContract() {
      setContractLoading(true);
      setContractError(null);
      try {
        const slug = config.contractSlug || config.type;
        const [mainContract, annex] = await Promise.all([
          getContractTemplateByProductSlug(slug),
          getChargebackAnnexTemplate(),
        ]);
        if (!mainContract) {
          setContractError(t('migma_checkout.step1.contract_not_found', 'Não foi possível encontrar o contrato desse serviço, por favor, entre em contato com o suporte.'));
          setFullContractText('');
          return;
        }
        let fullText = mainContract.content;
        if (annex) fullText += '\n\n' + '-'.repeat(40) + '\n\n' + annex.content;
        setFullContractText(fullText);
      } catch (err) {
        console.error('[Step1] Failed to load contract:', err);
        setContractError(t('migma_checkout.step1.contract_error', 'Erro ao carregar contrato.'));
      } finally {
        setContractLoading(false);
      }
    }
    loadContract();
  }, [config.contractSlug, config.type, t]);

  const set = <K extends keyof Step1Data>(key: K, value: Step1Data[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
  };

  const isSufficientlyIdentified = !!existingUserId && !!initialData?.full_name?.trim() && !!initialData?.phone?.trim();

  const validate = (): boolean => {
    const e: Record<string, string> = {};

    if (!isSufficientlyIdentified) {
      if (!form.full_name.trim()) e.full_name = t('migma_checkout.step1.validation_full_name', 'Nome completo é obrigatório');
      if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) e.email = t('migma_checkout.step1.validation_email', 'E-mail válido obrigatório');
      if (!form.phone.trim()) e.phone = t('migma_checkout.step1.validation_phone', 'WhatsApp é obrigatório');
    }
    if (form.num_dependents === null) e.num_dependents = t('migma_checkout.step1.validation_dependents', 'Selecione a quantidade de dependentes');
    if (!form.terms_accepted) e.terms_accepted = t('migma_checkout.step1.validation_terms', 'Obrigatório aceitar os termos');
    if (!form.data_accepted) e.data_accepted = t('migma_checkout.step1.validation_data', 'Obrigatório autorizar dados');
    if (!form.signature_data_url) e.signature = t('migma_checkout.step1.validation_signature', 'Assinatura é obrigatória');
    if (!isSplitEnabled && !method) {
      e.method = t('migma_checkout.step3.validation_method', 'Selecione uma forma de pagamento');
    }
    if (isSplitEnabled) {
      // Validação split — SplitPaymentSelector só emite config quando válida, mas verificamos por segurança
      if (!activeSplitConfig) {
        e.split_amount = 'Configure os valores e métodos de cada parte antes de continuar';
      }
      if (!splitCpf) {
        e.cpf = t('migma_checkout.step3.validation_cpf_required', 'O CPF é obrigatório para pagamentos via Parcelow');
      } else if (!validateCPF(splitCpf)) {
        e.cpf = t('migma_checkout.step3.validation_cpf_invalid', 'CPF inválido. Verifique os números preenchidos');
      }
    } else if (isParcelow) {
      // Validação Parcelow normal (4.5 PRD v7.0)
      const cpfToValidate = (isParcelowCard && cardOwnership === 'third_party') ? (payerInfo?.cpf || '') : cpf;

      if (!cpfToValidate) {
        e.cpf = t('migma_checkout.step3.validation_cpf_required', 'O CPF é obrigatório para pagamentos via Parcelow');
      } else if (!validateCPF(cpfToValidate)) {
        e.cpf = t('migma_checkout.step3.validation_cpf_invalid', 'CPF inválido. Verifique os números preenchidos');
      }

      if (isParcelowCard && cardOwnership === 'third_party') {
        if (!payerInfo?.name) e.payer_name = t('migma_checkout.step3.validation_payer_name', 'Nome do titular é obrigatório');
        if (!payerInfo?.email) e.payer_email = t('migma_checkout.step3.validation_payer_email', 'E-mail do titular é obrigatório');
        if (!payerInfo?.phone) e.payer_phone = t('migma_checkout.step3.validation_payer_phone', 'WhatsApp do titular é obrigatório');
      }
    }

    if (contractError) { setGlobalError(contractError); return false; }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // Chamado após confirmação no modal (ou diretamente para Stripe/Zelle)
  const doSubmit = async (userId: string, formData: Step1Data, paymentTotal: number, payment: any) => {
    setSaving(true);
    setGlobalError(null);
    try {
      if (isSplitEnabled && activeSplitConfig) {
        await onComplete(formData, userId, paymentTotal, {
          method: 'parcelow_card',
          receipt: null,
          cpf: splitCpf,
          splitConfig: activeSplitConfig,
        });
      } else {
        await onComplete(formData, userId, paymentTotal, payment);
      }
    } catch (err: any) {
      console.error('[Step1] Error:', err);
      setGlobalError(err.message || t('migma_checkout.step1.error_saving', 'Falha no registro. Tente novamente.'));
    } finally {
      setSaving(false);
      setShowParcelowConfirm(false);
      setPendingSubmitPayload(null);
    }
  };

  // Unified Submit: creates account and pays
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    let uid = regUserId || existingUserId;

    if (!uid) {
      setSaving(true);
      try {
        uid = await onRegisterUser(
          { full_name: form.full_name, email: form.email, phone: form.phone, password: form.password },
          form.num_dependents,
          total,
        );
        setRegUserId(uid);
        setRegDone(true);
      } catch (err: any) {
        setGlobalError(err.message || t('migma_checkout.step1.error_saving', 'Falha no registro. Tente novamente.'));
        setSaving(false);
        return;
      }
    }

    if (!uid) return;

    const payment = {
      method: method!,
      receipt: needsReceipt ? receipt : null,
      cardOwnership: isParcelowCard ? cardOwnership : undefined,
      cpf: isParcelow ? ((isParcelowCard && cardOwnership === 'third_party') ? payerInfo?.cpf : cpf) : undefined,
      payerInfo: (isParcelowCard && cardOwnership === 'third_party') ? payerInfo : undefined,
    };

    if (isParcelow || isSplitEnabled) {
      setPendingSubmitPayload({ form, userId: uid, total, payment });
      setShowParcelowConfirm(true);
      setSaving(false);
      return;
    }

    await doSubmit(uid, form, total, payment);
  };

  const payBtnLabel = () => {
    if (saving) return <><Loader2 className="w-4 h-4 animate-spin" /> {t('migma_checkout.step1.processing', 'Processando...')}</>;
    if (isSplitEnabled) return `Pagar Dividido — $${total} →`;
    if (method === 'stripe') return `Pagar com Stripe — $${total} →`;
    if (method === 'zelle') return 'Enviar Comprovante Zelle →';
    if (method === 'parcelow_card') return `Pagar com Cartão (Parcelow) — $${total} →`;
    if (method === 'parcelow_pix') return `Pagar com PIX (Parcelow) — $${total} →`;
    if (method === 'parcelow_ted') return `Pagar com TED (Parcelow) — $${total} →`;
    return t('migma_checkout.step1.continue_payment', `Continuar Pagamento — $${total} →`);
  };

  const parcelowMethodLabel = isSplitEnabled
    ? 'Pagamento Dividido (Parcelow)'
    : method === 'parcelow_card' ? 'Cartão de Crédito (Parcelow)'
    : method === 'parcelow_pix'  ? 'PIX (Parcelow)'
    : method === 'parcelow_ted'  ? 'TED Bancário (Parcelow)'
    : '';

  return (
    <>
      <TermsModal
        isOpen={termsOpen}
        onClose={() => setTermsOpen(false)}
        contractTitle={config.contractTitle}
        contractText={contractLoading ? t('migma_checkout.step1.loading_contract', 'Carregando contrato...') : (contractError || fullContractText)}
      />

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* ── 2 colunas (desktop) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
          {/* LEFT: Formulário */}
          <div className="lg:col-span-3 space-y-5">
            <h3 className="text-lg font-bold text-white">{t('migma_checkout.step1.title', 'Informações Pessoais')}</h3>

            {isSufficientlyIdentified ? (
              <div className="bg-[#111] border border-gold-medium/30 rounded-xl p-5 flex items-center justify-between">
                <div className="flex gap-4 items-center">
                  <div className="w-12 h-12 flex-shrink-0 bg-gold-medium/10 border border-gold-medium/20 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-gold-medium" />
                  </div>
                  <div>
                    <p className="font-bold text-white text-base mb-0.5">{t('migma_checkout.step1.session_identified', 'Sessão Identificada')}</p>
                    <p className="text-sm text-gray-400">
                      {t('migma_checkout.step1.session_message', 'Você já possui uma conta ativa com o e-mail:')} <strong className="text-gold-light">{form.email}</strong>
                    </p>
                  </div>
                </div>
                <div className="hidden sm:flex px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-xs font-bold items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                  Conectado
                </div>
              </div>
            ) : (
              <>
                {/* Nome */}
                <div>
                  <label className="text-sm font-medium text-gray-300 mb-1.5 block">{t('migma_checkout.step1.full_name', 'Nome Completo')} *</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input type="text" value={form.full_name} onChange={e => set('full_name', e.target.value)}
                      className={`${INPUT_CLASS} pl-10 ${errors.full_name ? 'border-red-500' : ''}`} />
                  </div>
                  {errors.full_name && <p className="text-red-400 text-xs mt-1">{errors.full_name}</p>}
                </div>

                {/* Email */}
                <div>
                  <label className="text-sm font-medium text-gray-300 mb-1.5 block">{t('migma_checkout.step1.email', 'E-mail')} *</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                      className={`${INPUT_CLASS} pl-10 ${errors.email ? 'border-red-500' : ''}`} />
                  </div>
                  {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
                </div>

                {/* WhatsApp */}
                <div>
                  <label className="text-sm font-medium text-gray-300 mb-1.5 block">{t('migma_checkout.step1.phone', 'WhatsApp')} *</label>
                  <div className="relative phone-input-container">
                    <PhoneInput
                      defaultCountry="br"
                      value={form.phone}
                      onChange={(phone) => set('phone', phone)}
                      className={`w-full ${errors.phone ? 'phone-input-error' : ''}`}
                      inputClassName={INPUT_CLASS}
                    />
                  </div>
                  {errors.phone && <p className="text-red-400 text-xs mt-1">{errors.phone}</p>}
                </div>
              </>
            )}


            {/* Dependentes */}
            {!existingUserId && (
              <div>
                <label className="text-sm font-medium text-gray-300 mb-1.5 block">
                  <Users className="w-4 h-4 inline mr-1" />
                  {t('migma_checkout.step1.num_dependents', 'Número de Dependentes')} *
                </label>
                <div className="relative">
                  <select value={form.num_dependents ?? ""} onChange={e => set('num_dependents', e.target.value === "" ? null : Number(e.target.value))}
                    className={`${INPUT_CLASS} appearance-none pr-10 ${errors.num_dependents ? 'border-red-500' : ''}`}>
                    <option value="" disabled>{t('migma_checkout.step1.select_dependents_placeholder', 'Selecione a quantidade de dependentes')}</option>
                    {[0,1,2,3,4,5].map(n => (
                      <option key={n} value={n} className="bg-[#1a1a1a]">
                        {n === 0
                          ? `0 ${t('migma_checkout.step1.dependents_zero', 'dependentes')}`
                          : `${n} ${n > 1 ? t('migma_checkout.step3.dependents_plural', 'dependentes') : t('migma_checkout.step3.dependents', 'dependente')}` + ` (+$${n * config.dependentPrice})`}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                </div>
                {(form.num_dependents ?? 0) > 0 && (
                  <p className="text-gold-medium text-xs mt-1">
                    +${(form.num_dependents ?? 0) * config.dependentPrice} {t('migma_checkout.step1.for_dependents', {
                      count: form.num_dependents ?? 0,
                      label: (form.num_dependents ?? 0) > 1
                        ? t('migma_checkout.step3.dependents_plural')
                        : t('migma_checkout.step3.dependents'),
                    })}
                  </p>
                )}
                {errors.num_dependents && <p className="text-red-400 text-xs mt-1 font-bold uppercase tracking-wider">{errors.num_dependents}</p>}
              </div>
            )}
          </div>

          {/* RIGHT: Resumo */}
          <div className="lg:col-span-2 lg:sticky lg:top-36">
            <div className="bg-[#111] border border-gold-medium/30 rounded-2xl overflow-hidden shadow-2xl">
              <div className="bg-gradient-to-b from-gold-dark/20 to-transparent px-6 pt-5 pb-4 border-b border-gold-medium/20">
                <p className="text-xs text-gold-medium font-bold uppercase tracking-widest mb-1">{t('migma_checkout.step3.order_summary', 'Resumo do Pedido')}</p>
                <p className="text-white font-bold">{config.name}</p>
              </div>
              <div className="px-6 py-5 space-y-3">
                <div className="flex justify-between text-sm text-gray-400">
                  <span>{t('migma_checkout.step3.process_fee', 'Taxa de Processo de Seleção')}</span>
                  <span className="text-white">${config.basePrice}</span>
                </div>
                {(form.num_dependents ?? 0) > 0 && (
                  <div className="flex justify-between text-sm text-gray-400">
                    <span>{form.num_dependents ?? 0} {(form.num_dependents ?? 0) > 1 ? t('migma_checkout.step3.dependents_plural') : t('migma_checkout.step3.dependents')}</span>
                    <span className="text-gold-medium">+${(form.num_dependents ?? 0) * config.dependentPrice}</span>
                  </div>
                )}
                <div className="border-t border-white/10 pt-3 flex justify-between font-black text-white text-xl">
                  <span>{t('migma_checkout.total', 'Total')}</span>
                  <span className="text-gold-medium">${total}</span>
                </div>
              </div>
              <div className="mx-4 mb-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex gap-3">
                <div className="w-5 h-5 rounded-full bg-emerald-500/30 flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold text-emerald-400">✓</div>
                <div>
                  <p className="text-emerald-400 text-xs font-bold mb-0.5">{t('checkout.money_back_guarantee_title', 'Dinheiro de Volta Garantido')}</p>
                  <p className="text-gray-400 text-xs leading-snug">
                    {t('checkout.money_back_guarantee_desc', 'Caso não seja aceito por nenhuma universidade, sua taxa será integralmente reembolsada.')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Termos + Assinatura ── */}
        <div className="bg-[#111] border border-white/10 rounded-2xl p-6 space-y-5">
          <h3 className="text-base font-bold text-white">{t('migma_checkout.step1.terms_title', 'Termos & Condições')}</h3>

          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={form.terms_accepted}
              onChange={e => set('terms_accepted', e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-gray-600 bg-[#1a1a1a] accent-gold-medium flex-shrink-0" />
            <span className="text-sm text-gray-300">
              {t('migma_checkout.step1.terms_declare', 'Declaro que li e concordo com todos os')}
              {' '}
              <button type="button" onClick={() => setTermsOpen(true)}
                className="text-gold-medium underline hover:text-gold-light transition-colors">
                {t('migma_checkout.step1.terms_label', 'Termos e Condições')}
              </button>{' '}
              {t('migma_checkout.step1.terms_and', 'e seu')}
              {' '}
              <button type="button" onClick={() => setTermsOpen(true)}
                className="text-gold-medium underline hover:text-gold-light transition-colors">
                {t('migma_checkout.step1.annex_label', 'Anexo I')}
              </button>. *
            </span>
          </label>
          {errors.terms_accepted && <p className="text-red-400 text-xs -mt-3 ml-7">{errors.terms_accepted}</p>}

          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={form.data_accepted}
              onChange={e => set('data_accepted', e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-gray-600 bg-[#1a1a1a] accent-gold-medium flex-shrink-0" />
            <span className="text-sm text-gray-300">
              {t('migma_checkout.step1.data_authorize', 'Autorizo o uso e tratamento dos meus dados pessoais para as finalidades descritas nos')}
              {' '}
              <button type="button" onClick={() => setTermsOpen(true)}
                className="text-gold-medium underline hover:text-gold-light transition-colors">
                {t('migma_checkout.step1.terms_label', 'Termos e Condições')}
              </button>. *
            </span>
          </label>
          {errors.data_accepted && <p className="text-red-400 text-xs -mt-3 ml-7">{errors.data_accepted}</p>}

          {!form.signature_data_url?.startsWith('http') ? (
            <div>
              <SignaturePadComponent
                label={t('migma_checkout.step1.digital_signature', 'Assinatura Digital') + ' *'}
                onSignatureChange={(dataUrl: string | null) => set('signature_data_url', dataUrl)}
                onSignatureConfirm={(dataUrl: string) => set('signature_data_url', dataUrl)}
                savedSignature={form.signature_data_url}
                isConfirmed={!!form.signature_data_url}
                height={160}
              />
              {errors.signature && <p className="text-red-400 text-xs mt-1">{errors.signature}</p>}
            </div>
          ) : (
            <div className="bg-[#1a1a1a] rounded-xl p-4 border border-emerald-500/20">
              <p className="text-emerald-400 text-sm font-bold flex items-center gap-2 mb-3">
                <Check className="w-4 h-4" />
                {t('migma_checkout.step1.signature_found', 'Assinatura digital vinculada ao seu perfil')}
              </p>
              <div className="bg-white rounded-lg p-2 w-full max-w-xs">
                <img src={form.signature_data_url} alt="Signature" className="h-16 object-contain" />
              </div>
              <button type="button" onClick={() => set('signature_data_url', null)}
                className="mt-3 text-xs text-gray-500 hover:text-white underline transition-colors">
                {t('migma_checkout.step1.resign', 'Deseja assinar novamente?')}
              </button>
            </div>
          )}
        </div>

        {/* ── Seção de Pagamento (PRD v7.0) — mostrada após registro ── */}
        <div className="bg-[#111] border border-white/10 rounded-2xl p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
          <h3 className="text-white text-base font-black flex items-center gap-2 uppercase tracking-widest border-l-4 border-gold-medium pl-4">
            <DollarSign className="w-5 h-5 text-gold-medium" />
            {t('migma_checkout.step3.payment_method_title', 'Informações de Pagamento')}
          </h3>

          {/* 4.5 Dados do Pagador / Titularidade */}
          <div className="space-y-6">
            {/* Caso 1: Cartão Parcelow (Seus dados ou Terceiro) */}
            {method === 'parcelow_card' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
                <div className="flex flex-col gap-4 bg-zinc-900/60 p-5 rounded-xl border border-gold-medium/20 shadow-xl">
                  <p className="text-sm font-bold text-white uppercase tracking-wide">
                    {t('checkout.is_card_owner_question', 'O cartão de crédito que você vai usar é seu ou de outra pessoa?')}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {(['own', 'third_party'] as const).map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => { setCardOwnership(val); if (val === 'own') setPayerInfo(null); }}
                        className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg border-2 transition-all duration-300 font-bold uppercase tracking-wider text-xs ${
                          cardOwnership === val
                            ? 'bg-gold-medium border-gold-medium text-black shadow-[0_0_15px_rgba(212,175,55,0.3)]'
                            : 'bg-black/40 border-white/10 text-gray-400 hover:border-gold-light/50 hover:text-white'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          cardOwnership === val ? 'border-black' : 'border-gray-600'
                        }`}>
                          {cardOwnership === val && <div className="w-2 h-2 rounded-full bg-black" />}
                        </div>
                        {val === 'own' ? t('checkout.my_card', 'Meu Cartão') : t('checkout.third_party_card', 'Cartão de Terceiro')}
                      </button>
                    ))}
                  </div>
                </div>

                {cardOwnership === 'own' ? (
                  <div className="bg-zinc-900/40 border border-gold-medium/20 rounded-lg p-4 space-y-4 animate-in fade-in slide-in-from-top-2 shadow-xl">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 mb-1 pl-1">
                          <FileText className="w-3.5 h-3.5 text-gold-medium" />
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{t('checkout.cpf_label', 'Seu CPF')} *</label>
                        </div>
                        <input
                          type="text"
                          value={cpf}
                          onChange={e => setCpf(e.target.value.replace(/\D/g, '').slice(0, 11))}
                          className={`${INPUT_CLASS} ${errors.cpf ? 'border-red-500' : ''} h-12`}
                        />
                        {errors.cpf && <p className="text-red-400 text-[10px] font-bold uppercase">{errors.cpf}</p>}
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 mb-1 pl-1">
                          <CreditCard className="w-3.5 h-3.5 text-gold-medium" />
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{t('checkout.name_on_card', 'Nome no Cartão')} *</label>
                        </div>
                        <input
                          type="text"
                          className={`${INPUT_CLASS} uppercase h-12`}
                          placeholder="COMO ESTÁ NO CARTÃO"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-zinc-900/40 border border-gold-medium/20 rounded-lg p-4 space-y-6 animate-in fade-in slide-in-from-top-2 shadow-xl">
                    <h4 className="text-gold-light font-black text-xs uppercase tracking-widest border-b border-white/5 pb-3 flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      {t('checkout.payer_data_title', 'Dados do Titular do Cartão')}
                    </h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-1">{t('checkout.payer_name', 'Nome Completo do Titular')}</label>
                        <input
                          type="text"
                          value={payerInfo?.name || ''}
                          onChange={e => setPayerInfo((prev: PayerInfo | null) => ({ ...prev!, name: e.target.value.toUpperCase(), cpf: prev?.cpf || '', email: prev?.email || '', phone: prev?.phone || '' }))}
                          className={`${INPUT_CLASS} ${errors.payer_name ? 'border-red-500' : ''} h-12 text-xs uppercase`}
                        />
                        {errors.payer_name && <p className="text-red-400 text-[10px] uppercase font-bold">{errors.payer_name}</p>}
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-1">{t('checkout.payer_cpf', 'CPF do Titular')}</label>
                        <input
                          type="text"
                          value={payerInfo?.cpf || ''}
                          onChange={e => setPayerInfo((prev: PayerInfo | null) => ({ ...prev!, cpf: e.target.value.replace(/\D/g, '').slice(0, 11), name: prev?.name || '', email: prev?.email || '', phone: prev?.phone || '' }))}
                          className={`${INPUT_CLASS} ${errors.cpf || errors.payer_cpf ? 'border-red-500' : ''} h-12 text-xs`}
                        />
                        {(errors.cpf || errors.payer_cpf) && <p className="text-red-400 text-[10px] uppercase font-bold">{errors.cpf || errors.payer_cpf}</p>}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-1">{t('checkout.payer_email', 'E-mail do Titular')}</label>
                        <input
                          type="email"
                          value={payerInfo?.email || ''}
                          onChange={e => setPayerInfo((prev: PayerInfo | null) => ({ ...prev!, email: e.target.value, name: prev?.name || '', cpf: prev?.cpf || '', phone: prev?.phone || '' }))}
                          className={`${INPUT_CLASS} ${errors.payer_email ? 'border-red-500' : ''} h-12 text-xs`}
                        />
                        {errors.payer_email && <p className="text-red-400 text-[10px] uppercase font-bold">{errors.payer_email}</p>}
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-1">{t('checkout.payer_phone', 'WhatsApp do Titular')}</label>
                        <input
                          type="text"
                          value={payerInfo?.phone || ''}
                          onChange={e => setPayerInfo((prev: PayerInfo | null) => ({ ...prev!, phone: e.target.value, name: prev?.name || '', cpf: prev?.cpf || '', email: prev?.email || '' }))}
                          className={`${INPUT_CLASS} ${errors.payer_phone ? 'border-red-500' : ''} h-12 text-xs`}
                        />
                        {errors.payer_phone && <p className="text-red-400 text-[10px] uppercase font-bold">{errors.payer_phone}</p>}
                      </div>
                    </div>

                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 flex gap-3 text-amber-200/80">
                      <div className="text-amber-500 flex-shrink-0 mt-0.5">
                        <Zap className="w-4 h-4" />
                      </div>
                      <p className="text-[10px] leading-relaxed italic">
                        {t('checkout.parcelow_address_notice_content', 'O endereço de cobrança deve ser o do titular do cartão e será preenchido na próxima tela.')}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Caso 2: Pix ou TED (CPF) */}
            {(method === 'parcelow_pix' || method === 'parcelow_ted') && (
              <div className="animate-in fade-in slide-in-from-top-2">
                <div className="bg-[#0b0b0b] border border-white/5 rounded-2xl p-6 space-y-4 shadow-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="w-5 h-5 text-gold-medium" />
                    <label className="text-sm font-bold text-white uppercase tracking-widest">{t('checkout.cpf_label', 'Seu CPF')} *</label>
                  </div>
                  <input
                    type="text"
                    value={cpf}
                    onChange={e => setCpf(e.target.value.replace(/\D/g, '').slice(0, 11))}
                    className={`${INPUT_CLASS} ${errors.cpf ? 'border-red-500' : ''} h-14 text-lg`}
                  />
                  {errors.cpf && <p className="text-red-400 text-xs font-bold uppercase tracking-wider">{errors.cpf}</p>}
                </div>
              </div>
            )}

            {/* Caso 3: Zelle (Upload de Comprovante) */}
            {method === 'zelle' && (
              <div className="animate-in fade-in slide-in-from-top-2">
                <ZelleUpload
                  onFileSelect={file => { setReceipt(file); setErrors(prev => { const n = { ...prev }; delete n.receipt; return n; }); }}
                  currentFile={receipt}
                  onClear={() => setReceipt(null)}
                />
                {errors.receipt && <p className="text-red-400 text-xs mt-2 font-bold uppercase tracking-wider">{errors.receipt}</p>}
              </div>
            )}
          </div>

          {/* Split Payment — reutiliza SplitPaymentSelector do visa-checkout */}
          {canUseSplit && (
            <div className="space-y-4 mt-6">
              <SplitPaymentSelector
                totalAmount={total}
                onSplitChange={(config) => setActiveSplitConfig(config as SplitPaymentConfig | null)}
              />

              {/* CPF — exibido quando split está ativo */}
              {isSplitEnabled && (
                <div className="bg-zinc-900/40 border border-gold-medium/20 rounded-lg p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gold-medium" />
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Seu CPF *</label>
                  </div>
                  <input
                    type="text"
                    value={splitCpf}
                    onChange={e => setSplitCpf(e.target.value.replace(/\D/g, '').slice(0, 11))}
                    placeholder="00000000000"
                    className={`${INPUT_CLASS} h-12 ${errors.cpf ? 'border-red-500' : ''}`}
                  />
                  {errors.cpf && <p className="text-red-400 text-xs font-bold uppercase">{errors.cpf}</p>}
                  {errors.split_amount && <p className="text-red-400 text-xs font-bold uppercase tracking-wider">{errors.split_amount}</p>}
                </div>
              )}
            </div>
          )}

          {/* 4.6 Seleção do Meio de Pagamento (oculta quando split está ativo) */}
          <div className="space-y-4 pt-8 border-t border-white/5" style={{ display: isSplitEnabled ? 'none' : undefined }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-black text-white uppercase tracking-[0.2em] pl-1 bg-gold-medium/10 py-1 px-3 rounded-md inline-block">
                {t('migma_checkout.step3.select_method_title', 'Selecione a Forma de Pagamento')}
              </p>
            </div>
            
            <div className="flex flex-col gap-3">
              {availableMethods.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => { setMethod(m.id); setErrors(prev => { const n = { ...prev }; delete n.method; delete n.cpf; return n; }); }}
                  className={`flex items-center gap-4 p-5 rounded-2xl border-2 text-left transition-all group relative overflow-hidden ${
                    method === m.id
                      ? 'border-gold-medium bg-[#1a1a1a] shadow-[0_10px_30px_rgba(0,0,0,0.5)]'
                      : 'border-white/5 bg-[#0d0d0d] hover:border-white/10 hover:bg-[#111]'
                  }`}
                >
                  {method === m.id && <div className="absolute top-0 left-0 w-1 h-full bg-gold-medium" />}
                  
                  <div className="flex-1">
                    <p className={`font-black text-sm uppercase tracking-wider ${method === m.id ? 'text-gold-light' : 'text-gray-300'}`}>{t(m.labelKey)}</p>
                    <p className="text-[10px] text-gray-500 font-medium uppercase tracking-tight mt-0.5">{t(m.sublabelKey)}</p>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                    method === m.id ? 'border-gold-medium' : 'border-white/10'
                  }`}>
                    {method === m.id && <div className="w-3 h-3 rounded-full bg-gold-medium animate-in zoom-in-0 duration-300 shadow-[0_0_8px_rgba(212,175,55,0.5)]" />}
                  </div>
                </button>
              ))}
            </div>
            {errors.method && <p className="text-red-400 text-xs font-bold uppercase tracking-widest">{errors.method}</p>}
          </div>
        </div>

        {/* Erro global */}
        {globalError && (
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-xl p-4">
            <span className="w-4 h-4 flex-shrink-0">⚠</span>
            {globalError}
          </div>
        )}

        <button type="submit" disabled={saving || contractLoading}
          className="w-full py-4 rounded-xl bg-gradient-to-b from-gold-light via-gold-medium to-gold-light text-black font-black uppercase tracking-widest text-sm shadow-lg shadow-gold-medium/20 hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
          {payBtnLabel()}
        </button>

        {/* Modal de confirmação para Parcelow — evita criar ordens acidentalmente */}
        {showParcelowConfirm && pendingSubmitPayload && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
            <div className="bg-[#111] border border-white/10 rounded-2xl p-8 max-w-sm w-full space-y-5 shadow-2xl">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-gold-medium">Confirmar Pagamento</p>
                <h3 className="text-xl font-black text-white">Tudo certo?</h3>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Método</span>
                  <span className="text-white font-bold">{parcelowMethodLabel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Valor</span>
                  <span className="text-white font-bold">${pendingSubmitPayload.total.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">E-mail</span>
                  <span className="text-white font-bold truncate max-w-[170px]">{pendingSubmitPayload.form.email}</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                Ao confirmar, você será redirecionado para a Parcelow para finalizar o pagamento.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowParcelowConfirm(false); setPendingSubmitPayload(null); }}
                  className="flex-1 py-3 rounded-xl border border-white/10 text-gray-300 hover:bg-white/5 font-bold text-sm transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => doSubmit(
                    pendingSubmitPayload.userId,
                    pendingSubmitPayload.form,
                    pendingSubmitPayload.total,
                    pendingSubmitPayload.payment,
                  )}
                  className="flex-1 py-3 rounded-xl bg-gold-medium hover:bg-gold-light text-black font-black text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {saving ? 'Processando...' : 'Confirmar →'}
                </button>
              </div>
            </div>
          </div>
        )}

        {!existingUserId && (
          <p className="text-center text-sm text-gray-500">
            {t('migma_checkout.step1.already_have_account', 'Já tem uma conta?')}
            {' '}
            <a href="/student/login" className="text-gold-medium hover:text-gold-light underline">
              {t('migma_checkout.step1.login', 'Fazer login')}
            </a>
          </p>
        )}
      </form>
    </>
  );
};
