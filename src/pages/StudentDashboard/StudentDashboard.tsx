import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowUpRight, Award, Bell, CheckCircle2, ClipboardList, Clock, FileSignature,
  BookOpen, Calendar, Download, Eye, FileText, Gift, Globe, GraduationCap, HelpCircle, Home, Loader2, LogOut, Mail, MapPin, MessageCircle, PenLine, Phone, Search, Target, Upload, User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { LanguageSelector } from '@/components/LanguageSelector';
import { cn } from '@/lib/utils';
import { useStudentAuth } from '@/contexts/StudentAuthContext';
import { supabase } from '@/lib/supabase';
import { PdfModal } from '@/components/ui/pdf-modal';
import { StudentSupportPanel } from '@/pages/StudentSupport';
import { StudentRewardsPanel } from '@/pages/StudentRewards';
import {
  useStudentDashboard,
  type DashboardApplication,
  type DashboardDocument,
  type DashboardIdentity,
  type DashboardStudentDocument,
  type DashboardForm,
  type DashboardSurveyResponse,
} from './hooks/useStudentDashboard';

type StudentDashboardTab =
  | 'overview'
  | 'applications'
  | 'documents'
  | 'supplemental-data'
  | 'forms'
  | 'rewards'
  | 'support'
  | 'profile';

const TABS: Array<{ id: StudentDashboardTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: 'Visão Geral', icon: Home },
  { id: 'applications', label: 'Minhas Candidaturas', icon: ClipboardList },
  { id: 'documents', label: 'Documentos Pendentes', icon: FileText },
  { id: 'supplemental-data', label: 'Dados Complementares', icon: FileSignature },
  { id: 'forms', label: 'Formulários para Assinar', icon: FileSignature },
  { id: 'rewards', label: 'Programa de Indicação', icon: Gift },
  { id: 'support', label: 'Suporte', icon: MessageCircle },
  { id: 'profile', label: 'Perfil', icon: User },
];

const isDashboardTab = (value: string | undefined): value is StudentDashboardTab =>
  !!value && TABS.some(tab => tab.id === value);

const statusText: Record<string, string> = {
  pending_admin_approval: 'Aguardando aprovação',
  approved: 'Aprovada',
  rejected: 'Rejeitada',
  payment_pending: 'Aguardando pagamento',
  payment_confirmed: 'Placement Fee pago',
  pending: 'Pendente',
  submitted: 'Enviado',
  under_review: 'Em análise',
};

