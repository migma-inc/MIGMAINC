import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, MessageCircle, Send, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useStudentAuth } from '../../../contexts/StudentAuthContext';
import type { OnboardingStep } from '../types';

const ONBOARDING_AI_WEBHOOK_URL = (
  import.meta.env.VITE_N8N_WEBHOOK_ONBOARDING_SUPPORT_URL ||
  import.meta.env.VITE_ONBOARDING_AI_WEBHOOK_URL
) as string | undefined;
const SUPPORT_CHAT_URL = 'https://migmainc.com/student/dashboard/support';

type ChatRole = 'assistant' | 'user';

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  created_at: string;
  escalate?: boolean;
  reason?: string;
  risk?: string;
}

interface StepGuide {
  objective: string;
  answerScope: string[];
  escalateWhen: string[];
}

interface OnboardingSupportWidgetProps {
  currentStep: OnboardingStep;
  currentStepLabel: string;
  completedSteps: OnboardingStep[];
  maxAllowedStep?: OnboardingStep | null;
}

const STEP_GUIDES: Record<OnboardingStep, StepGuide> = {
  selection_fee: {
    objective: 'Explain that the Selection Fee payment can stay processing while it waits for approval, and that the next-step button unlocks after approval.',
    answerScope: ['selection process payment', 'checkout status', 'payment processing', 'approval notification', 'next step button unlock'],
    escalateWhen: ['payment charged but not reflected', 'refund request', 'checkout error with proof'],
  },
  selection_survey: {
    objective: 'Help the student complete the profile and preference survey accurately.',
    answerScope: ['survey questions', 'academic background', 'English level', 'interest areas', 'deadline fields'],
    escalateWhen: ['student cannot submit', 'legal/status risk in answers', 'survey data looks wrong after submission'],
  },
  wait_room: {
    objective: 'Explain review timing after the survey and what the student can prepare while waiting.',
    answerScope: ['survey review', 'team approval', 'waiting room status', 'preparation while waiting'],
    escalateWhen: ['review seems overdue', 'urgent start date or visa deadline', 'student reports inconsistent status'],
  },
  scholarship_selection: {
    objective: 'Guide scholarship and school selection without guaranteeing approval or awards.',
    answerScope: ['available options', 'selection criteria', 'how to compare options', 'what happens after selection'],
    escalateWhen: ['student asks for guaranteed acceptance', 'specific scholarship promise', 'school option missing or inconsistent'],
  },
  process_type: {
    objective: 'Clarify the process type choice and route sensitive visa/status questions to the team.',
    answerScope: ['initial student', 'transfer', 'change of status', 'resident flow basics'],
    escalateWhen: ['I-94/status violation risk', 'SEVIS release deadline', 'legal advice request'],
  },
  placement_fee: {
    objective: 'Explain the Placement Fee and when the next onboarding step unlocks.',
    answerScope: ['placement fee purpose', 'payment status', 'next step after payment'],
    escalateWhen: ['payment dispute', 'paid but not unlocked', 'refund or cancellation request'],
  },
  documents_upload: {
    objective: 'Help the student upload required documents and interpret document review states.',
    answerScope: ['document upload', 'pending review', 'rejected documents', 'file requirements'],
    escalateWhen: ['document rejected unclear reason', 'sensitive personal document issue', 'deadline risk'],
  },
  payment: {
    objective: 'Explain application or I-20 related payment steps shown in onboarding.',
    answerScope: ['application fee', 'I-20 fee', 'payment method', 'payment confirmation'],
    escalateWhen: ['payment failed after charge', 'wrong amount', 'manual payment validation needed'],
  },
  dados_complementares: {
    objective: 'Help complete complementary data for applications and final internal review.',
    answerScope: ['personal data fields', 'address fields', 'dependent data', 'review before submission'],
    escalateWhen: ['profile/dependent mismatch', 'student cannot edit wrong data', 'sensitive identity mismatch'],
  },
  scholarship_fee: {
    objective: 'Explain scholarship-related fee status and what happens after payment.',
    answerScope: ['scholarship fee', 'payment confirmation', 'next step after payment'],
    escalateWhen: ['payment dispute', 'paid but not reflected', 'scholarship terms conflict'],
  },
  reinstatement_fee: {
    objective: 'Explain reinstatement fee status while avoiding legal advice.',
    answerScope: ['reinstatement fee', 'payment confirmation', 'team review after payment'],
    escalateWhen: ['legal/status advice', 'I-94 or status violation', 'urgent USCIS deadline'],
  },
  my_applications: {
    objective: 'Explain application status shown in onboarding and what the student can do next.',
    answerScope: ['application status', 'forms status', 'package status', 'pending review'],
    escalateWhen: ['conflicting status', 'acceptance claim not shown', 'deadline or school communication risk'],
  },
  acceptance_letter: {
    objective: 'Explain acceptance letter status and next onboarding actions without promising final outcomes.',
    answerScope: ['acceptance letter received', 'pending acceptance', 'what happens after acceptance'],
    escalateWhen: ['acceptance missing but expected', 'letter data mismatch', 'urgent start date'],
  },
  completed: {
    objective: 'Help with final onboarding completion questions and route process follow-up to the team.',
    answerScope: ['completed status', 'next process stage', 'where to wait for updates'],
    escalateWhen: ['student needs human follow-up', 'missing final confirmation', 'conflicting completion status'],
  },
};

