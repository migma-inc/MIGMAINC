/**
 * Etapa 10 — my_applications: Tela de aguardando análise (pós-venda).
 * O aluno aguarda enquanto a equipe do Matricula USA processa os documentos.
 */
import React, { useEffect, useState } from 'react';
import {
  Clock, CheckCircle, Building, GraduationCap, FileText,
  RefreshCw, AlertCircle,
} from 'lucide-react';
import { useStudentAuth } from '../../../contexts/StudentAuthContext';
import { matriculaSupabase } from '../../../lib/matriculaSupabase';
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

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:     { label: 'Under Review',  color: 'text-amber-600 bg-amber-50 border-amber-200' },
  in_review:   { label: 'In Review',     color: 'text-blue-600 bg-blue-50 border-blue-200' },
  accepted:    { label: 'Accepted',      color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  rejected:    { label: 'Not Approved',  color: 'text-red-600 bg-red-50 border-red-200' },
};

export const WaitingApprovalStep: React.FC<StepProps> = () => {
  const { user, userProfile } = useStudentAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchData = async () => {
    if (!user?.id || !userProfile?.id) return;
    setLoading(true);
    try {
      const [appsRes, notifRes] = await Promise.all([
        matriculaSupabase
          .from('scholarship_applications')
          .select(`id, status, created_at, scholarship_id, scholarships(id, title, name, universities(name))`)
          .eq('student_id', userProfile.id)
          .order('created_at', { ascending: false }),
        matriculaSupabase
          .from('student_notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10),
      ]);

      setApplications((appsRes.data as unknown as Application[]) || []);
      setNotifications(notifRes.data || []);
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

  return (
    <div className="space-y-8 pb-12 max-w-4xl mx-auto px-4">
      <div className="text-center md:text-left space-y-3">
        <h2 className="text-3xl md:text-5xl font-black text-slate-900 uppercase tracking-tighter">
          My Applications
        </h2>
        <p className="text-lg text-slate-600 font-medium">
          Our team is working on your applications. We'll notify you with updates.
        </p>
      </div>

      {/* Status dos documentos */}
      <div className={`rounded-2xl p-6 border ${
        docsStatus === 'approved' ? 'bg-emerald-50 border-emerald-200' :
        docsStatus === 'rejected' ? 'bg-red-50 border-red-200' :
        'bg-blue-50 border-blue-200'
      }`}>
        <div className="flex items-center gap-3">
          {docsStatus === 'approved'
            ? <CheckCircle className="w-6 h-6 text-emerald-500 flex-shrink-0" />
            : docsStatus === 'rejected'
            ? <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
            : <Clock className="w-6 h-6 text-blue-500 flex-shrink-0 animate-pulse" />
          }
          <div>
            <div className="font-bold text-slate-900">
              {docsStatus === 'approved' ? 'Documents Approved!' :
               docsStatus === 'rejected' ? 'Documents Need Attention' :
               docsStatus === 'under_review' ? 'Documents Under Review' :
               'Documents Submitted'}
            </div>
            <div className="text-sm text-slate-600 mt-0.5">
              {docsStatus === 'approved'
                ? 'Great news! Your documents have been approved. The university acceptance process is underway.'
                : docsStatus === 'rejected'
                ? 'Some documents were not approved. Our team will contact you with instructions.'
                : 'Your documents are being reviewed by the Matricula USA team. This typically takes 3-5 business days.'}
            </div>
          </div>
        </div>
      </div>

      {/* Candidaturas */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Your Applications</h3>
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : applications.length === 0 ? (
          <div className="bg-white border border-slate-100 rounded-2xl p-8 text-center">
            <GraduationCap className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No applications found yet.</p>
          </div>
        ) : (
          applications.map(app => {
            const statusInfo = STATUS_LABELS[app.status] || { label: app.status, color: 'text-slate-600 bg-slate-50 border-slate-200' };
            const scholarshipName = app.scholarships?.title || app.scholarships?.name || 'Scholarship';
            const universityName = app.scholarships?.universities?.name || 'University';

            return (
              <div key={app.id} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <Building className="w-5 h-5 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-900 truncate">{scholarshipName}</div>
                  <div className="text-sm text-slate-500">{universityName}</div>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${statusInfo.color}`}>
                  {statusInfo.label}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Notificações */}
      {notifications.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-500" />
            Updates
          </h3>
          {notifications.slice(0, 5).map(notif => (
            <div key={notif.id} className={`bg-white border rounded-2xl p-4 ${!notif.read_at ? 'border-blue-200 bg-blue-50/30' : 'border-slate-100'}`}>
              <div className="font-medium text-slate-800 text-sm">{notif.title || notif.message}</div>
              {notif.message && notif.title && (
                <div className="text-xs text-slate-500 mt-1">{notif.message}</div>
              )}
              <div className="text-xs text-slate-400 mt-1.5">
                {new Date(notif.created_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="text-xs text-slate-400 text-center flex items-center justify-center gap-1">
        <Clock className="w-3 h-3" />
        Last updated: {lastRefresh.toLocaleTimeString()}
      </div>
    </div>
  );
};
