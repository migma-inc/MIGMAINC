/**
 * MigmaSurveyStep — Questionário do Processo Seletivo v7
 * Integrado como step do StudentOnboarding (substitui SelectionSurveyStep).
 *
 * - Serviço lido de userProfile.service_type (não da URL)
 * - Persiste respostas em selection_survey_responses (MIGMA supabase)
 * - Espelha campos operacionais em user_profiles (MIGMA supabase)
 * - Marca selection_survey_passed = true em user_profiles (Matricula supabase)
 *   para que useOnboardingProgress avance o step
 * - Chama onNext() após conclusão
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../../lib/supabase';
import { useStudentAuth } from '../../../contexts/StudentAuthContext';
import {
  SURVEY_SECTIONS,
  getQuestionsForService,
  OPERATIONAL_FIELD_MAP,
  type SurveyQuestion,
  type SurveySection,
} from '../../../data/migmaSurveyQuestions';
import { SurveyQuestionField } from '../../MigmaSurvey/components/SurveyQuestionField';
import { SurveyCompletionScreen } from '../../MigmaSurvey/components/SurveyCompletionScreen';
import type { StepProps } from '../types';

export const MigmaSurveyStep: React.FC<StepProps> = ({ onNext }) => {
  const { t } = useTranslation();
  const { user, userProfile, updateUserProfile, refreshProfile } = useStudentAuth();

  // Serviço determinado pelo perfil, normalizado para os valores aceitos pelo banco
  // ex: 'cos-selection-process' → 'cos'
  const VALID_SERVICE_TYPES = ['transfer', 'cos', 'initial', 'eb2', 'eb3'] as const;
  type ValidServiceType = typeof VALID_SERVICE_TYPES[number];
  function normalizeService(raw: string | null | undefined): ValidServiceType {
    if (!raw) return 'transfer';
    const match = VALID_SERVICE_TYPES.find(v => raw === v || raw.startsWith(v + '-'));
    return match ?? 'transfer';
  }
  const service = normalizeService((userProfile as any)?.service_type);

  const questions = getQuestionsForService(service);
  const sections = SURVEY_SECTIONS;

  const [currentSectionIdx, setCurrentSectionIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [surveyCompletedAt, setSurveyCompletedAt] = useState<string | undefined>(undefined);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  // Pré-preencher dados do perfil e verificar se já concluiu
  useEffect(() => {
    (async () => {
      if (!user) return;

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, selection_survey_completed_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profile) return;
      setProfileId(profile.id);

      if (profile.selection_survey_completed_at) {
        setSurveyCompletedAt(profile.selection_survey_completed_at);
        setCompleted(true);
        return;
      }

      setAnswers(prev => ({
        ...prev,
        a_email: profile.email ?? (userProfile as any)?.email ?? '',
        a_full_name: profile.full_name ?? (userProfile as any)?.full_name ?? '',
      }));
    })();
  }, [user?.id]);

  const currentSection: SurveySection = sections[currentSectionIdx];
  const sectionQuestions: SurveyQuestion[] = questions.filter(
    q => q.section === currentSection.key
  );

  const isSectionComplete = useCallback((): boolean => {
    return sectionQuestions.every(q => {
      if (!q.required) return true;
      const val = answers[q.id];
      if (q.type === 'multiselect') {
        return Array.isArray(val) && val.length === (q.exactCount ?? 1);
      }
      if (q.type === 'checkbox') return val === 'true';
      return !!val && String(val).trim() !== '';
    });
  }, [sectionQuestions, answers]);

  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: 'smooth' });

  const handleAnswer = (questionId: string, value: string | string[]) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleNext = () => {
    if (currentSectionIdx < sections.length - 1) {
      setCurrentSectionIdx(i => i + 1);
      scrollTop();
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentSectionIdx > 0) {
      setCurrentSectionIdx(i => i - 1);
      scrollTop();
    }
  };

  const handleSubmit = async () => {
    if (!profileId || !user) return;
    setSaving(true);
    setError(null);

    try {
      const now = new Date().toISOString();

      // Build operational fields
      const operationalFields: Record<string, any> = {};
      for (const [qId, dbField] of Object.entries(OPERATIONAL_FIELD_MAP)) {
        const val = answers[qId];
        if (val !== undefined) operationalFields[dbField] = val;
      }

      // 1. Select → update/insert em selection_survey_responses (sem depender de constraint única)
      const { data: existing } = await supabase
        .from('selection_survey_responses')
        .select('id')
        .eq('profile_id', profileId)
        .eq('service_type', service)
        .maybeSingle();

      const surveyPayload = {
        profile_id: profileId,
        service_type: service,
        ...operationalFields,
        answers,
        completed_at: now,
        updated_at: now,
      };

      let surveyErr;
      if (existing?.id) {
        ({ error: surveyErr } = await supabase
          .from('selection_survey_responses')
          .update(surveyPayload)
          .eq('id', existing.id));
      } else {
        ({ error: surveyErr } = await supabase
          .from('selection_survey_responses')
          .insert(surveyPayload));
      }

      if (surveyErr) throw surveyErr;

      // 2. Espelhar campos operacionais em user_profiles (MIGMA supabase)
      const profileUpdate: Record<string, any> = {
        selection_survey_completed_at: now,
        updated_at: now,
      };
      if (operationalFields.transfer_deadline_date) {
        profileUpdate.transfer_deadline_date = operationalFields.transfer_deadline_date;
      }
      if (operationalFields.cos_i94_expiry_date) {
        profileUpdate.cos_i94_expiry_date = operationalFields.cos_i94_expiry_date;
      }
      profileUpdate.selection_survey_data = {
        academic_formation: operationalFields.academic_formation,
        interest_areas: operationalFields.interest_areas,
        english_level: operationalFields.english_level,
        main_objective: operationalFields.main_objective,
        weekly_availability: operationalFields.weekly_availability,
      };

      await supabase
        .from('user_profiles')
        .update(profileUpdate)
        .eq('id', profileId);

      // 3. Marcar selection_survey_passed = true (MIGMA)
      await supabase
        .from('user_profiles')
        .update({ selection_survey_passed: true })
        .eq('user_id', user.id);

      await updateUserProfile?.({ selection_survey_passed: true } as any);
      await refreshProfile();

      setSurveyCompletedAt(now);
      setCompleted(true);
      scrollTop();
    } catch (err: any) {
      console.error('[MigmaSurveyStep] submit error', err);
      setError(t('student_onboarding.survey.error_save'));
    } finally {
      setSaving(false);
    }
  };

  if (completed) {
    return (
      <div ref={topRef}>
        <SurveyCompletionScreen
          name={(userProfile as any)?.full_name ?? ''}
          email={(userProfile as any)?.email ?? ''}
          whatsapp={(userProfile as any)?.whatsapp ?? ''}
          service={service}
          academicFormation={typeof answers['a_formation'] === 'string' ? answers['a_formation'] : ''}
          englishLevel={typeof answers['a_english_level'] === 'string' ? answers['a_english_level'] : ''}
          surveyCompletedAt={surveyCompletedAt}
          onContinue={onNext}
          standalone={false}
        />
      </div>
    );
  }

  return (
    <div ref={topRef} className="max-w-2xl mx-auto px-4 py-8 space-y-6">

      {/* Section progress indicator */}
      <div className="flex items-center gap-2">
        {sections.map((s, idx) => {
          const done = idx < currentSectionIdx;
          const active = idx === currentSectionIdx;
          return (
            <div key={s.key} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black border-2 transition-all ${
                done   ? 'bg-gold-medium/20 border-gold-medium text-gold-medium' :
                active ? 'bg-gold-medium border-gold-medium text-black' :
                         'bg-transparent border-white/20 text-gray-600'
              }`}>
                {done ? '✓' : s.key}
              </div>
              {idx < sections.length - 1 && (
                <div className={`h-px w-6 transition-all ${idx < currentSectionIdx ? 'bg-gold-medium/40' : 'bg-white/10'}`} />
              )}
            </div>
          );
        })}
        <span className="ml-2 text-xs text-gray-500 font-medium">
          {t('student_onboarding.survey.section_counter', { current: currentSectionIdx + 1, total: sections.length })}
        </span>
      </div>

      {/* Section header */}
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-gold-medium mb-1">
          {t('student_onboarding.survey.section_label', { key: currentSection.key })}
        </p>
        <h2 className="text-2xl font-black text-white uppercase tracking-tight">
          {currentSection.title}
        </h2>
        <p className="text-sm text-gray-400 mt-1">{currentSection.description}</p>
      </div>

      {/* Questions */}
      <div className="space-y-3">
        {sectionQuestions.map(q => (
          <div key={q.id} className="bg-white/[0.03] border border-white/8 rounded-2xl p-4">
            <SurveyQuestionField
              question={q}
              value={answers[q.id]}
              onChange={val => handleAnswer(q.id, val)}
            />
          </div>
        ))}
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={handleBack}
          disabled={currentSectionIdx === 0}
          className="px-5 py-2.5 text-sm font-bold text-gray-400 border border-white/10 rounded-lg hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          {t('student_onboarding.survey.back')}
        </button>

        <button
          onClick={handleNext}
          disabled={!isSectionComplete() || saving}
          className="px-8 py-2.5 text-sm font-black uppercase tracking-widest bg-gold-medium hover:bg-gold-dark text-black rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {currentSectionIdx < sections.length - 1 ? t('student_onboarding.survey.next_section') : t('student_onboarding.survey.submit_survey')}
        </button>
      </div>
    </div>
  );
};
