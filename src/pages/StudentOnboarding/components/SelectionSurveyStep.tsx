/**
 * Etapa 3 — Quiz de Seleção.
 * Avalia o perfil do aluno. Para alunos Migma, a aprovação é automática após completar o quiz.
 */
import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { useStudentAuth } from '../../../contexts/StudentAuthContext';
import { supabase } from '../../../lib/supabase';
import { questions, sections } from '../../../data/formQuestions';
import type { StepProps } from '../types';

export const SelectionSurveyStep: React.FC<StepProps> = ({ onNext }) => {
  const { user, userProfile, updateUserProfile } = useStudentAuth();
  const [currentSectionIdx, setCurrentSectionIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>(() => {
    try {
      const saved = localStorage.getItem('migma_survey_answers');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pré-preencher dados do perfil
  useEffect(() => {
    if (!userProfile) return;
    setAnswers(prev => {
      const next = { ...prev };
      if (!next[1] && userProfile.full_name) next[1] = userProfile.full_name;
      if (!next[2] && userProfile.email) next[2] = userProfile.email;
      if (!next[3] && userProfile.phone) next[3] = userProfile.phone;
      return next;
    });
  }, [userProfile?.full_name, userProfile?.email, userProfile?.phone]);

  // Verificar se já passou
  useEffect(() => {
    if (userProfile?.selection_survey_passed) {
      setSubmitted(true);
    }
  }, [userProfile?.selection_survey_passed]);

  // Persistir respostas localmente
  useEffect(() => {
    localStorage.setItem('migma_survey_answers', JSON.stringify(answers));
  }, [answers]);

  const currentSection = sections[currentSectionIdx];
  const sectionQuestions = questions.filter(q => q.section === currentSection.key);

  // Filtrar perguntas condicionais
  const visibleQuestions = sectionQuestions.filter(q => {
    if (!q.conditionalOn) return true;
    return answers[q.conditionalOn.questionId] === q.conditionalOn.value;
  });

  const isLastSection = currentSectionIdx === sections.length - 1;
  const isFirstSection = currentSectionIdx === 0;

  const requiredUnanswered = visibleQuestions.filter(q =>
    q.required && !answers[q.id]
  );

  const handleAnswer = (questionId: number, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
    setError(null);
  };

  const handleNext = () => {
    if (requiredUnanswered.length > 0) {
      setError(`Please answer all required questions before continuing.`);
      return;
    }
    setError(null);
    if (!isLastSection) {
      setCurrentSectionIdx(i => i + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = async () => {
    if (requiredUnanswered.length > 0) {
      setError('Please answer all required questions.');
      return;
    }
    if (!user?.id) return;

    setSaving(true);
    setError(null);

    try {
      // Para alunos Migma: aprovação automática ao completar o quiz

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ selection_survey_passed: true })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      await updateUserProfile({ selection_survey_passed: true } as any);

      localStorage.removeItem('migma_survey_answers');
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Failed to submit. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (submitted) {
    return (
      <div className="space-y-8 pb-12 max-w-2xl mx-auto px-4">
        <div className="bg-white border border-emerald-500/30 rounded-[2.5rem] p-8 text-center shadow-xl">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-emerald-500" />
          </div>
          <h3 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">
            Selection Survey Completed!
          </h3>
          <p className="text-slate-500 mb-6">
            Congratulations! You are qualified to proceed with your scholarship application.
          </p>
          <button
            onClick={onNext}
            className="bg-blue-600 text-white py-3 px-8 rounded-xl hover:bg-blue-700 font-bold uppercase tracking-widest shadow-lg transition-all"
          >
            Choose Your Scholarship
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 max-w-4xl mx-auto px-4">
      {/* Header */}
      <div className="text-center md:text-left space-y-3">
        <h2 className="text-3xl md:text-5xl font-black text-slate-900 uppercase tracking-tighter">
          Selection Survey
        </h2>
        <p className="text-lg text-slate-600 font-medium">
          Answer all questions to qualify for the scholarship program.
        </p>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-slate-500">
          <span>Section {currentSectionIdx + 1} of {sections.length}</span>
          <span>{Math.round(((currentSectionIdx + 1) / sections.length) * 100)}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-500"
            style={{ width: `${((currentSectionIdx + 1) / sections.length) * 100}%` }}
          />
        </div>
        <div className="flex gap-2">
          {sections.map((s, i) => (
            <div
              key={s.key}
              className={`h-1.5 flex-1 rounded-full transition-all ${
                i <= currentSectionIdx ? 'bg-blue-500' : 'bg-slate-200'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Section title */}
      <div className="bg-slate-900 text-white rounded-2xl px-6 py-4">
        <div className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-0.5">
          Section {currentSection.key}
        </div>
        <div className="font-bold text-lg">{currentSection.title}</div>
      </div>

      {/* Questions */}
      <div className="space-y-6">
        {visibleQuestions.map(q => (
          <QuestionCard
            key={q.id}
            question={q}
            answer={answers[q.id] ?? ''}
            extraAnswer={answers[q.id + 0.5] ?? ''}
            onAnswer={handleAnswer}
          />
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl p-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => { setCurrentSectionIdx(i => i - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          disabled={isFirstSection}
          className="flex items-center gap-2 text-slate-600 font-semibold py-3 px-5 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>

        {isLastSection ? (
          <button
            onClick={handleSubmit}
            disabled={saving || requiredUnanswered.length > 0}
            className="flex items-center gap-2 bg-emerald-600 text-white py-3 px-8 rounded-xl hover:bg-emerald-700 font-bold uppercase tracking-widest shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : <>Submit Survey</>}
          </button>
        ) : (
          <button
            onClick={handleNext}
            disabled={requiredUnanswered.length > 0}
            className="flex items-center gap-2 bg-blue-600 text-white py-3 px-8 rounded-xl hover:bg-blue-700 font-bold uppercase tracking-widest shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

// ─── QuestionCard ──────────────────────────────────────────────────────────
interface QuestionCardProps {
  question: (typeof questions)[0];
  answer: string;
  extraAnswer: string;
  onAnswer: (id: number, value: string) => void;
}

const QuestionCard: React.FC<QuestionCardProps> = ({ question, answer, onAnswer }) => {
  const isRequired = question.required;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
      <div className="flex gap-2">
        <span className="text-xs font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full shrink-0">
          Q{question.id}
        </span>
        <p className="text-slate-800 font-medium leading-snug">
          {question.text}
          {isRequired && <span className="text-red-400 ml-1">*</span>}
        </p>
      </div>

      {/* Text / Email / Number / Textarea */}
      {['text', 'email', 'number', 'date'].includes(question.type) && (
        <input
          type={question.type}
          value={answer}
          placeholder={question.placeholder}
          onChange={e => onAnswer(question.id, e.target.value)}
          className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      )}

      {question.type === 'textarea' && (
        <textarea
          value={answer}
          placeholder={question.placeholder}
          onChange={e => onAnswer(question.id, e.target.value)}
          rows={4}
          className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      )}

      {/* Radio / yesno / truefalse */}
      {['radio', 'yesno', 'truefalse'].includes(question.type) && (
        <div className="space-y-2">
          {question.type === 'yesno' && !question.options && (
            <>
              {['Sim', 'Não'].map(opt => (
                <OptionButton key={opt} value={opt} label={opt} selected={answer === opt} onSelect={v => onAnswer(question.id, v)} />
              ))}
            </>
          )}
          {(question.options || []).map(opt => (
            <OptionButton
              key={opt.value}
              value={opt.value}
              label={opt.label}
              selected={answer === opt.value}
              warning={opt.warning}
              onSelect={v => onAnswer(question.id, v)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface OptionButtonProps {
  value: string;
  label: string;
  selected: boolean;
  warning?: boolean;
  onSelect: (v: string) => void;
}

const OptionButton: React.FC<OptionButtonProps> = ({ value, label, selected, warning, onSelect }) => (
  <button
    onClick={() => onSelect(value)}
    className={`
      w-full text-left px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all
      ${selected
        ? warning
          ? 'border-amber-400 bg-amber-50 text-amber-800'
          : 'border-blue-500 bg-blue-50 text-blue-800'
        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
      }
    `}
  >
    <span className="flex items-center gap-2">
      <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
        selected ? (warning ? 'border-amber-400 bg-amber-400' : 'border-blue-500 bg-blue-500') : 'border-slate-300'
      }`} />
      {label}
    </span>
  </button>
);
