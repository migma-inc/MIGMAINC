import React, { useEffect, useRef, useState } from 'react';
import { Trophy, Mail, Clock, CheckCircle } from 'lucide-react';
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
  contractApproved?: boolean; // Se true, o botão libera na mesma hora
}

const TARGET = 1481;
const DURATION_MS = 2800;

export const SurveyCompletionScreen: React.FC<Props> = ({ email, name, service, whatsapp, academicFormation, englishLevel, surveyCompletedAt, onContinue, standalone = true, contractApproved = false }) => {
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

  const isUnlocked = !timeLeft || contractApproved;
  const serviceLabel = service === 'transfer' ? 'Transfer' : service === 'cos' ? 'COS' : service.toUpperCase();

  return (
    <div className={standalone ? 'min-h-screen bg-black' : ''}>
      {standalone && <CheckoutTopbar serviceLabel={serviceLabel} />}

      <main className="max-w-xl mx-auto px-4 pb-20 text-center" style={{ paddingTop: standalone ? '140px' : '24px' }}>
        {/* Ícone de troféu */}
        <div className="w-20 h-20 bg-gold-medium/10 border-2 border-gold-medium/30 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_40px_rgba(212,175,55,0.1)]">
          <Trophy className="w-9 h-9 text-gold-medium" />
        </div>

        <h1 className="text-white text-3xl font-black mb-2 tracking-tight uppercase">
          {t('student_onboarding.survey_completion.title')}
        </h1>
        <p className="text-gray-400 text-sm mb-8 font-medium">
          {t('student_onboarding.survey_completion.subtitle')}
        </p>

        {/* Contador animado */}
        <div className="mb-2">
          <span className="text-gold-medium text-6xl font-black tabular-nums tracking-tighter shadow-gold-medium/20 text-shadow-sm">
            {count.toLocaleString(i18n.language)}
          </span>
        </div>
        <p className="text-white font-black text-lg mb-1 uppercase tracking-widest">
          {t('student_onboarding.survey_completion.institutions')}
        </p>
        <a
          href="https://studyinthestates.dhs.gov"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gold-medium/60 text-[10px] font-black uppercase tracking-widest hover:text-gold-medium transition-colors"
        >
          Study in the States — DHS
        </a>

        {/* Resumo da candidatura */}
        <div className="mt-8 bg-white/[0.02] border border-white/5 rounded-[2rem] p-6 text-left space-y-3 text-sm">
          <p className="text-gray-600 text-[10px] font-black uppercase tracking-[0.2em] mb-4">
            {t('student_onboarding.survey_completion.summary_title')}
          </p>
          
          <div className="flex flex-col gap-3">
            {[
              { label: t('student_onboarding.survey_completion.name'), value: name },
              { label: t('student_onboarding.survey_completion.email'), value: email },
              { label: t('student_onboarding.survey_completion.whatsapp'), value: whatsapp },
              { label: t('student_onboarding.survey_completion.profile_service'), value: serviceLabel },
              { label: t('student_onboarding.survey_completion.formation'), value: academicFormation },
              { label: t('student_onboarding.survey_completion.english_level'), value: englishLevel },
            ].map((item, idx) => item.value && (
              <div key={idx} className="flex justify-between items-center py-2 border-b border-white/[0.03] last:border-0">
                <span className="text-gray-500 font-bold text-xs uppercase tracking-wider">{item.label}</span>
                <span className="text-white font-black text-right truncate ml-4">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Card de status / Aprovação */}
        <div className={`mt-6 rounded-[2rem] p-6 border transition-all duration-500 ${
          contractApproved 
            ? 'bg-emerald-500/5 border-emerald-500/20 shadow-[0_0_50px_rgba(16,185,129,0.05)]' 
            : 'bg-gold-medium/5 border-gold-medium/20'
        }`}>
          <div className="flex items-center gap-4 text-left">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
              contractApproved ? 'bg-emerald-500/20' : 'bg-gold-medium/20'
            }`}>
              {contractApproved ? (
                <CheckCircle className="w-6 h-6 text-emerald-400" />
              ) : (
                <Clock className="w-6 h-6 text-gold-medium animate-pulse" />
              )}
            </div>
            <div>
              <p className={`font-black uppercase tracking-widest text-xs mb-1 ${
                contractApproved ? 'text-emerald-400' : 'text-gold-light'
              }`}>
                {contractApproved ? 'Contrato Aprovado' : 'Perfil em Análise'}
              </p>
              <p className="text-gray-400 text-sm leading-relaxed">
                {contractApproved 
                  ? 'Sua aprovação foi confirmada! Você já pode prosseguir para a escolha das faculdades.'
                  : 'Nossa equipe está revisando seus documentos. Em breve seu acesso às bolsas será liberado.'}
              </p>
            </div>
          </div>
        </div>

        {/* Email de confirmação */}
        <div className="mt-8 flex items-center justify-center gap-3 text-gray-600 text-[10px] font-black uppercase tracking-widest">
          <Mail className="w-4 h-4 text-gold-medium/40" />
          <span>{t('student_onboarding.survey_completion.email_sent')} <span className="text-white">{email}</span></span>
        </div>

        {/* Botão Escolher Faculdades */}
        <div className="mt-10">
          {isUnlocked ? (
            <button
              onClick={onContinue}
              className="w-full py-5 bg-gold-medium hover:bg-gold-light text-black font-black uppercase tracking-[0.2em] rounded-[1.5rem] text-sm transition-all shadow-[0_20px_40px_rgba(212,175,55,0.2)] active:scale-[0.98]"
            >
              {t('student_onboarding.survey_completion.btn_choose_colleges')}
            </button>
          ) : (
            <div className="w-full py-5 bg-white/[0.02] border border-white/5 rounded-[1.5rem] text-center space-y-2 cursor-not-allowed group">
              <p className="text-gray-500 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-3">
                <Clock className="w-4 h-4 text-gray-700" />
                {t('student_onboarding.survey_completion.btn_choose_colleges').replace(' →', '')}
              </p>
              <p className="text-gold-medium/40 text-sm font-black tabular-nums">
                Disponível em {timeLeft}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>

  );
};
