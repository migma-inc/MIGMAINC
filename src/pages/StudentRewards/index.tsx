import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Gift,
  Loader2,
  Mail,
  MessageCircle,
  Trophy,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useStudentAuth } from '@/contexts/StudentAuthContext';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface ReferralLink {
  id: string;
  unique_code: string;
  utm_source: string | null;
  clicks: number;
  closures_count: number;
  goal_reached_at: string | null;
  created_at: string;
}

interface ReferralLeadEntry {
  id: string;
  created_at: string;
  full_name: string;
  email: string;
  phone: string;
  status: string;
  meet_url: string | null;
  country: string | null;
}

const PRODUCTION_BASE_URL = 'https://migmainc.com';
const GOAL = 10;
const REDUCED_TUITION = '$3,800';

function getReferralBaseUrl() {
  if (typeof window === 'undefined') return PRODUCTION_BASE_URL;
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  return isLocalhost ? window.location.origin : PRODUCTION_BASE_URL;
}

function generateCode(name: string): string {
  const prefix = (name || 'MIG').replace(/\s+/g, '').slice(0, 3).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}${rand}`;
}

function formatDate(value: string | null | undefined, t: (key: string) => string, locale: string) {
  if (!value) return t('student_dashboard.rewards.not_yet');
  return new Date(value).toLocaleDateString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

interface StudentRewardsPanelProps {
  embedded?: boolean;
  onBack?: () => void;
}

export const StudentRewardsPanel: React.FC<StudentRewardsPanelProps> = ({ embedded = false, onBack }) => {
  const { user, userProfile } = useStudentAuth();
  const { t, i18n } = useTranslation();
  const [referral, setReferral] = useState<ReferralLink | null>(null);
  const [leads, setLeads] = useState<ReferralLeadEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const prevGoalRef = useRef(false);

  const fetchOrCreateReferral = useCallback(async () => {
    if (!userProfile?.id) return;
    setLoading(true);
    setError(null);

    try {
      const { data: existing, error: existingError } = await supabase
        .from('referral_links')
        .select('id, unique_code, utm_source, clicks, closures_count, goal_reached_at, created_at')
        .eq('profile_id', userProfile.id)
        .maybeSingle();

      if (existingError) throw existingError;

      let currentReferral = existing as ReferralLink | null;

      if (!currentReferral) {
        const unique_code = generateCode(userProfile.full_name ?? userProfile.email ?? 'MIG');
        const { data: created, error: createError } = await supabase
          .from('referral_links')
          .insert({
            profile_id: userProfile.id,
            unique_code,
            utm_source: 'migma_referral',
            clicks: 0,
            closures_count: 0,
          })
          .select('id, unique_code, utm_source, clicks, closures_count, goal_reached_at, created_at')
          .single();

        if (createError) throw createError;
        currentReferral = created as ReferralLink;
      }

      setReferral(currentReferral);

      const { data: leadData } = await supabase
        .from('referral_leads')
        .select('id, created_at, full_name, email, phone, status, meet_url, country')
        .eq('referral_link_id', currentReferral.id)
        .order('created_at', { ascending: false })
        .limit(20);

      setLeads((leadData ?? []) as ReferralLeadEntry[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('student_dashboard.rewards.error_load'));
    } finally {
      setLoading(false);
    }
  }, [t, userProfile?.email, userProfile?.full_name, userProfile?.id]);

  useEffect(() => {
    if (!user) return;
    void fetchOrCreateReferral();
  }, [user, fetchOrCreateReferral]);

  useEffect(() => {
    if (!userProfile?.id || !referral?.id) return;

    const channel = supabase
      .channel(`student-rewards-${userProfile.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'referral_links',
        filter: `profile_id=eq.${userProfile.id}`,
      }, () => { void fetchOrCreateReferral(); })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'referral_leads',
        filter: `referral_link_id=eq.${referral.id}`,
      }, () => { void fetchOrCreateReferral(); })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [fetchOrCreateReferral, userProfile?.id, referral?.id]);

  const referralUrl = useMemo(() => {
    if (!referral) return '';
    const url = new URL('/indicacao', getReferralBaseUrl());
    url.searchParams.set('ref', referral.unique_code);
    url.searchParams.set('utm_source', 'migma_referral');
    url.searchParams.set('utm_medium', 'student_rewards');
    url.searchParams.set('utm_campaign', 'referral_program');
    url.searchParams.set('utm_content', referral.unique_code);
    return url.toString();
  }, [referral]);

  const shareText = referralUrl
    ? t('student_dashboard.rewards.share_text', { url: referralUrl })
    : '';
  const whatsappUrl = referralUrl
    ? `https://wa.me/?text=${encodeURIComponent(shareText)}`
    : '';
  const emailUrl = referralUrl
    ? `mailto:?subject=${encodeURIComponent(t('student_dashboard.rewards.title'))}&body=${encodeURIComponent(shareText)}`
    : '';

  const handleCopy = async () => {
    if (!referralUrl) return;
    await navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const closures = referral?.closures_count ?? 0;
  const clicks = referral?.clicks ?? 0;
  const remaining = Math.max(GOAL - closures, 0);
  const progress = Math.min((closures / GOAL) * 100, 100);
  const goalReached = closures >= GOAL;

  useEffect(() => {
    if (goalReached && !prevGoalRef.current) {
      setShowCelebration(true);
    }
    prevGoalRef.current = goalReached;
  }, [goalReached]);

  if (loading) {
    return (
      <div className={cn(embedded ? 'min-h-[520px]' : 'min-h-screen', 'flex items-center justify-center bg-[#f7f4ee] dark:bg-[#0a0a0a]')}>
        <Loader2 className="h-8 w-8 animate-spin text-[#9a6a16] dark:text-[#CE9F48]" />
      </div>
    );
  }

  return (
    <div className={cn(embedded ? '' : 'min-h-screen', 'bg-[#f7f4ee] dark:bg-[#0a0a0a] px-4 py-8 text-[#1f1a14] dark:text-white')}>
      <div className="mx-auto max-w-6xl space-y-6">
        {!embedded && onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm text-[#6f6251] dark:text-gray-400 transition-colors hover:text-[#1f1a14] dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('student_dashboard.rewards.btn_back')}
          </button>
        )}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg border border-[#CE9F48]/20 bg-[#CE9F48]/10">
              <Gift className="h-5 w-5 text-[#9a6a16] dark:text-[#CE9F48]" />
            </div>
            <h1 className="text-2xl font-black tracking-tight">{t('student_dashboard.rewards.title')}</h1>
            <p className="mt-1 text-sm text-[#8a7b66] dark:text-gray-500">
              {t('student_dashboard.rewards.subtitle')}
            </p>
          </div>
          <Badge className={goalReached ? 'border-emerald-600/30 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300' : 'border-amber-600/30 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300'}>
            {goalReached ? t('student_dashboard.rewards.badge_goal_reached') : t('student_dashboard.rewards.badge_remaining', { remaining })}
          </Badge>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Celebration banner */}
        {showCelebration && (
          <div className="relative overflow-hidden rounded-xl border-2 border-amber-400/60 bg-gradient-to-r from-amber-500/20 via-yellow-400/10 to-amber-500/20 px-6 py-5">
            <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-amber-400/60 bg-amber-500/20 text-3xl">
                  🏆
                </div>
                <div>
                  <p className="text-lg font-black text-amber-300">{t('student_dashboard.rewards.celebration_title')}</p>
                  <p className="text-sm text-amber-200/80">{t('student_dashboard.rewards.celebration_desc', { tuition: REDUCED_TUITION })}</p>
                </div>
              </div>
              <button
                onClick={() => setShowCelebration(false)}
                className="self-end text-xs text-amber-400/60 hover:text-amber-300 sm:self-auto"
              >
                {t('student_dashboard.rewards.celebration_dismiss')}
              </button>
            </div>
            {/* decorative shimmer */}
            <div className="pointer-events-none absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-amber-400/5 to-transparent" />
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-3">
          <MetricCard icon={Trophy} label={t('student_dashboard.rewards.kpi_closures')} value={`${closures}/${GOAL}`} tone={goalReached ? 'green' : 'gold'} />
          <MetricCard icon={Users} label={t('student_dashboard.rewards.kpi_clicks')} value={String(clicks)} tone="blue" />
          <MetricCard icon={Calendar} label={t('student_dashboard.rewards.kpi_meetings')} value={String(leads.length)} tone="purple" />
        </section>

        <Card className="border-[#e3d5bd] dark:border-white/10 bg-white dark:bg-[#111] text-[#1f1a14] dark:text-white">
          <CardContent className="p-6">
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div>
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-widest text-[#4b4032] dark:text-gray-300">{t('student_dashboard.rewards.progress_title')}</h2>
                    <p className="mt-1 text-xs text-[#8a7b66] dark:text-gray-500">{t('student_dashboard.rewards.progress_desc', { tuition: REDUCED_TUITION })}</p>
                  </div>
                  <span className="text-3xl font-black text-[#9a6a16] dark:text-[#CE9F48]">{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-3 bg-[#eadbbf] dark:bg-white/10" />
                {goalReached && referral?.goal_reached_at ? (
                  <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>
                      {t('student_dashboard.rewards.progress_reached_date', { date: formatDate(referral.goal_reached_at, t, i18n.language) })}{' '}
                      <strong>{REDUCED_TUITION}</strong>.
                    </span>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-[#6f6251] dark:text-gray-400">
                    {goalReached
                      ? t('student_dashboard.rewards.progress_reached', { tuition: REDUCED_TUITION })
                      : t('student_dashboard.rewards.progress_missing', { remaining })}
                  </p>
                )}
              </div>

              <div className="rounded-lg border border-[#e3d5bd] dark:border-white/10 bg-white/70 dark:bg-white/[0.03] p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#8a7b66] dark:text-gray-500">{t('student_dashboard.rewards.code_title')}</p>
                <p className="mt-1 font-mono text-lg font-black text-[#1f1a14] dark:text-white">{referral?.unique_code ?? '—'}</p>
                <p className="mt-3 text-xs leading-relaxed text-[#8a7b66] dark:text-gray-500">
                  {t('student_dashboard.rewards.code_desc')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#e3d5bd] dark:border-white/10 bg-white dark:bg-[#111] text-[#1f1a14] dark:text-white">
          <CardContent className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-[#9a6a16] dark:text-[#CE9F48]" />
              <h2 className="text-sm font-black uppercase tracking-widest text-[#4b4032] dark:text-gray-300">{t('student_dashboard.rewards.link_title')}</h2>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row">
              <div className="min-w-0 flex-1 rounded-lg border border-[#e3d5bd] dark:border-white/10 bg-white/[0.04] px-4 py-3 font-mono text-sm text-[#4b4032] dark:text-gray-300">
                <span className="block truncate">{referralUrl}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleCopy} className="bg-[#CE9F48] text-black hover:bg-[#b8892f]">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? t('student_dashboard.rewards.btn_copied') : t('student_dashboard.rewards.btn_copy')}
                </Button>
                <Button variant="outline" asChild className="border-[#e3d5bd] dark:border-white/10 bg-[#f3ead9] dark:bg-white/5 text-[#1f1a14] dark:text-white hover:bg-[#eadbbf] dark:hover:bg-white/10">
                  <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="h-4 w-4" />
                    {t('student_dashboard.rewards.btn_whatsapp')}
                  </a>
                </Button>
                <Button variant="outline" asChild className="border-[#e3d5bd] dark:border-white/10 bg-[#f3ead9] dark:bg-white/5 text-[#1f1a14] dark:text-white hover:bg-[#eadbbf] dark:hover:bg-white/10">
                  <a href={emailUrl}>
                    <Mail className="h-4 w-4" />
                    {t('student_dashboard.rewards.btn_email')}
                  </a>
                </Button>
                <Button variant="outline" asChild className="border-[#e3d5bd] dark:border-white/10 bg-[#f3ead9] dark:bg-white/5 text-[#1f1a14] dark:text-white hover:bg-[#eadbbf] dark:hover:bg-white/10">
                  <a href={referralUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    {t('student_dashboard.rewards.btn_open')}
                  </a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <Card className="border-[#e3d5bd] dark:border-white/10 bg-white dark:bg-[#111] text-[#1f1a14] dark:text-white">
            <CardContent className="p-6">
              <h2 className="mb-4 text-sm font-black uppercase tracking-widest text-[#4b4032] dark:text-gray-300">{t('student_dashboard.rewards.how_title')}</h2>
              <div className="space-y-4">
                {[
                  t('student_dashboard.rewards.how_step1'),
                  t('student_dashboard.rewards.how_step2'),
                  t('student_dashboard.rewards.how_step3'),
                  t('student_dashboard.rewards.how_step4', { goal: GOAL, tuition: REDUCED_TUITION }),
                ].map((step, index) => (
                  <div key={step} className="flex gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#CE9F48]/20 bg-[#CE9F48]/10 text-xs font-black text-[#9a6a16] dark:text-[#CE9F48]">
                      {index + 1}
                    </span>
                    <p className="text-sm leading-relaxed text-[#6f6251] dark:text-gray-400">{step}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#e3d5bd] dark:border-white/10 bg-white dark:bg-[#111] text-[#1f1a14] dark:text-white">
            <CardContent className="p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-sm font-black uppercase tracking-widest text-[#4b4032] dark:text-gray-300">{t('student_dashboard.rewards.meetings_title')}</h2>
                <Badge className="border-[#e3d5bd] dark:border-white/10 bg-[#f3ead9] dark:bg-white/5 text-[#4b4032] dark:text-gray-300">{leads.length}</Badge>
              </div>

              {leads.length === 0 ? (
                <div className="flex min-h-[180px] flex-col items-center justify-center rounded-lg border border-dashed border-[#e3d5bd] dark:border-white/10 bg-white/[0.02] text-center">
                  <Calendar className="mb-3 h-8 w-8 text-[#6f6251] dark:text-gray-600" />
                  <p className="text-sm font-bold text-[#4b4032] dark:text-gray-300">{t('student_dashboard.rewards.meetings_empty_title')}</p>
                  <p className="mt-1 max-w-sm text-xs text-[#8a7b66] dark:text-gray-500">{t('student_dashboard.rewards.meetings_empty_desc')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {leads.map(lead => {
                    const isClosed = lead.status === 'fechado';
                    return (
                      <div key={lead.id} className="rounded-lg border border-[#e3d5bd] dark:border-white/10 bg-white/70 dark:bg-white/[0.03] px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-[#1f1a14] dark:text-white">{lead.full_name}</p>
                            <p className="mt-1 truncate text-xs text-[#8a7b66] dark:text-gray-500">{lead.email}</p>
                          </div>
                          {isClosed ? (
                            <Badge className="border-emerald-600/30 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 shrink-0">
                              ✓ {t('student_dashboard.rewards.badge_closed')}
                            </Badge>
                          ) : (
                            <Badge className="border-blue-600/30 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300 shrink-0">
                              {t('student_dashboard.rewards.badge_scheduled')}
                            </Badge>
                          )}
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-xs text-[#8a7b66] dark:text-gray-500">
                            <CheckCircle2 className={`h-3.5 w-3.5 ${isClosed ? 'text-emerald-400' : 'text-blue-400'}`} />
                            {formatDate(lead.created_at, t, i18n.language)}
                            {lead.country && <span className="text-[#8a7b66] dark:text-gray-600">· {lead.country}</span>}
                          </div>
                          {lead.meet_url && (
                            <a
                              href={lead.meet_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-400"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Meet
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

function MetricCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tone: 'gold' | 'green' | 'blue' | 'purple';
}) {
  const tones = {
    gold: 'border-amber-600/30 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
    green: 'border-emerald-600/30 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
    blue: 'border-blue-600/30 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300',
    purple: 'border-violet-600/30 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300',
  };

  return (
    <Card className="border-[#e3d5bd] dark:border-white/10 bg-white dark:bg-[#111] text-[#1f1a14] dark:text-white">
      <CardContent className="flex items-center justify-between gap-4 p-5">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#8a7b66] dark:text-gray-500">{label}</p>
          <p className="mt-2 text-2xl font-black">{value}</p>
        </div>
        <div className={cn('flex h-11 w-11 items-center justify-center rounded-lg border', tones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

const StudentRewards: React.FC = () => {
  const { user, loading } = useStudentAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate('/student/login');
  }, [loading, user, navigate]);

  return <StudentRewardsPanel onBack={() => navigate('/student/dashboard')} />;
};

export default StudentRewards;
