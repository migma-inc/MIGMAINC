import React, { useState, useEffect } from 'react';
import {
  User, Mail, Phone, Lock, Eye, EyeOff, Users, Loader2, ChevronDown, Check,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SignaturePadComponent } from '../../../components/ui/signature-pad';
import { PhoneInput } from 'react-international-phone';
import 'react-international-phone/style.css';
import { TermsModal } from './TermsModal';
import type { Step1Data, ServiceConfig } from '../types';
import { calcTotal } from '../serviceConfigs';
import { getContractTemplateByProductSlug, getChargebackAnnexTemplate } from '../../../lib/contract-templates';

interface Props {
  config: ServiceConfig;
  initialData?: Step1Data | null;
  existingUserId?: string | null;
  onComplete: (data: Step1Data, userId: string, total: number) => Promise<void>;
  onRegisterUser: (
    data: Pick<Step1Data, 'full_name' | 'email' | 'phone' | 'password'>,
    numDependents?: number,
    total?: number
  ) => Promise<string>;
}

const INPUT_CLASS = `
  w-full px-4 py-3 rounded-xl border border-white/10 bg-[#1a1a1a] text-white
  placeholder:text-gray-500 text-sm
  focus:outline-none focus:ring-1 focus:ring-gold-medium focus:border-gold-medium
  transition-colors
`.trim();