function createWelcomeMessage(stepLabel: string): ChatMessage {
  return {
    id: 'onboarding-welcome',
    role: 'assistant',
    content: `Posso ajudar com dúvidas desta etapa do onboarding: ${stepLabel}.`,
    created_at: new Date().toISOString(),
  };
}

function removeSupportUrl(content: string) {
  return content
    .replace(new RegExp(SUPPORT_CHAT_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '')
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export const OnboardingSupportWidget: React.FC<OnboardingSupportWidgetProps> = ({
  currentStep,
  currentStepLabel,
  completedSteps,
  maxAllowedStep,
}) => {
  const { t, i18n } = useTranslation();
  const { user, userProfile } = useStudentAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [createWelcomeMessage(currentStepLabel)]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const onboardingContext = useMemo(() => ({
    scope: 'onboarding_only',
    language: i18n.language,
    currentStep,
    currentStepLabel,
    completedSteps,
    maxAllowedStep: maxAllowedStep ?? null,
    currentStepGuide: STEP_GUIDES[currentStep],
    allStepGuides: STEP_GUIDES,
    guardrails: [
      'Answer only questions related to the onboarding journey and the current student step.',
      'Do not answer dashboard support, payment dispute, legal, visa-risk, or post-onboarding operational requests directly.',
      'When the question requires human review, ask one objective question at most and return escalate=true.',
      'Never promise acceptance, scholarship approval, I-20 issuance, legal outcomes, or exact deadlines unless present in context.',
    ],
  }), [completedSteps, currentStep, currentStepLabel, i18n.language, maxAllowedStep]);

  useEffect(() => {
    if (!open) return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open, sending]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setSending(true);

    if (!ONBOARDING_AI_WEBHOOK_URL) {
      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: String(t(
          'student_onboarding.support.not_configured',
          'The onboarding assistant is not configured yet. Please continue through the current step or contact the team if you are blocked.',
        )),
        created_at: new Date().toISOString(),
      }]);
      setSending(false);
      return;
    }

    try {
      const response = await fetch(ONBOARDING_AI_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'student_onboarding_ai_message',
          payloadVersion: 1,
          message: text,
          currentMessage: userMessage,
          student: {
            profileId: userProfile?.id ?? user?.id ?? null,
            name: userProfile?.full_name ?? null,
            email: user?.email ?? null,
          },
          onboarding: onboardingContext,
          history: messages.slice(-12).map((message) => ({
            role: message.role,
            content: message.content,
            created_at: message.created_at,
          })),
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const json = await response.json().catch(() => ({}));
      const reply = String(json.response ?? json.message ?? json.output ?? '').trim();
      const escalate = json.escalate === true;

      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: reply || String(t(
          'student_onboarding.support.empty_response',
          'I could not generate an answer for this onboarding step right now.',
        )),
        created_at: new Date().toISOString(),
        escalate,
        reason: typeof json.reason === 'string' ? json.reason : undefined,
        risk: typeof json.risk === 'string' ? json.risk : undefined,
      }]);
    } catch (error) {
      console.error('[OnboardingSupport] assistant request failed', error);
      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: String(t(
          'student_onboarding.support.error',
          'The onboarding assistant had a technical issue. Please try again in a few seconds.',
        )),
        created_at: new Date().toISOString(),
      }]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [input, messages, onboardingContext, sending, t, user, userProfile]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6">
      {open ? (
        <div className="flex h-[min(680px,calc(100vh-104px))] w-[calc(100vw-32px)] max-w-[420px] flex-col overflow-hidden rounded-lg border border-[#e3d5bd] bg-[#f7f4ee] text-[#1f1a14] shadow-2xl shadow-black/25 dark:border-white/10 dark:bg-[#0a0a0a] dark:text-white">
          <header className="flex items-center gap-3 border-b border-[#e3d5bd] bg-white/80 px-4 py-3 backdrop-blur dark:border-white/5 dark:bg-[#0a0a0a]/90">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#CE9F48]/30 bg-[#CE9F48]/15">
              <MessageCircle className="h-5 w-5 text-[#9a6a16] dark:text-[#CE9F48]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black">{t('student_onboarding.support.title', 'Onboarding AI')}</p>
              <p className="truncate text-xs text-[#8a7b66] dark:text-white/40">{currentStepLabel}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[#6f6251] transition-colors hover:bg-[#f3ead9] dark:text-white/50 dark:hover:bg-white/5"
              aria-label={String(t('common.close', 'Close'))}
              title={String(t('common.close', 'Close'))}
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <main className="flex-1 overflow-y-auto px-4 py-4">
            <div className="space-y-3">
              {messages.map((message) => {
                const isUser = message.role === 'user';
                const shouldShowSupportCta = !isUser && (
                  message.escalate === true ||
                  message.content.includes(SUPPORT_CHAT_URL)
                );
                const displayContent = shouldShowSupportCta
                  ? removeSupportUrl(message.content)
                  : message.content;

                return (
                  <div key={message.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[82%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                      isUser
                        ? 'bg-[#CE9F48] text-black'
                        : 'border border-[#e3d5bd] bg-white text-[#1f1a14] dark:border-white/10 dark:bg-white/5 dark:text-white'
                    }`}>
                      {displayContent}
                      {shouldShowSupportCta && (
                        <div className="mt-3 rounded-lg border border-blue-500/20 bg-blue-50 px-3 py-2 text-xs text-blue-800 dark:bg-blue-500/10 dark:text-blue-200">
                          <p className="font-semibold">
                            {t('student_onboarding.support.escalation_title', 'Talk directly with the Migma team')}
                          </p>
                          <p className="mt-1 text-blue-700/70 dark:text-blue-200/70">
                            {t('student_onboarding.support.escalation_body', 'Use the support chat in your student dashboard for direct team assistance.')}
                          </p>
                          <a
                            href={SUPPORT_CHAT_URL}
                            className="mt-2 inline-flex items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-700"
                          >
                            {t('student_onboarding.support.escalation_cta', 'Open support chat')}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {sending && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-lg border border-[#e3d5bd] bg-white px-3 py-2 text-xs text-[#8a7b66] dark:border-white/10 dark:bg-white/5 dark:text-white/50">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {t('student_onboarding.support.typing', 'Checking this step')}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </main>

          <footer className="border-t border-[#e3d5bd] bg-white/95 px-4 py-3 backdrop-blur dark:border-white/5 dark:bg-[#0a0a0a]/95">
            <div className="flex items-end gap-2 rounded-lg border border-[#e3d5bd] bg-[#f3ead9] px-3 py-2 focus-within:border-[#CE9F48]/50 dark:border-white/10 dark:bg-white/5">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={String(t('student_onboarding.support.placeholder', 'Ask about this step...'))}
                rows={1}
                className="max-h-28 flex-1 resize-none bg-transparent text-sm leading-relaxed text-[#1f1a14] outline-none placeholder:text-[#8a7b66] dark:text-white dark:placeholder:text-white/30"
                disabled={sending}
                onInput={(event) => {
                  const target = event.currentTarget;
                  target.style.height = 'auto';
                  target.style.height = `${Math.min(target.scrollHeight, 112)}px`;
                }}
              />
              <button
                type="button"
                onClick={() => void sendMessage()}
                disabled={sending || !input.trim()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#CE9F48] transition-colors hover:bg-[#b8892f] disabled:cursor-not-allowed disabled:opacity-40"
                aria-label={String(t('student_onboarding.support.send', 'Send'))}
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin text-black" /> : <Send className="h-4 w-4 text-black" />}
              </button>
            </div>
          </footer>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-h-14 items-center gap-3 rounded-full border border-[#CE9F48]/40 bg-[#1f1a14] px-4 py-3 text-white shadow-2xl shadow-black/25 transition-transform hover:scale-[1.02] hover:bg-[#2a231a] focus:outline-none focus:ring-4 focus:ring-[#CE9F48]/25 dark:border-[#CE9F48]/50"
          aria-label={String(t('student_onboarding.support.open', 'Open onboarding support'))}
          title={String(t('student_onboarding.support.open', 'Open onboarding support'))}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#CE9F48]">
            <MessageCircle className="h-5 w-5 text-black" />
          </span>
          <span className="hidden text-left sm:block">
            <span className="block text-sm font-black leading-tight">
              {t('student_onboarding.support.cta', 'Need help?')}
            </span>
            <span className="block max-w-[180px] truncate text-xs text-white/60">
              {currentStepLabel}
            </span>
          </span>
        </button>
      )}
    </div>
  );
};
