/**
 * Step 2 — Documentos & Verificação de Identidade
 * Desbloqueado após confirmação de pagamento.
 */
import React, { useState, useRef } from 'react';
import { Upload, X, FileImage, AlertCircle, Loader2, ChevronDown, ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Step2Data, DocType, CivilStatus } from '../types';

interface Props {
  onComplete: (data: Step2Data) => Promise<void>;
  onBack: () => void;
  isCompleted?: boolean;
  onAdvance?: () => void;
}

const INPUT_CLASS = `
  w-full px-4 py-3 rounded-xl border border-white/10 bg-[#1a1a1a] text-white
  placeholder:text-gray-500 text-sm
  focus:outline-none focus:ring-1 focus:ring-gold-medium focus:border-gold-medium
  transition-colors
`.trim();

const SELECT_CLASS = `${INPUT_CLASS} appearance-none pr-10`;

const MAX_SIZE_MB = 20;
const ALLOWED_TYPES = ['image/jpeg', 'image/png'];

interface FileUploadProps {
  label: string;
  hint?: string;
  file: File | null;
  onFile: (file: File | null) => void;
  error?: string;
  showSelfieExample?: boolean;
}

const FileUploadArea: React.FC<FileUploadProps> = ({ label, hint, file, onFile, error, showSelfieExample }) => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const validate = (f: File): string | null => {
    if (!ALLOWED_TYPES.includes(f.type)) return t('migma_checkout.step2.error_file_type', 'Apenas arquivos JPG e PNG são permitidos');
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      return t('migma_checkout.step2.error_file_size', {
        size: MAX_SIZE_MB,
        defaultValue: `O arquivo deve ter menos de ${MAX_SIZE_MB}MB`,
      });
    }
    return null;
  };

  const handleFile = (f: File) => {
    const err = validate(f);
    if (err) { alert(err); return; }
    onFile(f);
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-300 block">{label} *</label>
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
      {showSelfieExample && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 text-xs text-blue-300">
          {t('migma_checkout.step2.selfie_hint_box', 'Segure o documento próximo ao seu rosto. Tanto o rosto quanto o documento devem estar claramente visíveis.')}
        </div>
      )}

      {file ? (
        <div className="flex items-center gap-3 bg-[#1a1a1a] border border-gold-medium/40 rounded-xl p-4">
          <FileImage className="w-8 h-8 text-gold-medium flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{file.name}</p>
            <p className="text-gray-500 text-xs">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
          </div>
          <button
            type="button"
            onClick={() => { onFile(null); if (inputRef.current) inputRef.current.value = ''; }}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          onClick={() => inputRef.current?.click()}
          className={`
            border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
            ${dragOver ? 'border-gold-medium bg-gold-dark/10' : 'border-gold-medium/40 hover:border-gold-medium/70 bg-[#1a1a1a]'}
            ${error ? 'border-red-500' : ''}
          `}
        >
          <Upload className="w-8 h-8 text-gold-medium/70 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">{t('migma_checkout.step2.drop_file', 'Arraste o arquivo aqui ou clique para carregar')}</p>
          <p className="text-gray-600 text-xs mt-1">JPG or PNG, max {MAX_SIZE_MB}MB</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </div>
      )}
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
};

