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

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:     { label: 'Under Review',  color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  in_review:   { label: 'In Review',     color: 'text-gold-medium bg-gold-medium/10 border-gold-medium/20' },
  accepted:    { label: 'Accepted',      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  rejected:    { label: 'Not Approved',  color: 'text-red-400 bg-red-500/10 border-red-500/20' },
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
        supabase
          .from('scholarship_applications')
          .select(`id, status, created_at, scholarship_id, scholarships(id, title, name, universities(name))`)
          .eq('student_id', userProfile.id)
          .order('created_at', { ascending: false }),
        supabase
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
      <div className="space-y-1">
        <p className="text-xs font-black uppercase tracking-widest text-gold-medium">My Applications</p>
        <h2 className="text-2xl font-black text-white uppercase tracking-tight">Application Status</h2>
        <p className="text-sm text-gray-400 font-medium">
          Our team is working on your applications. We'll notify you with updates.
        </p>
      </div>

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
              {docsStatus === 'approved' ? 'Documents Approved!' :
               docsStatus === 'rejected' ? 'Documents Need Attention' :
               docsStatus === 'under_review' ? 'Documents Under Review' :
               'Documents Submitted'}
            </div>
            <div className="text-sm text-gray-400 mt-0.5">
              {docsStatus === 'approved'
                ? 'Great news! Your documents have been approved. The university acceptance process is underway.'
                : docsStatus === 'rejected'
                ? 'Some documents were not approved. Our team will contact you with instructions.'
                : 'Your documents are being reviewed by our team. This typically takes 3-5 business days.'}
            </div>
          </div>
        </div>
      </div>

      {/* Candidaturas */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white">Your Applications</h3>
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-gold-medium" />
          </div>
        ) : applications.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
            <GraduationCap className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No applications found yet.</p>
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
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-gold-medium" />
            Updates
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
        Last updated: {lastRefresh.toLocaleTimeString()}
      </div>
    </div>
  );
};
