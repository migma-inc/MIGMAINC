/**
 * WaitRoomStep — Sala de Espera pós-questionário (Spec V11 § 6.2)
 *
 * Exibido após selectionSurveyPassed = true e enquanto contractApproved = false.
 * O admin aprova o contrato na VisaOrderDetailPage, o que libera o step scholarship_selection.
 */
import React, { useEffect, useState, useMemo } from 'react';
import { Clock, CheckCircle, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface WaitRoomProps {
  surveyCompletedAt: string | null;
  checkProgress: () => Promise<void>;
}

interface TimeLeft {
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
}

function calcTimeLeft(surveyCompletedAt: string | null): TimeLeft {
  if (!surveyCompletedAt) return { hours: 24, minutes: 0, seconds: 0, expired: false };
  const deadline = new Date(surveyCompletedAt).getTime() + 24 * 60 * 60 * 1000;
  const diff = deadline - Date.now();
  if (diff <= 0) return { hours: 0, minutes: 0, seconds: 0, expired: true };
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  return { hours, minutes, seconds, expired: false };
}

export const WaitRoomStep: React.FC<WaitRoomProps> = ({ surveyCompletedAt, checkProgress }) => {
  const { t } = useTranslation();
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => calcTimeLeft(surveyCompletedAt));
  const [polling, setPolling] = useState(false);

  // Countdown tick
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(calcTimeLeft(surveyCompletedAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [surveyCompletedAt]);

  // Polling para detectar aprovação do admin (a cada 60s)
  useEffect(() => {
    const interval = setInterval(async () => {
      setPolling(true);
      await checkProgress();
      setPolling(false);
    }, 60_000);
    return () => clearInterval(interval);
  }, [checkProgress]);

  const pad = (n: number) => String(n).padStart(2, '0');

  const timerDisplay = useMemo(() => {
    if (timeLeft.expired) return null;
    return `${pad(timeLeft.hours)}:${pad(timeLeft.minutes)}:${pad(timeLeft.seconds)}`;
  }, [timeLeft]);

  return (
    <div className="space-y-8 pb-12 max-w-2xl mx-auto px-4">
      {/* Header */}
      <div className="space-y-1">
        <p className="text-xs font-black uppercase tracking-widest text-gold-medium">
          {t('student_onboarding.wait_room.section_label', 'Selection Process')}
        </p>
        <h2 className="text-2xl font-black text-white uppercase tracking-tight">
          {t('student_onboarding.wait_room.title', 'Waiting for Approval')}
        </h2>
        <p className="text-sm text-gray-400 font-medium">
          {t('student_onboarding.wait_room.subtitle', 'Your profile has been sent for review. You will receive an email confirmation soon.')}
        </p>
      </div>

      {/* Status card */}
      <div className="bg-gold-medium/5 border border-gold-medium/20 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Clock className="w-6 h-6 text-gold-medium flex-shrink-0 animate-pulse" />
          <div>
            <div className="font-bold text-white">{t('student_onboarding.wait_room.status_title', 'Profile review in progress...')}</div>
            <div className="text-sm text-gray-400 mt-0.5">
              {t('student_onboarding.wait_room.status_desc', 'Our team is reviewing your documents for contract approval.')}
            </div>
          </div>
        </div>

        {/* Checklist */}
        <div className="space-y-2 pt-2 border-t border-white/10">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span className="text-gray-300">{t('student_onboarding.wait_room.check_survey', 'Survey completed')}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span className="text-gray-300">{t('student_onboarding.wait_room.check_initial_docs', 'Initial documents validated')}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-gold-medium flex-shrink-0 animate-pulse" />
            <span className="text-gray-400">{t('student_onboarding.wait_room.check_contract', 'Contract approval and scholarship release — under review')}</span>
          </div>
        </div>
      </div>

      {/* Countdown */}
      {timerDisplay && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
          <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-2">
            {t('student_onboarding.wait_room.sla_label', 'Maximum response time (SLA)')}
          </p>
          <div className="text-5xl font-black text-white tabular-nums">{timerDisplay}</div>
          <p className="text-xs text-gray-600 mt-2">{t('student_onboarding.wait_room.time_units', 'hours : minutes : seconds')}</p>
        </div>
      )}


      {/* Última atualização */}
      <div className="text-xs text-gray-700 text-center flex items-center justify-center gap-1.5">
        <RefreshCw className={`w-3 h-3 ${polling ? 'animate-spin' : ''}`} />
        {t('student_onboarding.wait_room.auto_check', 'Automatically checking status every minute')}
      </div>
    </div>
  );
};
