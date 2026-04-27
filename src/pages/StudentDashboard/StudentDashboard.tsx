import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowUpRight, Award, Bell, CheckCircle2, ClipboardList, Clock, FileSignature,
  BookOpen, Calendar, Download, Eye, FileText, Gift, Globe, GraduationCap, HelpCircle, Home, Loader2, LogOut, Mail, MapPin, Menu, MessageCircle, PenLine, Phone, Search, Target, Upload, User, Moon, Sun, X
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

const TABS_CONFIG: Array<{ id: StudentDashboardTab; key: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'overview', key: 'student_dashboard.tabs.overview', icon: Home },
  { id: 'applications', key: 'student_dashboard.tabs.applications', icon: ClipboardList },
  { id: 'documents', key: 'student_dashboard.tabs.documents', icon: FileText },
  { id: 'supplemental-data', key: 'student_dashboard.tabs.supplemental_data', icon: FileSignature },
  { id: 'forms', key: 'student_dashboard.tabs.forms', icon: FileSignature },
  { id: 'rewards', key: 'student_dashboard.tabs.rewards', icon: Gift },
  { id: 'support', key: 'student_dashboard.tabs.support', icon: MessageCircle },
  { id: 'profile', key: 'student_dashboard.tabs.profile', icon: User },
];

const isDashboardTab = (value: string | undefined): value is StudentDashboardTab =>
  !!value && TABS_CONFIG.some(tab => tab.id === value);

const getStatusText = (t: any): Record<string, string> => ({
  pending: t('student_dashboard.status.pending'),
  submitted: t('student_dashboard.status.submitted'),
  approved: t('student_dashboard.status.approved'),
  rejected: t('student_dashboard.status.rejected'),
  waiting: t('student_dashboard.status.waiting'),
  payment_pending: t('student_dashboard.status.pending'),
  payment_confirmed: t('student_dashboard.status.approved'),
  pending_admin_approval: t('student_dashboard.status.waiting'),
  signed: t('student_dashboard.status.signed'),
  waiting_signature: t('student_dashboard.status.waiting_signature'),
});

function badgeClass(status: string) {
  if (['payment_confirmed', 'approved', 'submitted', 'signed'].includes(status)) {
    return 'border-emerald-600/30 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300';
  }

  if (['payment_pending', 'pending_admin_approval', 'pending', 'waiting_signature'].includes(status)) {
    return 'border-amber-600/30 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300';
  }

  if (status === 'rejected') {
    return 'border-red-600/30 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300';
  }

  return 'border-[#e3d5bd] bg-[#f3ead9] text-[#6f6251] dark:border-white/10 dark:bg-white/5 dark:text-gray-300';
}

