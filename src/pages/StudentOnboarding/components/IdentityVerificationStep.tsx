/**
 * Etapa 2 — Dados Adicionais do Perfil (Seção A — spec v7 §4.7)
 * Coleta dados pessoais do estudante e salva em user_identity (MIGMA).
 * Marca identity_verified = true em MIGMA e Matricula USA (gate do hook).
 */
import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useStudentAuth } from '../../../contexts/StudentAuthContext';
import { supabase } from '../../../lib/supabase';
import type { StepProps } from '../types';

const DOCUMENT_TYPES: { value: string; labelKey: string }[] = [
  { value: 'Passaporte', labelKey: 'student_onboarding.identity.doc_passport' },
  { value: 'RG',         labelKey: 'student_onboarding.identity.doc_rg' },
  { value: 'CNH',        labelKey: 'student_onboarding.identity.doc_cnh' },
];

const MARITAL_STATUS_OPTIONS: { value: string; labelKey: string }[] = [
  { value: 'Solteiro(a)',   labelKey: 'student_onboarding.identity.status_single' },
  { value: 'Casado(a)',     labelKey: 'student_onboarding.identity.status_married' },
  { value: 'Divorciado(a)', labelKey: 'student_onboarding.identity.status_divorced' },
  { value: 'Viúvo(a)',      labelKey: 'student_onboarding.identity.status_widowed' },
];

const COUNTRIES = [
  'Brasil', 'Estados Unidos', 'Portugal', 'Argentina', 'Colômbia',
  'México', 'Chile', 'Peru', 'Venezuela', 'Outro',
];

interface IdentityForm {
  birth_date: string;
  document_type: string;
  document_number: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  nationality: string;
  marital_status: string;
}

const EMPTY_FORM: IdentityForm = {
  birth_date: '',
  document_type: '',
  document_number: '',
  address: '',
  city: '',
  state: '',
  zip_code: '',
  country: '',
  nationality: '',
  marital_status: '',
};