export const Step2Documents: React.FC<Props> = ({ onComplete, onBack, isCompleted, onAdvance }) => {
  const { t } = useTranslation();

  if (isCompleted) {
    return (
      <div className="space-y-6">
        <div className="bg-[#111] border border-emerald-500/30 rounded-xl p-5 flex items-center justify-between">
          <div className="flex gap-4 items-center">
            <div className="w-12 h-12 flex-shrink-0 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center">
              <span className="w-5 h-5 flex items-center justify-center text-emerald-400 font-bold">✓</span>
            </div>
            <div>
              <p className="font-bold text-white text-base mb-0.5">{t('migma_checkout.step2.completed_title', 'Documentação Aceita!')}</p>
              <p className="text-sm text-gray-400">
                {t('migma_checkout.step2.completed_message', 'Seus documentos e informações obrigatórias para esta etapa já foram processados.')}
              </p>
            </div>
          </div>
          <div className="hidden sm:flex px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-xs font-bold items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
            Verificado
          </div>
        </div>

        <div className="flex gap-4 pt-4">
          <button type="button" onClick={onBack}
            className="flex-1 py-4 rounded-xl border border-white/10 text-white font-bold hover:bg-white/5 transition-colors flex items-center justify-center gap-2">
            <ChevronLeft className="w-4 h-4" /> {t('migma_checkout.back', 'Voltar')}
          </button>

          <button type="button" onClick={onAdvance}
            className="flex-[2] py-4 rounded-xl bg-gradient-to-b from-gold-light via-gold-medium to-gold-light text-black font-black uppercase tracking-widest text-sm hover:opacity-90 active:scale-[0.99] transition-all flex items-center justify-center gap-2">
            {t('migma_checkout.step2.continue_to_payment', 'Avançar para Pagamento →')}
          </button>
        </div>
      </div>
    );
  }
  const [form, setForm] = useState<Step2Data>({
    birth_date: '', doc_type: 'passport', doc_number: '',
    address: '', city: '', state: '', zip_code: '', country: '', nationality: '',
    civil_status: 'single', notes: '',
    doc_front: null, doc_back: null, selfie: null,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof Step2Data>(key: K, val: Step2Data[K]) => {
    setForm(prev => ({ ...prev, [key]: val }));
    setErrors(prev => { const n = { ...prev }; delete n[key as string]; return n; });
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.birth_date) e.birth_date = t('common.required', 'Obrigatório');
    if (!form.doc_number.trim()) e.doc_number = t('common.required', 'Obrigatório');
    if (!form.address.trim()) e.address = t('common.required', 'Obrigatório');
    if (!form.city.trim()) e.city = t('common.required', 'Obrigatório');
    if (!form.state.trim()) e.state = t('common.required', 'Obrigatório');
    if (!form.zip_code.trim()) e.zip_code = t('common.required', 'Obrigatório');
    if (!form.country.trim()) e.country = t('common.required', 'Obrigatório');
    if (!form.nationality.trim()) e.nationality = t('common.required', 'Obrigatório');
    if (!form.doc_front) e.doc_front = t('migma_checkout.step2.validation_doc_front', 'Frente do documento é obrigatória');
    if (!form.doc_back) e.doc_back = t('migma_checkout.step2.validation_doc_back', 'Verso do documento é obrigatório');
    if (!form.selfie) e.selfie = t('migma_checkout.step2.validation_selfie', 'Selfie com documento é obrigatória');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      console.log('[Step2Documents] Submitting form...', form);
      await onComplete(form);
      console.log('[Step2Documents] onComplete finished.');
    } catch (err) {
      console.error('[Step2Documents] Error in onComplete:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* ── Seção A: Dados adicionais do perfil ── */}
      <div className="bg-[#111] border border-white/10 rounded-2xl p-6 space-y-5">
        <h3 className="text-base font-bold text-white">{t('migma_checkout.step2.title', 'Dados Adicionais do Perfil')}</h3>

        {/* Data de nascimento + Tipo de doc */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-300 mb-1.5 block">{t('migma_checkout.step2.birth_date', 'Data de Nascimento')} *</label>
            <input type="date" value={form.birth_date}
              onChange={e => set('birth_date', e.target.value)}
              className={`${INPUT_CLASS} ${errors.birth_date ? 'border-red-500' : ''}`} />
            {errors.birth_date && <p className="text-red-400 text-xs mt-1">{errors.birth_date}</p>}
          </div>
          <div>
            <label className="text-sm font-medium text-gray-300 mb-1.5 block">{t('migma_checkout.step2.doc_type', 'Tipo de Documento')} *</label>
            <div className="relative">
              <select value={form.doc_type} onChange={e => set('doc_type', e.target.value as DocType)}
                className={SELECT_CLASS}>
                <option value="passport" className="bg-[#1a1a1a]">{t('docs.passport', 'Passaporte')}</option>
                <option value="rg" className="bg-[#1a1a1a]">RG</option>
                <option value="cnh" className="bg-[#1a1a1a]">CNH</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Número do documento */}
        <div>
          <label className="text-sm font-medium text-gray-300 mb-1.5 block">{t('migma_checkout.step2.doc_number', 'Número do Documento')} *</label>
          <input type="text" value={form.doc_number}
            onChange={e => set('doc_number', e.target.value)}
            className={`${INPUT_CLASS} ${errors.doc_number ? 'border-red-500' : ''}`} />
          {errors.doc_number && <p className="text-red-400 text-xs mt-1">{errors.doc_number}</p>}
        </div>

        {/* Endereço */}
        <div>
          <label className="text-sm font-medium text-gray-300 mb-1.5 block">{t('migma_checkout.step2.address', 'Endereço (Rua e Número)')} *</label>
          <input type="text" value={form.address}
            onChange={e => set('address', e.target.value)}
            className={`${INPUT_CLASS} ${errors.address ? 'border-red-500' : ''}`} />
          {errors.address && <p className="text-red-400 text-xs mt-1">{errors.address}</p>}
        </div>

        {/* Cidade + Estado + CEP */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-300 mb-1.5 block">{t('migma_checkout.step2.city', 'Cidade')} *</label>
            <input type="text" value={form.city}
              onChange={e => set('city', e.target.value)}
              className={`${INPUT_CLASS} ${errors.city ? 'border-red-500' : ''}`} />
            {errors.city && <p className="text-red-400 text-xs mt-1">{errors.city}</p>}
          </div>
          <div>
            <label className="text-sm font-medium text-gray-300 mb-1.5 block">{t('migma_checkout.step2.state_province', 'Estado / Província')} *</label>
            <input type="text" value={form.state}
              onChange={e => set('state', e.target.value)}
              className={`${INPUT_CLASS} ${errors.state ? 'border-red-500' : ''}`} />
            {errors.state && <p className="text-red-400 text-xs mt-1">{errors.state}</p>}
          </div>
          <div>
            <label className="text-sm font-medium text-gray-300 mb-1.5 block">{t('migma_checkout.step2.postal_code', 'CEP / Código Postal')} *</label>
            <input type="text" value={form.zip_code}
              onChange={e => set('zip_code', e.target.value)}
              className={`${INPUT_CLASS} ${errors.zip_code ? 'border-red-500' : ''}`} />
            {errors.zip_code && <p className="text-red-400 text-xs mt-1">{errors.zip_code}</p>}
          </div>
        </div>

        {/* País + Nacionalidade + Estado civil */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-300 mb-1.5 block">{t('migma_checkout.step2.country', 'País de Residência')} *</label>
            <input type="text" value={form.country}
              onChange={e => set('country', e.target.value)}
              className={`${INPUT_CLASS} ${errors.country ? 'border-red-500' : ''}`} />
            {errors.country && <p className="text-red-400 text-xs mt-1">{errors.country}</p>}
          </div>
          <div>
            <label className="text-sm font-medium text-gray-300 mb-1.5 block">{t('migma_checkout.step2.nationality', 'Nacionalidade')} *</label>
            <input type="text" value={form.nationality}
              onChange={e => set('nationality', e.target.value)}
              className={`${INPUT_CLASS} ${errors.nationality ? 'border-red-500' : ''}`} />
            {errors.nationality && <p className="text-red-400 text-xs mt-1">{errors.nationality}</p>}
          </div>
          <div>
            <label className="text-sm font-medium text-gray-300 mb-1.5 block">{t('migma_checkout.step2.marital_status', 'Estado Civil')} *</label>
            <div className="relative">
              <select value={form.civil_status}
                onChange={e => set('civil_status', e.target.value as CivilStatus)}
                className={SELECT_CLASS}>
                <option value="single" className="bg-[#1a1a1a]">{t('checkout.civil_status_single', 'Solteiro')}</option>
                <option value="married" className="bg-[#1a1a1a]">{t('checkout.civil_status_married', 'Casado')}</option>
                <option value="divorced" className="bg-[#1a1a1a]">{t('checkout.civil_status_divorced', 'Divorciado')}</option>
                <option value="widowed" className="bg-[#1a1a1a]">{t('checkout.civil_status_widowed', 'Viúvo')}</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Observações (opcional) */}
        <div>
          <label className="text-sm font-medium text-gray-300 mb-1.5 block">
            {t('migma_checkout.step2.additional_notes', 'Observações Adicionais (opcional)')}
          </label>
          <textarea
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            rows={3}
            className={`${INPUT_CLASS} resize-none`}
          />
        </div>
      </div>

      {/* ── Seção B: Upload de documentos ── */}
      <div className="bg-[#111] border border-white/10 rounded-2xl p-6 space-y-6">
        <h3 className="text-base font-bold text-white">{t('migma_checkout.step2.doc_upload_title', 'Upload de Documentos')}</h3>
        <p className="text-sm text-gray-400">
          {t('migma_checkout.step2.doc_upload_desc', {
            maxSize: MAX_SIZE_MB,
            defaultValue: `Envie fotos nítidas dos seus documentos. Arquivos devem ser JPG ou PNG, máx ${MAX_SIZE_MB}MB cada.`,
          })}
        </p>

        <FileUploadArea
          label={t('migma_checkout.step2.doc_front', 'Frente do Documento (Passaporte / RG / CNH)')}
          file={form.doc_front}
          onFile={f => set('doc_front', f)}
          error={errors.doc_front}
        />
        <FileUploadArea
          label={t('migma_checkout.step2.doc_back', 'Verso do Documento')}
          file={form.doc_back}
          onFile={f => set('doc_back', f)}
          error={errors.doc_back}
        />
        <FileUploadArea
          label={t('migma_checkout.step2.selfie_with_doc', 'Selfie com o Documento')}
          hint={t('migma_checkout.step2.selfie_hint', 'Segure o documento próximo ao seu rosto.')}
          showSelfieExample
          file={form.selfie}
          onFile={f => set('selfie', f)}
          error={errors.selfie}
        />
      </div>

      {/* Erro geral */}
      {Object.keys(errors).length > 0 && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {t('migma_checkout.step2.error_required_fields', 'Por favor, preencha todos os campos obrigatórios e envie os 3 documentos.')}
        </div>
      )}

      {/* Botões de ação */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 px-6 py-3 rounded-xl border border-white/20 text-gray-300 text-sm font-semibold hover:border-white/40 transition-all"
        >
          <ChevronLeft className="w-4 h-4" /> {t('migma_checkout.step2.back', 'Voltar')}
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex-1 py-4 rounded-xl bg-gradient-to-b from-gold-light via-gold-medium to-gold-light text-black font-black uppercase tracking-widest text-sm shadow-lg shadow-gold-medium/20 hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {saving
            ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('migma_checkout.step2.saving', 'Salvando...')}</>
            : t('migma_checkout.step2.upload_save', 'Carregar e Salvar Documentos →')
          }
        </button>
      </div>
    </form>
  );
};
