/**
 * Etapa 10 — my_applications: Tela de aguardando análise (pós-venda).
 * O aluno aguarda enquanto a equipe do Matricula USA processa os documentos.
 */
import React, { useEffect, useState, useMemo } from 'react';
import {
  Clock, CheckCircle, Building, GraduationCap, FileText,
  RefreshCw, AlertCircle, Timer,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useStudentAuth } from '../../../contexts/StudentAuthContext';
import { supabase } from '../../../lib/supabase';
import type { StepProps } from '../types';

interface Application {
  id: string;
  status: string;
  created_at: string;
  scholarship_id: string;
  scholarships: {
    id: string;
    title?: string;
    name?: string;
    universities: { name: string } | null;
  };
}

interface DocumentRequest {
  id: string;
  document_type: string;
  status: string | null;
  submitted_url: string | null;
  requested_at: string | null;
  submitted_at: string | null;
}

const DOCUMENT_LABELS: Record<string, string> = {
  current_i20: 'I-20 Atual',
  i94: 'I-94',
  f1_visa: 'Visto F-1',
  history_diploma: 'Histórico / Diploma',
  bank_statement: 'Comprovante de Fundos',
  address_us: 'Endereço nos EUA',
  address_br: 'Endereço no Brasil',
  certidoes: 'Certidões',
};

const DOCUMENT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendente', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  in_review: { label: 'Em análise', color: 'text-gold-medium bg-gold-medium/10 border-gold-medium/20' },
  under_review: { label: 'Em análise', color: 'text-gold-medium bg-gold-medium/10 border-gold-medium/20' },
  approved: { label: 'Aprovado', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  rejected: { label: 'Rejeitado', color: 'text-red-400 bg-red-500/10 border-red-500/20' },
};