export const IdentityVerificationStep: React.FC<StepProps> = ({ onNext }) => {
  const { t } = useTranslation();
  const { user } = useStudentAuth();
  const [form, setForm] = useState<IdentityForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadyVerified, setAlreadyVerified] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('user_identity')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setAlreadyVerified(true);
        setForm({
          birth_date: data.birth_date ?? '',
          document_type: data.document_type ?? '',
          document_number: data.document_number ?? '',
          address: data.address ?? '',
          city: data.city ?? '',
          state: data.state ?? '',
          zip_code: data.zip_code ?? '',
          country: data.country ?? '',
          nationality: data.nationality ?? '',
          marital_status: data.marital_status ?? '',
        });
      });
  }, [user?.id]);

  const set = (field: keyof IdentityForm) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  const isComplete = Object.values(form).every(v => v.trim() !== '');

  const handleSubmit = async () => {
    if (!user?.id || !isComplete) return;
    setSaving(true);
    setError(null);

    try {
      const now = new Date().toISOString();

      const { error: upsertErr } = await supabase
        .from('user_identity')
        .upsert(
          { user_id: user.id, ...form, updated_at: now },
          { onConflict: 'user_id' }
        );
      if (upsertErr) throw upsertErr;

      await supabase
        .from('user_profiles')
        .update({ identity_verified: true, updated_at: now })
        .eq('user_id', user.id);

      setAlreadyVerified(true);
      onNext();
    } catch (err: any) {
      setError(err.message || t('student_onboarding.identity.error_generic'));
    } finally {
      setSaving(false);
    }
  };

  if (alreadyVerified) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-10 h-10 text-emerald-400" />
        </div>
        <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-2">
          {t('student_onboarding.identity.already_verified_title')}
        </h3>
        <p className="text-gray-400 mb-6">{t('student_onboarding.identity.already_verified_desc')}</p>
        <button
          onClick={onNext}
          className="px-8 py-3 bg-gold-medium hover:bg-gold-dark text-black font-black uppercase tracking-widest rounded-xl transition-colors"
        >
          {t('student_onboarding.identity.continue')}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-gold-medium mb-1">
          {t('student_onboarding.identity.step_label')}
        </p>
        <h2 className="text-2xl font-black text-white uppercase tracking-tight">
          {t('student_onboarding.identity.title')}
        </h2>
        <p className="text-sm text-gray-400 mt-1">
          {t('student_onboarding.identity.subtitle')}
        </p>
      </div>

      <div className="space-y-4">
        {/* Data de Nascimento */}
        <Field label={t('student_onboarding.identity.birth_date')}>
          <input
            type="date"
            value={form.birth_date}
            onChange={set('birth_date')}
            className={inputCls + ' [color-scheme:dark]'}
          />
        </Field>

        {/* Tipo + Número do Documento */}
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('student_onboarding.identity.doc_type')}>
            <select value={form.document_type} onChange={set('document_type')} className={selectCls}>
              <option value="">{t('student_onboarding.identity.select_placeholder')}</option>
              {DOCUMENT_TYPES.map(d => <option key={d.value} value={d.value}>{t(d.labelKey)}</option>)}
            </select>
          </Field>
          <Field label={t('student_onboarding.identity.doc_number')}>
            <input
              type="text"
              value={form.document_number}
              onChange={set('document_number')}
              placeholder="Ex: AA123456"
              className={inputCls}
            />
          </Field>
        </div>

        {/* Endereço */}
        <Field label={t('student_onboarding.identity.address')}>
          <input
            type="text"
            value={form.address}
            onChange={set('address')}
            placeholder={t('student_onboarding.identity.address_placeholder')}
            className={inputCls}
          />
        </Field>

        {/* Cidade + Estado */}
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('student_onboarding.identity.city')}>
            <input type="text" value={form.city} onChange={set('city')} placeholder={t('student_onboarding.identity.city_placeholder')} className={inputCls} />
          </Field>
          <Field label={t('student_onboarding.identity.state')}>
            <input type="text" value={form.state} onChange={set('state')} placeholder={t('student_onboarding.identity.state_placeholder')} className={inputCls} />
          </Field>
        </div>

        {/* CEP + País */}
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('student_onboarding.identity.zip')}>
            <input type="text" value={form.zip_code} onChange={set('zip_code')} placeholder={t('student_onboarding.identity.zip_placeholder')} className={inputCls} />
          </Field>
          <Field label={t('student_onboarding.identity.country')}>
            <select value={form.country} onChange={set('country')} className={selectCls}>
              <option value="">{t('student_onboarding.identity.select_placeholder')}</option>
              {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        </div>

        {/* Nacionalidade + Estado Civil */}
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('student_onboarding.identity.nationality')}>
            <select value={form.nationality} onChange={set('nationality')} className={selectCls}>
              <option value="">{t('student_onboarding.identity.select_placeholder')}</option>
              {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label={t('student_onboarding.identity.marital_status')}>
            <select value={form.marital_status} onChange={set('marital_status')} className={selectCls}>
              <option value="">{t('student_onboarding.identity.select_placeholder')}</option>
              {MARITAL_STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{t(s.labelKey)}</option>)}
            </select>
          </Field>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-end pt-2">
        <button
          onClick={handleSubmit}
          disabled={!isComplete || saving}
          className="px-8 py-2.5 text-sm font-black uppercase tracking-widest bg-gold-medium hover:bg-gold-dark text-black rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? t('student_onboarding.identity.saving') : t('student_onboarding.identity.continue')}
        </button>
      </div>
    </div>
  );
};

// ─── helpers ────────────────────────────────────────────────────────────────

const inputCls =
  'w-full bg-[#0d0d0d] border-2 border-white/10 focus:border-gold-medium text-white placeholder-gray-600 rounded-xl px-4 py-3 text-sm outline-none transition-colors';

const selectCls =
  'w-full bg-[#0d0d0d] border-2 border-white/10 focus:border-gold-medium text-white rounded-xl px-4 py-3 text-sm outline-none transition-colors';

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-1.5">
    <label className="block text-white font-semibold text-sm leading-relaxed">{label}</label>
    {children}
  </div>
);
