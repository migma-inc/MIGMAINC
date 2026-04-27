import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

interface CalendlyEvent {
  id: string;
  unique_code: string | null;
  invitee_name: string | null;
  invitee_email: string | null;
  event_type: string | null;
  scheduled_at: string | null;
  created_at: string;
}

const PRODUCTION_BASE_URL = 'https://migmainc.com';
const GOAL = 10;
const REDUCED_TUITION = '$3,800/ano';

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

function formatDate(value: string | null | undefined) {
  if (!value) return 'Ainda não';
  return new Date(value).toLocaleDateString('pt-BR', {
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
  const [referral, setReferral] = useState<ReferralLink | null>(null);
  const [events, setEvents] = useState<CalendlyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      const { data: calendlyEvents } = await supabase
        .from('calendly_events')
        .select('id, unique_code, invitee_name, invitee_email, event_type, scheduled_at, created_at')
        .eq('owner_profile_id', userProfile.id)
        .order('created_at', { ascending: false })
        .limit(8);

      setEvents((calendlyEvents ?? []) as CalendlyEvent[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar programa de indicação.');
    } finally {
      setLoading(false);
    }
  }, [userProfile?.email, userProfile?.full_name, userProfile?.id]);

  useEffect(() => {
    if (!user) return;
    void fetchOrCreateReferral();
  }, [user, fetchOrCreateReferral]);

  const referralUrl = useMemo(() => {
    if (!referral) return '';
    const url = new URL('/book-a-call', getReferralBaseUrl());
    url.searchParams.set('ref', referral.unique_code);
    url.searchParams.set('utm_source', 'migma_referral');
    return url.toString();
  }, [referral]);

  const shareText = referralUrl
    ? `Quero te indicar a Migma para estudar nos EUA. Agende uma conversa aqui: ${referralUrl}`
    : '';
  const whatsappUrl = referralUrl
    ? `https://wa.me/?text=${encodeURIComponent(shareText)}`
    : '';
  const emailUrl = referralUrl
    ? `mailto:?subject=${encodeURIComponent('Indicação Migma')}&body=${encodeURIComponent(shareText)}`
    : '';

  const handleCopy = async () => {
    if (!referralUrl) return;
    await navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const closures = referral?.closures_count ?? 0;
  const clicks = referral?.clicks ?? 0;
  const scheduled = events.length;
  const remaining = Math.max(GOAL - closures, 0);
  const progress = Math.min((closures / GOAL) * 100, 100);
  const goalReached = closures >= GOAL;

  if (loading) {
    return (
      <div className={cn(embedded ? 'min-h-[520px]' : 'min-h-screen', 'flex items-center justify-center bg-[#0a0a0a]')}>
        <Loader2 className="h-8 w-8 animate-spin text-[#CE9F48]" />
      </div>
    );
  }

  return (
    <div className={cn(embedded ? '' : 'min-h-screen', 'bg-[#0a0a0a] px-4 py-8 text-white')}>
      <div className="mx-auto max-w-6xl space-y-6">
        {!embedded && onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>
        )}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg border border-[#CE9F48]/20 bg-[#CE9F48]/10">
              <Gift className="h-5 w-5 text-[#CE9F48]" />
            </div>
            <h1 className="text-2xl font-black tracking-tight">Programa de Indicação</h1>
            <p className="mt-1 text-sm text-gray-500">
              Compartilhe seu link, acompanhe agendamentos e veja suas indicações fechadas.
            </p>
          </div>
          <Badge className={goalReached ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-[#CE9F48]/30 bg-[#CE9F48]/10 text-[#CE9F48]'}>
            {goalReached ? 'Meta atingida' : `${remaining} fechamento(s) restantes`}
          </Badge>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-3">
          <MetricCard icon={Trophy} label="Fechamentos" value={`${closures}/${GOAL}`} tone={goalReached ? 'green' : 'gold'} />
          <MetricCard icon={Users} label="Cliques no link" value={String(clicks)} tone="blue" />
          <MetricCard icon={Calendar} label="Reuniões agendadas" value={String(scheduled)} tone="purple" />
        </section>

        <Card className="border-white/10 bg-[#111] text-white">
          <CardContent className="p-6">
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div>
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-widest text-gray-300">Progresso da Meta</h2>
                    <p className="mt-1 text-xs text-gray-500">10 indicações fechadas reduzem sua tuition para {REDUCED_TUITION}.</p>
                  </div>
                  <span className="text-3xl font-black text-[#CE9F48]">{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-3 bg-white/10" />
                {goalReached && referral?.goal_reached_at ? (
                  <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>
                      Meta atingida em {formatDate(referral.goal_reached_at)}. Tuition reduzida para{' '}
                      <strong>{REDUCED_TUITION}</strong>.
                    </span>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-gray-400">
                    {goalReached
                      ? `Meta atingida. Sua tuition fica elegível para ${REDUCED_TUITION}.`
                      : `Faltam ${remaining} indicação(ões) fechadas para atingir o benefício.`}
                  </p>
                )}
              </div>

              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Código único</p>
                <p className="mt-1 font-mono text-lg font-black text-white">{referral?.unique_code ?? '—'}</p>
                <p className="mt-3 text-xs leading-relaxed text-gray-500">
                  O link leva para a página de agendamento e mantém o código do indicador no lead.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[#111] text-white">
          <CardContent className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-[#CE9F48]" />
              <h2 className="text-sm font-black uppercase tracking-widest text-gray-300">Seu link de indicação</h2>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row">
              <div className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 font-mono text-sm text-gray-300">
                <span className="block truncate">{referralUrl}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleCopy} className="bg-[#CE9F48] text-black hover:bg-[#b8892f]">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copiado' : 'Copiar'}
                </Button>
                <Button variant="outline" asChild className="border-white/10 bg-white/5 text-white hover:bg-white/10">
                  <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp
                  </a>
                </Button>
                <Button variant="outline" asChild className="border-white/10 bg-white/5 text-white hover:bg-white/10">
                  <a href={emailUrl}>
                    <Mail className="h-4 w-4" />
                    Email
                  </a>
                </Button>
                <Button variant="outline" asChild className="border-white/10 bg-white/5 text-white hover:bg-white/10">
                  <a href={referralUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Abrir
                  </a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <Card className="border-white/10 bg-[#111] text-white">
            <CardContent className="p-6">
              <h2 className="mb-4 text-sm font-black uppercase tracking-widest text-gray-300">Como funciona</h2>
              <div className="space-y-4">
                {[
                  'Compartilhe seu link com amigos que querem estudar nos EUA.',
                  'O lead agenda uma reunião e o sistema preserva seu código de indicação.',
                  'Quando o CRM marca o lead como fechado, seu contador sobe em tempo real.',
                  `Com ${GOAL} fechamentos, sua tuition fica elegível para ${REDUCED_TUITION}.`,
                ].map((step, index) => (
                  <div key={step} className="flex gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#CE9F48]/20 bg-[#CE9F48]/10 text-xs font-black text-[#CE9F48]">
                      {index + 1}
                    </span>
                    <p className="text-sm leading-relaxed text-gray-400">{step}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-[#111] text-white">
            <CardContent className="p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-sm font-black uppercase tracking-widest text-gray-300">Agendamentos recentes</h2>
                <Badge className="border-white/10 bg-white/5 text-gray-300">{events.length}</Badge>
              </div>

              {events.length === 0 ? (
                <div className="flex min-h-[180px] flex-col items-center justify-center rounded-lg border border-dashed border-white/10 bg-white/[0.02] text-center">
                  <Calendar className="mb-3 h-8 w-8 text-gray-600" />
                  <p className="text-sm font-bold text-gray-300">Nenhuma reunião registrada ainda</p>
                  <p className="mt-1 max-w-sm text-xs text-gray-500">Quando alguém agendar usando seu link, o registro aparecerá aqui.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {events.map(event => (
                    <div key={event.id} className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-white">{event.invitee_name || event.invitee_email || 'Lead indicado'}</p>
                          <p className="mt-1 truncate text-xs text-gray-500">{event.invitee_email || event.event_type || 'Calendly'}</p>
                        </div>
                        <Badge className="border-blue-500/20 bg-blue-500/10 text-blue-300">
                          Agendado
                        </Badge>
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        {formatDate(event.scheduled_at ?? event.created_at)}
                      </div>
                    </div>
                  ))}
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
    gold: 'border-[#CE9F48]/20 bg-[#CE9F48]/10 text-[#CE9F48]',
    green: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
    blue: 'border-blue-500/20 bg-blue-500/10 text-blue-300',
    purple: 'border-violet-500/20 bg-violet-500/10 text-violet-300',
  };

  return (
    <Card className="border-white/10 bg-[#111] text-white">
      <CardContent className="flex items-center justify-between gap-4 p-5">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">{label}</p>
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
