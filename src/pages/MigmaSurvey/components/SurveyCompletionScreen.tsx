import React, { useEffect, useRef, useState } from 'react';
import { Trophy, Mail, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CheckoutTopbar } from '../../MigmaCheckout/components/CheckoutTopbar';

interface Props {
  email: string;
  name: string;
  service: string;
  whatsapp?: string;
  academicFormation?: string;
  englishLevel?: string;
  surveyCompletedAt?: string; // ISO string — usado para calcular o unlock de 24h
  onContinue: () => void;
  standalone?: boolean; // false = embutido no StudentOnboarding (sem topbar)
}

const TARGET = 1481;
const DURATION_MS = 2800;

export const SurveyCompletionScreen: React.FC<Props> = ({ email, name, service, whatsapp, academicFormation, englishLevel, surveyCompletedAt, onContinue, standalone = true }) => {
  const { t, i18n } = useTranslation();
  const [count, setCount] = useState(0);
  const [unlockAt, setUnlockAt] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState('');
  const animationRef = useRef<number | null>(null);

  // Contador animado 0 → 1.481
  useEffect(() => {
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / DURATION_MS, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * TARGET));
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(tick);
      } else {
        setCount(TARGET);
      }
    };

    animationRef.current = requestAnimationFrame(tick);
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, []);

  // Botão "Escolher Faculdades" bloqueado por 24h — usa selection_survey_completed_at do banco
  useEffect(() => {
    const completedAt = surveyCompletedAt ? new Date(surveyCompletedAt) : new Date();
    setUnlockAt(new Date(completedAt.getTime() + 24 * 60 * 60 * 1000));
  }, [surveyCompletedAt]);

  // Countdown timer
  useEffect(() => {
    if (!unlockAt) return;
    const update = () => {
      const now = new Date();
      const diff = unlockAt.getTime() - now.getTime();
      if (diff <= 0) { setTimeLeft(''); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [unlockAt]);

  const isUnlocked = !timeLeft;
  const serviceLabel = service === 'transfer' ? 'Transfer' : service === 'cos' ? 'COS' : service.toUpperCase();

  return (
    <div className={standalone ? 'min-h-screen bg-black' : ''}>
      {standalone && <CheckoutTopbar serviceLabel={serviceLabel} />}

      <main className="max-w-xl mx-auto px-4 pb-20 text-center" style={{ paddingTop: standalone ? '140px' : '24px' }}>
        {/* Ícone de troféu */}
        <div className="w-20 h-20 bg-gold-medium/10 border-2 border-gold-medium/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <Trophy className="w-9 h-9 text-gold-medium" />
        </div>

        <h1 className="text-white text-3xl font-black mb-2 tracking-tight">
          {t('student_onboarding.survey_completion.title')}
        </h1>
        <p className="text-gray-400 text-sm mb-8">
          {t('student_onboarding.survey_completion.subtitle')}
        </p>

        {/* Contador animado */}
        <div className="mb-2">
          <span className="text-gold-medium text-6xl font-black tabular-nums">
            {count.toLocaleString(i18n.language)}
          </span>
        </div>
        <p className="text-white font-semibold text-lg mb-1">
          {t('student_onboarding.survey_completion.institutions')}
        </p>
        <a
          href="https://studyinthestates.dhs.gov"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gold-medium text-xs hover:underline"
        >
          Study in the States — DHS
        </a>

        {/* Resumo da candidatura */}
        <div className="mt-8 bg-[#0d0d0d] border border-white/10 rounded-2xl p-5 text-left space-y-2 text-sm">
          <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-3">{t('student_onboarding.survey_completion.summary_title')}</p>
          {name && (
            <div className="flex justify-between gap-4">
              <span className="text-gray-400 shrink-0">{t('student_onboarding.survey_completion.name')}</span>
              <span className="text-white font-semibold text-right">{name}</span>
            </div>
          )}
          {email && (
            <div className="flex justify-between gap-4">
              <span className="text-gray-400 shrink-0">{t('student_onboarding.survey_completion.email')}</span>
              <span className="text-white font-semibold text-right">{email}</span>
            </div>
          )}
          {whatsapp && (
            <div className="flex justify-between gap-4">
              <span className="text-gray-400 shrink-0">{t('student_onboarding.survey_completion.whatsapp')}</span>
              <span className="text-white font-semibold text-right">{whatsapp}</span>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <span className="text-gray-400 shrink-0">{t('student_onboarding.survey_completion.profile_service')}</span>
            <span className="text-white font-semibold text-right">{serviceLabel}</span>
          </div>
          {academicFormation && (
            <div className="flex justify-between gap-4">
              <span className="text-gray-400 shrink-0">{t('student_onboarding.survey_completion.formation')}</span>
              <span className="text-white font-semibold text-right">{academicFormation}</span>
            </div>
          )}
          {englishLevel && (
            <div className="flex justify-between gap-4">
              <span className="text-gray-400 shrink-0">{t('student_onboarding.survey_completion.english_level')}</span>
              <span className="text-white font-semibold text-right">{englishLevel}</span>
            </div>
          )}
        </div>

        {/* Card de retorno */}
        <div className="mt-4 bg-gold-medium/5 border border-gold-medium/20 rounded-2xl p-5">
          <p className="text-gold-light font-bold text-sm mb-1">{t('student_onboarding.survey_completion.feedback_time')}</p>
          <p className="text-gray-400 text-sm">
            {t('student_onboarding.survey_completion.feedback_desc')}
          </p>
        </div>

        {/* Email de confirmação */}
        <div className="mt-4 flex items-center justify-center gap-2 text-gray-500 text-xs">
          <Mail className="w-3.5 h-3.5" />
          <span>{t('student_onboarding.survey_completion.email_sent')} <span className="text-gray-300">{email}</span></span>
        </div>

        {/* Botão Escolher Faculdades */}
        <div className="mt-8">
          {isUnlocked ? (
            <button
              onClick={onContinue}
              className="w-full py-4 bg-gold-medium hover:bg-gold-light text-black font-black rounded-xl text-sm transition-all"
            >
              {t('student_onboarding.survey_completion.btn_choose_colleges')}
            </button>
          ) : (
            <div className="w-full py-4 bg-[#111] border border-white/10 rounded-xl text-center space-y-1 cursor-not-allowed">
              <p className="text-gray-500 text-sm font-semibold flex items-center justify-center gap-2">
                <Clock className="w-4 h-4" />
                {t('student_onboarding.survey_completion.btn_choose_colleges').replace(' →', '')}
              </p>
              <p className="text-gray-600 text-xs">
                {t('student_onboarding.survey_completion.available_in')} {timeLeft}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