function badgeClass(status: string) {
  if (['payment_confirmed', 'approved', 'submitted'].includes(status)) return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
  if (['payment_pending', 'pending_admin_approval', 'pending'].includes(status)) return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
  if (status === 'rejected') return 'border-red-500/30 bg-red-500/10 text-red-300';
  return 'border-white/10 bg-white/5 text-gray-300';
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Ainda não';
  return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getProgress(profile: ReturnType<typeof useStudentAuth>['userProfile'], app: DashboardApplication | null) {
  const checks = [
    !!profile?.has_paid_selection_process_fee,
    !!profile?.selection_survey_passed,
    !!app,
    !!app && ['approved', 'payment_pending', 'payment_confirmed'].includes(app.status),
    !!profile?.is_placement_fee_paid || app?.status === 'payment_confirmed',
    !!profile?.is_application_fee_paid,
    !!profile?.documents_uploaded,
    !!app?.acceptance_letter_url,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function getNextAction(profile: ReturnType<typeof useStudentAuth>['userProfile'], app: DashboardApplication | null) {
  if (!profile?.has_paid_selection_process_fee) return { label: 'Iniciar processo', href: '/student/onboarding?step=selection_fee' };
  if (!profile.selection_survey_passed) return { label: 'Responder questionário', href: '/student/onboarding?step=selection_survey' };
  if (!app) return { label: 'Selecionar universidade', href: '/student/onboarding?step=scholarship_selection' };
  if (!['approved', 'payment_pending', 'payment_confirmed'].includes(app.status)) return { label: 'Aguardar aprovação de bolsa', href: null };
  if (!profile.is_placement_fee_paid && app.status !== 'payment_confirmed') return { label: 'Pagar Placement Fee', href: '/student/onboarding?step=placement_fee' };
  if (!profile.is_application_fee_paid) return { label: 'Pagar Application Fee', href: '/student/onboarding?step=payment' };
  if (!profile.documents_uploaded) return { label: 'Enviar documentos', href: '/student/onboarding?step=documents_upload' };
  if (!app.acceptance_letter_url) return { label: 'Acompanhar candidatura', href: '/student/onboarding?step=my_applications' };
  return { label: 'Ver carta de aceite', href: '/student/onboarding?step=acceptance_letter' };
}

function isIdentityComplete(identity: DashboardIdentity | null) {
  if (!identity) return false;
  return [
    identity.birth_date,
    identity.document_type,
    identity.document_number,
    identity.address,
    identity.city,
    identity.state,
    identity.zip_code,
    identity.country,
    identity.nationality,
    identity.marital_status,
  ].every(value => typeof value === 'string' && value.trim().length > 0);
}

function hasDocumentsSubmitted(
  globalDocuments: DashboardDocument[],
  studentDocuments: DashboardStudentDocument[],
  profileFlag: boolean,
) {
  if (profileFlag) return true;
  return globalDocuments.some(doc => !!doc.submitted_at || !!doc.submitted_url) ||
    studentDocuments.some(doc => !!doc.uploaded_at || !!doc.file_url);
}

function getCurrentStepInfo(profile: ReturnType<typeof useStudentAuth>['userProfile'], app: DashboardApplication | null) {
  if (!profile?.has_paid_selection_process_fee) {
    return {
      number: 1,
      total: 8,
      title: 'Taxa do Processo Seletivo',
      description: 'Esta taxa cobre o processamento da sua candidatura, avaliação de documentos e suporte inicial para seu processo de estudo.',
    };
  }
  if (!profile.selection_survey_passed) {
    return {
      number: 2,
      total: 8,
      title: 'Questionário Estratégico',
      description: 'Complete suas respostas para que a equipe Migma direcione sua candidatura para as melhores opções de bolsa.',
    };
  }
  if (!app) {
    return {
      number: 3,
      total: 8,
      title: 'Seleção de Universidade',
      description: 'Escolha suas opções de universidade e bolsa para análise da equipe Migma.',
    };
  }
  if (!['approved', 'payment_pending', 'payment_confirmed'].includes(app.status)) {
    return {
      number: 4,
      total: 8,
      title: 'Aprovação de Bolsa',
      description: 'Sua seleção está em revisão. Acompanhe aqui o status da candidatura aprovada.',
    };
  }
  if (!profile.is_placement_fee_paid && app.status !== 'payment_confirmed') {
    return {
      number: 5,
      total: 8,
      title: 'Placement Fee',
      description: 'Finalize o pagamento para garantir sua vaga e liberar documentos, formulários e próximos passos.',
    };
  }
  if (!profile.is_application_fee_paid) {
    return {
      number: 6,
      total: 8,
      title: 'Application Fee',
      description: 'Pague a taxa de aplicação da universidade para avançar com o envio do seu processo.',
    };
  }
  if (!profile.documents_uploaded) {
    return {
      number: 7,
      total: 8,
      title: 'Documentos Pendentes',
      description: 'Envie os documentos solicitados para completar seu pacote de candidatura.',
    };
  }
  return {
    number: 8,
    total: 8,
    title: app.acceptance_letter_url ? 'Carta de Aceite' : 'Formulários e Pacote Final',
    description: app.acceptance_letter_url
      ? 'Sua carta já está disponível. Acesse os documentos finais para seguir as orientações da equipe.'
      : 'Acompanhe a geração dos formulários, assinatura digital e envio do pacote final.',
  };
}

const StudentDashboard: React.FC = () => {
  const { tab } = useParams();
  const navigate = useNavigate();
  const { user, userProfile, loading: authLoading, signOut } = useStudentAuth();
  const { data, activeApplication, loading, error } = useStudentDashboard();

  const currentTab: StudentDashboardTab = isDashboardTab(tab) ? tab : 'overview';
  const progress = useMemo(() => getProgress(userProfile, activeApplication), [userProfile, activeApplication]);
  const nextAction = useMemo(() => getNextAction(userProfile, activeApplication), [userProfile, activeApplication]);
  const studentVisibleForms = useMemo(
    () => data.forms.filter(form => form.form_type !== 'termo_responsabilidade_estudante'),
    [data.forms],
  );

  useEffect(() => {
    if (!authLoading && !user) navigate('/student/login');
  }, [authLoading, user, navigate]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-9 h-9 animate-spin text-[#CE9F48]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-white/10 bg-[#0d0d0d] lg:block">
        <div className="h-20 px-6 flex items-center border-b border-white/10">
          <img src="/logo.png" alt="Migma" className="h-9 object-contain" onError={e => { e.currentTarget.style.display = 'none'; }} />
        </div>
        <div className="px-4 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#CE9F48]/15 border border-[#CE9F48]/25 flex items-center justify-center">
              <User className="w-5 h-5 text-[#CE9F48]" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold truncate">{userProfile?.full_name || userProfile?.email || 'Aluno'}</p>
              <p className="text-xs text-gray-500">Portal do Aluno</p>
            </div>
          </div>
        </div>
        <nav className="p-3 space-y-1">
          {TABS.map(item => {
            const Icon = item.icon;
            const active = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => navigate(`/student/dashboard/${item.id}`)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-semibold transition-colors text-left',
                  active ? 'bg-[#CE9F48] text-black' : 'text-gray-400 hover:text-white hover:bg-white/5',
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 h-20 border-b border-white/10 bg-[#0a0a0a]/90 backdrop-blur px-4 lg:px-8 flex items-center justify-between">
          <div>
            <p className="text-xs text-[#CE9F48] font-black uppercase tracking-widest">Painel do Estudante</p>
            <h1 className="text-xl font-black tracking-tight">{TABS.find(item => item.id === currentTab)?.label}</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-white/5">
              <Bell className="w-4 h-4" />
            </Button>
            <LanguageSelector />
            <Button
              variant="outline"
              className="border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white"
              onClick={async () => {
                await signOut();
                navigate('/student/login');
              }}
            >
              <LogOut className="w-4 h-4" />
              Sair
            </Button>
          </div>
        </header>

        <div className="lg:hidden border-b border-white/10 bg-[#0d0d0d] px-4 py-3 overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            {TABS.map(item => (
              <button
                key={item.id}
                onClick={() => navigate(`/student/dashboard/${item.id}`)}
                className={cn(
                  'px-3 py-2 rounded-lg text-xs font-bold',
                  currentTab === item.id ? 'bg-[#CE9F48] text-black' : 'bg-white/5 text-gray-400',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <main className="p-4 lg:p-8">
          {error && (
            <div className="mb-5 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {currentTab === 'overview' && (
            <OverviewTab
              progress={progress}
              nextAction={nextAction}
              application={activeApplication}
              applicationCount={data.applications.length}
              pendingDocuments={data.documents.filter(doc => doc.status !== 'approved').length}
              formsCount={studentVisibleForms.length}
              applications={data.applications}
              identityComplete={isIdentityComplete(data.identity)}
              academicComplete={!!data.surveyResponse?.completed_at || !!userProfile?.selection_survey_passed}
              documentsComplete={hasDocumentsSubmitted(data.documents, data.studentDocuments, !!userProfile?.documents_uploaded)}
            />
          )}
          {currentTab === 'applications' && (
            <ApplicationsTab
              applications={data.applications}
              documents={data.documents}
              forms={studentVisibleForms}
            />
          )}
          {currentTab === 'documents' && (
            <DocumentsTab
              documents={data.documents}
              studentDocuments={data.studentDocuments}
            />
          )}
          {currentTab === 'supplemental-data' && <PlaceholderTab title="Dados Complementares" description="Formulário da seção 11.4. Será conectado aos dados exigidos para preencher os formulários da universidade." />}
          {currentTab === 'forms' && <FormsTab forms={studentVisibleForms} application={activeApplication} />}
          {currentTab === 'rewards' && <StudentRewardsPanel embedded />}
          {currentTab === 'support' && <StudentSupportPanel embedded />}
          {currentTab === 'profile' && (
            <ProfileTab
              progress={progress}
              identity={data.identity}
              surveyResponse={data.surveyResponse}
            />
          )}
        </main>
      </div>
    </div>
  );
};

function OverviewTab({
  progress,
  nextAction,
  application,
  applicationCount,
  pendingDocuments,
  formsCount,
  applications,
  identityComplete,
  academicComplete,
  documentsComplete,
}: {
  progress: number;
  nextAction: { label: string; href: string | null };
  application: DashboardApplication | null;
  applicationCount: number;
  pendingDocuments: number;
  formsCount: number;
  applications: DashboardApplication[];
  identityComplete: boolean;
  academicComplete: boolean;
  documentsComplete: boolean;
}) {
  const navigate = useNavigate();
  const { userProfile } = useStudentAuth();
  const step = getCurrentStepInfo(userProfile, application);
  const approvedCount = applications.filter(app => ['approved', 'payment_pending', 'payment_confirmed'].includes(app.status)).length;
  const pendingCount = applications.filter(app => ['pending_admin_approval', 'payment_pending'].includes(app.status)).length;
  const profileItems = [
    { label: 'Informações básicas', done: identityComplete },
    { label: 'Detalhes acadêmicos', done: academicComplete },
    { label: 'Documentos enviados', done: documentsComplete },
  ];

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-lg border border-[#CE9F48]/20 bg-gradient-to-br from-[#111] via-[#151515] to-[#2a2413] p-6 shadow-2xl shadow-black/30 lg:p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#CE9F48]/30 bg-[#CE9F48]/10">
            <Award className="h-5 w-5 text-[#CE9F48]" />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight lg:text-2xl">
              Bem-vindo, {userProfile?.full_name || userProfile?.email || 'aluno'}!
            </h2>
            <p className="text-xs text-gray-500">Gerencie sua jornada de candidatura com a Migma</p>
          </div>
        </div>

        <div className="mx-auto mt-9 max-w-2xl text-center">
          <Badge className="mb-5 border-[#CE9F48]/30 bg-[#CE9F48]/10 text-[#CE9F48]">
            Passo {step.number} / {step.total}
          </Badge>
          <h3 className="text-2xl font-black tracking-tight lg:text-3xl">{step.title}</h3>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-gray-300">{step.description}</p>
          <div className="mx-auto mt-7 max-w-sm">
            <Progress value={progress} className="h-2 bg-white/10 [&>div]:bg-[#CE9F48]" />
            <p className="mt-2 text-xs text-gray-500">{progress}% do processo concluído</p>
          </div>
          <div className="mx-auto mt-5 grid max-w-xl grid-cols-3 gap-2 text-center">
            <MiniKpi label="Candidaturas" value={String(applicationCount)} />
            <MiniKpi label="Docs pendentes" value={String(pendingDocuments)} />
            <MiniKpi label="Formulários" value={String(formsCount)} />
          </div>
          <Button
            onClick={() => nextAction.href && navigate(nextAction.href)}
            disabled={!nextAction.href}
            className="mt-7 w-full max-w-sm bg-[#CE9F48] text-black hover:bg-[#b8892f]"
          >
            {nextAction.label}
          </Button>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <ActionCard icon={Search} title="Encontrar Bolsas" subtitle="Continue sua seleção de universidades" metric={application ? 'Em andamento' : 'Pendente'} onClick={() => navigate('/student/onboarding?step=scholarship_selection')} />
        <ActionCard icon={ClipboardList} title="Minhas Candidaturas" subtitle="Acompanhe o status da sua candidatura" metric={`${approvedCount} aprovadas · ${pendingCount} pendentes`} onClick={() => navigate('/student/dashboard/applications')} />
        <ActionCard icon={Target} title="Atualizar Perfil" subtitle="Mantenha seus dados atualizados" metric={`${pendingDocuments} docs pendentes`} onClick={() => navigate('/student/dashboard/profile')} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="border-white/10 bg-[#111] text-white">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ClipboardList className="w-5 h-5 text-[#CE9F48]" />
                Candidaturas Recentes
              </CardTitle>
              <p className="mt-1 text-xs text-gray-500">Acompanhe suas últimas submissões de bolsa</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-[#CE9F48]">{applicationCount}</p>
              <p className="text-[10px] uppercase tracking-widest text-gray-600">Total</p>
            </div>
          </CardHeader>
          <CardContent>
            {applications.length === 0 ? (
              <div className="flex min-h-[260px] flex-col items-center justify-center text-center">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5">
                  <FileText className="h-7 w-7 text-gray-500" />
                </div>
                <h3 className="text-lg font-black">Nenhuma candidatura ainda</h3>
                <p className="mt-2 max-w-sm text-sm text-gray-500">Comece sua jornada navegando e se candidatando a bolsas.</p>
                <Button onClick={() => navigate('/student/onboarding?step=scholarship_selection')} className="mt-6 bg-[#CE9F48] text-black hover:bg-[#b8892f]">
                  Começar processo
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {applications.slice(0, 3).map(app => (
                  <ApplicationSummary key={app.id} application={app} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card className="border-white/10 bg-[#111] text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="w-4 h-4 text-[#CE9F48]" />
                Status do Perfil
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {profileItems.map(item => (
                  <div key={item.label} className="flex items-center justify-between text-sm">
                    <span className="text-gray-300">{item.label}</span>
                    {item.done ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Clock className="h-4 w-4 text-amber-400" />}
                  </div>
                ))}
              </div>
              <button
                onClick={() => navigate('/student/dashboard/profile')}
                className="w-full rounded-lg border border-[#CE9F48]/20 bg-[#CE9F48]/10 px-4 py-3 text-left text-sm text-[#CE9F48] transition-colors hover:bg-[#CE9F48]/15"
              >
                Complete seu perfil para desbloquear mais oportunidades
                <span className="mt-1 block text-xs font-bold">Completar agora →</span>
              </button>
            </CardContent>
          </Card>

          <Card className="border-[#CE9F48]/20 bg-[#CE9F48] text-black">
            <CardContent className="p-5">
              <h3 className="flex items-center gap-2 font-black">
                <HelpCircle className="h-4 w-4" />
                Dicas de Sucesso
              </h3>
              <ul className="mt-4 space-y-2 text-sm font-medium">
                <li>• Candidate-se cedo para aumentar suas chances de sucesso</li>
                <li>• Adapte suas candidaturas para cada bolsa</li>
                <li>• Mantenha seu perfil atualizado com suas últimas conquistas</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ActionCard({
  icon: Icon,
  title,
  subtitle,
  metric,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  metric: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group rounded-lg border border-white/10 bg-[#111] p-4 text-left text-white transition-colors hover:border-[#CE9F48]/30 hover:bg-[#151515]"
    >
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#CE9F48]/20 bg-[#CE9F48]/10">
          <Icon className="h-5 w-5 text-[#CE9F48]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-black">{title}</h3>
              <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
              <p className="mt-2 text-xs text-[#CE9F48]">{metric}</p>
            </div>
            <ArrowUpRight className="h-4 w-4 text-gray-600 transition-colors group-hover:text-[#CE9F48]" />
          </div>
        </div>
      </div>
    </button>
  );
}

function MiniKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
      <p className="text-lg font-black text-white">{value}</p>
      <p className="text-[10px] uppercase tracking-widest text-gray-500">{label}</p>
    </div>
  );
}

function ApplicationsTab({
  applications,
  documents,
  forms,
}: {
  applications: DashboardApplication[];
  documents: DashboardDocument[];
  forms: Array<{ id: string; application_id: string | null; form_type: string; signed_at: string | null }>;
}) {
  const navigate = useNavigate();
  const approvedCount = applications.filter(app => ['approved', 'payment_pending', 'payment_confirmed'].includes(app.status)).length;
  const pendingCount = applications.filter(app => ['pending_admin_approval', 'payment_pending'].includes(app.status)).length;

  if (applications.length === 0) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h2 className="text-2xl font-black tracking-tight">Minhas Candidaturas</h2>
          <p className="mt-1 text-sm text-gray-500">Acompanhe o progresso de todas as suas aplicações para bolsas de estudo.</p>
        </div>
        <ApplicationsKpis total={0} approved={0} pending={0} />
        <Card className="border-white/10 bg-[#111] text-white">
          <CardContent className="p-10">
            <div className="flex min-h-[260px] flex-col items-center justify-center text-center">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-lg border border-[#CE9F48]/20 bg-[#CE9F48]/10">
                <FileText className="h-8 w-8 text-[#CE9F48]" />
              </div>
              <h3 className="text-xl font-black">Nenhuma candidatura ainda</h3>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-gray-500">
                Comece a se candidatar a bolsas para acompanhar seu progresso aqui. Vamos ajudar você a encontrar as melhores oportunidades que correspondam ao seu perfil.
              </p>
              <Button onClick={() => navigate('/student/onboarding?step=scholarship_selection')} className="mt-7 bg-[#CE9F48] text-black hover:bg-[#b8892f]">
                Começar processo
                <ArrowUpRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h2 className="text-2xl font-black tracking-tight">Minhas Candidaturas</h2>
        <p className="mt-1 text-sm text-gray-500">Acompanhe o progresso de todas as suas aplicações para bolsas de estudo.</p>
      </div>

      <ApplicationsKpis total={applications.length} approved={approvedCount} pending={pendingCount} />

      <div className="grid gap-4">
        {applications.map(app => {
          const appForms = forms.filter(form =>
            form.form_type !== 'termo_responsabilidade_estudante' &&
            (!form.application_id || form.application_id === app.id)
          );
          return (
            <ApplicationCard
              key={app.id}
              application={app}
              documents={documents}
              forms={appForms}
            />
          );
        })}
      </div>
    </div>
  );
}

function ApplicationsKpis({ total, approved, pending }: { total: number; approved: number; pending: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <MetricTile icon={ClipboardList} label="Total de Aplicações" value={String(total)} tone="gold" />
      <MetricTile icon={CheckCircle2} label="Aprovadas" value={String(approved)} tone="green" />
      <MetricTile icon={Clock} label="Pendentes" value={String(pending)} tone="amber" />
    </div>
  );
}

function MetricTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: 'gold' | 'green' | 'amber';
}) {
  const toneClass = {
    gold: 'bg-[#CE9F48]/10 border-[#CE9F48]/20 text-[#CE9F48]',
    green: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    amber: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
  }[tone];

  return (
    <Card className="border-white/10 bg-[#111] text-white">
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className="mt-2 text-3xl font-black">{value}</p>
        </div>
        <div className={cn('flex h-12 w-12 items-center justify-center rounded-lg border', toneClass)}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function ApplicationCard({
  application,
  documents,
  forms,
}: {
  application: DashboardApplication;
  documents: DashboardDocument[];
  forms: Array<{ id: string; form_type: string; signed_at: string | null }>;
}) {
  const scholarship = application.institution_scholarships;
  const submittedDocs = documents.filter(doc => !!doc.submitted_at || !!doc.submitted_url).length;
  const approvedDocs = documents.filter(doc => doc.status === 'approved').length;
  const signedForms = forms.filter(form => !!form.signed_at).length;
  const statusSteps = [
    { label: 'Bolsa aprovada', done: ['approved', 'payment_pending', 'payment_confirmed'].includes(application.status) },
    { label: 'Placement Fee', done: application.status === 'payment_confirmed' || !!application.placement_fee_paid_at },
    { label: 'Documentos', done: documents.length > 0 && documents.every(doc => doc.status === 'approved') },
    { label: 'Formulários', done: forms.length > 0 && forms.every(form => !!form.signed_at) },
  ];

  return (
    <Card className="border-white/10 bg-[#111] text-white">
      <CardContent className="p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#CE9F48]/20 bg-[#CE9F48]/10">
                <GraduationCap className="h-5 w-5 text-[#CE9F48]" />
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-lg font-black">{application.institutions?.name ?? 'Universidade'}</h3>
                <p className="text-xs text-gray-500">
                  {[application.institutions?.city, application.institutions?.state].filter(Boolean).join(', ') || 'Localização não informada'}
                </p>
              </div>
              <Badge className={badgeClass(application.status)}>{statusText[application.status] ?? application.status}</Badge>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <Info label="Bolsa" value={scholarship?.discount_percent ? `${scholarship.discount_percent}%` : '—'} />
              <Info label="Placement" value={scholarship?.placement_fee_usd ? `$${scholarship.placement_fee_usd}` : '—'} />
              <Info label="Tuition anual" value={scholarship?.tuition_annual_usd ? `$${scholarship.tuition_annual_usd}` : '—'} />
              <Info label="Aplicado em" value={formatDate(application.created_at)} />
            </div>
          </div>

          <div className="grid gap-3 text-sm lg:w-80">
            <DocumentStatusLine label="Documentos enviados" value={`${submittedDocs}/${Math.max(documents.length, submittedDocs)}`} done={submittedDocs > 0} />
            <DocumentStatusLine label="Documentos aprovados" value={`${approvedDocs}/${Math.max(documents.length, approvedDocs)}`} done={documents.length > 0 && approvedDocs === documents.length} />
            <DocumentStatusLine label="Formulários assinados" value={`${signedForms}/${Math.max(forms.length, signedForms)}`} done={forms.length > 0 && signedForms === forms.length} />
            <DocumentStatusLine label="Pacote final" value={application.package_status ?? 'Pendente'} done={application.package_status === 'ready' || application.package_status === 'sent'} />
          </div>
        </div>

        <div className="mt-5 grid gap-2 md:grid-cols-4">
          {statusSteps.map(step => (
            <div key={step.label} className={cn(
              'rounded-lg border px-3 py-2 text-xs font-semibold',
              step.done ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-white/10 bg-white/[0.03] text-gray-500',
            )}>
              {step.done ? <CheckCircle2 className="mr-1.5 inline h-3.5 w-3.5" /> : <Clock className="mr-1.5 inline h-3.5 w-3.5" />}
              {step.label}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function DocumentStatusLine({ label, value, done }: { label: string; value: string; done: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
      <span className="text-gray-400">{label}</span>
      <span className={cn('font-bold', done ? 'text-emerald-400' : 'text-amber-400')}>{value}</span>
    </div>
  );
}

function ApplicationSummary({ application }: { application: DashboardApplication }) {
  const scholarship = application.institution_scholarships;
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-lg font-black">{application.institutions?.name ?? 'Universidade'}</h3>
          <Badge className={badgeClass(application.status)}>{statusText[application.status] ?? application.status}</Badge>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          {[application.institutions?.city, application.institutions?.state].filter(Boolean).join(', ') || 'Localização não informada'}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Info label="Bolsa" value={scholarship?.discount_percent ? `${scholarship.discount_percent}%` : '—'} />
        <Info label="Placement" value={scholarship?.placement_fee_usd ? `$${scholarship.placement_fee_usd}` : '—'} />
        <Info label="Pago em" value={formatDate(application.placement_fee_paid_at)} />
        <Info label="Pacote" value={application.package_status ?? 'Pendente'} />
      </div>
    </div>
  );
}

const DOCUMENT_LABELS: Record<string, string> = {
  current_i20: 'I-20 atual',
  i94: 'I-94',
  f1_visa: 'Visto F-1',
  history_diploma: 'Histórico / Diploma traduzido',
  bank_statement: 'Comprovação financeira',
  address_us: 'Proof of address nos EUA',
  address_br: 'Proof of address no Brasil',
  certidoes: 'Certidão traduzida',
  passport: 'Passaporte',
};

function documentLabel(type: string) {
  return DOCUMENT_LABELS[type] ?? type.replace(/_/g, ' ');
}

function DocumentsTab({
  documents,
  studentDocuments,
}: {
  documents: DashboardDocument[];
  studentDocuments: DashboardStudentDocument[];
}) {
  const navigate = useNavigate();
  const total = documents.length + studentDocuments.length;
  const submitted = documents.filter(doc => !!doc.submitted_at || !!doc.submitted_url).length +
    studentDocuments.filter(doc => !!doc.uploaded_at || !!doc.file_url).length;
  const approved = documents.filter(doc => doc.status === 'approved').length +
    studentDocuments.filter(doc => doc.status === 'approved').length;
  const rejected = documents.filter(doc => doc.status === 'rejected').length +
    studentDocuments.filter(doc => doc.status === 'rejected').length;

  if (total === 0) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h2 className="text-2xl font-black tracking-tight">Documentos Pendentes</h2>
          <p className="mt-1 text-sm text-gray-500">Lista de documentos solicitados pelo sistema ou pela equipe Migma.</p>
        </div>
        <DocumentKpis total={0} submitted={0} approved={0} rejected={0} />
        <Card className="border-white/10 bg-[#111] text-white">
          <CardContent className="p-10">
            <div className="flex min-h-[260px] flex-col items-center justify-center text-center">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-lg border border-[#CE9F48]/20 bg-[#CE9F48]/10">
                <FileText className="h-8 w-8 text-[#CE9F48]" />
              </div>
              <h3 className="text-xl font-black">Nenhum documento solicitado</h3>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-gray-500">
                Os documentos globais aparecerão aqui após a confirmação do Placement Fee ou quando a equipe Migma solicitar algo específico.
              </p>
              <Button onClick={() => navigate('/student/onboarding?step=documents_upload')} className="mt-7 bg-[#CE9F48] text-black hover:bg-[#b8892f]">
                Ir para documentos
                <ArrowUpRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight">Documentos Pendentes</h2>
          <p className="mt-1 text-sm text-gray-500">Lista de documentos solicitados pelo sistema ou pela equipe Migma.</p>
        </div>
        <Button onClick={() => navigate('/student/onboarding?step=documents_upload')} className="bg-[#CE9F48] text-black hover:bg-[#b8892f]">
          Enviar documentos
        </Button>
      </div>

      <DocumentKpis total={total} submitted={submitted} approved={approved} rejected={rejected} />

      <div className="grid gap-4">
        {documents.map(doc => (
          <DocumentRequestCard key={doc.id} document={doc} />
        ))}
        {studentDocuments.map(doc => (
          <StudentDocumentCard key={doc.id} document={doc} />
        ))}
      </div>
    </div>
  );
}

function DocumentKpis({ total, submitted, approved, rejected }: { total: number; submitted: number; approved: number; rejected: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <MetricTile icon={FileText} label="Solicitados" value={String(total)} tone="gold" />
      <MetricTile icon={ArrowUpRight} label="Enviados" value={String(submitted)} tone="gold" />
      <MetricTile icon={CheckCircle2} label="Aprovados" value={String(approved)} tone="green" />
      <MetricTile icon={Clock} label="Com pendência" value={String(Math.max(total - approved - rejected, 0))} tone="amber" />
    </div>
  );
}

function DocumentRequestCard({ document }: { document: DashboardDocument }) {
  const submitted = !!document.submitted_at || !!document.submitted_url;
  return (
    <Card className="border-white/10 bg-[#111] text-white">
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-4">
            <div className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border',
              document.status === 'approved'
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                : document.status === 'rejected'
                  ? 'border-red-500/20 bg-red-500/10 text-red-300'
                  : 'border-[#CE9F48]/20 bg-[#CE9F48]/10 text-[#CE9F48]',
            )}>
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-black capitalize">{documentLabel(document.document_type)}</h3>
                <Badge className={badgeClass(document.status)}>{statusText[document.status] ?? document.status}</Badge>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Solicitado em {formatDate(document.requested_at)}
                {document.submitted_at ? ` · Enviado em ${formatDate(document.submitted_at)}` : ''}
                {document.approved_at ? ` · Aprovado em ${formatDate(document.approved_at)}` : ''}
              </p>
              {document.rejection_reason && (
                <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {document.rejection_reason}
                </div>
              )}
            </div>
          </div>
          <div className="grid gap-2 text-sm lg:w-56">
            <DocumentStatusLine label="Upload" value={submitted ? 'Enviado' : 'Pendente'} done={submitted} />
            <DocumentStatusLine label="Revisão" value={document.status === 'approved' ? 'Aprovado' : document.status === 'rejected' ? 'Recusado' : 'Aguardando'} done={document.status === 'approved'} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StudentDocumentCard({ document }: { document: DashboardStudentDocument }) {
  const submitted = !!document.uploaded_at || !!document.file_url;
  return (
    <Card className="border-white/10 bg-[#111] text-white">
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#CE9F48]/20 bg-[#CE9F48]/10 text-[#CE9F48]">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-black capitalize">{documentLabel(document.type)}</h3>
                <Badge className={badgeClass(document.status)}>{statusText[document.status] ?? document.status}</Badge>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Documento do perfil {document.uploaded_at ? `· Enviado em ${formatDate(document.uploaded_at)}` : ''}
              </p>
              {document.rejection_reason && (
                <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {document.rejection_reason}
                </div>
              )}
            </div>
          </div>
          <div className="lg:w-56">
            <DocumentStatusLine label="Upload" value={submitted ? 'Enviado' : 'Pendente'} done={submitted} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FormsTab({ forms, application }: { forms: DashboardForm[]; application: DashboardApplication | null }) {
  const [previewForm, setPreviewForm] = useState<DashboardForm | null>(null);
  const [signingForm, setSigningForm] = useState<DashboardForm | null>(null);
  const visibleForms = forms.filter(form => form.form_type !== 'termo_responsabilidade_estudante');
  const generated = visibleForms.length;
  const signed = visibleForms.filter(form => !!form.signed_at).length;
  const pending = Math.max(generated - signed, 0);

  const markFormPdfOpened = async (form: DashboardForm) => {
    const now = new Date().toISOString();
    const metadata = form.signature_metadata_json ?? {};
    const currentOpenCount = typeof metadata.pdf_open_count === 'number' ? metadata.pdf_open_count : 0;

    form.signature_metadata_json = {
      ...metadata,
      pdf_opened_at: typeof metadata.pdf_opened_at === 'string' ? metadata.pdf_opened_at : now,
      last_pdf_opened_at: now,
      pdf_open_count: currentOpenCount + 1,
    };

    await supabase
      .from('institution_forms')
      .update({ signature_metadata_json: form.signature_metadata_json })
      .eq('id', form.id);
  };

  if (visibleForms.length === 0) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h2 className="text-2xl font-black tracking-tight">Formulários para Assinar</h2>
          <p className="mt-1 text-sm text-gray-500">Revise e assine os formulários gerados para sua candidatura.</p>
        </div>
        <FormsKpis generated={0} signed={0} pending={0} />
        <Card className="border-white/10 bg-[#111] text-white">
          <CardContent className="p-10">
            <div className="flex min-h-[260px] flex-col items-center justify-center text-center">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-lg border border-[#CE9F48]/20 bg-[#CE9F48]/10">
                <FileSignature className="h-8 w-8 text-[#CE9F48]" />
              </div>
              <h3 className="text-xl font-black">Nenhum formulário gerado ainda</h3>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-gray-500">
                {application?.status === 'payment_confirmed'
                  ? 'O pagamento foi confirmado. Os formulários aparecerão aqui assim que forem gerados pela equipe.'
                  : 'Os formulários serão liberados após aprovação e pagamento do Placement Fee.'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h2 className="text-2xl font-black tracking-tight">Formulários para Assinar</h2>
        <p className="mt-1 text-sm text-gray-500">Baixe cada PDF, assine fora do portal e envie o arquivo assinado.</p>
      </div>

      <FormsKpis generated={generated} signed={signed} pending={pending} />

      <div className="grid gap-4">
        {visibleForms.map(form => (
          <FormCard
            key={form.id}
            form={form}
            onPreview={() => {
              void markFormPdfOpened(form);
              setPreviewForm(form);
            }}
            onOpenPdf={() => void markFormPdfOpened(form)}
            onSign={() => setSigningForm(form)}
          />
        ))}
      </div>

      {previewForm && (previewForm.signed_url || previewForm.template_url) && (
        <PdfModal
          isOpen={!!previewForm}
          onClose={() => setPreviewForm(null)}
          pdfUrl={(previewForm.signed_url || previewForm.template_url)!}
          title={previewForm.form_type}
        />
      )}

      {signingForm && (
        <FormSignatureModal
          form={signingForm}
          onClose={() => setSigningForm(null)}
          onSigned={() => window.location.reload()}
        />
      )}
    </div>
  );
}

function FormsKpis({ generated, signed, pending }: { generated: number; signed: number; pending: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <MetricTile icon={FileSignature} label="Gerados" value={String(generated)} tone="gold" />
      <MetricTile icon={CheckCircle2} label="Assinados" value={String(signed)} tone="green" />
      <MetricTile icon={PenLine} label="Aguardando assinatura" value={String(pending)} tone="amber" />
    </div>
  );
}

function FormCard({ form, onPreview, onOpenPdf, onSign }: { form: DashboardForm; onPreview: () => void; onOpenPdf: () => void; onSign: () => void }) {
  const isSigned = !!form.signed_at;
  return (
    <Card className="border-white/10 bg-[#111] text-white">
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-4">
            <div className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border',
              isSigned ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' : 'border-[#CE9F48]/20 bg-[#CE9F48]/10 text-[#CE9F48]',
            )}>
              <FileSignature className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-black">{form.form_type}</h3>
                <Badge className={isSigned ? badgeClass('submitted') : badgeClass('pending')}>
                  {isSigned ? 'Assinado' : 'Aguardando assinatura'}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Gerado em {formatDate(form.generated_at)}
                {form.signed_at ? ` · Assinado em ${formatDate(form.signed_at)}` : ''}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(form.template_url || form.signed_url) && (
              <Button variant="outline" onClick={onPreview} className="border-white/10 bg-white/5 text-white hover:bg-white/10">
                <Eye className="h-4 w-4" />
                Revisar
              </Button>
            )}
            {(form.signed_url || form.template_url) && (
              <Button variant="outline" asChild className="border-white/10 bg-white/5 text-white hover:bg-white/10">
                <a href={(form.signed_url || form.template_url)!} target="_blank" rel="noopener noreferrer" onClick={onOpenPdf}>
                  <Download className="h-4 w-4" />
                  Abrir
                </a>
              </Button>
            )}
            <Button onClick={onSign} disabled={isSigned} className="bg-[#CE9F48] text-black hover:bg-[#b8892f]">
              <Upload className="h-4 w-4" />
              {isSigned ? 'Enviado' : 'Enviar assinado'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FormSignatureModal({ form, onClose, onSigned }: { form: DashboardForm; onClose: () => void; onSigned: () => void }) {
  const { user, userProfile } = useStudentAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async () => {
    if (!selectedFile || !user?.id || !userProfile?.id) return;
    setUploading(true);
    setError(null);

    try {
      const ext = selectedFile.name.split('.').pop()?.toLowerCase() || 'pdf';
      const filePath = `signed/${user.id}/${form.id}_${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('institution-forms')
        .upload(filePath, selectedFile, {
          contentType: selectedFile.type || 'application/pdf',
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('institution-forms')
        .getPublicUrl(filePath);

      setUploadedUrl(publicUrlData.publicUrl);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar arquivo assinado.');
    } finally {
      setUploading(false);
    }
  };

  const handleConfirm = async () => {
    if (!uploadedUrl || !userProfile?.id) return;
    setSaving(true);
    setError(null);

    try {
      const now = new Date().toISOString();
      const metadata = form.signature_metadata_json ?? {};
      const { error: updateError } = await supabase
        .from('institution_forms')
        .update({
          signed_at: now,
          signed_url: uploadedUrl,
          signature_metadata_json: {
            ...metadata,
            signed_at: now,
            signer_confirmed_at: now,
            signer_profile_id: userProfile.id,
            signer_name: userProfile.full_name,
            signature_capture: 'external_signed_file_upload',
            uploaded_signed_url: uploadedUrl,
            original_filename: selectedFile?.name ?? null,
            file_size_bytes: selectedFile?.size ?? null,
            file_type: selectedFile?.type ?? null,
          },
        })
        .eq('id', form.id);

      if (updateError) throw updateError;
      onSigned();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar assinatura.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-2xl rounded-lg border border-white/10 bg-[#0f0f0f] p-5 text-white shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-black">Enviar formulário assinado</h3>
            <p className="mt-1 text-sm text-gray-500">{form.form_type}</p>
          </div>
          <Button variant="outline" onClick={onClose} className="border-white/10 bg-white/5 text-white hover:bg-white/10">
            Fechar
          </Button>
        </div>

        <div className="space-y-4">
          {form.template_url && (
            <Button variant="outline" asChild className="border-white/10 bg-white/5 text-white hover:bg-white/10">
              <a
                href={form.template_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  const now = new Date().toISOString();
                  const metadata = form.signature_metadata_json ?? {};
                  const currentOpenCount = typeof metadata.pdf_open_count === 'number' ? metadata.pdf_open_count : 0;
                  form.signature_metadata_json = {
                    ...metadata,
                    pdf_opened_at: typeof metadata.pdf_opened_at === 'string' ? metadata.pdf_opened_at : now,
                    last_pdf_opened_at: now,
                    pdf_open_count: currentOpenCount + 1,
                  };
                  void supabase
                    .from('institution_forms')
                    .update({ signature_metadata_json: form.signature_metadata_json })
                    .eq('id', form.id);
                }}
              >
                <Download className="h-4 w-4" />
                Baixar PDF original
              </a>
            </Button>
          )}

          <label className="block rounded-lg border border-dashed border-white/15 bg-white/[0.03] p-5">
            <span className="text-sm font-bold">Arquivo assinado</span>
            <span className="mt-1 block text-xs text-gray-500">
              Envie o PDF assinado digitalmente, escaneado ou fotografado.
            </span>
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/jpg"
              className="mt-4 block w-full text-sm text-gray-300 file:mr-4 file:rounded-md file:border-0 file:bg-[#CE9F48] file:px-4 file:py-2 file:text-sm file:font-bold file:text-black"
              disabled={uploading || saving || !!uploadedUrl}
              onChange={event => {
                setSelectedFile(event.target.files?.[0] ?? null);
                setUploadedUrl(null);
                setError(null);
              }}
            />
          </label>

          {selectedFile && !uploadedUrl && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{selectedFile.name}</p>
                <p className="text-xs text-gray-500">{Math.ceil(selectedFile.size / 1024)} KB</p>
              </div>
              <Button onClick={handleUpload} disabled={uploading} className="bg-[#CE9F48] text-black hover:bg-[#b8892f]">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Enviar arquivo
              </Button>
            </div>
          )}

          {uploadedUrl && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-300" />
                <div>
                  <p className="text-sm font-bold text-emerald-200">Arquivo enviado</p>
                  <p className="mt-1 text-xs leading-relaxed text-emerald-100/80">
                    Confirme abaixo que este é o formulário assinado por você. Depois da confirmação, ele será marcado como assinado no seu processo.
                  </p>
                </div>
              </div>
            </div>
          )}

        {error && <p className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

        <div className="mt-5 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={saving} className="border-white/10 bg-white/5 text-white hover:bg-white/10">
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!uploadedUrl || saving} className="bg-[#CE9F48] text-black hover:bg-[#b8892f]">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}
            Confirmo que assinei
          </Button>
        </div>
        </div>
      </div>
    </div>
  );
}

function ProfileTab({
  progress,
  identity,
  surveyResponse,
}: {
  progress: number;
  identity: DashboardIdentity | null;
  surveyResponse: DashboardSurveyResponse | null;
}) {
  const { userProfile } = useStudentAuth();
  const personalRows = [
    { icon: User, label: 'Nome completo', value: userProfile?.full_name || userProfile?.email },
    { icon: Mail, label: 'Email', value: userProfile?.email },
    { icon: Phone, label: 'Telefone', value: userProfile?.phone },
    { icon: MapPin, label: 'País', value: identity?.country || userProfile?.country },
    { icon: FileText, label: identity?.document_type || 'Documento', value: identity?.document_number },
    { icon: Globe, label: 'Nacionalidade', value: identity?.nationality },
  ];
  const academicRows = [
    { icon: BookOpen, label: 'Área de interesse', value: formatArrayOrText(surveyResponse?.interest_areas) || userProfile?.field_of_interest },
    { icon: GraduationCap, label: 'Formação acadêmica', value: surveyResponse?.academic_formation || userProfile?.academic_level },
    { icon: Target, label: 'Tipo de processo', value: userProfile?.service_type || userProfile?.student_process_type },
    { icon: MessageCircle, label: 'Inglês', value: surveyResponse?.english_level },
  ];
  const accountRows = [
    { icon: Calendar, label: 'Membro desde', value: formatDate(userProfile?.created_at) },
    { icon: CheckCircle2, label: 'Completude do perfil', value: `${progress}%` },
    { icon: ClipboardList, label: 'Status documentos', value: userProfile?.documents_status || 'Pendente' },
    { icon: User, label: 'Dependentes', value: String(userProfile?.num_dependents ?? 0) },
  ];
  const missing = [
    { label: 'país', done: !!(identity?.country || userProfile?.country) },
    { label: 'área de interesse', done: !!(surveyResponse?.interest_areas?.length || userProfile?.field_of_interest) },
    { label: 'formação acadêmica', done: !!(surveyResponse?.academic_formation || userProfile?.academic_level) },
    { label: 'inglês', done: !!surveyResponse?.english_level },
    { label: 'documento', done: !!identity?.document_number },
  ].filter(item => !item.done);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight">Perfil do Estudante</h2>
          <p className="mt-1 text-sm text-gray-500">Dados pessoais e acadêmicos usados no processo de bolsa.</p>
        </div>
        <Button asChild className="bg-[#CE9F48] text-black hover:bg-[#b8892f]">
          <a href="/student/onboarding?step=identity">
            <PenLine className="h-4 w-4" />
            Editar perfil
          </a>
        </Button>
      </div>

      <Card className="border-[#CE9F48]/30 bg-gradient-to-r from-[#1a1508] to-[#2a2413] text-white">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-black">Completude do Perfil</h3>
              <p className="mt-1 text-sm text-gray-400">Complete seu perfil para melhorar o pareamento com bolsas.</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black text-[#CE9F48]">{progress}%</p>
              <p className="text-xs text-gray-500">Completo</p>
            </div>
          </div>
          <Progress value={progress} className="mt-5 h-2 bg-white/10 [&>div]:bg-[#CE9F48]" />
          <p className="mt-4 flex items-center gap-2 text-xs text-gray-500">
            <CheckCircle2 className="h-3.5 w-3.5 text-[#CE9F48]" />
            Perfil completo aumenta a precisão das recomendações.
          </p>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-[#111] text-white">
        <CardContent className="p-6">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="relative flex h-16 w-16 items-center justify-center rounded-lg border border-[#CE9F48]/20 bg-[#CE9F48]/10">
                <User className="h-8 w-8 text-[#CE9F48]" />
                <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-[#111]">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                </span>
              </div>
              <div>
                <h3 className="text-xl font-black">{userProfile?.full_name || userProfile?.email}</h3>
                <p className="mt-1 text-sm text-gray-500">{userProfile?.email}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge className="border-blue-500/20 bg-blue-500/10 text-blue-300">Aluno ativo</Badge>
                  <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-300">Verificado</Badge>
                </div>
              </div>
            </div>
            <Badge className="w-fit border-[#CE9F48]/30 bg-[#CE9F48]/10 text-[#CE9F48]">{progress}% completo</Badge>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            <ProfileSection title="Informações pessoais" rows={personalRows} />
            <ProfileSection title="Informações acadêmicas" rows={academicRows} />
          </div>

          <div className="mt-8 border-t border-white/10 pt-6">
            <ProfileSection title="Informações da conta" rows={accountRows} compact />
          </div>
        </CardContent>
      </Card>

      {missing.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/10 text-white">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <HelpCircle className="mt-0.5 h-5 w-5 text-amber-300" />
              <div>
                <h3 className="font-bold text-amber-100">Complete seu perfil</h3>
                <p className="mt-1 text-sm text-amber-100/80">
                  Esses dados ajudam a encontrar bolsas mais compatíveis com seu perfil.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {missing.map(item => (
                    <span key={item.label} className="rounded-full bg-amber-300/15 px-3 py-1 text-xs font-bold text-amber-100">
                      Adicionar {item.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ProfileSection({
  title,
  rows,
  compact = false,
}: {
  title: string;
  rows: Array<{ icon: React.ElementType; label: string; value: string | null | undefined }>;
  compact?: boolean;
}) {
  return (
    <section>
      <h4 className="mb-4 text-sm font-black">{title}</h4>
      <div className={cn('grid gap-4', compact ? 'md:grid-cols-2' : '')}>
        {rows.map(row => (
          <ProfileInfoRow key={row.label} icon={row.icon} label={row.label} value={row.value} />
        ))}
      </div>
    </section>
  );
}

function ProfileInfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string | null | undefined;
}) {
  const displayValue = value && value.trim() ? value : 'Não informado';
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-1 h-4 w-4 shrink-0 text-gray-500" />
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className={cn('mt-0.5 text-sm font-semibold', displayValue === 'Não informado' ? 'text-gray-500' : 'text-white')}>
          {displayValue}
        </p>
      </div>
    </div>
  );
}

function formatArrayOrText(value: string[] | string | null | undefined) {
  if (!value) return '';
  return Array.isArray(value) ? value.join(', ') : value;
}

function PlaceholderTab({ title, description }: { title: string; description: string }) {
  return (
    <Card className="border-white/10 bg-[#111] text-white">
      <CardContent className="p-8">
        <EmptyState title={title} text={description} />
      </CardContent>
    </Card>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-4 w-12 h-12 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
        <HelpCircle className="w-5 h-5 text-gray-500" />
      </div>
      <h3 className="font-black">{title}</h3>
      <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">{text}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
      <p className="text-[10px] uppercase tracking-widest text-gray-500 font-black">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

export default StudentDashboard;