const STATUS_LABELS: Record<string, { labelKey: string; color: string }> = {
  pending:     { labelKey: 'student_onboarding.waiting.status_pending',   color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  in_review:   { labelKey: 'student_onboarding.waiting.status_in_review', color: 'text-gold-medium bg-gold-medium/10 border-gold-medium/20' },
  accepted:    { labelKey: 'student_onboarding.waiting.status_accepted',  color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  rejected:    { labelKey: 'student_onboarding.waiting.status_rejected',  color: 'text-red-400 bg-red-500/10 border-red-500/20' },
};

export const WaitingApprovalStep: React.FC<StepProps> = () => {
  const { t } = useTranslation();
  const { user, userProfile } = useStudentAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [documentRequests, setDocumentRequests] = useState<DocumentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchData = async () => {
    if (!user?.id || !userProfile?.id) return;
    setLoading(true);
    try {
      const [appsRes, notifRes, docsRes] = await Promise.all([
        supabase
          .from('institution_applications')
          .select(`
            id, status, created_at,
            institutions ( name ),
            institution_scholarships ( scholarship_level )
          `)
          .eq('profile_id', userProfile.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('student_notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('global_document_requests')
          .select('id, document_type, status, submitted_url, requested_at, submitted_at')
          .eq('profile_id', userProfile.id)
          .order('requested_at', { ascending: false }),
      ]);

      // Mapeia os dados do V11 para a interface esperada pelo componente
      const mappedApps = (appsRes.data || []).map((app: any) => ({
        id: app.id,
        status: app.status,
        created_at: app.created_at,
        scholarship_id: '', // Não usado no V11 desta forma
        scholarships: {
          id: '',
          name: app.institution_scholarships?.scholarship_level || 'Bolsa de Estudos',
          universities: { name: app.institutions?.name || 'Universidade' }
        }
      }));

      setApplications(mappedApps as unknown as Application[]);
      setNotifications(notifRes.data || []);
      setDocumentRequests((docsRes.data as DocumentRequest[]) || []);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('[WaitingApprovalStep] Erro:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Polling a cada 5 minutos (conforme documentação)
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user?.id, userProfile?.id]);

  const docsStatus = userProfile?.documents_status;

  // ── Deadline countdown ────────────────────────────────────────────────────
  const deadline = useMemo(() => {
    const serviceType = userProfile?.service_type ?? userProfile?.student_process_type;
    if (serviceType === 'transfer' && userProfile?.transfer_deadline_date) {
      const target = new Date(userProfile.transfer_deadline_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      target.setHours(0, 0, 0, 0);
      const days = Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
      return {
        type: 'transfer' as const,
        label: t('student_onboarding.waiting.deadline_transfer'),
        days,
        date: target.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        alertThresholds: [30, 15, 7, 1],
      };
    }
    if (serviceType === 'cos' && userProfile?.cos_i94_expiry_date) {
      const target = new Date(userProfile.cos_i94_expiry_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      target.setHours(0, 0, 0, 0);
      const days = Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
      return {
        type: 'cos' as const,
        label: t('student_onboarding.waiting.deadline_cos'),
        days,
        date: target.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        alertThresholds: [60, 30, 15, 7],
      };
    }
    return null;
  }, [userProfile]);

  const deadlineUrgency = useMemo(() => {
    if (!deadline) return null;
    if (deadline.days <= 7) return 'critical';
    if (deadline.days <= 15) return 'high';
    if (deadline.days <= (deadline.type === 'cos' ? 60 : 30)) return 'medium';
    return 'ok';
  }, [deadline]);

  return (
    <div className="space-y-8 pb-12 max-w-4xl mx-auto px-4">
      <div className="space-y-1">
        <p className="text-xs font-black uppercase tracking-widest text-gold-medium">{t('student_onboarding.waiting.section_label')}</p>
        <h2 className="text-2xl font-black text-white uppercase tracking-tight">{t('student_onboarding.waiting.title')}</h2>
        <p className="text-sm text-gray-400 font-medium">
          {t('student_onboarding.waiting.subtitle')}
        </p>
      </div>

      {/* Deadline countdown */}
      {deadline && (
        <div className={`rounded-2xl p-5 border ${
          deadlineUrgency === 'critical'
            ? 'bg-red-500/10 border-red-500/30'
            : deadlineUrgency === 'high'
            ? 'bg-amber-500/10 border-amber-500/30'
            : deadlineUrgency === 'medium'
            ? 'bg-yellow-500/10 border-yellow-500/30'
            : 'bg-gold-medium/5 border-gold-medium/20'
        }`}>
          <div className="flex items-start gap-4">
            <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${
              deadlineUrgency === 'critical' ? 'bg-red-500/20' :
              deadlineUrgency === 'high'     ? 'bg-amber-500/20' :
              deadlineUrgency === 'medium'   ? 'bg-yellow-500/20' :
              'bg-gold-medium/10'
            }`}>
              <Timer className={`w-6 h-6 ${
                deadlineUrgency === 'critical' ? 'text-red-400' :
                deadlineUrgency === 'high'     ? 'text-amber-400' :
                deadlineUrgency === 'medium'   ? 'text-yellow-400' :
                'text-gold-medium'
              }`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black uppercase tracking-widest text-gray-500">
                  {deadline.label}
                </span>
                {deadlineUrgency === 'critical' && (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                    {t('student_onboarding.waiting.urgency_critical')}
                  </span>
                )}
                {deadlineUrgency === 'high' && (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    {t('student_onboarding.waiting.urgency_high')}
                  </span>
                )}
              </div>
              <div className={`text-4xl font-black mt-1 tabular-nums ${
                deadlineUrgency === 'critical' ? 'text-red-400' :
                deadlineUrgency === 'high'     ? 'text-amber-400' :
                deadlineUrgency === 'medium'   ? 'text-yellow-300' :
                'text-white'
              }`}>
                {deadline.days > 0 ? deadline.days : 0}
                <span className="text-base font-semibold text-gray-500 ml-1">
                  {deadline.days === 1 ? t('student_onboarding.waiting.days_left_one') : t('student_onboarding.waiting.days_left_other')}
                </span>
              </div>
              <div className="text-sm text-gray-500 mt-0.5">{deadline.date}</div>
              {deadline.days <= 0 && (
                <div className="mt-2 text-sm font-semibold text-red-400 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" />
                  {deadline.type === 'transfer'
                    ? t('student_onboarding.waiting.deadline_passed_transfer')
                    : t('student_onboarding.waiting.deadline_passed_cos')}
                </div>
              )}
              {deadline.days > 0 && deadlineUrgency !== 'ok' && (
                <div className={`mt-2 text-sm font-medium flex items-center gap-1.5 ${
                  deadlineUrgency === 'critical' ? 'text-red-400' :
                  deadlineUrgency === 'high'     ? 'text-amber-400' :
                  'text-yellow-400'
                }`}>
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {deadline.type === 'transfer'
                    ? t('student_onboarding.waiting.deadline_approaching_transfer')
                    : t('student_onboarding.waiting.deadline_approaching_cos')}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Status dos documentos */}
      <div className={`rounded-2xl p-6 border ${
        docsStatus === 'approved' ? 'bg-emerald-500/10 border-emerald-500/20' :
        docsStatus === 'rejected' ? 'bg-red-500/10 border-red-500/20' :
        'bg-gold-medium/5 border-gold-medium/20'
      }`}>
        <div className="flex items-center gap-3">
          {docsStatus === 'approved'
            ? <CheckCircle className="w-6 h-6 text-emerald-400 flex-shrink-0" />
            : docsStatus === 'rejected'
            ? <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
            : <Clock className="w-6 h-6 text-gold-medium flex-shrink-0 animate-pulse" />
          }
          <div>
            <div className="font-bold text-white">
              {docsStatus === 'approved' ? t('student_onboarding.waiting.docs_approved') :
               docsStatus === 'rejected' ? t('student_onboarding.waiting.docs_rejected') :
               docsStatus === 'under_review' ? t('student_onboarding.waiting.docs_under_review') :
               t('student_onboarding.waiting.docs_submitted')}
            </div>
            <div className="text-sm text-gray-400 mt-0.5">
              {docsStatus === 'approved'
                ? t('student_onboarding.waiting.docs_approved_desc')
                : docsStatus === 'rejected'
                ? t('student_onboarding.waiting.docs_rejected_desc')
                : t('student_onboarding.waiting.docs_review_desc')}
            </div>
          </div>
        </div>
      </div>

      {/* Documentos enviados */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white">Documentos enviados</h3>
          <p className="text-xs text-gray-500">Passport aparece na etapa anterior e pode ser atualizado por lá.</p>
        </div>

        {documentRequests.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center text-gray-500 text-sm">
            Nenhum documento complementar enviado ainda.
          </div>
        ) : (
          <div className="grid gap-3">
            {documentRequests.map(doc => {
              const statusInfo = DOCUMENT_STATUS_LABELS[doc.status || 'pending'] || {
                label: doc.status || 'Pendente',
                color: 'text-gray-400 bg-white/5 border-white/10',
              };
              const label = DOCUMENT_LABELS[doc.document_type] || doc.document_type;
              const fileName = doc.submitted_url?.split('/').pop() || 'arquivo enviado';
              const submittedDate = doc.submitted_at || doc.requested_at;

              return (
                <div key={doc.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="font-semibold text-white">{label}</div>
                    <div className="text-sm text-gray-500 truncate">{fileName}</div>
                    {submittedDate && (
                      <div className="text-xs text-gray-600 mt-1">
                        Enviado em {new Date(submittedDate).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <span className={`inline-flex w-fit text-xs font-semibold px-2.5 py-1 rounded-full border ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Candidaturas */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white">{t('student_onboarding.waiting.applications_title')}</h3>
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {t('student_onboarding.waiting.refresh')}
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-gold-medium" />
          </div>
        ) : applications.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
            <GraduationCap className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">{t('student_onboarding.waiting.no_applications')}</p>
          </div>
        ) : (
          applications.map(app => {
            const statusInfo = STATUS_LABELS[app.status] || { label: app.status, color: 'text-gray-400 bg-white/5 border-white/10' };
            const scholarshipName = app.scholarships?.title || app.scholarships?.name || 'Scholarship';
            const universityName = app.scholarships?.universities?.name || 'University';

            return (
              <div key={app.id} className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                  <Building className="w-5 h-5 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white truncate">{scholarshipName}</div>
                  <div className="text-sm text-gray-500">{universityName}</div>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${statusInfo.color}`}>
                  {t(statusInfo.labelKey)}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Notificações */}
      {notifications.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-gold-medium" />
            {t('student_onboarding.waiting.updates_title')}
          </h3>
          {notifications.slice(0, 5).map(notif => (
            <div key={notif.id} className={`border rounded-2xl p-4 ${!notif.read_at ? 'border-gold-medium/20 bg-gold-medium/5' : 'border-white/10 bg-white/5'}`}>
              <div className="font-medium text-white text-sm">{notif.title || notif.message}</div>
              {notif.message && notif.title && (
                <div className="text-xs text-gray-500 mt-1">{notif.message}</div>
              )}
              <div className="text-xs text-gray-600 mt-1.5">
                {new Date(notif.created_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="text-xs text-gray-600 text-center flex items-center justify-center gap-1">
        <Clock className="w-3 h-3" />
        {t('student_onboarding.waiting.last_updated', { time: lastRefresh.toLocaleTimeString() })}
      </div>
    </div>
  );
};
