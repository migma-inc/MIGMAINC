import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SignaturePad from 'signature_pad';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { PdfSignatureViewer, type SignaturePlacement } from '@/components/ui/pdf-signature-viewer';
import {
  Star, Briefcase, AlertCircle, ArrowUpRight, Award, CheckCircle2, ClipboardList, Clock, FileSignature,
  BookOpen, Calendar, Camera, Download, Eye, FileText, Gift, Globe, GraduationCap, HelpCircle, Home, Loader2, LogOut, Mail, MapPin, Menu, MessageCircle, PenLine, Phone, Search, Save, Target, Timer, Undo2, Upload, User, Moon, Sun, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { LanguageSelector } from '@/components/LanguageSelector';
import { cn } from '@/lib/utils';
import { useStudentAuth } from '@/contexts/StudentAuthContext';
import { supabase } from '@/lib/supabase';
import { getSecureUrl } from '@/lib/storage';
import { DocumentViewerModal } from '@/components/DocumentViewerModal';
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
  type DashboardComplementaryData,
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

// Document types that only apply to Transfer students (spec 11.5 / 14.1)
const TRANSFER_ONLY_DOC_TYPES = new Set(['current_i20']);

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

function isPdfUrl(value: string | null | undefined) {
  if (!value) return false;
  return value.split('?')[0].toLowerCase().endsWith('.pdf');
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

const MAX_SIGNATURE_PHOTO_SIZE = 5 * 1024 * 1024;
const ALLOWED_SIGNATURE_PHOTO_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png']);
type SignatureEvidenceKind = 'document_front' | 'document_back' | 'selfie_doc';
type SignatureEvidenceUpload = {
  kind: SignatureEvidenceKind;
  label: string;
  file: File;
  path: string;
  url: string;
  sha256: string;
};

const SIGNATURE_EVIDENCE_REQUIREMENTS: Array<{ kind: SignatureEvidenceKind; label: string; description: string; capture?: 'user' | 'environment' }> = [
  {
    kind: 'document_front',
    label: 'Document Front',
    description: 'Foto da frente do documento.',
    capture: 'environment',
  },
  {
    kind: 'document_back',
    label: 'Document Back',
    description: 'Foto do verso do documento.',
    capture: 'environment',
  },
  {
    kind: 'selfie_doc',
    label: 'Selfie with document',
    description: 'Foto do seu rosto segurando o documento.',
    capture: 'user',
  },
];

const SIGNATURE_PLACEMENTS: Record<string, SignaturePlacement> = {
  enrollment_agreement:                    { pageIndex:  0, x: 60,  y: 80,  width: 220, height: 55 },
  affidavit_of_financial_support:          { pageIndex:  0, x: 60,  y: 80,  width: 220, height: 55 },
  all_statements_and_agreement:            { pageIndex:  0, x: 60,  y: 80,  width: 220, height: 55 },
  i20_request_form:                        { pageIndex:  0, x: 120, y: 80,  width: 180, height: 50 },
  tuition_refund_policy:                   { pageIndex:  0, x: 90,  y: 80,  width: 200, height: 55 },
  scholarship_support_compliance_agreement:{ pageIndex: -1, x: 90,  y: 80,  width: 200, height: 55 },
  application_for_admission:               { pageIndex: -1, x: 60,  y: 80,  width: 220, height: 55 },
  statement_of_institutional_purpose:      { pageIndex:  0, x: 60,  y: 40,  width: 220, height: 55 },
  letter_of_recommendation:               { pageIndex:  0, x: 60,  y: 80,  width: 220, height: 55 },
  application_packet:                      { pageIndex:  0, x: 60,  y: 80,  width: 220, height: 55 },
};

const SIGNATURE_PLACEMENT_FALLBACK: SignaturePlacement = { pageIndex: -1, x: 0, y: 74, width: 210, height: 55 };

function getSignaturePlacement(formType: string, totalPages: number): SignaturePlacement {
  const mapped = SIGNATURE_PLACEMENTS[formType];
  if (mapped) return mapped;
  return { ...SIGNATURE_PLACEMENT_FALLBACK, pageIndex: totalPages - 1 };
}

async function createSignedPdfBlob({
  templateUrl,
  signatureBlob,
  evidenceFiles,
  signerName,
  signedAt,
  formType,
  placement,
}: {
  templateUrl: string;
  signatureBlob: Blob;
  evidenceFiles: Array<{ kind: SignatureEvidenceKind; label: string; file: File }>;
  signerName: string | null | undefined;
  signedAt: string;
  formType: string;
  placement?: SignaturePlacement;
}): Promise<{ blob: Blob; templateBytes: ArrayBuffer; signatureBytes: ArrayBuffer; evidenceBytes: Record<SignatureEvidenceKind, ArrayBuffer>; signedBytes: ArrayBuffer }> {
  const secureTemplateUrl = await getSecureUrl(templateUrl);
  if (!secureTemplateUrl) throw new Error('URL segura do PDF original nao encontrada.');
  const [templateBytes, signatureBytes, evidenceBytePairs] = await Promise.all([
    fetch(secureTemplateUrl).then(response => {
      if (!response.ok) throw new Error('Erro ao carregar PDF original para assinatura.');
      return response.arrayBuffer();
    }),
    signatureBlob.arrayBuffer(),
    Promise.all(evidenceFiles.map(async evidence => [evidence.kind, await evidence.file.arrayBuffer()] as const)),
  ]);
  const evidenceBytes = Object.fromEntries(evidenceBytePairs) as Record<SignatureEvidenceKind, ArrayBuffer>;

  const pdfDoc = await PDFDocument.load(templateBytes);
  const signatureImage = await pdfDoc.embedPng(signatureBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();

  const resolved = placement ?? getSignaturePlacement(formType, pages.length);
  const pageIndex = resolved.pageIndex === -1
    ? pages.length - 1
    : Math.min(Math.max(resolved.pageIndex, 0), pages.length - 1);
  const page = pages[pageIndex];
  const { width: pageWidth } = page.getSize();

  const signatureWidth = Math.min(resolved.width, pageWidth - 96);
  const signatureHeight = signatureWidth / Math.max(signatureImage.width / signatureImage.height, 2.8);
  const x = resolved.x;
  const y = resolved.y;

  page.drawImage(signatureImage, {
    x,
    y,
    width: signatureWidth,
    height: signatureHeight,
  });
  page.drawLine({
    start: { x, y: y - 5 },
    end: { x: x + signatureWidth, y: y - 5 },
    thickness: 0.7,
    color: rgb(0.18, 0.16, 0.13),
  });
  page.drawText(signerName || 'Aluno MIGMA', {
    x,
    y: y - 19,
    size: 8,
    font,
    color: rgb(0.25, 0.23, 0.2),
  });
  page.drawText(`Assinado via MIGMA em ${new Date(signedAt).toLocaleString('pt-BR')} - ${formType}`, {
    x,
    y: y - 31,
    size: 6.5,
    font,
    color: rgb(0.42, 0.38, 0.32),
  });

  for (const evidence of evidenceFiles) {
    const evidenceImage = evidence.file.type === 'image/png'
      ? await pdfDoc.embedPng(evidenceBytes[evidence.kind])
      : await pdfDoc.embedJpg(evidenceBytes[evidence.kind]);
    const evidencePage = pdfDoc.addPage([612, 792]);
    const evidenceMargin = 54;
    evidencePage.drawText('MIGMA - Evidence of Electronic Signature', {
      x: evidenceMargin,
      y: 735,
      size: 16,
      font,
      color: rgb(0.18, 0.16, 0.13),
    });
    evidencePage.drawText(`Signer: ${signerName || 'Aluno MIGMA'}`, {
      x: evidenceMargin,
      y: 705,
      size: 10,
      font,
      color: rgb(0.25, 0.23, 0.2),
    });
    evidencePage.drawText(`Form: ${formType}`, {
      x: evidenceMargin,
      y: 688,
      size: 10,
      font,
      color: rgb(0.25, 0.23, 0.2),
    });
    evidencePage.drawText(`Signed at: ${new Date(signedAt).toLocaleString('pt-BR')}`, {
      x: evidenceMargin,
      y: 671,
      size: 10,
      font,
      color: rgb(0.25, 0.23, 0.2),
    });
    evidencePage.drawText(`${evidence.label} submitted by the signer:`, {
      x: evidenceMargin,
      y: 640,
      size: 11,
      font,
      color: rgb(0.18, 0.16, 0.13),
    });
    const maxPhotoWidth = 420;
    const maxPhotoHeight = 460;
    const photoScale = Math.min(maxPhotoWidth / evidenceImage.width, maxPhotoHeight / evidenceImage.height, 1);
    const photoWidth = evidenceImage.width * photoScale;
    const photoHeight = evidenceImage.height * photoScale;
    evidencePage.drawImage(evidenceImage, {
      x: evidenceMargin,
      y: 600 - photoHeight,
      width: photoWidth,
      height: photoHeight,
    });
    evidencePage.drawText('This file is stored as signing evidence together with the signed PDF metadata.', {
      x: evidenceMargin,
      y: Math.max(70, 585 - photoHeight),
      size: 8,
      font,
      color: rgb(0.42, 0.38, 0.32),
    });
  }

  pdfDoc.setTitle(`${formType} - assinado`);
  pdfDoc.setSubject('Documento assinado eletronicamente pelo Student Dashboard MIGMA');
  pdfDoc.setProducer('MIGMA Student Dashboard');
  pdfDoc.setModificationDate(new Date(signedAt));

  const signedUint8 = await pdfDoc.save();
  const signedBytes = signedUint8.buffer.slice(
    signedUint8.byteOffset,
    signedUint8.byteOffset + signedUint8.byteLength,
  ) as ArrayBuffer;
  return {
    blob: new Blob([signedBytes], { type: 'application/pdf' }),
    templateBytes,
    signatureBytes,
    evidenceBytes,
    signedBytes,
  };
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
    !!app?.acceptance_letter_url &&
      !(app.placement_fee_installments === 2 && !app.placement_fee_2nd_installment_paid_at),
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
  
  const is2ndPending = app?.placement_fee_installments === 2 && !app?.placement_fee_2nd_installment_paid_at;
  const hasLetter = !!app?.acceptance_letter_url && !is2ndPending;
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
  if (!profile.documents_uploaded) return { label: t(`${na}.send_docs`), href: '/student/dashboard/documents' };
  if (app.placement_fee_installments === 2 && !app.placement_fee_2nd_installment_paid_at)
    return { label: 'Pagar 2ª parcela do Placement Fee', href: '/student/dashboard/payment/placement-fee-2nd' };
  if (!app.acceptance_letter_url) return { label: t(`${na}.track`), href: '/student/dashboard/documents' };
  return { label: t(`${na}.view_letter`), href: '/student/dashboard/documents' };
}

function DeadlineCountdown() {
  const { userProfile } = useStudentAuth();

  const deadline = useMemo(() => {
    const svc = userProfile?.service_type ?? userProfile?.student_process_type;
    if (svc === 'transfer' && userProfile?.transfer_deadline_date) {
      const target = new Date(userProfile.transfer_deadline_date);
      const today = new Date(); today.setHours(0, 0, 0, 0); target.setHours(0, 0, 0, 0);
      const days = Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
      return { type: 'transfer' as const, label: 'Prazo de Transferência', days, date: target.toLocaleDateString('pt-BR') };
    }
    if (svc === 'cos' && userProfile?.cos_i94_expiry_date) {
      const target = new Date(userProfile.cos_i94_expiry_date);
      const today = new Date(); today.setHours(0, 0, 0, 0); target.setHours(0, 0, 0, 0);
      const days = Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
      return { type: 'cos' as const, label: 'Vencimento do I-94', days, date: target.toLocaleDateString('pt-BR') };
    }
    return null;
  }, [userProfile]);

  if (!deadline) return null;

  const urgency =
    deadline.days <= 7 ? 'critical' :
    deadline.days <= 15 ? 'high' :
    deadline.days <= (deadline.type === 'cos' ? 60 : 30) ? 'medium' : 'ok';

  const colors = {
    critical: { border: 'border-red-500/30 bg-red-500/10', icon: 'bg-red-500/20 text-red-400', num: 'text-red-400', badge: 'bg-red-500/20 text-red-400 border-red-500/30' },
    high:     { border: 'border-amber-500/30 bg-amber-500/10', icon: 'bg-amber-500/20 text-amber-400', num: 'text-amber-400', badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
    medium:   { border: 'border-yellow-500/30 bg-yellow-500/10', icon: 'bg-yellow-500/20 text-yellow-400', num: 'text-yellow-300', badge: '' },
    ok:       { border: 'border-[#CE9F48]/20 bg-[#CE9F48]/5', icon: 'bg-[#CE9F48]/10 text-[#9a6a16] dark:text-[#CE9F48]', num: 'text-[#1f1a14] dark:text-white', badge: '' },
  }[urgency];

  return (
    <div className={`rounded-xl border p-4 ${colors.border}`}>
      <div className="flex items-center gap-4">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${colors.icon}`}>
          <Timer className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black uppercase tracking-widest text-[#8a7b66] dark:text-gray-500">
              {deadline.label}
            </span>
            {urgency === 'critical' && (
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${colors.badge}`}>URGENTE</span>
            )}
            {urgency === 'high' && (
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${colors.badge}`}>ATENÇÃO</span>
            )}
          </div>
          <div className={`text-4xl font-black tabular-nums mt-0.5 ${colors.num}`}>
            {Math.max(deadline.days, 0)}
            <span className="text-sm font-medium text-[#8a7b66] dark:text-gray-500 ml-1">
              {deadline.days === 1 ? 'dia restante' : 'dias restantes'}
            </span>
          </div>
          <p className="text-xs text-[#8a7b66] dark:text-gray-500 mt-0.5">{deadline.date}</p>
          {deadline.days <= 0 && (
            <p className="mt-1 text-sm font-semibold text-red-400 flex items-center gap-1">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {deadline.type === 'transfer' ? 'Prazo de transferência expirado' : 'Vencimento do I-94 expirado — contate a Migma imediatamente'}
            </p>
          )}
          {deadline.days > 0 && urgency !== 'ok' && (
            <p className={`mt-1 text-sm font-medium flex items-center gap-1 ${colors.num}`}>
              <AlertCircle className="h-4 w-4 shrink-0" />
              {deadline.type === 'transfer' ? 'Seu prazo de transferência está próximo' : 'O vencimento do seu I-94 está próximo — aja com urgência'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
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
  onRefresh,
  openViewer,
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
  onRefresh: () => Promise<void>;
  openViewer: (url: string | null, title: string) => void;
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
      <DeadlineCountdown />
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

      {userProfile?.student_process_type === 'transfer' && application && (
        <TransferFormOverview
          application={application}
          onRefresh={onRefresh}
          openViewer={openViewer}
          compact={true}
        />
      )}

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
  onRefresh,
  serviceType,
  openViewer,
  application,
}: {
  documents: DashboardDocument[];
  studentDocuments: DashboardStudentDocument[];
  onRefresh: () => Promise<void>;
  serviceType: string | null | undefined;
  openViewer: (url: string | null, title: string) => void;
  application: DashboardApplication | null;
}) {
  const { t } = useTranslation();

  // Filter Transfer-only docs for COS students
  const visibleDocuments = serviceType === 'cos'
    ? documents.filter(doc => !TRANSFER_ONLY_DOC_TYPES.has(doc.document_type))
    : documents;

  const total = visibleDocuments.length + studentDocuments.length;
  const submitted = visibleDocuments.filter(doc => !!doc.submitted_at || !!doc.submitted_url).length +
    studentDocuments.filter(doc => !!doc.uploaded_at || !!doc.file_url).length;
  const approved = visibleDocuments.filter(doc => doc.status === 'approved').length +
    studentDocuments.filter(doc => doc.status === 'approved').length;
  const rejected = visibleDocuments.filter(doc => doc.status === 'rejected').length +
    studentDocuments.filter(doc => doc.status === 'rejected').length;

  const showAcceptanceLetter = !!application && (
    !!application.acceptance_letter_url || application.package_status === 'sent' || application.package_status === 'ready'
  );
  const showTransferForm = !!application && serviceType === 'transfer' && (
    !!application.transfer_form_url || !!application.transfer_form_filled_url
  );

  if (total === 0 && !showAcceptanceLetter && !showTransferForm) {
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
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h2 className="text-2xl font-black tracking-tight">{t('student_dashboard.documents.title')}</h2>
        <p className="mt-1 text-sm text-[#8a7b66] dark:text-gray-500">{t('student_dashboard.documents.subtitle')}</p>
      </div>

      <DocumentKpis total={total} submitted={submitted} approved={approved} rejected={rejected} />

      {/* Carta de Aceite e Transfer Form no topo da lista */}
      {(showAcceptanceLetter || showTransferForm) && (
        <div className="space-y-4">
          {showAcceptanceLetter && (
            <AcceptanceLetterCard application={application!} openViewer={openViewer} />
          )}
          {showTransferForm && (
            <TransferFormOverview application={application!} onRefresh={onRefresh} openViewer={openViewer} />
          )}
        </div>
      )}

      {total > 0 && (
        <div className="grid gap-4">
          {visibleDocuments.map(doc => (
            <DocumentRequestCard key={doc.id} document={doc} onUploaded={onRefresh} isTransferOnly={TRANSFER_ONLY_DOC_TYPES.has(doc.document_type)} openViewer={openViewer} />
          ))}
          {studentDocuments.map(doc => (
            <StudentDocumentCard key={doc.id} document={doc} onUploaded={onRefresh} openViewer={openViewer} />
          ))}
        </div>
      )}
    </div>
  );
}

function FormsTab({ 
  forms, 
  application,
  openViewer,
}: { 
  forms: DashboardForm[]; 
  application: DashboardApplication | null;
  openViewer: (url: string | null, title: string) => void;
}) {
  const { t } = useTranslation();
  const [previewForm] = useState<DashboardForm | null>(null);
  const [signingForm, setSigningForm] = useState<DashboardForm | null>(null);
  const visibleForms = forms;
  const previewPdfUrl = previewForm ? (isPdfUrl(previewForm.signed_url) ? previewForm.signed_url : previewForm.template_url) : null;
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
              openViewer(previewPdfUrl, form.form_type);
            }}
            onOpenPdf={() => {
              void markFormPdfOpened(form);
              openViewer(form.signed_url || form.template_url, form.form_type);
            }}
            onSign={() => setSigningForm(form)}
          />
        ))}
      </div>


      {signingForm && (
        <FormSignatureModal
          form={signingForm}
          onClose={() => setSigningForm(null)}
          onSigned={() => window.location.reload()}
          openViewer={openViewer}
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

function SupplementalDataTab({ data, onRefresh }: { data: DashboardComplementaryData | null; onRefresh: () => Promise<void> }) {
  const { t } = useTranslation();
  const { userProfile } = useStudentAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<DashboardComplementaryData>>({});

  // Sincronizar dados quando o modo edição é ativado
  useEffect(() => {
    if (isEditing && data) {
      setFormData(data);
    }
  }, [isEditing, data]);

  const handleSave = async () => {
    if (!userProfile?.id) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('student_complementary_data')
        .upsert({
          profile_id: userProfile.id,
          ...formData,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
      await onRefresh();
      setIsEditing(false);
    } catch (err) {
      console.error('Error saving complementary data:', err);
      alert('Erro ao salvar dados. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!data && !isEditing) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-black tracking-tight">{t('student_dashboard.tabs.supplemental_data')}</h2>
            <p className="mt-1 text-sm text-[#8a7b66] dark:text-gray-500">Informações adicionais para sua candidatura universitária.</p>
          </div>
        </div>
        <Card className="border-[#e3d5bd] dark:border-white/10 bg-white dark:bg-[#111] text-[#1f1a14] dark:text-white">
          <CardContent className="p-10">
            <div className="flex min-h-[260px] flex-col items-center justify-center text-center">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-lg border border-[#CE9F48]/20 bg-[#CE9F48]/10">
                <FileSignature className="h-8 w-8 text-[#9a6a16] dark:text-[#CE9F48]" />
              </div>
              <h3 className="text-xl font-black">{t('student_dashboard.profile.missing_title')}</h3>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-[#8a7b66] dark:text-gray-500">
                Você ainda não preencheu seus dados complementares.
              </p>
              <Button onClick={() => setIsEditing(true)} className="mt-6 bg-[#CE9F48] text-black hover:bg-[#b8892f]">
                Preencher Agora
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black tracking-tight">Editar Dados Complementares</h2>
            <p className="text-sm text-[#8a7b66] dark:text-gray-500">Atualize suas informações de contato e perfil acadêmico.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsEditing(false)} disabled={isSaving}>
              <Undo2 className="mr-2 h-4 w-4" /> Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="bg-[#CE9F48] text-black hover:bg-[#b8892f]">
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar Alterações
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Contato de Emergência */}
          <Card className="border-[#e3d5bd] dark:border-white/10 bg-white dark:bg-[#111]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Phone className="h-5 w-5 text-[#CE9F48]" /> Contato de Emergência
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>Nome Completo</Label>
                <Input 
                  value={formData.emergency_contact_name || ''} 
                  onChange={e => setFormData({ ...formData, emergency_contact_name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Parentesco</Label>
                <Input 
                  value={formData.emergency_contact_relationship || ''} 
                  onChange={e => setFormData({ ...formData, emergency_contact_relationship: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>WhatsApp / Telefone</Label>
                <Input 
                  value={formData.emergency_contact_phone || ''} 
                  onChange={e => setFormData({ ...formData, emergency_contact_phone: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Endereço Completo</Label>
                <Textarea 
                  value={formData.emergency_contact_address || ''} 
                  onChange={e => setFormData({ ...formData, emergency_contact_address: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Patrocinador Financeiro */}
          <Card className="border-[#e3d5bd] dark:border-white/10 bg-white dark:bg-[#111]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Award className="h-5 w-5 text-[#CE9F48]" /> Patrocinador Financeiro
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>Nome do Patrocinador</Label>
                <Input 
                  value={formData.sponsor_name || ''} 
                  onChange={e => setFormData({ ...formData, sponsor_name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Parentesco</Label>
                <Input 
                  value={formData.sponsor_relationship || ''} 
                  onChange={e => setFormData({ ...formData, sponsor_relationship: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Empregador / Empresa</Label>
                <Input 
                  value={formData.sponsor_employer || ''} 
                  onChange={e => setFormData({ ...formData, sponsor_employer: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Renda Anual (USD)</Label>
                <Input 
                  value={formData.sponsor_annual_income || ''} 
                  onChange={e => setFormData({ ...formData, sponsor_annual_income: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Recomendantes */}
          <Card className="md:col-span-2 border-[#e3d5bd] dark:border-white/10 bg-white dark:bg-[#111]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <PenLine className="h-5 w-5 text-[#CE9F48]" /> Cartas de Recomendação
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4 rounded-lg border border-[#e3d5bd]/50 p-4 dark:border-white/5">
                <h4 className="font-bold text-[#CE9F48]">Recomendante 1</h4>
                <div className="grid gap-2">
                  <Label>Nome</Label>
                  <Input 
                    value={formData.recommender1_name || ''} 
                    onChange={e => setFormData({ ...formData, recommender1_name: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Cargo / Relacionamento</Label>
                  <Input 
                    value={formData.recommender1_role || ''} 
                    onChange={e => setFormData({ ...formData, recommender1_role: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Contato (Email/Tel)</Label>
                  <Input 
                    value={formData.recommender1_contact || ''} 
                    onChange={e => setFormData({ ...formData, recommender1_contact: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-4 rounded-lg border border-[#e3d5bd]/50 p-4 dark:border-white/5">
                <h4 className="font-bold text-[#CE9F48]">Recomendante 2</h4>
                <div className="grid gap-2">
                  <Label>Nome</Label>
                  <Input 
                    value={formData.recommender2_name || ''} 
                    onChange={e => setFormData({ ...formData, recommender2_name: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Cargo / Relacionamento</Label>
                  <Input 
                    value={formData.recommender2_role || ''} 
                    onChange={e => setFormData({ ...formData, recommender2_role: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Contato (Email/Tel)</Label>
                  <Input 
                    value={formData.recommender2_contact || ''} 
                    onChange={e => setFormData({ ...formData, recommender2_contact: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const emergencyRows = [
    { icon: User, label: "Nome", value: data?.emergency_contact_name },
    { icon: Phone, label: "Telefone", value: data?.emergency_contact_phone },
    { icon: Star, label: "Parentesco", value: data?.emergency_contact_relationship },
    { icon: MapPin, label: "Endereço", value: data?.emergency_contact_address },
  ];

  const sponsorRows = data?.has_sponsor ? [
    { icon: User, label: "Nome do Patrocinador", value: data.sponsor_name },
    { icon: Star, label: "Parentesco", value: data.sponsor_relationship },
    { icon: Phone, label: "Telefone", value: data.sponsor_phone },
    { icon: Briefcase, label: "Empregador", value: data.sponsor_employer },
    { icon: Award, label: "Renda Anual", value: data.sponsor_annual_income },
    { icon: Home, label: "Valor Comprometido", value: data.sponsor_committed_amount_usd ? `$${data.sponsor_committed_amount_usd}` : null },
  ] : [];

  const recommenders = [
    { name: data?.recommender1_name, role: data?.recommender1_role, contact: data?.recommender1_contact },
    { name: data?.recommender2_name, role: data?.recommender2_role, contact: data?.recommender2_contact },
  ].filter(r => !!r.name);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight">{t('student_dashboard.tabs.supplemental_data')}</h2>
          <p className="mt-1 text-sm text-[#8a7b66] dark:text-gray-500">Informações adicionais para sua candidatura universitária.</p>
        </div>
        <Button onClick={() => setIsEditing(true)} variant="outline" className="border-[#CE9F48] text-[#9a6a16] hover:bg-[#CE9F48]/10 dark:text-[#CE9F48]">
          <PenLine className="mr-2 h-4 w-4" /> Editar Dados
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Card Contato Emergência */}
        <Card className="border-[#e3d5bd] dark:border-white/10 bg-white dark:bg-[#111]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg font-bold text-[#1f1a14] dark:text-white">
              <div className="rounded-md bg-[#CE9F48]/10 p-2">
                <Phone className="h-5 w-5 text-[#CE9F48]" />
              </div>
              Contato de Emergência
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {emergencyRows.map((row, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <row.icon className="mt-0.5 h-4 w-4 text-[#8a7b66]" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#8a7b66]">{row.label}</p>
                  <p className="text-sm font-medium">{row.value || '—'}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Card Patrocinador Financeiro */}
        <Card className="border-[#e3d5bd] dark:border-white/10 bg-white dark:bg-[#111]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg font-bold text-[#1f1a14] dark:text-white">
              <div className="rounded-md bg-[#CE9F48]/10 p-2">
                <Award className="h-5 w-5 text-[#CE9F48]" />
              </div>
              Patrocinador Financeiro
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data?.has_sponsor ? (
              sponsorRows.map((row, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <row.icon className="mt-0.5 h-4 w-4 text-[#8a7b66]" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#8a7b66]">{row.label}</p>
                    <p className="text-sm font-medium">{row.value || '—'}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <p className="text-sm text-[#8a7b66]">O próprio estudante é o patrocinador.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card Experiência e Recomendantes */}
        <Card className="border-[#e3d5bd] dark:border-white/10 bg-white dark:bg-[#111]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg font-bold text-[#1f1a14] dark:text-white">
              <div className="rounded-md bg-[#CE9F48]/10 p-2">
                <PenLine className="h-5 w-5 text-[#CE9F48]" />
              </div>
              Recomendantes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {recommenders.length > 0 ? (
              recommenders.map((r, idx) => (
                <div key={idx} className="space-y-2 rounded-lg border border-[#e3d5bd]/50 p-3 dark:border-white/5">
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-[#CE9F48]" />
                    <p className="text-sm font-bold">{r.name}</p>
                  </div>
                  <div className="ml-6 space-y-1">
                    <p className="text-xs text-[#8a7b66]">{r.role}</p>
                    <p className="text-xs font-medium text-[#1f1a14] dark:text-gray-300">{r.contact}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="py-4 text-center text-sm text-[#8a7b66]">Nenhum recomendante listado.</p>
            )}
          </CardContent>
        </Card>
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

function TransferFormOverview({
  application,
  onRefresh,
  openViewer,
  compact = false,
}: {
  application: DashboardApplication;
  onRefresh: () => Promise<void>;
  openViewer: (url: string | null, title: string) => void;
  compact?: boolean;
}) {
  const { user, userProfile } = useStudentAuth();
  const navigate = useNavigate();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [templateUrl, setTemplateUrl] = useState<string | null>(null);
  const [filledUrl, setFilledUrl] = useState<string | null>(null);

  useEffect(() => {
    const resolveUrls = async () => {
      if (application.transfer_form_url) {
        const url = await getSecureUrl(application.transfer_form_url);
        setTemplateUrl(url);
      } else {
        setTemplateUrl(null);
      }

      if (application.transfer_form_filled_url) {
        const url = await getSecureUrl(application.transfer_form_filled_url);
        setFilledUrl(url);
      } else {
        setFilledUrl(null);
      }
    };
    resolveUrls();
  }, [application.transfer_form_url, application.transfer_form_filled_url]);

  const hasTemplate = !!application.transfer_form_url;
  const hasFilled = !!application.transfer_form_filled_url;
  const status = application.transfer_form_student_status || 'pending';
  const adminStatus = application.transfer_form_admin_status || null;
  const rejectionReason = application.transfer_form_rejection_reason || null;
  const isDelivered = !!application.transfer_form_delivered_at;
  const isConcluded = !!application.transfer_concluded_at;
  const [confirmingDelivery, setConfirmingDelivery] = useState(false);

  const handleConfirmDelivery = async () => {
    if (!user?.id) return;
    setConfirmingDelivery(true);
    try {
      await supabase
        .from('institution_applications')
        .update({ transfer_form_delivered_at: new Date().toISOString() })
        .eq('id', application.id);

      // Notify admin
      try {
        await supabase.functions.invoke('migma-notify', {
          body: {
            trigger: 'transfer_form_delivered',
            data: {
              client_name: userProfile?.full_name || userProfile?.email || user?.email,
              client_id: userProfile?.id,
            },
          },
        });
      } catch (notifyErr) {
        console.warn('Failed to notify admin (non-fatal):', notifyErr);
      }

      await onRefresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setConfirmingDelivery(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    
    setUploading(true);
    setError(null);

    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/transfer-forms/${application.id}_filled_${Date.now()}.${ext}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('migma-student-documents')
        .upload(path, file);

      if (uploadError) throw uploadError;

      const TEN_YEARS = 60 * 60 * 24 * 365 * 10;
      const { data: signedData, error: signedError } = await supabase.storage
        .from('migma-student-documents')
        .createSignedUrl(uploadData.path, TEN_YEARS);
      if (signedError) throw signedError;
      const publicUrl = signedData.signedUrl;

      const { error: updateError } = await supabase
        .from('institution_applications')
        .update({
          transfer_form_filled_url: publicUrl,
          transfer_form_student_status: 'received',
          transfer_form_admin_status: 'pending',
          transfer_form_rejection_reason: null,
        })
        .eq('id', application.id);

      if (updateError) throw updateError;

      // Notificar MatriculaUSA
      try {
        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-matriculausa-transfer-form`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            student_email: userProfile?.email || user?.email,
            student_name: userProfile?.full_name,
            filled_form_url: publicUrl,
            migma_application_id: application.id,
          })
        });
      } catch (notifyErr) {
        console.error('Failed to notify MatriculaUSA:', notifyErr);
      }

      await onRefresh();
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer upload');
    } finally {
      setUploading(false);
    }
  };

  if (!hasTemplate && status === 'pending') return null;

  return (
    <Card className="border-[#CE9F48]/30 bg-[#CE9F48]/5 dark:border-[#CE9F48]/20 dark:bg-[#CE9F48]/5 overflow-hidden mb-5">
      <CardContent className="p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#CE9F48]/20 text-[#9a6a16] dark:text-[#CE9F48]">
              <FileSignature className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-black text-[#1f1a14] dark:text-white">
                  Formulário de Transferência
                </h3>
                {adminStatus === 'approved' ? (
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Aprovado</Badge>
                ) : adminStatus === 'rejected' ? (
                  <Badge className="bg-red-100 text-red-800 border-red-200">Reprovado</Badge>
                ) : (
                  <Badge className={badgeClass(status)}>
                    {status === 'received' ? 'Enviado' : status === 'submitted' ? 'Processado' : 'Pendente'}
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-[#8a7b66] dark:text-gray-400 max-w-md">
                {adminStatus === 'approved'
                  ? 'Seu formulário foi aprovado. O processo de transferência foi aceito!'
                  : adminStatus === 'rejected'
                  ? 'Seu formulário foi reprovado. Por favor, corrija e reenvie.'
                  : status === 'pending'
                  ? 'Este formulário deve ser entregue à sua escola atual para solicitar a liberação do seu SEVIS.'
                  : 'Seu formulário foi enviado e está em análise pela nossa equipe.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {hasTemplate && (
              <Button
                variant="outline"
                disabled={!templateUrl}
                onClick={() => openViewer(templateUrl, 'Modelo Transfer Form')}
                className="border-[#CE9F48]/40 text-[#9a6a16] dark:text-[#CE9F48] hover:bg-[#CE9F48]/10"
              >
                <Download className="mr-2 h-4 w-4" />
                Visualizar Modelo
              </Button>
            )}

            {compact ? (
              <Button
                onClick={() => navigate('/student/dashboard/documents')}
                className="bg-[#CE9F48] text-black hover:bg-[#b8892f]"
              >
                <Upload className="mr-2 h-4 w-4" />
                {hasFilled ? 'Gerenciar Formulário' : 'Enviar Preenchido'}
              </Button>
            ) : (
              <>
                {(status !== 'submitted' || adminStatus === 'rejected') && adminStatus !== 'approved' && (
                  <>
                    <input
                      type="file"
                      className="hidden"
                      ref={fileInputRef}
                      onChange={handleUpload}
                      accept=".pdf,.jpg,.jpeg,.png"
                    />
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="bg-[#CE9F48] text-black hover:bg-[#b8892f]"
                    >
                      {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                      {hasFilled ? 'Reenviar Preenchido' : 'Enviar Preenchido'}
                    </Button>
                  </>
                )}

                {hasFilled && (
                  <Button
                    variant="ghost"
                    disabled={!filledUrl}
                    onClick={() => openViewer(filledUrl, 'Formulário Enviado')}
                    className="text-[#8a7b66] dark:text-gray-400"
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    Ver Enviado
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
        {error && <p className="mt-4 text-sm text-red-500 font-medium">{error}</p>}
        {adminStatus === 'rejected' && rejectionReason && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
            <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">Motivo da reprovação:</p>
            <p className="text-sm text-red-600 dark:text-red-300">{rejectionReason}</p>
          </div>
        )}

        {/* TRANSFER CONCLUÍDO banner */}
        {isConcluded && (
          <div className="mt-4 rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-5 dark:bg-emerald-900/20">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="font-black text-emerald-700 dark:text-emerald-400 text-base">TRANSFER CONCLUÍDO</p>
                <p className="text-sm text-emerald-600 dark:text-emerald-300 mt-0.5">
                  Transferência concluída! Aguarde contato da universidade sobre o início das aulas.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Instrução de entrega + confirmação — aparece assim que o admin envia o formulário */}
        {!compact && hasTemplate && !isConcluded && (
          <div className="mt-4 rounded-xl border border-[#CE9F48]/30 bg-[#CE9F48]/5 p-5 space-y-4">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-[#CE9F48]/70 mb-1">Próximo passo</p>
              <p className="text-sm text-[#8a7b66] dark:text-gray-300 leading-relaxed">
                Este formulário deve ser entregue à sua escola atual para solicitar a liberação do seu SEVIS.
                Leve pessoalmente ao DSO (Designated School Official) ou envie por email conforme orientação da sua escola.
              </p>
            </div>

            {isDelivered ? (
              <div className="flex items-center gap-3 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-4 py-3">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                <div>
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Entrega confirmada</p>
                  <p className="text-xs text-emerald-600/80 dark:text-emerald-500 mt-0.5">Você confirmou a entrega do Transfer Form à sua escola atual.</p>
                </div>
              </div>
            ) : (
              <button
                onClick={handleConfirmDelivery}
                disabled={confirmingDelivery}
                className="w-full flex items-center gap-3 rounded-lg border border-[#CE9F48]/40 bg-white/50 dark:bg-white/5 px-4 py-3 text-left transition-colors hover:border-[#CE9F48]/70 hover:bg-[#CE9F48]/10 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#CE9F48]/40 bg-[#CE9F48]/10">
                  {confirmingDelivery
                    ? <Loader2 className="h-4 w-4 animate-spin text-[#CE9F48]" />
                    : <CheckCircle2 className="h-4 w-4 text-[#CE9F48]" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1f1a14] dark:text-white">Já entreguei o Transfer Form à minha escola atual</p>
                  <p className="text-xs text-[#8a7b66] dark:text-gray-400 mt-0.5">Clique para confirmar a entrega</p>
                </div>
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AcceptanceLetterCard({
  application,
  openViewer,
}: {
  application: DashboardApplication;
  openViewer: (url: string | null, title: string) => void;
}) {
  const [letterUrl, setLetterUrl] = useState<string | null>(null);

  const is2ndPending =
    application.placement_fee_installments === 2 &&
    !application.placement_fee_2nd_installment_paid_at;

  useEffect(() => {
    if (application.acceptance_letter_url && !is2ndPending) {
      getSecureUrl(application.acceptance_letter_url).then(setLetterUrl);
    } else {
      setLetterUrl(null);
    }
  }, [application.acceptance_letter_url, is2ndPending]);

  const hasLetter = !!application.acceptance_letter_url && !is2ndPending;

  const badgeClass = hasLetter
    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
    : is2ndPending
      ? 'bg-amber-100 text-amber-800 border-amber-200'
      : 'bg-amber-100 text-amber-800 border-amber-200';

  const badgeLabel = hasLetter ? 'Disponível' : is2ndPending ? '2ª Parcela Pendente' : 'Aguardando';

  const description = hasLetter
    ? 'Sua carta de aceite foi emitida pela universidade. Clique para visualizar ou baixar.'
    : is2ndPending
      ? 'Sua carta de aceite está pronta, mas será liberada somente após o pagamento da 2ª parcela do Placement Fee.'
      : 'A carta de aceite será disponibilizada aqui quando emitida.';

  return (
    <Card className="border-emerald-500/30 bg-emerald-500/5 dark:border-emerald-500/20 dark:bg-emerald-500/5 overflow-hidden">
      <CardContent className="p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-[#1f1a14] dark:text-white">Carta de Aceite</h3>
                <Badge className={badgeClass}>{badgeLabel}</Badge>
              </div>
              <p className="mt-1 text-sm text-[#8a7b66] dark:text-gray-400 max-w-md">{description}</p>
            </div>
          </div>

          {hasLetter && (
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                disabled={!letterUrl}
                onClick={() => openViewer(letterUrl, 'Carta de Aceite')}
                className="border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
              >
                <Eye className="mr-2 h-4 w-4" />
                Visualizar
              </Button>
              {letterUrl && (
                <a
                  href={letterUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-md border border-emerald-500/40 px-4 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  Baixar
                </a>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
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

function DocumentRequestCard({ 
  document, 
  onUploaded, 
  isTransferOnly,
  openViewer,
}: { 
  document: DashboardDocument; 
  onUploaded: () => Promise<void>; 
  isTransferOnly?: boolean;
  openViewer: (url: string | null, title: string) => void;
}) {
  const { t } = useTranslation();
  const { user, userProfile } = useStudentAuth();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const submitted = !!document.submitted_at || !!document.submitted_url;
  const canUpload = document.status !== 'approved';

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id || !userProfile?.id) return;
    e.target.value = '';

    setUploading(true);
    setUploadError(null);
    try {
      const ext = file.name.split('.').pop() || 'pdf';
      const filePath = `${user.id}/global-documents/${document.document_type}_${Date.now()}.${ext}`;

      const { error: storageErr } = await supabase.storage
        .from('migma-student-documents')
        .upload(filePath, file, { upsert: true });
      if (storageErr) throw storageErr;

      const { data: urlData } = supabase.storage.from('migma-student-documents').getPublicUrl(filePath);

      const { error: dbErr } = await supabase
        .from('global_document_requests')
        .update({
          submitted_url: urlData.publicUrl,
          submitted_at: new Date().toISOString(),
          status: 'pending',
        })
        .eq('id', document.id);
      if (dbErr) throw dbErr;

      await onUploaded();
    } catch (err: any) {
      setUploadError(err.message ?? 'Erro ao enviar arquivo.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="border-[#e3d5bd] dark:border-white/10 bg-white dark:bg-[#111] text-[#1f1a14] dark:text-white">
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-4 flex-1 min-w-0">
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
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-black capitalize">{documentLabel(document.document_type, t)}</h3>
                <Badge className={badgeClass(document.status)}>{getStatusText(t)[document.status] ?? document.status}</Badge>
                {isTransferOnly && (
                  <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded border border-[#CE9F48]/40 bg-[#CE9F48]/10 text-[#9a6a16] dark:text-[#CE9F48]">Transfer</span>
                )}
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
              {uploadError && (
                <p className="mt-2 text-xs text-red-400">{uploadError}</p>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-3 lg:w-56 lg:shrink-0">
            <div className="grid gap-2 text-sm">
              <DocumentStatusLine label={t('student_dashboard.documents.upload_label')} value={submitted ? t('student_dashboard.status.submitted') : t('student_dashboard.status.pending')} done={submitted} />
              <DocumentStatusLine label={t('student_dashboard.documents.review_label')} value={document.status === 'approved' ? t('student_dashboard.status.approved') : document.status === 'rejected' ? t('student_dashboard.status.rejected') : t('student_dashboard.status.waiting')} done={document.status === 'approved'} />
            </div>
            {canUpload && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-[#CE9F48]/40 text-[#9a6a16] dark:text-[#CE9F48] hover:bg-[#CE9F48]/10"
                >
                  {uploading
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Upload className="h-3.5 w-3.5" />}
                  <span className="ml-1.5">
                    {submitted ? 'Reenviar' : 'Enviar'}
                  </span>
                </Button>
                {submitted && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      const url = await getSecureUrl(document.submitted_url);
                      openViewer(url, documentLabel(document.document_type, t));
                    }}
                    className="text-[#8a7b66] dark:text-gray-400"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span className="ml-1.5">Ver Enviado</span>
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StudentDocumentCard({ 
  document, 
  onUploaded,
  openViewer,
}: { 
  document: DashboardStudentDocument; 
  onUploaded: () => Promise<void>; 
  openViewer: (url: string | null, title: string) => void;
}) {
  const { t } = useTranslation();
  const { user } = useStudentAuth();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const submitted = !!document.uploaded_at || !!document.file_url;
  const canUpload = document.status !== 'approved';

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    e.target.value = '';

    setUploading(true);
    setUploadError(null);
    try {
      const ext = file.name.split('.').pop() || 'pdf';
      const filePath = `${user.id}/identity/${document.type}_${Date.now()}.${ext}`;

      const { error: storageErr } = await supabase.storage
        .from('migma-student-documents')
        .upload(filePath, file, { upsert: true });
      if (storageErr) throw storageErr;

      const { data: urlData } = supabase.storage.from('migma-student-documents').getPublicUrl(filePath);

      const { error: dbErr } = await supabase
        .from('student_documents')
        .update({
          file_url: urlData.publicUrl,
          original_filename: file.name,
          file_size_bytes: file.size,
          uploaded_at: new Date().toISOString(),
          status: 'pending',
        })
        .eq('id', document.id);
      if (dbErr) throw dbErr;

      await onUploaded();
    } catch (err: any) {
      setUploadError(err.message ?? 'Erro ao enviar arquivo.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="border-[#e3d5bd] dark:border-white/10 bg-white dark:bg-[#111] text-[#1f1a14] dark:text-white">
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-4 flex-1 min-w-0">
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
            <div className="min-w-0">
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
              {uploadError && (
                <p className="mt-2 text-xs text-red-400">{uploadError}</p>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-3 lg:w-56 lg:shrink-0">
            <DocumentStatusLine label={t('student_dashboard.documents.upload_label')} value={submitted ? t('student_dashboard.status.submitted') : t('student_dashboard.status.pending')} done={submitted} />
            {canUpload && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-[#CE9F48]/40 text-[#9a6a16] dark:text-[#CE9F48] hover:bg-[#CE9F48]/10"
                >
                  {uploading
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Upload className="h-3.5 w-3.5" />}
                  <span className="ml-1.5">
                    {submitted ? 'Reenviar' : 'Enviar'}
                  </span>
                </Button>
                {submitted && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      const url = await getSecureUrl(document.file_url);
                      openViewer(url, documentLabel(document.type, t));
                    }}
                    className="text-[#8a7b66] dark:text-gray-400"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span className="ml-1.5">Ver Enviado</span>
                  </Button>
                )}
              </>
            )}
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

function FormCard({ 
  form, 
  onPreview, 
  onOpenPdf, 
  onSign 
}: { 
  form: DashboardForm; 
  onPreview: () => void; 
  onOpenPdf: () => void; 
  onSign: () => void;
}) {
  const { t } = useTranslation();
  const isSigned = !!form.signed_at;
  const hasSignedPdf = isPdfUrl(form.signed_url);
  const canSign = !isSigned || !hasSignedPdf;
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
            {(form.template_url || hasSignedPdf) && (
              <Button variant="outline" onClick={onPreview} className="border-[#e3d5bd] dark:border-white/10 bg-[#f3ead9] dark:bg-white/5 text-[#1f1a14] dark:text-white hover:bg-[#eadbbf] dark:hover:bg-white/10">
                <Eye className="h-4 w-4" />
                {t('student_dashboard.forms.btn_review')}
              </Button>
            )}
            {(form.signed_url || form.template_url) && (
              <Button 
                variant="outline" 
                onClick={onOpenPdf} 
                className="border-[#e3d5bd] dark:border-white/10 bg-[#f3ead9] dark:bg-white/5 text-[#1f1a14] dark:text-white hover:bg-[#eadbbf] dark:hover:bg-white/10"
              >
                <Download className="h-4 w-4" />
                {t('student_dashboard.forms.btn_open')}
              </Button>
            )}
            <Button onClick={onSign} disabled={!canSign} className="bg-[#CE9F48] text-black hover:bg-[#b8892f]">
              <Upload className="h-4 w-4" />
              {!canSign ? t('student_dashboard.status.submitted') : t('student_dashboard.forms.btn_send_signed')}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FormSignatureModal({ 
  form, 
  onClose, 
  onSigned,
  openViewer,
}: { 
  form: DashboardForm; 
  onClose: () => void; 
  onSigned: () => void;
  openViewer: (url: string | null, title: string) => void;
}) {
  const { t } = useTranslation();
  const { user, userProfile } = useStudentAuth();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const signaturePadRef = useRef<SignaturePad | null>(null);
  const [hasSignature, setHasSignature] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signaturePreviewUrl, setSignaturePreviewUrl] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [evidenceFiles, setEvidenceFiles] = useState<Record<SignatureEvidenceKind, File | null>>({
    document_front: null,
    document_back: null,
    selfie_doc: null,
  });
  const [evidencePreviews, setEvidencePreviews] = useState<Record<SignatureEvidenceKind, string | null>>({
    document_front: null,
    document_back: null,
    selfie_doc: null,
  });
  const defaultPlacement = SIGNATURE_PLACEMENTS[form.form_type] ?? getSignaturePlacement(form.form_type, 1);
  const [placement, setPlacement] = useState<SignaturePlacement>(defaultPlacement);
  const flowStartedAt = useRef(new Date().toISOString());
  const evidencePreviewsRef = useRef(evidencePreviews);
  const hasAllEvidenceFiles = SIGNATURE_EVIDENCE_REQUIREMENTS.every(requirement => !!evidenceFiles[requirement.kind]);

  useEffect(() => {
    evidencePreviewsRef.current = evidencePreviews;
  }, [evidencePreviews]);

  useEffect(() => {
    return () => {
      Object.values(evidencePreviewsRef.current).forEach(preview => {
        if (preview) URL.revokeObjectURL(preview);
      });
    };
  }, []);

  useEffect(() => {
    if (!form.template_url) return;
    getSecureUrl(form.template_url).then(url => { if (url) setPdfUrl(url); });
  }, [form.template_url]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const data = signaturePadRef.current?.isEmpty() ? null : signaturePadRef.current?.toData();
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(Math.floor(rect.width * ratio), 1);
      canvas.height = Math.max(Math.floor(rect.height * ratio), 1);
      const context = canvas.getContext('2d');
      context?.scale(ratio, ratio);
      signaturePadRef.current?.clear();
      if (data) signaturePadRef.current?.fromData(data);
    };

    const signaturePad = new SignaturePad(canvas, {
      backgroundColor: 'rgba(0,0,0,0)',
      penColor: 'rgb(31, 26, 20)',
      minWidth: 0.8,
      maxWidth: 2.4,
    });

    signaturePad.addEventListener('endStroke', () => {
      const empty = signaturePad.isEmpty();
      setHasSignature(!empty);
      setError(null);
      if (!empty) {
        setSignaturePreviewUrl(canvas.toDataURL('image/png'));
      }
    });

    signaturePadRef.current = signaturePad;
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      signaturePad.off();
      signaturePadRef.current = null;
    };
  }, []);

  const clearSignature = () => {
    signaturePadRef.current?.clear();
    setHasSignature(false);
    setSignaturePreviewUrl(null);
    setError(null);
  };

  const canvasToBlob = async (canvas: HTMLCanvasElement) => {
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('Erro ao preparar a imagem da assinatura.'));
      }, 'image/png');
    });
  };

  const handleEvidenceSelect = (kind: SignatureEvidenceKind, event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (!ALLOWED_SIGNATURE_PHOTO_TYPES.has(selectedFile.type)) {
      setEvidenceFiles(prev => ({ ...prev, [kind]: null }));
      setEvidencePreviews(prev => ({ ...prev, [kind]: null }));
      setError('Envie uma foto em JPG ou PNG.');
      event.target.value = '';
      return;
    }

    if (selectedFile.size > MAX_SIGNATURE_PHOTO_SIZE) {
      setEvidenceFiles(prev => ({ ...prev, [kind]: null }));
      setEvidencePreviews(prev => ({ ...prev, [kind]: null }));
      setError('A foto precisa ter no maximo 5MB.');
      event.target.value = '';
      return;
    }

    const currentPreview = evidencePreviews[kind];
    if (currentPreview) URL.revokeObjectURL(currentPreview);
    setEvidenceFiles(prev => ({ ...prev, [kind]: selectedFile }));
    setEvidencePreviews(prev => ({ ...prev, [kind]: URL.createObjectURL(selectedFile) }));
    setError(null);
  };

  const removeEvidenceFile = (kind: SignatureEvidenceKind) => {
    const currentPreview = evidencePreviews[kind];
    if (currentPreview) URL.revokeObjectURL(currentPreview);
    setEvidenceFiles(prev => ({ ...prev, [kind]: null }));
    setEvidencePreviews(prev => ({ ...prev, [kind]: null }));
    setError(null);
  };

  const handleConfirm = async () => {
    const canvas = canvasRef.current;
    const signaturePad = signaturePadRef.current;
    if (!canvas || !signaturePad || signaturePad.isEmpty()) {
      setError('Desenhe sua assinatura antes de confirmar.');
      return;
    }
    if (!consentChecked) {
      setError('Confirme o consentimento antes de assinar.');
      return;
    }
    if (!hasAllEvidenceFiles) {
      setError('Envie Document Front, Document Back e a foto segurando o documento antes de confirmar.');
      return;
    }
    if (!user?.id || !userProfile?.id) {
      setError('Sessao do aluno nao encontrada. Entre novamente e tente assinar.');
      return;
    }
    if (!form.template_url) {
      setError('PDF original nao encontrado para aplicar a assinatura.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const signatureDrawnAt = new Date().toISOString();
      const ts = Date.now();
      const signatureBlob = await canvasToBlob(canvas);
      const signaturePath = `signed/${user.id}/${form.id}_${ts}.png`;
      const resolvedEvidenceFiles = SIGNATURE_EVIDENCE_REQUIREMENTS.map(requirement => {
        const file = evidenceFiles[requirement.kind];
        if (!file) throw new Error(`Arquivo obrigatório ausente: ${requirement.label}.`);
        return {
          ...requirement,
          file,
        };
      });
      const signedPdfPath = `signed/${user.id}/${form.id}_${ts}_signed.pdf`;

      const [
        { blob: signedPdfBlob, templateBytes, signatureBytes, evidenceBytes, signedBytes },
        { data: { session } },
      ] = await Promise.all([
        createSignedPdfBlob({
          templateUrl: form.template_url,
          signatureBlob,
          evidenceFiles: resolvedEvidenceFiles,
          signerName: userProfile.full_name,
          signedAt: signatureDrawnAt,
          formType: form.form_type,
          placement,
        }),
        supabase.auth.getSession(),
      ]);

      const [templateSha256, signatureSha256, signedPdfSha256] = await Promise.all([
        sha256Hex(templateBytes),
        sha256Hex(signatureBytes),
        sha256Hex(signedBytes),
      ]);
      const evidenceUploads = await Promise.all(resolvedEvidenceFiles.map(async evidence => {
        const ext = evidence.file.type === 'image/png' ? 'png' : 'jpg';
        const path = `signed/${user.id}/${form.id}_${ts}_${evidence.kind}.${ext}`;
        return {
          kind: evidence.kind,
          label: evidence.label,
          file: evidence.file,
          path,
          sha256: await sha256Hex(evidenceBytes[evidence.kind]),
        };
      }));

      const accessToken = session?.access_token ?? '';
      const sessionIdHash = accessToken
        ? await sha256Hex(new TextEncoder().encode(accessToken).buffer as ArrayBuffer)
        : null;
      const authProvider = (session?.user?.app_metadata?.['provider'] as string | undefined) ?? 'unknown';
      const emailVerified = session?.user?.email_confirmed_at != null;
      const environment = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'development'
        : 'production';

      const { error: uploadError } = await supabase.storage
        .from('institution-forms')
        .upload(signaturePath, signatureBlob, { contentType: 'image/png', upsert: false });
      if (uploadError) throw uploadError;

      for (const evidence of evidenceUploads) {
        const { error: evidenceUploadError } = await supabase.storage
          .from('institution-forms')
          .upload(evidence.path, evidence.file, { contentType: evidence.file.type, upsert: false });
        if (evidenceUploadError) throw evidenceUploadError;
      }

      const { error: pdfUploadError } = await supabase.storage
        .from('institution-forms')
        .upload(signedPdfPath, signedPdfBlob, { contentType: 'application/pdf', upsert: false });
      if (pdfUploadError) throw pdfUploadError;

      const { data: sigUrlData } = supabase.storage.from('institution-forms').getPublicUrl(signaturePath);
      const { data: pdfUrlData } = supabase.storage.from('institution-forms').getPublicUrl(signedPdfPath);
      const signatureUrl = sigUrlData.publicUrl;
      const signedPdfUrl = pdfUrlData.publicUrl;
      const uploadedEvidence = evidenceUploads.map<SignatureEvidenceUpload>(evidence => ({
        ...evidence,
        url: supabase.storage.from('institution-forms').getPublicUrl(evidence.path).data.publicUrl,
      }));
      const evidenceByKind = Object.fromEntries(uploadedEvidence.map(evidence => [evidence.kind, evidence])) as Record<SignatureEvidenceKind, SignatureEvidenceUpload>;

      const confirmedAt = new Date().toISOString();
      const prevMeta: Record<string, unknown> = form.signature_metadata_json ?? {};

      const CONSENT_TEXT = 'Declaro que li o documento, conferi meus dados e confirmo que esta assinatura eletrônica representa minha assinatura para este formulário.';

      const proofPayload = {
        proof_version: 'migma-web-signature-v2',
        environment,
        signer_confirmed_at: confirmedAt,
        signature_capture: 'drawn_signature',
        identity_photo_url: evidenceByKind.selfie_doc.url,
        identity_photo_sha256: evidenceByKind.selfie_doc.sha256,
        document_front_url: evidenceByKind.document_front.url,
        document_back_url: evidenceByKind.document_back.url,
        selfie_doc_url: evidenceByKind.selfie_doc.url,

        signer: {
          user_id: user.id,
          profile_id: userProfile.id,
          full_name: userProfile.full_name,
          email: userProfile.email ?? user.email ?? null,
          email_verified: emailVerified,
          auth_provider: authProvider,
          auth_session_id_hash: sessionIdHash,
          mfa_verified: false,
        },

        document: {
          form_id: form.id,
          form_type: form.form_type,
          template_storage_path: form.template_url,
          template_pdf_sha256: templateSha256,
          signature_image_sha256: signatureSha256,
          document_front_sha256: evidenceByKind.document_front.sha256,
          document_back_sha256: evidenceByKind.document_back.sha256,
          selfie_doc_sha256: evidenceByKind.selfie_doc.sha256,
          signed_pdf_storage_path: signedPdfPath,
          signed_pdf_sha256: signedPdfSha256,
          signed_pdf_file_size_bytes: signedPdfBlob.size,
          signed_pdf_url: signedPdfUrl,
        },

        signature: {
          capture_method: 'drawn_signature',
          signature_storage_path: signaturePath,
          signature_image_url: signatureUrl,
          signature_file_type: 'image/png',
          signature_file_size_bytes: signatureBlob.size,
          signature_drawn_at_client: signatureDrawnAt,
          signature_confirmed_at_client: confirmedAt,
          signature_placement: {
            page_index: placement.pageIndex,
            x: placement.x,
            y: placement.y,
            width: placement.width,
            height: placement.height,
          },
        },

        identity: {
          capture_method: 'document_front_back_and_selfie',
          document_front: {
            storage_path: evidenceByKind.document_front.path,
            url: evidenceByKind.document_front.url,
            file_type: evidenceByKind.document_front.file.type,
            file_name: evidenceByKind.document_front.file.name,
            file_size_bytes: evidenceByKind.document_front.file.size,
            sha256: evidenceByKind.document_front.sha256,
          },
          document_back: {
            storage_path: evidenceByKind.document_back.path,
            url: evidenceByKind.document_back.url,
            file_type: evidenceByKind.document_back.file.type,
            file_name: evidenceByKind.document_back.file.name,
            file_size_bytes: evidenceByKind.document_back.file.size,
            sha256: evidenceByKind.document_back.sha256,
          },
          selfie_doc: {
            storage_path: evidenceByKind.selfie_doc.path,
            url: evidenceByKind.selfie_doc.url,
            file_type: evidenceByKind.selfie_doc.file.type,
            file_name: evidenceByKind.selfie_doc.file.name,
            file_size_bytes: evidenceByKind.selfie_doc.file.size,
            sha256: evidenceByKind.selfie_doc.sha256,
          },
          submitted_at_client: confirmedAt,
        },

        consent: {
          statement_version: 'signature-consent-v1',
          statement_text: CONSENT_TEXT,
          checkbox_checked: true,
          confirm_button_label: 'Confirmar e assinar documento',
          confirmed_at_client: confirmedAt,
        },

        request: {
          ip_address_hash: null,
          user_agent: window.navigator.userAgent,
          browser_language: window.navigator.language,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
            device_pixel_ratio: window.devicePixelRatio,
          },
          origin: window.location.origin,
          path: window.location.pathname,
          request_id: crypto.randomUUID(),
        },

        audit: {
          pdf_open_count: typeof prevMeta.pdf_open_count === 'number' ? prevMeta.pdf_open_count : 0,
          first_pdf_opened_at_client: typeof prevMeta.pdf_opened_at === 'string' ? prevMeta.pdf_opened_at : null,
          last_pdf_opened_at_client: typeof prevMeta.last_pdf_opened_at === 'string' ? prevMeta.last_pdf_opened_at : null,
          signature_flow_started_at_client: flowStartedAt.current,
          proof_created_at_client: confirmedAt,
          proof_payload_sha256: null as string | null,
        },
      };

      // client-side hash antes de enviar (a Edge Function vai recomputar com campos server-side)
      const payloadBytes = new TextEncoder().encode(JSON.stringify(proofPayload)).buffer as ArrayBuffer;
      proofPayload.audit.proof_payload_sha256 = await sha256Hex(payloadBytes);

      const { data: { session: fnSession } } = await supabase.auth.getSession();
      if (!fnSession?.access_token) throw new Error('Sessão expirada. Faça login novamente.');

      const fnRes = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sign-document`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${fnSession.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ form_id: form.id, proof_payload: proofPayload }),
        },
      );
      const fnData = await fnRes.json() as { ok?: boolean; error?: string };
      if (!fnRes.ok) throw new Error(fnData?.error ?? `Erro no servidor (${fnRes.status}).`);

      onSigned();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar assinatura.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/95 dark:bg-black/80 p-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-[#e3d5bd] dark:border-white/10 bg-[#fffaf0] dark:bg-[#0f0f0f] p-5 text-[#1f1a14] dark:text-white shadow-2xl">
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
            <Button 
              variant="outline" 
              onClick={async () => {
                const now = new Date().toISOString();
                const metadata: Record<string, unknown> = form.signature_metadata_json ?? {};
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
                
                const url = await getSecureUrl(form.template_url);
                openViewer(url, form.form_type);
              }}
              className="border-[#e3d5bd] dark:border-white/10 bg-[#f3ead9] dark:bg-white/5 text-[#1f1a14] dark:text-white hover:bg-[#eadbbf] dark:hover:bg-white/10"
            >
              <Download className="h-4 w-4" />
              {t('student_dashboard.forms.modal_download_orig')}
            </Button>
          )}

          {pdfUrl && (
            <PdfSignatureViewer
              pdfUrl={pdfUrl}
              placement={placement}
              signatureDataUrl={signaturePreviewUrl}
              onPlacementChange={setPlacement}
            />
          )}

          <div className="rounded-lg border border-[#d8c5a3] dark:border-white/15 bg-white/70 dark:bg-white/[0.03] p-4">
            <div className="mb-4">
              <div>
                <p className="text-sm font-bold">Identity verification documents</p>
                <p className="mt-1 text-xs text-[#8a7b66] dark:text-gray-500">
                  Envie Document Front, Document Back e uma foto segurando o documento. Esses arquivos serao anexados como evidencia da assinatura.
                </p>
              </div>
            </div>

            <div className="mb-4 grid gap-4 md:grid-cols-[140px_1fr] md:items-center">
              <img
                src="/helpselfie.png"
                alt="Exemplo de foto segurando documento"
                className="h-auto w-32 rounded-md border border-[#CE9F48]/40 object-cover"
              />
              <div className="rounded-md border border-dashed border-[#d8c5a3] bg-[#f7efdf] p-4 text-xs text-[#6f6251] dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-400">
                Use fotos nitidas, com boa luz, sem cortes no documento. Formatos aceitos: JPG ou PNG, ate 5MB cada.
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {SIGNATURE_EVIDENCE_REQUIREMENTS.map(requirement => {
                const preview = evidencePreviews[requirement.kind];
                const file = evidenceFiles[requirement.kind];

                return (
                  <div key={requirement.kind} className="rounded-md border border-[#e3d5bd] bg-[#fffaf0] p-3 dark:border-white/10 dark:bg-white/[0.03]">
                    <div className="mb-3">
                      <p className="text-xs font-black uppercase tracking-wide text-[#1f1a14] dark:text-white">{requirement.label}</p>
                      <p className="mt-1 text-[11px] text-[#8a7b66] dark:text-gray-500">{requirement.description}</p>
                    </div>

                    {preview ? (
                      <div className="relative overflow-hidden rounded-md border border-[#CE9F48]/40 bg-black/5 dark:bg-black/30">
                        <img
                          src={preview}
                          alt={requirement.label}
                          className="mx-auto h-36 w-full object-contain"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          onClick={() => removeEvidenceFile(requirement.kind)}
                          disabled={saving}
                          className="absolute right-2 top-2 h-7 w-7"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <Button type="button" variant="outline" disabled={saving} className="h-36 w-full flex-col border-dashed border-[#d8c5a3] bg-[#f7efdf] text-[#1f1a14] hover:bg-[#eadbbf] dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10" asChild>
                        <label className="cursor-pointer">
                          <Camera className="h-6 w-6" />
                          <span className="mt-2 text-xs font-bold">Upload</span>
                          <input
                            type="file"
                            accept="image/jpeg,image/jpg,image/png"
                            capture={requirement.capture}
                            onChange={event => handleEvidenceSelect(requirement.kind, event)}
                            disabled={saving}
                            className="hidden"
                          />
                        </label>
                      </Button>
                    )}

                    {file && (
                      <p className="mt-2 truncate text-[10px] text-emerald-700 dark:text-emerald-300" title={file.name}>
                        {file.name}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-dashed border-[#d8c5a3] dark:border-white/15 bg-white/70 dark:bg-white/[0.03] p-4">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold">{t('student_dashboard.forms.modal_draw_signature', { defaultValue: 'Desenhe sua assinatura' })}</p>
                <p className="mt-1 text-xs text-[#8a7b66] dark:text-gray-500">
                  {t('student_dashboard.forms.modal_draw_signature_desc', { defaultValue: 'A assinatura sera salva com metadados de comprovacao do portal MIGMA.' })}
                </p>
              </div>
              <Button type="button" variant="outline" onClick={clearSignature} disabled={saving || !hasSignature} className="border-[#e3d5bd] dark:border-white/10 bg-[#f3ead9] dark:bg-white/5 text-[#1f1a14] dark:text-white hover:bg-[#eadbbf] dark:hover:bg-white/10">
                <X className="h-4 w-4" />
                {t('student_dashboard.forms.modal_btn_clear_signature', { defaultValue: 'Limpar' })}
              </Button>
            </div>
            <canvas
              ref={canvasRef}
              className="h-48 w-full touch-none rounded-md border border-[#e3d5bd] bg-white shadow-inner dark:border-white/10"
            />
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#CE9F48]/30 bg-[#CE9F48]/10 p-4">
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={e => setConsentChecked(e.target.checked)}
              disabled={saving}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#CE9F48]"
            />
            <span className="text-xs leading-relaxed text-[#4b4032] dark:text-gray-300">
              Declaro que li o documento, conferi meus dados e confirmo que esta assinatura eletrônica representa minha assinatura para este formulário.
            </span>
          </label>

        {error && <p className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

        <div className="mt-5 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={saving} className="border-[#e3d5bd] dark:border-white/10 bg-[#f3ead9] dark:bg-white/5 text-[#1f1a14] dark:text-white hover:bg-[#eadbbf] dark:hover:bg-white/10">
            {t('student_dashboard.forms.modal_btn_cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={!hasSignature || !hasAllEvidenceFiles || !consentChecked || saving} className="bg-[#CE9F48] text-black hover:bg-[#b8892f]">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}
            Confirmar e assinar documento
          </Button>
        </div>
        </div>
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
  const { user, userProfile, loading: authLoading, signOut } = useStudentAuth();
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
    refresh,
  } = useStudentDashboard();

  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerTitle, setViewerTitle] = useState<string>('');
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  const openViewer = (url: string | null, title: string) => {
    if (!url) return;
    setViewerUrl(url);
    setViewerTitle(title);
    setIsViewerOpen(true);
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/student/login', { replace: true });
    }
  }, [authLoading, navigate, user]);

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

  const handleSignOut = async () => {
    await signOut();
    navigate('/student/login', { replace: true });
  };

  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white dark:bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-[#9a6a16] dark:text-[#CE9F48]" />
      </div>
    );
  }

  if (!user || !userProfile) return null;

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
            onRefresh={refresh}
            openViewer={openViewer}
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
            onRefresh={refresh}
            serviceType={userProfile?.service_type ?? userProfile?.student_process_type}
            openViewer={openViewer}
            application={activeApplication ?? null}
          />
        );
      case 'forms':
        return (
          <FormsTab
            forms={data.forms}
            application={activeApplication}
            openViewer={openViewer}
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
      case 'supplemental-data':
        return <SupplementalDataTab data={data.complementaryData} onRefresh={refresh} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f4ee] dark:bg-[#0a0a0a] text-[#1f1a14] dark:text-white">
      <DocumentViewerModal 
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
        url={viewerUrl}
        title={viewerTitle}
      />
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
              onClick={() => void handleSignOut()}
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
