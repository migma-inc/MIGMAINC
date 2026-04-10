import React, { useState, useRef } from 'react';
import {
  CheckCircle, FileText, Loader2, PartyPopper,
  Upload, X, CreditCard, Smartphone, DollarSign, Zap,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Step1Data, Step2Data, ServiceConfig, PaymentMethod, IPRegion, CardOwnership } from '../types';

interface Props {
  config: ServiceConfig;
  step1: Step1Data;
  step2: Step2Data;
  total: number;
  region: IPRegion;
  paymentConfirmed: boolean;
  onPayment: (
    method: PaymentMethod,
    extra: { receipt?: File | null; cardOwnership?: CardOwnership; cpf?: string }
  ) => Promise<void>;
}

interface MethodOption {
  id: PaymentMethod;
  labelKey: string;
  defaultLabel: string;
  sublabelKey: string;
  defaultSublabel: string;
  icon: React.ReactNode;
  regions: IPRegion[];
}

const METHODS: MethodOption[] = [
  {
    id: 'stripe',
    labelKey: 'checkout.payment_stripe',
    defaultLabel: 'Cartão de Crédito Global',
    sublabelKey: 'checkout.payment_stripe_sub',
    defaultSublabel: 'Processamento seguro via Stripe',
    icon: <CreditCard className="w-5 h-5" />,
    regions: ['US', 'BR', 'OTHER'],
  },
  {
    id: 'square',
    labelKey: 'checkout.payment_square',
    defaultLabel: 'Square Payment',
    sublabelKey: 'checkout.payment_square_sub',
    defaultSublabel: 'Secure checkout',
    icon: <CreditCard className="w-5 h-5" />,
    regions: ['US'],
  },
  {
    id: 'parcelow',
    labelKey: 'checkout.payment_parcelow',
    defaultLabel: 'Cartão Brasileiro (Parcelado)',
    sublabelKey: 'checkout.payment_parcelow_sub',
    defaultSublabel: 'Pague em BRL em até 12x',
    icon: <CreditCard className="w-5 h-5" />,
    regions: ['BR'],
  },
  {
    id: 'pix',
    labelKey: 'checkout.payment_pix',
    defaultLabel: 'Pix',
    sublabelKey: 'checkout.payment_pix_sub',
    defaultSublabel: 'Aprovação instantânea',
    icon: <Zap className="w-5 h-5" />,
    regions: ['BR'],
  },
  {
    id: 'zelle',
    labelKey: 'checkout.payment_zelle',
    defaultLabel: 'Zelle / Transferência US',
    sublabelKey: 'checkout.payment_zelle_sub',
    defaultSublabel: 'Para contas nos Estados Unidos',
    icon: <Smartphone className="w-5 h-5" />,
    regions: ['US', 'BR', 'OTHER'],
  },
];

const INPUT_CLASS = `
  w-full px-4 py-3 rounded-xl border border-white/10 bg-[#1a1a1a] text-white
  placeholder:text-gray-500 text-sm
  focus:outline-none focus:ring-1 focus:ring-gold-medium focus:border-gold-medium
  transition-colors
`.trim();

