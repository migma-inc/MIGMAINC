/**
 * Etapa 2 — Dados Adicionais do Perfil (Seção A — spec v7 §4.7)
 * Coleta dados pessoais do estudante e salva em user_identity (MIGMA).
 * Marca identity_verified = true em MIGMA e Matricula USA (gate do hook).
 */
import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle } from 'lucide-react';
import { useStudentAuth } from '../../../contexts/StudentAuthContext';
import { supabase } from '../../../lib/supabase';
import type { StepProps } from '../types';

const DOCUMENT_TYPES = ['Passaporte', 'RG', 'CNH'];
const MARITAL_STATUS_OPTIONS = ['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)'];
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
      setError(err.message || 'Erro ao salvar. Tente novamente.');
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
          Perfil Completo!
        </h3>
        <p className="text-gray-400 mb-6">Seus dados já foram registrados.</p>
        <button
          onClick={onNext}
          className="px-8 py-3 bg-gold-medium hover:bg-gold-dark text-black font-black uppercase tracking-widest rounded-xl transition-colors"
        >
          Continuar →
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-gold-medium mb-1">
          Etapa 2
        </p>
        <h2 className="text-2xl font-black text-white uppercase tracking-tight">
          Dados do Perfil
        </h2>
        <p className="text-sm text-gray-400 mt-1">
          Preencha todas as informações abaixo para continuar.
        </p>
      </div>

      <div className="space-y-4">
        {/* Data de Nascimento */}
        <Field label="Data de Nascimento">
          <input
            type="date"
            value={form.birth_date}
            onChange={set('birth_date')}
            className={inputCls + ' [color-scheme:dark]'}
          />
        </Field>

        {/* Tipo + Número do Documento */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo de Documento">
            <select value={form.document_type} onChange={set('document_type')} className={selectCls}>
              <option value="">Selecione</option>
              {DOCUMENT_TYPES.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </Field>
          <Field label="Número do Documento">
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
        <Field label="Endereço (Rua e número)">
          <input
            type="text"
            value={form.address}
            onChange={set('address')}
            placeholder="Ex: Rua das Flores, 123"
            className={inputCls}
          />
        </Field>

        {/* Cidade + Estado */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cidade">
            <input type="text" value={form.city} onChange={set('city')} placeholder="Ex: São Paulo" className={inputCls} />
          </Field>
          <Field label="Estado / Província">
            <input type="text" value={form.state} onChange={set('state')} placeholder="Ex: SP" className={inputCls} />
          </Field>
        </div>

        {/* CEP + País */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="CEP / Código Postal">
            <input type="text" value={form.zip_code} onChange={set('zip_code')} placeholder="Ex: 01310-100" className={inputCls} />
          </Field>
          <Field label="País de Residência">
            <select value={form.country} onChange={set('country')} className={selectCls}>
              <option value="">Selecione</option>
              {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        </div>

        {/* Nacionalidade + Estado Civil */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nacionalidade">
            <select value={form.nationality} onChange={set('nationality')} className={selectCls}>
              <option value="">Selecione</option>
              {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Estado Civil">
            <select value={form.marital_status} onChange={set('marital_status')} className={selectCls}>
              <option value="">Selecione</option>
              {MARITAL_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
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
          Continuar →
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
