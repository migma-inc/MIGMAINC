/**
 * Questionário do Processo Seletivo — MIGMA v7
 * Rota: /student/survey/:service
 *
 * Exibido após conclusão do MigmaCheckout (Step 2).
 * Persiste em selection_survey_responses + user_profiles.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronLeft, Check, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { CheckoutTopbar } from '../MigmaCheckout/components/CheckoutTopbar';
import {
  SURVEY_SECTIONS,
  getQuestionsForService,
  OPERATIONAL_FIELD_MAP,
  type SurveyQuestion,
  type SurveySection,
} from '../../data/migmaSurveyQuestions';
import { SurveyQuestionField } from './components/SurveyQuestionField';
import { SurveyProgressBar } from './components/SurveyProgressBar';
import { SurveyCompletionScreen } from './components/SurveyCompletionScreen';

// ---------------------------------------------------------------------------

const MigmaSurvey: React.FC = () => {
  const { service = 'transfer' } = useParams<{ service: string }>();
  const navigate = useNavigate();

  const questions = getQuestionsForService(service);
  const sections = SURVEY_SECTIONS;

  const [currentSectionIdx, setCurrentSectionIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  // Pré-preencher dados do perfil
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate(`/student/checkout/${service}`); return; }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, selection_survey_completed_at')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (!profile) return;

      setProfileId(profile.id);
      setUserEmail(profile.email || session.user.email || '');
      setUserName(profile.full_name || '');

      if (profile.selection_survey_completed_at) {
        setCompleted(true);
        return;
      }

      setAnswers(prev => ({
        ...prev,
        a_email: profile.email || session.user.email || '',
        a_full_name: profile.full_name || '',
      }));
    })();
  }, [service, navigate]);

  const currentSection: SurveySection = sections[currentSectionIdx];
  const sectionQuestions: SurveyQuestion[] = questions.filter(q => q.section === currentSection.key);

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

  const scrollTop = () => {
    topRef.current?.scrollIntoView({ behavior: 'smooth' });
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

  const handleAnswer = (questionId: string, value: string | string[]) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = async () => {
    if (!profileId) return;
    setSaving(true);
    setError(null);

    try {
      const now = new Date().toISOString();

      // Build operational fields for selection_survey_responses
      const operationalFields: Record<string, any> = {};
      for (const [qId, dbField] of Object.entries(OPERATIONAL_FIELD_MAP)) {
        const val = answers[qId];
        if (val !== undefined) operationalFields[dbField] = val;
      }

      // Upsert into selection_survey_responses
      const { error: upsertErr } = await supabase
        .from('selection_survey_responses')
        .upsert(
          {
            profile_id: profileId,
            service_type: service,
            ...operationalFields,
            answers,
            completed_at: now,
            updated_at: now,
          },
          { onConflict: 'profile_id,service_type' }
        );

      if (upsertErr) throw upsertErr;

      // Mirror operational fields to user_profiles
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
      // Store summary of key operational answers for CRM
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

      setCompleted(true);
      scrollTop();
    } catch (err: any) {
      console.error('[Survey] submit error', err);
      setError('Erro ao salvar suas respostas. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  if (completed) {
    return (
      <SurveyCompletionScreen
        email={userEmail}
        name={userName}
        service={service}
        onContinue={() => navigate('/student/onboarding')}
      />
    );
  }

  const isLast = currentSectionIdx === sections.length - 1;

  return (
    <div className="min-h-screen bg-black" ref={topRef}>
      <CheckoutTopbar serviceLabel={service === 'transfer' ? 'Transfer' : service === 'cos' ? 'COS' : service.toUpperCase()} />

      <SurveyProgressBar
        sections={sections}
        currentSectionIdx={currentSectionIdx}
      />

      <main className="max-w-2xl mx-auto px-4 pb-24" style={{ marginTop: '112px' }}>
        {/* Section header */}
        <div className="mb-8">
          <p className="text-gold-medium text-xs font-bold tracking-widest uppercase mb-1">
            Seção {currentSection.key} de {sections.length}
          </p>
          <h2 className="text-white text-2xl font-black mb-2">{currentSection.title}</h2>
          <p className="text-gray-400 text-sm">{currentSection.description}</p>
        </div>

        {/* Questions */}
        <div className="space-y-8">
          {sectionQuestions.map(q => (
            <SurveyQuestionField
              key={q.id}
              question={q}
              value={answers[q.id]}
              onChange={val => handleAnswer(q.id, val)}
            />
          ))}
        </div>

        {error && (
          <p className="mt-6 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        {/* Navigation */}
        <div className="mt-10 flex items-center justify-between">
          <button
            onClick={handleBack}
            disabled={currentSectionIdx === 0}
            className="flex items-center gap-2 px-5 py-3 border border-white/10 text-gray-400 hover:text-white hover:border-white/30 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed text-sm font-semibold"
          >
            <ChevronLeft className="w-4 h-4" />
            Voltar
          </button>

          <button
            onClick={handleNext}
            disabled={!isSectionComplete() || saving}
            className="flex items-center gap-2 px-6 py-3 bg-gold-medium hover:bg-gold-light text-black font-black rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm"
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
            ) : isLast ? (
              <><Check className="w-4 h-4" /> Enviar Questionário</>
            ) : (
              <>Próxima Seção <ChevronRight className="w-4 h-4" /></>
            )}
          </button>
        </div>

        {/* Progress indicator */}
        <p className="mt-6 text-center text-gray-600 text-xs">
          {currentSectionIdx + 1} / {sections.length} seções concluídas
        </p>
      </main>
    </div>
  );
};

export default MigmaSurvey;