export const Step1PersonalInfo: React.FC<Props> = ({ config, initialData, existingUserId, onComplete, onRegisterUser }) => {
  const { t } = useTranslation();
  const [form, setForm] = useState<Step1Data>(initialData || {
    full_name: '', email: '', phone: '', password: '', confirm_password: '',
    num_dependents: 0, terms_accepted: false, data_accepted: false,
    signature_data_url: null,
  });
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // States for dynamic contract loading
  const [contractLoading, setContractLoading] = useState(true);
  const [fullContractText, setFullContractText] = useState<string>('');
  const [contractError, setContractError] = useState<string | null>(null);

  const total = calcTotal(config, form.num_dependents);

  useEffect(() => {
    async function loadContract() {
      setContractLoading(true);
      setContractError(null);
      try {
        const slug = config.contractSlug || config.type;
        const [mainContract, annex] = await Promise.all([
          getContractTemplateByProductSlug(slug),
          getChargebackAnnexTemplate()
        ]);

        if (!mainContract) {
          setContractError(t('migma_checkout.step1.contract_not_found', 'Não foi possível encontrar o contrato desse serviço, por favor, entre em contato com o suporte.'));
          setFullContractText('');
          return;
        }

        let fullText = mainContract.content;
        if (annex) {
          fullText += '\n\n' + '-'.repeat(40) + '\n\n' + annex.content;
        }
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

  // Se o usuário está logado, mas não tem nome/cel no banco, precisamos exibir os campos para ele preencher!
  const isSufficientlyIdentified = !!existingUserId && !!initialData?.full_name?.trim() && !!initialData?.phone?.trim();

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!isSufficientlyIdentified) {
      if (!form.full_name.trim()) e.full_name = t('migma_checkout.step1.validation_full_name', 'Nome completo é obrigatório');
      if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) e.email = t('migma_checkout.step1.validation_email', 'E-mail válido obrigatório');
      if (!form.phone.trim()) e.phone = t('migma_checkout.step1.validation_phone', 'WhatsApp é obrigatório');
    }
    
    // Somente exige senha se for um novo registro
    if (!existingUserId) {
      if (!form.password || form.password.length < 6) e.password = t('migma_checkout.step1.validation_password', 'Mínimo 6 caracteres');
      if (form.password !== form.confirm_password) e.confirm_password = t('migma_checkout.step1.validation_confirm_password', 'Senhas não coincidem');
    }
    
    // Termos e assinatura são sempre obrigatórios se não houver assinatura prévia
    if (!form.terms_accepted) e.terms_accepted = t('migma_checkout.step1.validation_terms', 'Obrigatório aceitar os termos');
    if (!form.data_accepted) e.data_accepted = t('migma_checkout.step1.validation_data', 'Obrigatório autorizar dados');
    if (!form.signature_data_url) e.signature = t('migma_checkout.step1.validation_signature', 'Assinatura é obrigatória');

    if (contractError) {
      setGlobalError(contractError);
      return false;
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    setGlobalError(null);

    try {
      let userId = existingUserId;
      if (!userId) {
        userId = await onRegisterUser(
          { full_name: form.full_name, email: form.email, phone: form.phone, password: form.password },
          form.num_dependents,
          total,
        );
      }
      await onComplete(form, userId!, total);
    } catch (err: any) {
      console.error('[Step1] Error:', err);
      setGlobalError(err.message || t('migma_checkout.step1.error_saving', 'Falha no registro. Tente novamente.'));
    } finally {
      setSaving(false);
    }
  };

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
                      placeholder={t('migma_checkout.step1.full_name_placeholder', 'Nome completo')}
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
                      placeholder="name@email.com"
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
                      onChange={(phone) => {
                        set('phone', phone);
                      }}
                      placeholder="+55 11 99999-9999"
                      className={`w-full ${errors.phone ? 'phone-input-error' : ''}`}
                      inputClassName={INPUT_CLASS}
                    />
                  </div>
                  {errors.phone && <p className="text-red-400 text-xs mt-1">{errors.phone}</p>}
                </div>
              </>
            )}

            {/* Senha - Oculta se já estiver logado/registrado */}
            {!existingUserId && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-300 mb-1.5 block">{t('migma_checkout.step1.password_label', 'Definir Senha')} *</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input type={showPwd ? 'text' : 'password'} value={form.password}
                      onChange={e => set('password', e.target.value)} placeholder={t('migma_checkout.step1.password_placeholder', 'Mínimo 6 chars')}
                      className={`${INPUT_CLASS} pl-10 pr-10 ${errors.password ? 'border-red-500' : ''}`} />
                    <button type="button" onClick={() => setShowPwd(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                      {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-300 mb-1.5 block">{t('migma_checkout.step1.confirm_password_label', 'Confirmar Senha')} *</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input type={showConfirmPwd ? 'text' : 'password'} value={form.confirm_password}
                      onChange={e => set('confirm_password', e.target.value)} placeholder={t('migma_checkout.step1.confirm_password_placeholder', 'Repita a senha')}
                      className={`${INPUT_CLASS} pl-10 pr-10 ${errors.confirm_password ? 'border-red-500' : ''}`} />
                    <button type="button" onClick={() => setShowConfirmPwd(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                      {showConfirmPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.confirm_password && <p className="text-red-400 text-xs mt-1">{errors.confirm_password}</p>}
                </div>
              </div>
            )}

            {/* Dependentes - Oculto se já estiver logado (modo super minimalista) */}
            {!existingUserId && (
              <div>
                <label className="text-sm font-medium text-gray-300 mb-1.5 block">
                  <Users className="w-4 h-4 inline mr-1" />
                  {t('migma_checkout.step1.num_dependents', 'Número de Dependentes')} *
                </label>
                <div className="relative">
                  <select value={form.num_dependents} onChange={e => set('num_dependents', Number(e.target.value))}
                    className={`${INPUT_CLASS} appearance-none pr-10`}>
                    {[0,1,2,3,4,5].map(n => (
                      <option key={n} value={n} className="bg-[#1a1a1a]">
                        {n === 0 ? t('migma_checkout.step1.only_applicant', 'Somente titular (sem taxa extra)') : t('migma_checkout.step3.dependents_count', { count: n, label: n > 1 ? t('migma_checkout.step3.dependents_plural') : t('migma_checkout.step3.dependents') }) + ` (+$${n * config.dependentPrice})`}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                </div>
                {form.num_dependents > 0 && (
                  <p className="text-gold-medium text-xs mt-1">
                    +${form.num_dependents * config.dependentPrice} {t('migma_checkout.step1.for_dependents', { count: form.num_dependents, label: form.num_dependents > 1 ? t('migma_checkout.step3.dependents_plural') : t('migma_checkout.step3.dependents') })}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* RIGHT: Resumo do pagamento */}
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
                {form.num_dependents > 0 && (
                  <div className="flex justify-between text-sm text-gray-400">
                    <span>{form.num_dependents} {form.num_dependents > 1 ? t('migma_checkout.step3.dependents_plural') : t('migma_checkout.step3.dependents')}</span>
                    <span className="text-gold-medium">+${form.num_dependents * config.dependentPrice}</span>
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

            <label className={`flex items-start gap-3 cursor-pointer`}>
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
                  <img 
                    src={form.signature_data_url} 
                    alt="Signature" 
                    className="h-16 object-contain" 
                  />
                </div>
                <button 
                  type="button" 
                  onClick={() => set('signature_data_url', null)}
                  className="mt-3 text-xs text-gray-500 hover:text-white underline transition-colors"
                >
                  {t('migma_checkout.step1.resign', 'Deseja assinar novamente?')}
                </button>
              </div>
            )}
          </div>

        {/* ── Erro global ── */}
        {globalError && (
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-xl p-4">
            <span className="w-4 h-4 flex-shrink-0">⚠</span>
            {globalError}
          </div>
        )}

        <button type="submit" disabled={saving || contractLoading}
          className="w-full py-4 rounded-xl bg-gradient-to-b from-gold-light via-gold-medium to-gold-light text-black font-black uppercase tracking-widest text-sm shadow-lg shadow-gold-medium/20 hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
          {saving
            ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('migma_checkout.step1.creating_account', 'Criando conta...')}</>
            : t('migma_checkout.step1.continue', 'Continuar para Documentos →')
          }
        </button>

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