function formatDate(value: string | null | undefined, fallback: string = '-') {
  if (!value) return fallback;
  return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getProgress(profile: any, app: DashboardApplication | null) {
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

function getCurrentStepInfo(profile: any, app: DashboardApplication | null, t: any) {
  const k = 'student_dashboard.step';
  if (!profile?.has_paid_selection_process_fee) return { number: 1, total: 8, title: t(`${k}.1_title`), description: t(`${k}.1_desc`) };
  if (!profile.selection_survey_passed) return { number: 2, total: 8, title: t(`${k}.2_title`), description: t(`${k}.2_desc`) };
  if (!app) return { number: 3, total: 8, title: t(`${k}.3_title`), description: t(`${k}.3_desc`) };
  if (!['approved', 'payment_pending', 'payment_confirmed'].includes(app.status)) return { number: 4, total: 8, title: t(`${k}.4_title`), description: t(`${k}.4_desc`) };
  if (!profile.is_placement_fee_paid && app.status !== 'payment_confirmed') return { number: 5, total: 8, title: t(`${k}.5_title`), description: t(`${k}.5_desc`) };
  if (!profile.is_application_fee_paid) return { number: 6, total: 8, title: t(`${k}.6_title`), description: t(`${k}.6_desc`) };
  if (!profile.documents_uploaded) return { number: 7, total: 8, title: t(`${k}.7_title`), description: t(`${k}.7_desc`) };
  
  const hasLetter = !!app?.acceptance_letter_url;
  return { 
    number: 8, 
    total: 8, 
    title: hasLetter ? t(`${k}.8a_title`) : t(`${k}.8b_title`), 
    description: hasLetter ? t(`${k}.8a_desc`) : t(`${k}.8b_desc`) 
  };
}

function getNextAction(profile: any, app: DashboardApplication | null, t: (key: string) => string) {
  const na = 'student_dashboard.next_action';
  if (!profile?.has_paid_selection_process_fee) return { label: t(`${na}.start`), href: '/student/onboarding?step=selection_fee' };
  if (!profile.selection_survey_passed) return { label: t(`${na}.survey`), href: '/student/onboarding?step=selection_survey' };
  if (!app) return { label: t(`${na}.select_university`), href: '/student/onboarding?step=scholarship_selection' };
  if (!['approved', 'payment_pending', 'payment_confirmed'].includes(app.status)) return { label: t(`${na}.wait_approval`), href: null };
  if (!profile.is_placement_fee_paid && app.status !== 'payment_confirmed') return { label: t(`${na}.pay_placement`), href: '/student/onboarding?step=placement_fee' };
  if (!profile.is_application_fee_paid) return { label: t(`${na}.pay_application`), href: '/student/onboarding?step=payment' };
  if (!profile.documents_uploaded) return { label: t(`${na}.send_docs`), href: '/student/onboarding?step=documents_upload' };
  if (!app.acceptance_letter_url) return { label: t(`${na}.track`), href: '/student/onboarding?step=my_applications' };
  return { label: t(`${na}.view_letter`), href: '/student/onboarding?step=acceptance_letter' };
}

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
  const { t } = useTranslation();
  const step = getCurrentStepInfo(userProfile, application, t);
  const approvedCount = applications.filter(app => ['approved', 'payment_pending', 'payment_confirmed'].includes(app.status)).length;
  const pendingCount = applications.filter(app => ['pending_admin_approval', 'payment_pending'].includes(app.status)).length;
  const profileItems = [
    { label: t('student_dashboard.overview.profile_item_basic'), done: identityComplete },
    { label: t('student_dashboard.overview.profile_item_academic'), done: academicComplete },
    { label: t('student_dashboard.overview.profile_item_docs'), done: documentsComplete },
  ];

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-xl border border-[#CE9F48]/20 bg-gradient-to-br from-white dark:from-[#111] via-[#f6ead2] dark:via-[#151515] to-[#ead6a8] dark:to-[#2a2413] p-6 shadow-sm lg:p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#CE9F48]/30 bg-[#CE9F48]/10">
            <Award className="h-5 w-5 text-[#9a6a16] dark:text-[#CE9F48]" />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight lg:text-2xl">
              {t('student_dashboard.overview.welcome', { name: userProfile?.full_name || userProfile?.email || t('student_dashboard.overview.welcome_fallback') })}
            </h2>
            <p className="text-xs text-[#8a7b66] dark:text-gray-500">{t('student_dashboard.overview.welcome_sub')}</p>
          </div>
        </div>

        <div className="mx-auto mt-9 max-w-2xl text-center">
          <Badge className="mb-5 border-[#CE9F48]/30 bg-[#CE9F48]/10 text-[#9a6a16] dark:text-[#CE9F48]">
            {t('student_dashboard.step.badge', { number: step.number, total: step.total })}
          </Badge>
          <h3 className="text-2xl font-black tracking-tight lg:text-3xl">{step.title}</h3>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[#4b4032] dark:text-gray-300">{step.description}</p>
          <div className="mx-auto mt-7 max-w-sm">
            <Progress value={progress} className="h-2 bg-[#eadbbf] dark:bg-white/10 [&>div]:bg-[#CE9F48]" />
            <p className="mt-2 text-xs text-[#8a7b66] dark:text-gray-500">{t('student_dashboard.step.progress', { value: progress })}</p>
          </div>
          <div className="mx-auto mt-5 grid max-w-xl grid-cols-3 gap-2 text-center">
            <MiniKpi label={t('student_dashboard.overview.kpi_applications')} value={String(applicationCount)} />
            <MiniKpi label={t('student_dashboard.overview.kpi_pending_docs')} value={String(pendingDocuments)} />
            <MiniKpi label={t('student_dashboard.overview.kpi_forms')} value={String(formsCount)} />
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
        <ActionCard
          icon={Search}
          title={t('student_dashboard.overview.card_scholarships_title')}
          subtitle={t('student_dashboard.overview.card_scholarships_sub')}
          metric={application ? t('student_dashboard.overview.card_scholarships_metric_active') : t('student_dashboard.overview.card_scholarships_metric_pending')}
          onClick={() => navigate('/student/onboarding?step=scholarship_selection')}
        />
        <ActionCard
          icon={ClipboardList}
          title={t('student_dashboard.overview.card_applications_title')}
          subtitle={t('student_dashboard.overview.card_applications_sub')}
          metric={t('student_dashboard.overview.card_applications_metric', { approved: approvedCount, pending: pendingCount })}
          onClick={() => navigate('/student/dashboard/applications')}
        />
        <ActionCard
          icon={Target}
          title={t('student_dashboard.overview.card_profile_title')}
          subtitle={t('student_dashboard.overview.card_profile_sub')}
          metric={t('student_dashboard.overview.card_profile_metric', { count: pendingDocuments })}
          onClick={() => navigate('/student/dashboard/profile')}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="border-[#e3d5bd] dark:border-white/10 bg-white dark:bg-[#111] text-[#1f1a14] dark:text-white">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ClipboardList className="w-5 h-5 text-[#9a6a16] dark:text-[#CE9F48]" />
                {t('student_dashboard.overview.recent_title')}
              </CardTitle>
              <p className="mt-1 text-xs text-[#8a7b66] dark:text-gray-500">{t('student_dashboard.overview.recent_sub')}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-[#9a6a16] dark:text-[#CE9F48]">{applicationCount}</p>
              <p className="text-[10px] uppercase tracking-widest text-[#6f6251] dark:text-gray-600">Total</p>
            </div>
          </CardHeader>
          <CardContent>
            {applications.length === 0 ? (
              <div className="flex min-h-[260px] flex-col items-center justify-center text-center">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-[#e3d5bd] dark:border-white/10 bg-[#f3ead9] dark:bg-white/5">
                  <FileText className="h-7 w-7 text-[#8a7b66] dark:text-gray-500" />
                </div>
                <h3 className="text-lg font-black">{t('student_dashboard.overview.empty_title')}</h3>
                <p className="mt-2 max-w-sm text-sm text-[#8a7b66] dark:text-gray-500">{t('student_dashboard.overview.empty_desc')}</p>
                <Button onClick={() => navigate('/student/onboarding?step=scholarship_selection')} className="mt-6 bg-[#CE9F48] text-black hover:bg-[#b8892f]">
                  {t('student_dashboard.overview.cta_start')}
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
          <Card className="border-[#e3d5bd] dark:border-white/10 bg-white dark:bg-[#111] text-[#1f1a14] dark:text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="w-4 h-4 text-[#9a6a16] dark:text-[#CE9F48]" />
                {t('student_dashboard.overview.profile_status_title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {profileItems.map(item => (
                  <div key={item.label} className="flex items-center justify-between text-sm">
                    <span className="text-[#4b4032] dark:text-gray-300">{item.label}</span>
                    {item.done ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Clock className="h-4 w-4 text-amber-400" />}
                  </div>
                ))}
              </div>
              <button
                onClick={() => navigate('/student/dashboard/profile')}
                className="w-full rounded-lg border border-[#CE9F48]/20 bg-[#CE9F48]/10 px-4 py-3 text-left text-sm text-[#9a6a16] dark:text-[#CE9F48] transition-colors hover:bg-[#CE9F48]/15"
              >
                {t('student_dashboard.overview.profile_complete_cta')}
                <span className="mt-1 block text-xs font-bold">{t('student_dashboard.overview.profile_complete_cta_btn')}</span>
              </button>
            </CardContent>
          </Card>

          <Card className="border-[#CE9F48]/20 bg-[#CE9F48] text-black">
            <CardContent className="p-5">
              <h3 className="flex items-center gap-2 font-black">
                <HelpCircle className="h-4 w-4" />
                {t('student_dashboard.overview.tips_title')}
              </h3>
              <ul className="mt-4 space-y-2 text-sm font-medium">
                <li>• {t('student_dashboard.overview.tip_1')}</li>
                <li>• {t('student_dashboard.overview.tip_2')}</li>
                <li>• {t('student_dashboard.overview.tip_3')}</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
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
  const { t } = useTranslation();
  const approvedCount = applications.filter(app => ['approved', 'payment_pending', 'payment_confirmed'].includes(app.status)).length;
  const pendingCount = applications.filter(app => ['pending_admin_approval', 'payment_pending'].includes(app.status)).length;

  if (applications.length === 0) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h2 className="text-2xl font-black tracking-tight">{t('student_dashboard.applications.title')}</h2>
          <p className="mt-1 text-sm text-[#8a7b66] dark:text-gray-500">{t('student_dashboard.applications.subtitle')}</p>
        </div>
        <ApplicationsKpis total={0} approved={0} pending={0} />
        <Card className="border-[#e3d5bd] dark:border-white/10 bg-white dark:bg-[#111] text-[#1f1a14] dark:text-white">
          <CardContent className="p-10">
            <div className="flex min-h-[260px] flex-col items-center justify-center text-center">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-lg border border-[#CE9F48]/20 bg-[#CE9F48]/10">
                <FileText className="h-8 w-8 text-[#9a6a16] dark:text-[#CE9F48]" />
              </div>
              <h3 className="text-xl font-black">{t('student_dashboard.applications.empty_title')}</h3>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-[#8a7b66] dark:text-gray-500">
                {t('student_dashboard.applications.empty_desc')}
              </p>
              <Button onClick={() => navigate('/student/onboarding?step=scholarship_selection')} className="mt-7 bg-[#CE9F48] text-black hover:bg-[#b8892f]">
                {t('student_dashboard.applications.start_process')}
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
        <h2 className="text-2xl font-black tracking-tight">{t('student_dashboard.applications.title')}</h2>
        <p className="mt-1 text-sm text-[#8a7b66] dark:text-gray-500">{t('student_dashboard.applications.subtitle')}</p>
      </div>

      <ApplicationsKpis total={applications.length} approved={approvedCount} pending={pendingCount} />

      <div className="grid gap-4">
        {applications.map(app => {
          const appForms = (forms as any[]).filter(form =>
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

function DocumentsTab({
  documents,
  studentDocuments,
}: {
  documents: DashboardDocument[];
  studentDocuments: DashboardStudentDocument[];
}) {
  const { t } = useTranslation();
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
          <h2 className="text-2xl font-black tracking-tight">{t('student_dashboard.documents.title')}</h2>
          <p className="mt-1 text-sm text-[#8a7b66] dark:text-gray-500">{t('student_dashboard.documents.subtitle')}</p>
        </div>
        <DocumentKpis total={0} submitted={0} approved={0} rejected={0} />
        <Card className="border-[#e3d5bd] dark:border-white/10 bg-white dark:bg-[#111] text-[#1f1a14] dark:text-white">
          <CardContent className="p-10">
            <div className="flex min-h-[260px] flex-col items-center justify-center text-center">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-lg border border-[#CE9F48]/20 bg-[#CE9F48]/10">
                <FileText className="h-8 w-8 text-[#9a6a16] dark:text-[#CE9F48]" />
              </div>
              <h3 className="text-xl font-black">{t('student_dashboard.documents.empty_title')}</h3>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-[#8a7b66] dark:text-gray-500">
                {t('student_dashboard.documents.empty_desc')}
              </p>
              <Button onClick={() => navigate('/student/onboarding?step=documents_upload')} className="mt-7 bg-[#CE9F48] text-black hover:bg-[#b8892f]">
                {t('student_dashboard.documents.btn_go_to_docs')}
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
          <h2 className="text-2xl font-black tracking-tight">{t('student_dashboard.documents.title')}</h2>
          <p className="mt-1 text-sm text-[#8a7b66] dark:text-gray-500">{t('student_dashboard.documents.subtitle')}</p>
        </div>
        <Button onClick={() => navigate('/student/onboarding?step=documents_upload')} className="bg-[#CE9F48] text-black hover:bg-[#b8892f]">
          {t('student_dashboard.documents.btn_submit')}
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

function FormsTab({ forms, application }: { forms: DashboardForm[]; application: DashboardApplication | null }) {
  const { t } = useTranslation();
  const [previewForm, setPreviewForm] = useState<DashboardForm | null>(null);
  const [signingForm, setSigningForm] = useState<DashboardForm | null>(null);
  const visibleForms = forms.filter(form => form.form_type !== 'termo_responsabilidade_estudante');
  const generated = visibleForms.length;
  const signed = visibleForms.filter(form => !!form.signed_at).length;
  const pending = Math.max(generated - signed, 0);

  const markFormPdfOpened = async (form: DashboardForm) => {
    const now = new Date().toISOString();
    const metadata = (form.signature_metadata_json as any) ?? {};
    const currentOpenCount = typeof metadata.pdf_open_count === 'number' ? metadata.pdf_open_count : 0;

    const newMetadata = {
      ...metadata,
      pdf_opened_at: typeof metadata.pdf_opened_at === 'string' ? metadata.pdf_opened_at : now,
      last_pdf_opened_at: now,
      pdf_open_count: currentOpenCount + 1,
    };

    await supabase
      .from('institution_forms')
      .update({ signature_metadata_json: newMetadata })
      .eq('id', form.id);
  };

  if (visibleForms.length === 0) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h2 className="text-2xl font-black tracking-tight">{t('student_dashboard.forms.title')}</h2>
          <p className="mt-1 text-sm text-[#8a7b66] dark:text-gray-500">{t('student_dashboard.forms.sub')}</p>
        </div>
        <FormsKpis generated={0} signed={0} pending={0} />
        <Card className="border-[#e3d5bd] dark:border-white/10 bg-white dark:bg-[#111] text-[#1f1a14] dark:text-white">
          <CardContent className="p-10">
            <div className="flex min-h-[260px] flex-col items-center justify-center text-center">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-lg border border-[#CE9F48]/20 bg-[#CE9F48]/10">
                <FileSignature className="h-8 w-8 text-[#9a6a16] dark:text-[#CE9F48]" />
              </div>
              <h3 className="text-xl font-black">{t('student_dashboard.forms.empty_title')}</h3>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-[#8a7b66] dark:text-gray-500">
                {application?.status === 'payment_confirmed'
                  ? t('student_dashboard.forms.empty_desc_paid')
                  : t('student_dashboard.forms.empty_desc_pending')}
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
        <h2 className="text-2xl font-black tracking-tight">{t('student_dashboard.forms.title')}</h2>
        <p className="mt-1 text-sm text-[#8a7b66] dark:text-gray-500">{t('student_dashboard.forms.sub_desc')}</p>
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
  const { t } = useTranslation();

  const personalRows = [
    { icon: User, label: t('student_dashboard.profile.row_name'), value: userProfile?.full_name || userProfile?.email },
    { icon: Mail, label: t('student_dashboard.profile.row_email'), value: userProfile?.email },
    { icon: Phone, label: t('student_dashboard.profile.row_phone'), value: userProfile?.phone },
    { icon: MapPin, label: t('student_dashboard.profile.row_country'), value: identity?.country },
    { icon: FileText, label: identity?.document_type || t('student_dashboard.profile.row_document'), value: identity?.document_number },
    { icon: Globe, label: t('student_dashboard.profile.row_nationality'), value: identity?.nationality },
  ];

  const academicRows = [
    { icon: BookOpen, label: t('student_dashboard.profile.row_interest'), value: formatArrayOrText(surveyResponse?.interest_areas) },
    { icon: GraduationCap, label: t('student_dashboard.profile.row_formation'), value: surveyResponse?.academic_formation },
    { icon: Target, label: t('student_dashboard.profile.row_process_type'), value: userProfile?.service_type || userProfile?.student_process_type },
    { icon: MessageCircle, label: t('student_dashboard.profile.row_english'), value: surveyResponse?.english_level },
  ];

  const accountRows = [
    { icon: Calendar, label: t('student_dashboard.profile.row_member_since'), value: formatDate((userProfile as any)?.created_at) },
    { icon: CheckCircle2, label: t('student_dashboard.profile.row_completion'), value: t('student_dashboard.profile.row_completion_value', { value: progress }) },
    { icon: ClipboardList, label: t('student_dashboard.profile.row_doc_status'), value: userProfile?.documents_status || t('student_dashboard.status.pending') },
    { icon: User, label: t('student_dashboard.profile.row_dependents'), value: String(userProfile?.num_dependents ?? 0) },
  ];

  const missing = [
    { label: t('student_dashboard.profile.missing_country'), done: !!identity?.country },
    { label: t('student_dashboard.profile.missing_interest'), done: !!(surveyResponse?.interest_areas?.length) },
    { label: t('student_dashboard.profile.missing_formation'), done: !!(surveyResponse?.academic_formation) },
    { label: t('student_dashboard.profile.missing_english'), done: !!surveyResponse?.english_level },
    { label: t('student_dashboard.profile.missing_document'), done: !!identity?.document_number },
  ].filter(item => !item.done);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight">{t('student_dashboard.profile.title')}</h2>
          <p className="mt-1 text-sm text-[#8a7b66] dark:text-gray-500">{t('student_dashboard.profile.subtitle')}</p>
        </div>
        <Button asChild className="bg-[#CE9F48] text-black hover:bg-[#b8892f]">
          <a href="/student/onboarding?step=identity">
            <PenLine className="h-4 w-4" />
            {t('student_dashboard.profile.btn_edit')}
          </a>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-6">
          <Card className="border-[#e3d5bd] dark:border-white/10 bg-white dark:bg-[#111]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-[#8a7b66] dark:text-gray-500">
                {t('student_dashboard.profile.section_personal')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {personalRows.map((row, idx) => {
                const Icon = row.icon;
                return (
                  <div key={idx} className="flex items-center justify-between border-b border-[#f3ead9] dark:border-white/5 pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center gap-3 text-[#1f1a14] dark:text-white">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f3ead9] dark:bg-white/5 text-[#6f6251] dark:text-gray-400">
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-medium">{row.label}</span>
                    </div>
                    <span className="text-sm text-[#6f6251] dark:text-gray-400">{row.value || t('student_dashboard.profile.row_missing')}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="border-[#e3d5bd] dark:border-white/10 bg-white dark:bg-[#111]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-[#8a7b66] dark:text-gray-500">
                {t('student_dashboard.profile.section_academic')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {academicRows.map((row, idx) => {
                const Icon = row.icon;
                return (
                  <div key={idx} className="flex items-center justify-between border-b border-[#f3ead9] dark:border-white/5 pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center gap-3 text-[#1f1a14] dark:text-white">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f3ead9] dark:bg-white/5 text-[#6f6251] dark:text-gray-400">
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-medium">{row.label}</span>
                    </div>
                    <span className="max-w-[150px] truncate text-sm text-[#6f6251] dark:text-gray-400 sm:max-w-[200px]" title={String(row.value || '')}>{row.value || t('student_dashboard.profile.row_missing')}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-[#e3d5bd] dark:border-white/10 bg-white dark:bg-[#111]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-[#8a7b66] dark:text-gray-500">
                {t('student_dashboard.profile.completion_title')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium text-[#1f1a14] dark:text-white">{t('student_dashboard.profile.completion_badge', { progress })}</span>
                <span className="text-[#8a7b66] dark:text-gray-500">
                  {missing.length === 0 ? t('student_dashboard.profile.completion_label') : t('student_dashboard.profile.missing_count', { count: missing.length })}
                </span>
              </div>
              <Progress value={progress} className="h-2 bg-[#eadbbf] dark:bg-white/10" />

              {missing.length > 0 ? (
                <div className="mt-6 rounded-lg border border-[#e3d5bd] dark:border-white/10 bg-[#f3ead9] dark:bg-white/5 p-4">
                  <h4 className="font-medium text-[#1f1a14] dark:text-white">{t('student_dashboard.profile.missing_title')}</h4>
                  <p className="mt-1 text-sm text-[#8a7b66] dark:text-gray-400">{t('student_dashboard.profile.missing_desc')}</p>
                  <ul className="mt-3 space-y-2">
                    {missing.map((item, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-[#1f1a14] dark:text-gray-300">
                        <div className="h-1.5 w-1.5 rounded-full bg-[#CE9F48]" />
                        <span className="capitalize">{item.label}</span>
                      </li>
                    ))}
                  </ul>
                  <Button asChild variant="outline" className="mt-4 w-full border-[#CE9F48]/50 text-[#9a6a16] dark:text-[#CE9F48] hover:bg-[#CE9F48]/10">
                    <a href="/student/onboarding?step=identity">{t('student_dashboard.profile.btn_edit')}</a>
                  </Button>
                </div>
              ) : (
                <div className="mt-6 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    <h4 className="font-medium text-emerald-700 dark:text-emerald-300">{t('student_dashboard.profile.already_verified_title')}</h4>
                  </div>
                  <p className="mt-1 text-sm text-emerald-600/80 dark:text-emerald-300/80">
                    {t('student_dashboard.profile.completion_tip')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-[#e3d5bd] dark:border-white/10 bg-white dark:bg-[#111]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-[#8a7b66] dark:text-gray-500">{t('student_dashboard.profile.section_account')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {accountRows.map((row, idx) => {
                const Icon = row.icon;
                return (
                  <div key={idx} className="flex items-center justify-between border-b border-[#f3ead9] dark:border-white/5 pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center gap-3 text-[#1f1a14] dark:text-white">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f3ead9] dark:bg-white/5 text-[#6f6251] dark:text-gray-400">
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-medium">{row.label}</span>
                    </div>
                    <span className="text-sm text-[#6f6251] dark:text-gray-400">{row.value || t('student_dashboard.profile.row_missing')}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ActionCard({ icon: Icon, title, subtitle, metric, onClick }: { icon: any; title: string; subtitle: string; metric: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="group rounded-lg border border-[#e3d5bd] dark:border-white/10 bg-white dark:bg-[#111] p-4 text-left text-[#1f1a14] dark:text-white transition-colors hover:border-[#CE9F48]/30 hover:bg-[#f8f1e4] dark:hover:bg-[#151515]">
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#CE9F48]/20 bg-[#CE9F48]/10">
          <Icon className="h-5 w-5 text-[#9a6a16] dark:text-[#CE9F48]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-black">{title}</h3>
              <p className="mt-1 text-xs text-[#8a7b66] dark:text-gray-500">{subtitle}</p>
              <p className="mt-2 text-xs text-[#9a6a16] dark:text-[#CE9F48]">{metric}</p>
            </div>
            <ArrowUpRight className="h-4 w-4 text-[#6f6251] dark:text-gray-600 transition-colors group-hover:text-[#9a6a16] dark:group-hover:text-[#CE9F48]" />
          </div>
        </div>
      </div>
    </button>
  );
}

function MiniKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#e3d5bd] dark:border-white/10 bg-black/5 dark:bg-black/20 px-3 py-2">
      <p className="text-lg font-black text-[#1f1a14] dark:text-white">{value}</p>
      <p className="text-[10px] uppercase tracking-widest text-[#8a7b66] dark:text-gray-500">{label}</p>
    </div>
  );
}

function MetricTile({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone: 'gold' | 'green' | 'amber' }) {
  const toneClass = {
    gold: 'border-amber-600/30 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
    green: 'border-emerald-600/30 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
    amber: 'border-amber-600/30 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
  }[tone];

  return (
    <Card className="border-[#e3d5bd] dark:border-white/10 bg-white dark:bg-[#111] text-[#1f1a14] dark:text-white">
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-xs text-[#8a7b66] dark:text-gray-500">{label}</p>
          <p className="mt-2 text-3xl font-black">{value}</p>
        </div>
        <div className={cn('flex h-12 w-12 items-center justify-center rounded-lg border', toneClass)}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function ApplicationCard({ application, documents, forms }: { application: DashboardApplication; documents: DashboardDocument[]; forms: DashboardForm[] }) {
  const { t } = useTranslation();
  const scholarship = application.institution_scholarships;
  const submittedDocs = documents.filter(doc => !!doc.submitted_at || !!doc.submitted_url).length;
  const approvedDocs = documents.filter(doc => doc.status === 'approved').length;
  const signedForms = forms.filter(form => !!form.signed_at).length;
  
  const statusSteps = [
    { label: t('student_dashboard.applications.step_scholarship'), done: ['approved', 'payment_pending', 'payment_confirmed'].includes(application.status) },
    { label: t('student_dashboard.applications.step_placement'), done: application.status === 'payment_confirmed' || !!application.placement_fee_paid_at },
    { label: t('student_dashboard.applications.step_documents'), done: documents.length > 0 && documents.every(doc => doc.status === 'approved') },
    { label: t('student_dashboard.applications.step_forms'), done: forms.length > 0 && forms.every(form => !!form.signed_at) },
  ];

  return (
    <Card className="border-[#e3d5bd] dark:border-white/10 bg-white dark:bg-[#111] text-[#1f1a14] dark:text-white">
      <CardContent className="p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#CE9F48]/20 bg-[#CE9F48]/10">
                <GraduationCap className="h-5 w-5 text-[#9a6a16] dark:text-[#CE9F48]" />
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-lg font-black">{application.institutions?.name ?? t('student_dashboard.applications.university_fallback')}</h3>
                <p className="text-xs text-[#8a7b66] dark:text-gray-500">
                  {[application.institutions?.city, application.institutions?.state].filter(Boolean).join(', ') || '-'}
                </p>
              </div>
              <Badge className={badgeClass(application.status)}>{getStatusText(t)[application.status] ?? application.status}</Badge>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <Info label={t('student_dashboard.applications.info_scholarship')} value={scholarship?.discount_percent ? `${scholarship.discount_percent}%` : '—'} />
              <Info label={t('student_dashboard.applications.info_placement')} value={scholarship?.placement_fee_usd ? `$${scholarship.placement_fee_usd}` : '—'} />
              <Info label={t('student_dashboard.applications.info_tuition')} value={scholarship?.tuition_annual_usd ? `$${scholarship.tuition_annual_usd}` : '—'} />
              <Info label={t('student_dashboard.applications.info_applied_at')} value={formatDate(application.created_at)} />
            </div>
          </div>

          <div className="grid gap-3 text-sm lg:w-80">
            <DocumentStatusLine label={t('student_dashboard.applications.docs_submitted')} value={`${submittedDocs}/${Math.max(documents.length, submittedDocs)}`} done={submittedDocs > 0} />
            <DocumentStatusLine label={t('student_dashboard.applications.docs_approved')} value={`${approvedDocs}/${Math.max(documents.length, approvedDocs)}`} done={documents.length > 0 && approvedDocs === documents.length} />
            <DocumentStatusLine label={t('student_dashboard.applications.forms_signed')} value={`${signedForms}/${Math.max(forms.length, signedForms)}`} done={forms.length > 0 && signedForms === forms.length} />
            <DocumentStatusLine label={t('student_dashboard.applications.info_package_final')} value={application.package_status ?? '-'} done={application.package_status === 'ready' || application.package_status === 'sent'} />
          </div>
        </div>

        <div className="mt-5 grid gap-2 md:grid-cols-4">
          {statusSteps.map(step => (
            <div key={step.label} className={cn(
              'rounded-lg border px-3 py-2 text-xs font-semibold',
              step.done ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-[#e3d5bd] dark:border-white/10 bg-white/70 dark:bg-white/[0.03] text-[#8a7b66] dark:text-gray-500',
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
    <div className="flex items-center justify-between rounded-lg border border-[#e3d5bd] dark:border-white/10 bg-white/70 dark:bg-white/[0.03] px-3 py-2">
      <span className="text-[#6f6251] dark:text-gray-400">{label}</span>
      <span className={cn('font-bold', done ? 'text-emerald-400' : 'text-amber-400')}>{value}</span>
    </div>
  );
}

function ApplicationSummary({ application }: { application: DashboardApplication }) {
  const { t } = useTranslation();
  const scholarship = application.institution_scholarships;
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-lg font-black">{application.institutions?.name ?? t('student_dashboard.applications.university_fallback')}</h3>
          <Badge className={badgeClass(application.status)}>{getStatusText(t)[application.status] ?? application.status}</Badge>
        </div>
        <p className="mt-1 text-sm text-[#8a7b66] dark:text-gray-500">
          {[application.institutions?.city, application.institutions?.state].filter(Boolean).join(', ') || t('student_dashboard.applications.location_fallback')}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Info label={t('student_dashboard.applications.info_scholarship')} value={scholarship?.discount_percent ? `${scholarship.discount_percent}%` : '—'} />
        <Info label={t('student_dashboard.applications.info_placement')} value={scholarship?.placement_fee_usd ? `$${scholarship.placement_fee_usd}` : '—'} />
        <Info label={t('student_dashboard.applications.info_paid_at')} value={formatDate(application.placement_fee_paid_at)} />
        <Info label={t('student_dashboard.applications.info_package')} value={application.package_status ?? 'Pendente'} />
      </div>
    </div>
  );
}

function documentLabel(type: string, t: (key: string, options?: any) => string) {
  return t(`student_dashboard.documents.types.${type}`, {
    defaultValue: type.replace(/_/g, ' '),
  });
}

function DocumentKpis({ total, submitted, approved, rejected }: { total: number; submitted: number; approved: number; rejected: number }) {
  const { t } = useTranslation();
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <MetricTile icon={FileText} label={t('student_dashboard.documents.kpi_requested')} value={String(total)} tone="gold" />
      <MetricTile icon={ArrowUpRight} label={t('student_dashboard.documents.kpi_submitted')} value={String(submitted)} tone="gold" />
      <MetricTile icon={CheckCircle2} label={t('student_dashboard.documents.kpi_approved')} value={String(approved)} tone="green" />
      <MetricTile icon={Clock} label={t('student_dashboard.documents.kpi_pending')} value={String(Math.max(total - approved - rejected, 0))} tone="amber" />
    </div>
  );
}

function DocumentRequestCard({ document }: { document: DashboardDocument }) {
  const { t } = useTranslation();
  const submitted = !!document.submitted_at || !!document.submitted_url;
  return (
    <Card className="border-[#e3d5bd] dark:border-white/10 bg-white dark:bg-[#111] text-[#1f1a14] dark:text-white">
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-4">
            <div className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border',
              document.status === 'approved'
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                : document.status === 'rejected'
                  ? 'border-red-500/20 bg-red-500/10 text-red-300'
                  : 'border-[#CE9F48]/20 bg-[#CE9F48]/10 text-[#9a6a16] dark:text-[#CE9F48]',
            )}>
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-black capitalize">{documentLabel(document.document_type, t)}</h3>
                <Badge className={badgeClass(document.status)}>{getStatusText(t)[document.status] ?? document.status}</Badge>
              </div>
              <p className="mt-1 text-xs text-[#8a7b66] dark:text-gray-500">
                {t('student_dashboard.documents.requested_prefix')} {formatDate(document.requested_at)}
                {document.submitted_at ? ` ${t('student_dashboard.documents.submitted_prefix')} ${formatDate(document.submitted_at)}` : ''}
                {document.approved_at ? ` ${t('student_dashboard.documents.approved_prefix')} ${formatDate(document.approved_at)}` : ''}
              </p>
              {document.rejection_reason && (
                <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {document.rejection_reason}
                </div>
              )}
            </div>
          </div>
          <div className="grid gap-2 text-sm lg:w-56">
            <DocumentStatusLine label={t('student_dashboard.documents.upload_label')} value={submitted ? t('student_dashboard.status.submitted') : t('student_dashboard.status.pending')} done={submitted} />
            <DocumentStatusLine label={t('student_dashboard.documents.review_label')} value={document.status === 'approved' ? t('student_dashboard.status.approved') : document.status === 'rejected' ? t('student_dashboard.status.rejected') : t('student_dashboard.status.waiting')} done={document.status === 'approved'} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StudentDocumentCard({ document }: { document: DashboardStudentDocument }) {
  const { t } = useTranslation();
  const submitted = !!document.uploaded_at || !!document.file_url;
  return (
    <Card className="border-[#e3d5bd] dark:border-white/10 bg-white dark:bg-[#111] text-[#1f1a14] dark:text-white">
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#CE9F48]/20 bg-[#CE9F48]/10 text-[#9a6a16] dark:text-[#CE9F48]">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-black capitalize">{documentLabel(document.type, t)}</h3>
                <Badge className={badgeClass(document.status)}>{getStatusText(t)[document.status] ?? document.status}</Badge>
              </div>
              <p className="mt-1 text-xs text-[#8a7b66] dark:text-gray-500">
                {t('student_dashboard.documents.profile_doc_label')} {document.uploaded_at ? ` ${t('student_dashboard.documents.submitted_prefix')} ${formatDate(document.uploaded_at)}` : ''}
              </p>
              {document.rejection_reason && (
                <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {document.rejection_reason}
                </div>
              )}
            </div>
          </div>
          <div className="lg:w-56">
            <DocumentStatusLine label={t('student_dashboard.documents.upload_label')} value={submitted ? t('student_dashboard.status.submitted') : t('student_dashboard.status.pending')} done={submitted} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ApplicationsKpis({ total, approved, pending }: { total: number; approved: number; pending: number }) {
  const { t } = useTranslation();
  return (
    <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
      <MetricTile icon={FileText} label={t('student_dashboard.applications.kpis.total')} value={String(total)} tone="gold" />
      <MetricTile icon={CheckCircle2} label={t('student_dashboard.applications.kpis.approved')} value={String(approved)} tone="green" />
      <MetricTile icon={Clock} label={t('student_dashboard.applications.kpis.pending')} value={String(pending)} tone="amber" />
    </div>
  );
}

function FormsKpis({ generated, signed, pending }: { generated: number; signed: number; pending: number }) {
  const { t } = useTranslation();
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <MetricTile icon={FileSignature} label={t('student_dashboard.forms.kpis.generated')} value={String(generated)} tone="gold" />
      <MetricTile icon={CheckCircle2} label={t('student_dashboard.forms.kpis.signed')} value={String(signed)} tone="green" />
      <MetricTile icon={PenLine} label={t('student_dashboard.forms.kpis.pending')} value={String(pending)} tone="amber" />
    </div>
  );
}

function FormCard({ form, onPreview, onOpenPdf, onSign }: { form: DashboardForm; onPreview: () => void; onOpenPdf: () => void; onSign: () => void }) {
  const { t } = useTranslation();
  const isSigned = !!form.signed_at;
  return (
    <Card className="border-[#e3d5bd] dark:border-white/10 bg-white dark:bg-[#111] text-[#1f1a14] dark:text-white">
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-4">
            <div className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border',
              isSigned ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' : 'border-[#CE9F48]/20 bg-[#CE9F48]/10 text-[#9a6a16] dark:text-[#CE9F48]',
            )}>
              <FileSignature className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-black">{form.form_type}</h3>
                <Badge className={isSigned ? badgeClass('signed') : badgeClass('waiting_signature')}>
                  {isSigned ? t('student_dashboard.status.signed') : t('student_dashboard.status.waiting_signature')}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-[#8a7b66] dark:text-gray-500">
                {t('student_dashboard.status.generated_at')} {formatDate(form.generated_at)}
                {form.signed_at ? ` · ${t('student_dashboard.status.signed_at')} ${formatDate(form.signed_at)}` : ''}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(form.template_url || form.signed_url) && (
              <Button variant="outline" onClick={onPreview} className="border-[#e3d5bd] dark:border-white/10 bg-[#f3ead9] dark:bg-white/5 text-[#1f1a14] dark:text-white hover:bg-[#eadbbf] dark:hover:bg-white/10">
                <Eye className="h-4 w-4" />
                {t('student_dashboard.forms.btn_review')}
              </Button>
            )}
            {(form.signed_url || form.template_url) && (
              <Button variant="outline" asChild className="border-[#e3d5bd] dark:border-white/10 bg-[#f3ead9] dark:bg-white/5 text-[#1f1a14] dark:text-white hover:bg-[#eadbbf] dark:hover:bg-white/10">
                <a href={(form.signed_url || form.template_url)!} target="_blank" rel="noopener noreferrer" onClick={onOpenPdf}>
                  <Download className="h-4 w-4" />
                  {t('student_dashboard.forms.btn_open')}
                </a>
              </Button>
            )}
            <Button onClick={onSign} disabled={isSigned} className="bg-[#CE9F48] text-black hover:bg-[#b8892f]">
              <Upload className="h-4 w-4" />
              {isSigned ? t('student_dashboard.status.submitted') : t('student_dashboard.forms.btn_send_signed')}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FormSignatureModal({ form, onClose, onSigned }: { form: DashboardForm; onClose: () => void; onSigned: () => void }) {
  const { t } = useTranslation();
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
      const metadata = (form.signature_metadata_json as any) ?? {};
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/95 dark:bg-black/80 p-4">
      <div className="w-full max-w-2xl rounded-lg border border-[#e3d5bd] dark:border-white/10 bg-[#fffaf0] dark:bg-[#0f0f0f] p-5 text-[#1f1a14] dark:text-white shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-black">{t('student_dashboard.forms.modal_title')}</h3>
            <p className="mt-1 text-sm text-[#8a7b66] dark:text-gray-500">{form.form_type}</p>
          </div>
          <Button variant="outline" onClick={onClose} className="border-[#e3d5bd] dark:border-white/10 bg-[#f3ead9] dark:bg-white/5 text-[#1f1a14] dark:text-white hover:bg-[#eadbbf] dark:hover:bg-white/10">
            {t('student_dashboard.forms.modal_close')}
          </Button>
        </div>

        <div className="space-y-4">
          {form.template_url && (
            <Button variant="outline" asChild className="border-[#e3d5bd] dark:border-white/10 bg-[#f3ead9] dark:bg-white/5 text-[#1f1a14] dark:text-white hover:bg-[#eadbbf] dark:hover:bg-white/10">
              <a
                href={form.template_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  const now = new Date().toISOString();
                  const metadata = (form.signature_metadata_json as any) ?? {};
                  const currentOpenCount = typeof metadata.pdf_open_count === 'number' ? metadata.pdf_open_count : 0;
                  const newMetadata = {
                    ...metadata,
                    pdf_opened_at: typeof metadata.pdf_opened_at === 'string' ? metadata.pdf_opened_at : now,
                    last_pdf_opened_at: now,
                    pdf_open_count: currentOpenCount + 1,
                  };
                  void supabase
                    .from('institution_forms')
                    .update({ signature_metadata_json: newMetadata })
                    .eq('id', form.id);
                }}
              >
                <Download className="h-4 w-4" />
                {t('student_dashboard.forms.modal_download_orig')}
              </a>
            </Button>
          )}

          <label className="block rounded-lg border border-dashed border-[#d8c5a3] dark:border-white/15 bg-white/70 dark:bg-white/[0.03] p-5">
            <span className="text-sm font-bold">{t('student_dashboard.forms.modal_signed_file')}</span>
            <span className="mt-1 block text-xs text-[#8a7b66] dark:text-gray-500">
              {t('student_dashboard.forms.modal_signed_desc')}
            </span>
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/jpg"
              className="mt-4 block w-full text-sm text-[#4b4032] dark:text-gray-300 file:mr-4 file:rounded-md file:border-0 file:bg-[#CE9F48] file:px-4 file:py-2 file:text-sm file:font-bold file:text-black"
              disabled={uploading || saving || !!uploadedUrl}
              onChange={event => {
                setSelectedFile(event.target.files?.[0] ?? null);
                setUploadedUrl(null);
                setError(null);
              }}
            />
          </label>

          {selectedFile && !uploadedUrl && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-[#e3d5bd] dark:border-white/10 bg-white/70 dark:bg-white/[0.03] px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{selectedFile.name}</p>
                <p className="text-xs text-[#8a7b66] dark:text-gray-500">{Math.ceil(selectedFile.size / 1024)} KB</p>
              </div>
              <Button onClick={handleUpload} disabled={uploading} className="bg-[#CE9F48] text-black hover:bg-[#b8892f]">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {t('student_dashboard.forms.modal_btn_upload')}
              </Button>
            </div>
          )}

          {uploadedUrl && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-300" />
                <div>
                  <p className="text-sm font-bold text-emerald-200">{t('student_dashboard.forms.modal_upload_success')}</p>
                  <p className="mt-1 text-xs leading-relaxed text-emerald-100/80">
                    {t('student_dashboard.forms.modal_upload_confirm_desc')}
                  </p>
                </div>
              </div>
            </div>
          )}

        {error && <p className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

        <div className="mt-5 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={saving} className="border-[#e3d5bd] dark:border-white/10 bg-[#f3ead9] dark:bg-white/5 text-[#1f1a14] dark:text-white hover:bg-[#eadbbf] dark:hover:bg-white/10">
            {t('student_dashboard.forms.modal_btn_cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={!uploadedUrl || saving} className="bg-[#CE9F48] text-black hover:bg-[#b8892f]">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}
            {t('student_dashboard.forms.modal_btn_confirm')}
          </Button>
        </div>
        </div>
      </div>
    </div>
  );
}

function PlaceholderTab({ title, description }: { title: string; description: string }) {
  return (
    <Card className="border-[#e3d5bd] dark:border-white/10 bg-white dark:bg-[#111]">
      <CardContent className="p-8">
        <EmptyState title={title} text={description} />
      </CardContent>
    </Card>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f3ead9] dark:bg-white/5">
        <FileText className="h-8 w-8 text-[#9a6a16] dark:text-[#CE9F48]" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-[#1f1a14] dark:text-white">{title}</h3>
        <p className="mt-1 text-sm text-[#8a7b66] dark:text-gray-400">{text}</p>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#e3d5bd] dark:border-white/10 bg-[#f3ead9] dark:bg-white/[0.03] px-3 py-2">
      <p className="text-[10px] uppercase tracking-widest text-[#8a7b66] dark:text-gray-500 font-black">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[#1f1a14] dark:text-white">{value}</p>
    </div>
  );
}

function formatArrayOrText(value: string[] | string | null | undefined) {
  if (!value) return '';
  return Array.isArray(value) ? value.join(', ') : value;
}

const StudentDashboard = () => {
  const navigate = useNavigate();
  const { tab } = useParams<{ tab: string }>();
  const { userProfile, signOut } = useStudentAuth();
  const { t } = useTranslation();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() =>
    document.documentElement.classList.contains('dark')
  );

  const activeTab = isDashboardTab(tab) ? tab : 'overview';

  const {
    data,
    activeApplication,
    loading,
  } = useStudentDashboard();

  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark';
    setIsDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    setIsDarkMode(prev => {
      const next = !prev;
      document.documentElement.classList.toggle('dark', next);
      localStorage.setItem('theme', next ? 'dark' : 'light');
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white dark:bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-[#9a6a16] dark:text-[#CE9F48]" />
      </div>
    );
  }

  const nextAction = getNextAction(userProfile, activeApplication, t);
  const progress = getProgress(userProfile, activeApplication);

  const renderTab = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <OverviewTab
            progress={progress}
            nextAction={nextAction}
            application={activeApplication}
            applicationCount={data.applications.length}
            pendingDocuments={data.documents.filter(d => d.status !== 'approved').length + data.studentDocuments.filter(d => d.status !== 'approved').length}
            formsCount={data.forms.length}
            applications={data.applications}
            identityComplete={!!data.identity?.document_number}
            academicComplete={!!data.surveyResponse?.academic_formation}
            documentsComplete={data.documents.length > 0 && data.documents.every(d => d.status === 'approved')}
          />
        );
      case 'applications':
        return (
          <ApplicationsTab
            applications={data.applications}
            documents={data.documents}
            forms={data.forms}
          />
        );
      case 'documents':
        return (
          <DocumentsTab
            documents={data.documents}
            studentDocuments={data.studentDocuments}
          />
        );
      case 'forms':
        return (
          <FormsTab
            forms={data.forms}
            application={activeApplication}
          />
        );
      case 'rewards':
        return <StudentRewardsPanel />;
      case 'support':
        return <StudentSupportPanel />;
      case 'profile':
        return (
          <ProfileTab
            progress={progress}
            identity={data.identity}
            surveyResponse={data.surveyResponse}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f4ee] dark:bg-[#0a0a0a] text-[#1f1a14] dark:text-white">
      {mobileSidebarOpen && (
        <button
          type="button"
          aria-label={t('student_dashboard.nav.close_menu', { defaultValue: 'Fechar menu' })}
          className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[1px] lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed left-0 top-0 z-[60] h-full w-72 border-r border-[#e3d5bd] bg-[#fffaf0] transition-transform duration-200 dark:border-white/10 dark:bg-[#0d0d0d] lg:z-40 lg:translate-x-0',
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex h-full flex-col p-6">
          <div className="flex items-center justify-between gap-3 px-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#CE9F48]">
                <Award className="h-6 w-6 text-black" />
              </div>
              <span className="text-xl font-black tracking-tight">MIGMA</span>
            </div>
            <button
              type="button"
              aria-label={t('student_dashboard.nav.close_menu', { defaultValue: 'Fechar menu' })}
              className="rounded-lg p-2 text-[#6f6251] hover:bg-[#f3ead9] dark:text-gray-400 dark:hover:bg-white/5 lg:hidden"
              onClick={() => setMobileSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="mt-10 flex-1 space-y-1">
            {TABS_CONFIG.map(item => (
              <button
                key={item.id}
                onClick={() => {
                  navigate(`/student/dashboard/${item.id}`);
                  setMobileSidebarOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-bold transition-all',
                  activeTab === item.id
                    ? 'bg-[#CE9F48] text-black shadow-lg shadow-[#CE9F48]/20'
                    : 'text-[#6f6251] hover:bg-[#f3ead9] dark:text-gray-400 dark:hover:bg-white/5'
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span className="min-w-0 flex-1 truncate whitespace-nowrap">{t(item.key)}</span>
              </button>
            ))}
          </nav>

          <div className="mt-auto space-y-2 pt-6 border-t border-[#f3ead9] dark:border-white/5">
            <button
              onClick={() => signOut()}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
            >
              <LogOut className="h-5 w-5 shrink-0" />
              <span className="min-w-0 flex-1 truncate whitespace-nowrap">{t('student_dashboard.nav.logout', { defaultValue: 'Sair' })}</span>
            </button>
          </div>
        </div>
      </aside>

      <main className="lg:ml-72">
        <header className="fixed left-0 right-0 top-0 z-50 flex h-16 items-center justify-between border-b border-[#e3d5bd] bg-white/90 px-3 backdrop-blur-md dark:border-white/10 dark:bg-[#0a0a0a]/90 sm:px-6 lg:left-72">
          <div className="flex items-center gap-2 sm:gap-4 lg:hidden">
            <button
              type="button"
              aria-label={t('student_dashboard.nav.open_menu', { defaultValue: 'Abrir menu' })}
              className="rounded-lg p-2 text-[#6f6251] hover:bg-[#f3ead9] dark:text-gray-400 dark:hover:bg-white/5"
              onClick={() => setMobileSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#CE9F48]">
              <Award className="h-5 w-5 text-black" />
            </div>
            <span className="hidden text-lg font-black sm:inline">MIGMA</span>
          </div>

          <div className="hidden items-center gap-2 text-sm font-bold text-[#8a7b66] dark:text-gray-500 lg:flex">
             {t('student_dashboard.portal_label')}
             <span className="mx-2 text-[#eadbbf] dark:text-white/10">/</span>
             <span className="text-[#1f1a14] dark:text-white capitalize">{activeTab.replace('-', ' ')}</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
             <button
               onClick={toggleDarkMode}
               className="p-2 rounded-lg text-[#6f6251] dark:text-gray-400 hover:bg-[#f3ead9] dark:hover:bg-white/5 transition-colors"
               title={isDarkMode ? t('theme.light', { defaultValue: 'Light Mode' }) : t('theme.dark', { defaultValue: 'Dark Mode' })}
             >
               {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
             </button>
             <LanguageSelector />
             <div className="hidden h-8 w-[1px] bg-[#eadbbf] dark:bg-white/10 sm:block" />
             <div className="hidden items-center gap-3 sm:flex">
               <div className="text-right hidden sm:block">
                 <p className="text-xs font-black">{userProfile?.full_name}</p>
                 <p className="text-[10px] text-[#8a7b66] dark:text-gray-500 capitalize">{userProfile?.student_process_type || 'Estudante'}</p>
               </div>
               <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#b8892f] dark:border-[#CE9F48] bg-[#f3ead9] dark:bg-white/5">
                 <User className="h-5 w-5 text-[#9a6a16] dark:text-[#CE9F48]" />
               </div>
             </div>
          </div>
        </header>

        <div className="p-6 pt-24 lg:p-10 lg:pt-24">
          {renderTab()}
        </div>
      </main>
    </div>
  );
};

export default StudentDashboard;
