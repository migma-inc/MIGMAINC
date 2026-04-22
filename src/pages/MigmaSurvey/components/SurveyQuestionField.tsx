import React from 'react';
import { Check, AlertTriangle, Info } from 'lucide-react';
import type { SurveyQuestion } from '../../../data/migmaSurveyQuestions';
import { useTranslation } from 'react-i18next';

interface Props {
  question: SurveyQuestion;
  value: string | string[] | undefined;
  onChange: (value: string | string[]) => void;
}

export const SurveyQuestionField: React.FC<Props> = ({ question, value, onChange }) => {
  const { t } = useTranslation();

  const baseLabel = (
    <label className="block text-white font-semibold text-sm mb-3 leading-relaxed">
      {t(`survey_questions.${question.id}.text`, { defaultValue: question.text })}
      {question.required && <span className="text-gold-medium ml-1">*</span>}
      {question.exactCount && (
        <span className="ml-2 text-gold-medium/70 text-xs font-normal">
          {t('survey_questions.exact_count', { count: question.exactCount, defaultValue: `(escolha exatamente {{count}})`, replace: { count: question.exactCount } })}
        </span>
      )}
    </label>
  );

  // -------------------------------------------------------------------------
  // multiselect
  // -------------------------------------------------------------------------
  if (question.type === 'multiselect') {
    const selected: string[] = Array.isArray(value) ? value : [];
    const exactCount = question.exactCount ?? Infinity;

    const toggle = (optVal: string) => {
      if (selected.includes(optVal)) {
        onChange(selected.filter(v => v !== optVal));
      } else if (selected.length < exactCount) {
        onChange([...selected, optVal]);
      }
    };

    return (
      <div>
        {baseLabel}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {question.options?.map(opt => {
            const isSelected = selected.includes(opt.value);
            const isDisabled = !isSelected && selected.length >= exactCount;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggle(opt.value)}
                disabled={isDisabled}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all text-sm
                  ${isSelected
                    ? 'border-gold-medium bg-gold-medium/10 text-gold-light font-semibold'
                    : isDisabled
                    ? 'border-white/5 bg-[#0d0d0d] text-gray-600 cursor-not-allowed'
                    : 'border-white/10 bg-[#0d0d0d] text-gray-300 hover:border-white/30 hover:text-white'
                  }
                `}
              >
                <span className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center ${
                  isSelected ? 'border-gold-medium bg-gold-medium' : 'border-white/20'
                }`}>
                  {isSelected && <Check className="w-2.5 h-2.5 text-black" />}
                </span>
                {t(`survey_questions.${question.id}.options.${opt.value}`, { defaultValue: opt.label })}
              </button>
            );
          })}
        </div>
        <p className={`mt-2 text-xs ${selected.length === exactCount ? 'text-emerald-400' : 'text-gray-500'}`}>
          {t('survey_questions.selected_count', { selected: selected.length, total: exactCount, defaultValue: '{{selected}} / {{total}} selecionados', replace: { selected: selected.length, total: exactCount } })}
        </p>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // radio
  // -------------------------------------------------------------------------
  if (question.type === 'radio') {
    return (
      <div>
        {baseLabel}
        <div className="space-y-2">
          {question.options?.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`
                w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all text-sm
                ${value === opt.value
                  ? 'border-gold-medium bg-gold-medium/10 text-gold-light font-semibold'
                  : 'border-white/10 bg-[#0d0d0d] text-gray-300 hover:border-white/30 hover:text-white'
                }
              `}
            >
              <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                value === opt.value ? 'border-gold-medium bg-gold-medium' : 'border-white/20'
              }`} />
              {t(`survey_questions.${question.id}.options.${opt.value}`, { defaultValue: opt.label })}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // yesno
  // -------------------------------------------------------------------------
  if (question.type === 'yesno') {
    return (
      <div>
        {baseLabel}
        <div className="flex gap-3">
          {([
            { label: 'Sim', emoji: '✓', key: 'yes' },
            { label: 'Não', emoji: '✕', key: 'no' },
          ] as const).map(({ label, emoji, key }) => {
            const isSelected = value === label;
            const isYes = label === 'Sim';
            return (
              <button
                key={label}
                type="button"
                onClick={() => onChange(label)}
                className={`
                  flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 font-bold text-sm transition-all
                  ${isSelected
                    ? isYes
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                      : 'border-red-500/60 bg-red-500/10 text-red-400'
                    : 'border-white/10 bg-transparent text-gray-400 hover:border-white/25 hover:text-white'
                  }
                `}
              >
                <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] font-black flex-shrink-0 transition-all ${
                  isSelected
                    ? isYes ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-red-400 bg-red-400/80 text-white'
                    : 'border-white/20 text-transparent'
                }`}>
                  {emoji}
                </span>
                {t(`survey_questions.yesno.${key}`, { defaultValue: label })}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // checkbox
  // -------------------------------------------------------------------------
  if (question.type === 'checkbox') {
    const checked = value === 'true';
    return (
      <div>
        <button
          type="button"
          onClick={() => onChange(checked ? 'false' : 'true')}
          className={`
            w-full flex items-start gap-3 px-4 py-4 rounded-xl border-2 text-left transition-all
            ${checked
              ? 'border-gold-medium bg-gold-medium/10'
              : 'border-white/10 bg-[#0d0d0d] hover:border-white/30'
            }
          `}
        >
          <span className={`w-5 h-5 rounded border-2 flex-shrink-0 mt-0.5 flex items-center justify-center ${
            checked ? 'border-gold-medium bg-gold-medium' : 'border-white/20'
          }`}>
            {checked && <Check className="w-3 h-3 text-black" />}
          </span>
          <span className={`text-sm font-semibold leading-relaxed ${checked ? 'text-gold-light' : 'text-gray-300'}`}>
            {t(`survey_questions.${question.id}.text`, { defaultValue: question.text })}
            {question.required && <span className="text-gold-medium ml-1">*</span>}
          </span>
        </button>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // textarea
  // -------------------------------------------------------------------------
  if (question.type === 'textarea') {
    return (
      <div>
        {baseLabel}
        <textarea
          value={typeof value === 'string' ? value : ''}
          onChange={e => onChange(e.target.value)}
          rows={4}
          placeholder={t('survey_questions.textarea_placeholder', { defaultValue: 'Escreva aqui...' })}
          className="w-full bg-[#0d0d0d] border-2 border-white/10 focus:border-gold-medium text-white placeholder-gray-600 rounded-xl px-4 py-3 text-sm outline-none transition-colors resize-none"
        />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // date
  // -------------------------------------------------------------------------
  if (question.type === 'date') {
    return (
      <div className="space-y-3">
        {baseLabel}
        {question.description && (
          <div className="flex gap-2.5 rounded-xl border border-gold-medium/20 bg-gold-medium/5 px-4 py-3">
            <Info className="w-4 h-4 text-gold-medium flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-400 leading-relaxed">{t(`survey_questions.${question.id}.description`, { defaultValue: question.description })}</p>
          </div>
        )}
        <input
          type="date"
          value={typeof value === 'string' ? value : ''}
          onChange={e => onChange(e.target.value)}
          className="w-full bg-[#0d0d0d] border-2 border-white/10 focus:border-gold-medium text-white rounded-xl px-4 py-3 text-sm outline-none transition-colors [color-scheme:dark]"
        />
        {question.warning && (
          <div className="flex gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-300 font-semibold leading-relaxed">{t(`survey_questions.${question.id}.warning`, { defaultValue: question.warning })}</p>
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // text / email (default)
  // -------------------------------------------------------------------------
  return (
    <div>
      {baseLabel}
      <input
        type={question.type === 'email' ? 'email' : 'text'}
        value={typeof value === 'string' ? value : ''}
        onChange={e => onChange(e.target.value)}
        placeholder={question.type === 'email' ? t('survey_questions.email_placeholder', { defaultValue: 'seu@email.com' }) : ''}
        className="w-full bg-[#0d0d0d] border-2 border-white/10 focus:border-gold-medium text-white placeholder-gray-600 rounded-xl px-4 py-3 text-sm outline-none transition-colors"
      />
    </div>
  );
};