export const Step3Confirmation: React.FC<Props> = ({
  config, step1, step2, total, region, paymentConfirmed, onPayment,
}) => {
  const { t } = useTranslation();
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [cardOwnership, setCardOwnership] = useState<CardOwnership>('own');
  const [cpf, setCpf] = useState('');
  const [receipt, setReceipt] = useState<File | null>(null);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);

  const docTypeLabels: Record<string, string> = { 
    passport: t('docs.passport', 'Passaporte'), 
    rg: 'RG', 
    cnh: 'CNH' 
  };

  const availableMethods = METHODS.filter(m => m.regions.includes(region));
  const needsCardOwnership = method === 'square' || method === 'parcelow';
  const needsReceipt = method === 'zelle' || method === 'pix';
  const isStripe = method === 'stripe';

  const handlePay = async () => {
    if (!method) { setError(t('migma_checkout.step3.error_select_method', 'Selecione um método de pagamento.')); return; }
    if (needsReceipt && !receipt) { setError(t('migma_checkout.step3.error_send_receipt', 'Envie o comprovante de pagamento.')); return; }

    setPaying(true);
    setError(null);
    try {
      await onPayment(method, {
        receipt: needsReceipt ? receipt : null,
        cardOwnership: needsCardOwnership ? cardOwnership : undefined,
        cpf: (needsCardOwnership && cardOwnership === 'third_party') ? cpf : undefined,
      });
    } catch (err: any) {
      setError(err.message || t('migma_checkout.step3.error_processing', 'Erro ao processar pagamento.'));
      setPaying(false);
    }
  };

  // ── Success screen ─────────────────────────────────────────
  if (paymentConfirmed) {
    return (
      <div className="flex flex-col items-center text-center py-16 space-y-6">
        <div className="w-24 h-24 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
          <PartyPopper className="w-12 h-12 text-emerald-400" />
        </div>
        <h2 className="text-3xl font-black text-white uppercase tracking-tight">
          {t('migma_checkout.step3.success_title', 'Processo Iniciado!')}
        </h2>
        <p className="text-gray-400 max-w-md text-lg">
          {t('migma_checkout.step3.success_message', 'Seu processo de seleção foi iniciado com sucesso. Nossa equipe entrará em contato em até 24 horas.')}
        </p>
        <div className="bg-[#111] border border-gold-medium/30 rounded-2xl p-6 text-left w-full max-w-md space-y-2">
          <p className="text-gold-medium font-bold text-sm mb-3">{t('migma_checkout.step3.next_steps', 'Próximos Passos')}</p>
          {[
            t('migma_checkout.step3.next_step_1', 'Verifique seu e-mail para confirmação'),
            t('migma_checkout.step3.next_step_2', 'Nossa equipe revisará seus documentos'),
            t('migma_checkout.step3.next_step_3', 'Você será conectado com universidades parceiras'),
            t('migma_checkout.step3.next_step_4', 'Nós te guiaremos até a aceitação'),
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-3 text-sm text-gray-300">
              <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              {s}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Payment form ───────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Order Summary ── */}
      <div className="bg-[#111] border border-gold-medium/30 rounded-2xl overflow-hidden">
        <div className="bg-gradient-to-b from-gold-dark/20 to-transparent px-6 pt-5 pb-4 border-b border-gold-medium/20">
          <p className="text-xs text-gold-medium font-bold uppercase tracking-widest mb-1">{t('migma_checkout.step3.order_summary', 'Resumo do Pedido')}</p>
          <p className="text-white font-bold">{config.name}</p>
        </div>
        <div className="px-6 py-5 space-y-3">
          <div className="flex justify-between text-sm text-gray-400">
            <span>{t('migma_checkout.step3.process_fee', 'Taxa de Processo de Seleção')}</span>
            <span className="text-white">${config.basePrice}</span>
          </div>
          {step1.num_dependents > 0 && (
            <div className="flex justify-between text-sm text-gray-400">
              <span>{step1.num_dependents} {step1.num_dependents > 1 ? t('migma_checkout.step3.dependents_plural') : t('migma_checkout.step3.dependents')}</span>
              <span className="text-gold-medium">+${step1.num_dependents * config.dependentPrice}</span>
            </div>
          )}
          <div className="border-t border-white/10 pt-3 flex justify-between font-black text-white text-xl">
            <span>{t('migma_checkout.step3.total', 'Total')}</span>
            <span className="text-gold-medium">${total}</span>
          </div>
        </div>
      </div>

      {/* ── Confirmed: Personal Info ── */}
      <div className="bg-[#111] border border-white/10 rounded-2xl p-5 space-y-3">
        <p className="text-sm font-bold text-gold-medium flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400" /> {t('migma_checkout.step3.personal_info', 'Informações Pessoais')}
        </p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><p className="text-gray-500 text-xs">{t('migma_checkout.step1.full_name', 'Nome Completo')}</p><p className="text-white">{step1.full_name || '—'}</p></div>
          <div><p className="text-gray-500 text-xs">{t('migma_checkout.step1.email', 'E-mail')}</p><p className="text-white">{step1.email || '—'}</p></div>
          <div><p className="text-gray-500 text-xs">{t('migma_checkout.step1.phone', 'WhatsApp')}</p><p className="text-white">{step1.phone || '—'}</p></div>
          <div><p className="text-gray-500 text-xs">{t('migma_checkout.step1.num_dependents', 'Número de Dependentes')}</p><p className="text-white">{step1.num_dependents}</p></div>
        </div>
      </div>

      {/* ── Confirmed: Documents ── */}
      <div className="bg-[#111] border border-white/10 rounded-2xl p-5 space-y-3">
        <p className="text-sm font-bold text-gold-medium flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400" /> {t('migma_checkout.step3.docs_uploaded', 'Documentos Enviados')}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          {[
            { label: t('migma_checkout.step2.doc_front', 'Frente do Documento'), file: step2.doc_front },
            { label: t('migma_checkout.step2.doc_back', 'Verso do Documento'), file: step2.doc_back },
            { label: t('migma_checkout.step2.selfie_with_doc', 'Selfie com Documento'), file: step2.selfie },
          ].map(({ label, file }) => (
            <div key={label} className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
              <FileText className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-gray-400 text-xs">{label}</p>
                <p className="text-white text-xs truncate">{file?.name || '—'}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm mt-2">
          <div><p className="text-gray-500 text-xs">{t('migma_checkout.step2.birth_date', 'Data de Nascimento')}</p><p className="text-white">{step2.birth_date}</p></div>
          <div><p className="text-gray-500 text-xs">{t('migma_checkout.step2.doc_type', 'Documento')}</p><p className="text-white">{docTypeLabels[step2.doc_type]} — {step2.doc_number}</p></div>
          <div><p className="text-gray-500 text-xs">{t('migma_checkout.step2.country', 'País')}</p><p className="text-white">{step2.country}</p></div>
        </div>
      </div>

      {/* ── Payment Method ── */}
      <div className="bg-[#111] border border-white/10 rounded-2xl p-6 space-y-5">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-gold-medium" /> {t('migma_checkout.step3.payment_method', 'Forma de Pagamento')}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {availableMethods.map(m => (
            <button
              key={m.id}
              type="button"
              onClick={() => { setMethod(m.id); setError(null); }}
              className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                method === m.id
                  ? 'border-gold-medium bg-gold-medium/10'
                  : 'border-white/10 bg-[#1a1a1a] hover:border-white/20'
              }`}
            >
              <span className={`mt-0.5 ${method === m.id ? 'text-gold-medium' : 'text-gray-500'}`}>{m.icon}</span>
              <div>
                <p className={`font-semibold text-sm ${method === m.id ? 'text-gold-light' : 'text-white'}`}>{t(m.labelKey, m.defaultLabel)}</p>
                <p className="text-xs text-gray-500 mt-0.5">{t(m.sublabelKey, m.defaultSublabel)}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Card Ownership (Square / Parcelow) */}
        {needsCardOwnership && (
          <div className="space-y-3 pt-2 border-t border-white/10">
            <p className="text-sm font-medium text-gray-300">{t('migma_checkout.step3.card_ownership', 'Titular do Cartão')}</p>
            <div className="flex gap-3">
              {([['own', t('migma_checkout.step3.my_card', 'Meu cartão')], ['third_party', t('migma_checkout.step3.third_party_card', 'Cartão de terceiro')]] as const).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setCardOwnership(val)}
                  className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                    cardOwnership === val
                      ? 'border-gold-medium bg-gold-medium/10 text-gold-light'
                      : 'border-white/10 bg-[#1a1a1a] text-gray-400 hover:border-white/20'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {cardOwnership === 'third_party' && (
              <div>
                <label className="text-sm font-medium text-gray-300 mb-1.5 block">{t('migma_checkout.step3.payer_cpf', 'CPF do Titular')} *</label>
                <input
                  type="text"
                  value={cpf}
                  onChange={e => setCpf(e.target.value)}
                  placeholder="000.000.000-00"
                  className={INPUT_CLASS}
                />
              </div>
            )}
          </div>
        )}

        {/* Zelle / Pix receipt upload */}
        {needsReceipt && (
          <div className="space-y-3 pt-2 border-t border-white/10">
            <p className="text-sm font-medium text-gray-300">
              {t('migma_checkout.step3.payment_receipt', 'Comprovante de Pagamento')} *
            </p>
            {method === 'zelle' && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-xs text-blue-300">
                {t('migma_checkout.step3.zelle_instruction', 'Envie para: payments@migma.com — depois anexe o comprovante abaixo.')}
              </div>
            )}
            {method === 'pix' && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-xs text-emerald-300">
                {t('migma_checkout.step3.pix_instruction', 'Chave Pix: pagamentos@migma.com — depois anexe o comprovante abaixo.')}
              </div>
            )}
            {receipt ? (
              <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3">
                <FileText className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span className="text-white text-sm flex-1 truncate">{receipt.name}</span>
                <button type="button" onClick={() => setReceipt(null)} className="text-gray-500 hover:text-red-400">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => receiptInputRef.current?.click()}
                className="w-full border-2 border-dashed border-white/20 hover:border-gold-medium/40 rounded-xl py-6 flex flex-col items-center gap-2 transition-colors"
              >
                <Upload className="w-6 h-6 text-gray-500" />
                <span className="text-sm text-gray-400">{t('migma_checkout.step3.click_attach_receipt', 'Clique para anexar o comprovante')}</span>
                <span className="text-xs text-gray-600">PNG, JPG ou PDF</span>
              </button>
            )}
            <input
              ref={receiptInputRef}
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={e => setReceipt(e.target.files?.[0] ?? null)}
            />
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <span className="w-4 h-4 flex-shrink-0">⚠</span>
          {error}
        </div>
      )}

      {/* Pay button */}
      <button
        type="button"
        onClick={handlePay}
        disabled={paying || !method}
        className="w-full py-4 rounded-xl bg-gradient-to-b from-gold-light via-gold-medium to-gold-light text-black font-black uppercase tracking-widest text-sm shadow-lg shadow-gold-medium/20 hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {paying
          ? <><Loader2 className="w-4 h-4 animate-spin" /> {isStripe ? t('migma_checkout.step3.redirecting', 'Redirecionando...') : t('migma_checkout.step3.processing', 'Processando...')}</>
          : isStripe
          ? t('migma_checkout.step3.pay_with_stripe', 'Pagar com Stripe →')
          : t('migma_checkout.step3.confirm_payment', { total }, `Confirmar Pagamento — $${total} →`)
        }
      </button>
    </div>
  );
};
