/**
 * ScholarshipApprovalTab — Admin § 8.1–8.3 (Spec V11)
 *
 * Renderizado dentro de AdminUserDetail como aba "Bolsas V11".
 * Gerencia o ciclo completo de aprovação de bolsa:
 *   1. Admin vê as até 4 seleções do aluno
 *   2. Admin escolhe qual aprovar
 *   3. Sistema gera link Parcelow para o Placement Fee
 *   4. Sistema envia e-mail de notificação ao cliente
 *   5. Status atualiza para AGUARD. PAGAMENTO PLACEMENT FEE
 */
import { useEffect, useState, useCallback } from 'react';
import {
  Award, CheckCircle2, Clock, Copy, DollarSign,
  ExternalLink, GraduationCap, Loader2, MapPin, RefreshCw,
  Send, Shield, Timer, X, AlertTriangle, CheckCircle,
  FileText, Package, Link, CreditCard, Download,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import type { CaseDetailPage } from '@/lib/onboarding-crm';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface InstitutionApplication {
  id: string;
  profile_id: string;
  institution_id: string;
  scholarship_level_id: string | null;
  status: string;
  placement_fee_paid_at: string | null;
  placement_fee_installments: number | null;
  placement_fee_2nd_installment_paid_at: string | null;
  admin_approved_at: string | null;
  admin_approved_by: string | null;
  payment_link_url: string | null;
  payment_link_generated_at: string | null;
  forms_status: string | null;
  package_status: string | null;
  package_storage_url: string | null;
  package_sent_at: string | null;
  acceptance_letter_url: string | null;
  created_at: string;
  institutions: {
    id: string;
    name: string;
    slug: string;
    city: string;
    state: string;
    modality: string;
    cpt_opt: string;
    accepts_cos: boolean;
    accepts_transfer: boolean;
    application_fee_usd: number;
    institution_courses: {
      course_name: string;
      degree_level: string;
      area: string;
    }[];
  } | null;
  institution_scholarships: {
    id: string;
    placement_fee_usd: number;
    discount_percent: number;
    tuition_annual_usd: number;
    monthly_migma_usd: number;
    installments_total: number;
  } | null;
}

function statusLabel(s: string) {
  const map: Record<string, { label: string; cls: string }> = {
    pending_admin_approval: { label: 'AGUARD. APROVAÇÃO', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
    approved: { label: 'APROVADA', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
    rejected: { label: 'REJEITADA', cls: 'bg-white/5 text-gray-500 border-white/10' },
    payment_pending: { label: 'AGUARD. PAGAMENTO', cls: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
    payment_confirmed: { label: 'PLACEMENT FEE PAGO', cls: 'bg-green-500/20 text-green-300 border-green-500/30' },
  };
  return map[s] ?? { label: s.toUpperCase(), cls: 'bg-white/5 text-gray-400 border-white/10' };
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

export function ScholarshipApprovalTab({ detail }: { detail: CaseDetailPage }) {
  const { profile } = detail;

  const [applications, setApplications] = useState<InstitutionApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // V11 post-payment states
  const [generatingForms, setGeneratingForms] = useState(false);
  const [buildingPackage, setBuildingPackage] = useState(false);
  const [savingLetterUrl, setSavingLetterUrl] = useState(false);
  const [confirming2nd, setConfirming2nd] = useState(false);
  const [letterUrlInput, setLetterUrlInput] = useState('');
  const [v11Msg, setV11Msg] = useState<{ text: string; ok: boolean } | null>(null);

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('institution_applications')
        .select(`
          id, profile_id, institution_id, scholarship_level_id, status,
          placement_fee_paid_at, placement_fee_installments, placement_fee_2nd_installment_paid_at,
          admin_approved_at, admin_approved_by,
          payment_link_url, payment_link_generated_at,
          forms_status, package_status, package_storage_url, package_sent_at,
          acceptance_letter_url, created_at,
          institutions (
            id, name, slug, city, state, modality, cpt_opt, accepts_cos, accepts_transfer, application_fee_usd,
            institution_courses ( course_name, degree_level, area )
          ),
          institution_scholarships (
            id, placement_fee_usd, discount_percent, tuition_annual_usd, monthly_migma_usd, installments_total
          )
        `)
        .eq('profile_id', profile.id)
        .order('created_at', { ascending: true });

      if (err) throw err;
      setApplications((data as unknown as InstitutionApplication[]) || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [profile.id]);

  useEffect(() => { fetchApplications(); }, [fetchApplications]);

  // ── Derive overall status ──
  const approvedApp = applications.find(a => a.status === 'approved' || a.status === 'payment_pending' || a.status === 'payment_confirmed');
  const overallStatus: 'awaiting' | 'approved' | 'paid' =
    applications.some(a => a.status === 'payment_confirmed') ? 'paid' :
    approvedApp ? 'approved' :
    'awaiting';

  // ── Deadline display ──
  const serviceType = profile.service_type ?? profile.student_process_type;
  const deadlineDate = serviceType === 'transfer' ? profile.transfer_deadline_date : profile.cos_i94_expiry_date;
  const deadlineDays = deadlineDate
    ? Math.ceil((new Date(deadlineDate).getTime() - Date.now()) / 86_400_000)
    : null;

  // ── Approve handler ──
  const handleApprove = async () => {
    const app = applications.find(a => a.id === selectedAppId);
    if (!app || !app.institution_scholarships) return;

    setProcessing(true);
    setActionMsg(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const adminId = session?.user?.id ?? null;

      // 1. Generate Parcelow checkout link for the placement fee
      const placementFee = app.institution_scholarships.placement_fee_usd;
      const originUrl = window.location.origin;

      const fnRes = await supabase.functions.invoke('migma-parcelow-checkout', {
        body: {
          amount: String(placementFee),
          email: profile.email,
          full_name: profile.full_name,
          user_id: profile.user_id,
          reference_suffix: `-APP-${app.id.slice(0, 8)}`,
          redirect_success_override: `${originUrl}/student/onboarding?step=placement_fee&success=true`,
          redirect_failed_override: `${originUrl}/student/onboarding?step=placement_fee&failed=true`,
          parcelow_environment: originUrl.includes('migmainc.com') ? 'production' : 'staging',
        },
      });

      const checkoutUrl: string | null = fnRes.data?.checkout_url ?? fnRes.data?.url_checkout ?? null;

      // 2. Update selected application → approved
      const now = new Date().toISOString();
      const { error: approveErr } = await supabase
        .from('institution_applications')
        .update({
          status: 'payment_pending',
          admin_approved_at: now,
          admin_approved_by: adminId,
          payment_link_url: checkoutUrl,
          payment_link_generated_at: checkoutUrl ? now : null,
        })
        .eq('id', app.id);
      if (approveErr) throw approveErr;

      // 2b. Sync to MatriculaUSA — Caroline/Oikos only (fire-and-forget)
      const institutionSlug = (app.institutions?.slug ?? '').toLowerCase();
      if (institutionSlug.includes('caroline') || institutionSlug.includes('oikos')) {
        supabase.functions.invoke('sync-to-matriculausa', {
          body: { application_id: app.id },
        }).catch(e => console.error('[sync-to-matriculausa]', e));
      }

      // 3. Reject all other pending applications for this profile
      const otherIds = applications
        .filter(a => a.id !== app.id && a.status === 'pending_admin_approval')
        .map(a => a.id);
      if (otherIds.length > 0) {
        await supabase
          .from('institution_applications')
          .update({ status: 'rejected' })
          .in('id', otherIds);
      }

      // 4. Send notification email to student
      if (profile.email) {
        const instName = app.institutions?.name ?? 'universidade selecionada';
        const courseName = app.institutions?.institution_courses?.[0]?.course_name ?? '';
        const discount = app.institution_scholarships.discount_percent;

        await supabase.functions.invoke('send-email', {
          body: {
            to: profile.email,
            subject: `✅ Sua vaga foi aprovada! — ${instName}`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #111;">
                <h2 style="color: #B89E4E;">🎓 Parabéns, ${profile.full_name?.split(' ')[0] ?? 'aluno(a)'}!</h2>
                <p>Sua vaga foi aprovada pela equipe Migma.</p>
                <ul style="background: #f9f9f9; border-left: 4px solid #B89E4E; padding: 16px 24px; border-radius: 4px;">
                  <li><strong>Instituição:</strong> ${instName}</li>
                  ${courseName ? `<li><strong>Curso:</strong> ${courseName}</li>` : ''}
                  <li><strong>Bolsa:</strong> ${discount}% de desconto</li>
                  <li><strong>Placement Fee:</strong> $${placementFee.toLocaleString()}</li>
                </ul>
                ${checkoutUrl ? `
                  <p style="margin-top: 24px;">
                    <a href="${checkoutUrl}" style="background:#B89E4E;color:#000;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">
                      Pagar Placement Fee →
                    </a>
                  </p>
                  <p style="font-size: 12px; color: #666; margin-top: 8px;">
                    Ou acesse pelo portal: <a href="${originUrl}/student/onboarding">${originUrl}/student/onboarding</a>
                  </p>
                ` : `<p>Acesse seu portal para ver o link de pagamento.</p>`}
                <p style="color:#888;font-size:12px;margin-top:32px;">Migma Inc. — suporte@migmainc.com</p>
              </div>
            `,
          },
        });
      }

      setActionMsg('Bolsa aprovada com sucesso! E-mail enviado ao cliente.');
      await fetchApplications();
      setSelectedAppId(null);
    } catch (err: any) {
      setActionMsg(`Erro: ${err.message}`);
    } finally {
      setProcessing(false);
      setShowConfirmDialog(false);
    }
  };

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ── V11 handlers ──

  const handleGenerateForms = async (appId: string) => {
    setGeneratingForms(true);
    setV11Msg(null);
    try {
      const res = await supabase.functions.invoke('generate-institution-forms', {
        body: { application_id: appId },
      });
      if (res.error) throw new Error(res.error.message);
      const n = res.data?.forms_generated ?? '?';
      setV11Msg({ text: `${n} formulários gerados com sucesso.`, ok: true });
      await fetchApplications();
    } catch (e: any) {
      setV11Msg({ text: `Erro: ${e.message}`, ok: false });
    } finally {
      setGeneratingForms(false);
    }
  };

  const handleBuildPackage = async (appId: string) => {
    setBuildingPackage(true);
    setV11Msg(null);
    try {
      const res = await supabase.functions.invoke('package-matriculausa', {
        body: { application_id: appId, force: true },
      });
      if (res.error) throw new Error(res.error.message);
      setV11Msg({ text: `Pacote gerado. ${res.data?.forms_added ?? 0} forms + ${res.data?.docs_added ?? 0} docs.`, ok: true });
      await fetchApplications();
    } catch (e: any) {
      setV11Msg({ text: `Erro: ${e.message}`, ok: false });
    } finally {
      setBuildingPackage(false);
    }
  };

  const handleSaveLetterUrl = async (appId: string) => {
    if (!letterUrlInput.trim()) return;
    setSavingLetterUrl(true);
    setV11Msg(null);
    try {
      const { error } = await supabase
        .from('institution_applications')
        .update({ acceptance_letter_url: letterUrlInput.trim() })
        .eq('id', appId);
      if (error) throw error;
      setV11Msg({ text: 'URL da carta de aceite salva.', ok: true });
      setLetterUrlInput('');
      await fetchApplications();
    } catch (e: any) {
      setV11Msg({ text: `Erro: ${e.message}`, ok: false });
    } finally {
      setSavingLetterUrl(false);
    }
  };

  const handleConfirm2ndInstallment = async (appId: string) => {
    setConfirming2nd(true);
    setV11Msg(null);
    try {
      const { error } = await supabase
        .from('institution_applications')
        .update({ placement_fee_2nd_installment_paid_at: new Date().toISOString() })
        .eq('id', appId);
      if (error) throw error;
      setV11Msg({ text: '2ª parcela confirmada. Carta de aceite desbloqueada para o aluno.', ok: true });
      await fetchApplications();
    } catch (e: any) {
      setV11Msg({ text: `Erro: ${e.message}`, ok: false });
    } finally {
      setConfirming2nd(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Render: loading / error
  // ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-7 h-7 text-gold-medium animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center py-16 space-y-3">
        <AlertTriangle className="w-8 h-8 text-red-400" />
        <p className="text-red-300 text-sm">{error}</p>
        <Button size="sm" onClick={fetchApplications} variant="outline" className="border-white/10 text-white">
          <RefreshCw className="w-4 h-4 mr-2" />
          Tentar Novamente
        </Button>
      </div>
    );
  }

  if (applications.length === 0) {
    return (
      <div className="text-center py-20 text-gray-500">
        <GraduationCap className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">Nenhuma seleção de universidade encontrada para este perfil.</p>
        <p className="text-xs mt-1 text-gray-600">O aluno ainda não completou o passo de seleção de faculdades.</p>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Render: main
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── 8.1 Status Banner ── */}
      <div className={cn(
        'rounded-2xl border px-5 py-4 flex items-center justify-between gap-4',
        overallStatus === 'paid'
          ? 'bg-green-500/10 border-green-500/20'
          : overallStatus === 'approved'
          ? 'bg-blue-500/10 border-blue-500/20'
          : 'bg-amber-500/10 border-amber-500/20'
      )}>
        <div className="flex items-center gap-3">
          {overallStatus === 'paid'
            ? <CheckCircle className="w-6 h-6 text-green-400" />
            : overallStatus === 'approved'
            ? <Clock className="w-6 h-6 text-blue-400 animate-pulse" />
            : <Clock className="w-6 h-6 text-amber-400 animate-pulse" />}
          <div>
            <p className="font-black text-white uppercase tracking-widest text-sm">
              {overallStatus === 'paid'
                ? 'Placement Fee Pago'
                : overallStatus === 'approved'
                ? 'Aguardando Pagamento do Placement Fee'
                : 'Aguardando Aprovação de Bolsa'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {applications.length} seleção(ões) · {applications.filter(a => a.status === 'pending_admin_approval').length} pendente(s)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {deadlineDays !== null && (
            <div className={cn(
              'text-center px-3 py-2 rounded-xl border text-xs font-black',
              deadlineDays <= 7 ? 'bg-red-500/20 border-red-500/30 text-red-300' :
              deadlineDays <= 30 ? 'bg-amber-500/20 border-amber-500/30 text-amber-300' :
              'bg-white/5 border-white/10 text-gray-400'
            )}>
              <Timer className="w-3.5 h-3.5 mx-auto mb-0.5" />
              <div className="text-lg leading-none">{deadlineDays}</div>
              <div className="tracking-widest uppercase opacity-70">dias</div>
            </div>
          )}
          <Button size="sm" onClick={fetchApplications} variant="outline" className="border-white/10 text-white bg-transparent hover:bg-white/10">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* ── Left: Selections (8.1) ── */}
        <div className="xl:col-span-2 space-y-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
            <Award className="w-4 h-4 text-gold-medium" />
            Seleções do Aluno ({applications.length})
          </h3>

          {applications.map(app => {
            const inst = app.institutions;
            const scholar = app.institution_scholarships;
            const course = inst?.institution_courses?.[0];
            const st = statusLabel(app.status);
            const isPending = app.status === 'pending_admin_approval';
            const isSelected = selectedAppId === app.id;

            return (
              <Card
                key={app.id}
                onClick={() => isPending ? setSelectedAppId(isSelected ? null : app.id) : undefined}
                className={cn(
                  'bg-black/30 border transition-all',
                  isPending && 'cursor-pointer',
                  isSelected
                    ? 'border-gold-medium/50 shadow-[0_0_20px_rgba(184,158,78,0.08)]'
                    : isPending
                    ? 'border-white/5 hover:border-white/10'
                    : app.status === 'approved' || app.status === 'payment_pending' || app.status === 'payment_confirmed'
                    ? 'border-emerald-500/20'
                    : 'border-white/5 opacity-50'
                )}
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    {/* Radio / Status indicator */}
                    <div className="mt-1 shrink-0">
                      {isPending ? (
                        <div className={cn(
                          'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all',
                          isSelected ? 'border-gold-medium bg-gold-medium' : 'border-white/20'
                        )}>
                          {isSelected && <div className="w-2 h-2 bg-black rounded-full" />}
                        </div>
                      ) : (
                        <div className="w-5 h-5 flex items-center justify-center">
                          {(app.status === 'approved' || app.status === 'payment_pending' || app.status === 'payment_confirmed')
                            ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            : <X className="w-4 h-4 text-gray-600" />}
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <p className="font-black text-white">{inst?.name ?? '—'}</p>
                          <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3" />
                            {inst?.city}, {inst?.state} · {inst?.modality}
                          </p>
                          {course && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              {course.course_name} — {course.degree_level}
                            </p>
                          )}
                        </div>
                        <Badge className={cn('text-[9px] font-black uppercase border rounded-sm shrink-0', st.cls)}>
                          {st.label}
                        </Badge>
                      </div>

                      {scholar && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          <span className="text-xs bg-gold-medium/10 border border-gold-medium/20 text-gold-medium px-2.5 py-1 rounded-full font-bold">
                            Placement Fee: ${scholar.placement_fee_usd.toLocaleString()}
                          </span>
                          <span className="text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full font-bold">
                            {scholar.discount_percent}% OFF
                          </span>
                          <span className="text-xs bg-white/5 border border-white/10 text-gray-400 px-2.5 py-1 rounded-full font-bold">
                            Tuition: ${scholar.tuition_annual_usd.toLocaleString()}/ano
                          </span>
                        </div>
                      )}

                      {/* Payment link (if approved) */}
                      {app.payment_link_url && (
                        <div className="mt-3 flex items-center gap-2 bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2">
                          <ExternalLink className="w-3.5 h-3.5 text-gold-medium shrink-0" />
                          <span className="text-xs text-gray-400 truncate flex-1 font-mono">
                            {app.payment_link_url}
                          </span>
                          <button
                            onClick={e => { e.stopPropagation(); copyLink(app.payment_link_url!); }}
                            className="shrink-0 text-gray-500 hover:text-white transition-colors"
                          >
                            {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                          </button>
                          <a
                            href={app.payment_link_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="shrink-0 text-gold-medium hover:text-gold-light transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      )}

                      {app.admin_approved_at && (
                        <p className="text-[10px] text-gray-600 mt-2">
                          Aprovado em {fmtDate(app.admin_approved_at)}
                        </p>
                      )}
                      {app.placement_fee_paid_at && (
                        <p className="text-[10px] text-emerald-500 mt-1 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Placement Fee pago em {fmtDate(app.placement_fee_paid_at)}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* ── 8.2 Critérios de Aprovação (informational) ── */}
          <Card className="bg-black/20 border border-white/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                <Shield className="w-4 h-4 text-gold-medium" />
                Critérios de Aprovação CRM Migma
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {[
                'Perfil financeiro compatível com o I-20 da faculdade',
                'Curso coerente com histórico acadêmico e profissional do cliente',
                'Instituição com histórico positivo de aprovação',
                'Início de aulas compatível com o timing do processo',
              ].map((c, i) => (
                <div key={i} className="flex items-center gap-2.5 text-sm text-gray-400">
                  <div className="w-5 h-5 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-[10px] font-black text-gray-500">
                    {i + 1}
                  </div>
                  {c}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* ── Right: Profile Summary + Action (8.3) ── */}
        <div className="space-y-4">

          {/* Profile summary */}
          <Card className="bg-black/30 border border-white/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-gold-medium" />
                Perfil do Aluno
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2 text-sm">
              {[
                { label: 'Serviço', value: profile.service_type },
                { label: 'Área de Interesse', value: profile.field_of_interest },
                { label: 'Nível Acadêmico', value: profile.academic_level },
                { label: 'Dependentes', value: profile.num_dependents != null ? String(profile.num_dependents) : null },
                { label: 'Step Atual', value: profile.onboarding_current_step },
                { label: 'Questionário', value: profile.selection_survey_passed ? '✓ Completo' : '✗ Pendente' },
                { label: 'Selection Fee', value: profile.has_paid_selection_process_fee ? '✓ Pago' : '✗ Pendente' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between py-1 border-b border-white/5 last:border-0">
                  <span className="text-gray-500 text-xs">{label}</span>
                  <span className="text-white text-xs font-medium capitalize">{value || '—'}</span>
                </div>
              ))}

              {/* Deadline destaque */}
              {deadlineDate && (
                <div className={cn(
                  'mt-3 rounded-xl p-3 border text-xs',
                  deadlineDays !== null && deadlineDays <= 7
                    ? 'bg-red-500/10 border-red-500/20 text-red-300'
                    : deadlineDays !== null && deadlineDays <= 30
                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                    : 'bg-white/5 border-white/10 text-gray-400'
                )}>
                  <p className="font-black uppercase tracking-widest text-[10px] mb-1">
                    {serviceType === 'transfer' ? 'Prazo de Transferência' : 'Vencimento I-94'}
                  </p>
                  <p className="font-black text-white">
                    {new Date(deadlineDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                  {deadlineDays !== null && (
                    <p className="mt-0.5">{deadlineDays > 0 ? `${deadlineDays} dias restantes` : 'Prazo expirado'}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── 8.3 Ação do Admin ── */}
          {overallStatus === 'awaiting' && (
            <Card className="bg-black/30 border border-gold-medium/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                  <Award className="w-4 h-4 text-gold-medium" />
                  Aprovação de Bolsa
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                {selectedAppId ? (
                  <div className="bg-gold-medium/5 border border-gold-medium/20 rounded-xl p-3">
                    <p className="text-xs text-gold-medium font-black uppercase tracking-widest mb-1">Selecionado para aprovar:</p>
                    <p className="text-sm text-white font-bold">
                      {applications.find(a => a.id === selectedAppId)?.institutions?.name}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Placement Fee: $
                      {applications.find(a => a.id === selectedAppId)?.institution_scholarships?.placement_fee_usd.toLocaleString()}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 italic">
                    Selecione uma opção na lista ao lado para aprovar.
                  </p>
                )}

                <Button
                  disabled={!selectedAppId || processing}
                  onClick={() => setShowConfirmDialog(true)}
                  className="w-full bg-gold-medium hover:bg-gold-light disabled:opacity-40 text-black font-black uppercase tracking-widest text-xs"
                >
                  {processing
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processando...</>
                    : <><Award className="w-4 h-4 mr-2" />Aprovar Bolsa</>}
                </Button>

                <div className="text-[10px] text-gray-600 space-y-1">
                  <p>• Gera link Parcelow para o Placement Fee</p>
                  <p>• Dispara e-mail de notificação ao cliente</p>
                  <p>• Rejeita automaticamente as outras opções</p>
                  <p>• Status: AGUARD. PAGAMENTO PLACEMENT FEE</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Approved: link card */}
          {approvedApp?.payment_link_url && overallStatus !== 'paid' && (
            <Card className="bg-black/30 border border-blue-500/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-blue-400" />
                  Link de Pagamento Gerado
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <div className="bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2.5 flex items-center gap-2">
                  <span className="text-xs text-gray-400 truncate flex-1 font-mono">
                    {approvedApp.payment_link_url}
                  </span>
                  <button
                    onClick={() => copyLink(approvedApp.payment_link_url!)}
                    className="text-gray-500 hover:text-white transition-colors shrink-0"
                  >
                    {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <a
                  href={approvedApp.payment_link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2.5 bg-blue-500/10 border border-blue-500/20 text-blue-300 hover:bg-blue-500/20 rounded-xl text-xs font-bold transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Abrir Link
                </a>
                {approvedApp.payment_link_generated_at && (
                  <p className="text-[10px] text-gray-600">
                    Gerado em {fmtDate(approvedApp.payment_link_generated_at)}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Action feedback */}
          {actionMsg && (
            <div className={cn(
              'rounded-xl px-4 py-3 text-sm border',
              actionMsg.startsWith('Erro')
                ? 'bg-red-500/10 border-red-500/20 text-red-300'
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
            )}>
              {actionMsg.startsWith('Erro')
                ? <AlertTriangle className="w-4 h-4 inline mr-2" />
                : <CheckCircle2 className="w-4 h-4 inline mr-2" />}
              {actionMsg}
            </div>
          )}

          {/* WhatsApp notice */}
          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
            <p className="text-[10px] text-gray-600 uppercase font-black tracking-widest mb-1.5 flex items-center gap-1.5">
              <Send className="w-3 h-3" />
              Notificações automáticas
            </p>
            <ul className="text-[11px] text-gray-500 space-y-1">
              <li>✉️ E-mail — enviado automaticamente na aprovação</li>
              <li>📱 WhatsApp — integração via n8n (a configurar)</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ── V11 Fluxo Pós-Pagamento ── */}
      {overallStatus === 'paid' && approvedApp && (() => {
        const paidApp = approvedApp as InstitutionApplication;
        const needs2nd = paidApp.placement_fee_installments === 2 && !paidApp.placement_fee_2nd_installment_paid_at;
        return (
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2 pt-2">
              <Package className="w-4 h-4 text-gold-medium" />
              Fluxo V11 — Pós-Pagamento
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* 1. Gerar Formulários */}
              <Card className="bg-black/30 border border-white/10">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gold-medium" />
                    <span className="text-xs font-black uppercase tracking-widest text-gray-300">Formulários PDF</span>
                    {paidApp.forms_status && (
                      <span className={cn(
                        'ml-auto text-[9px] font-black uppercase px-2 py-0.5 rounded-full border',
                        paidApp.forms_status === 'generated' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      )}>
                        {paidApp.forms_status}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    Gera os PDFs dos formulários da universidade com os dados do aluno.
                  </p>
                  <Button
                    size="sm"
                    disabled={generatingForms}
                    onClick={() => handleGenerateForms(paidApp.id)}
                    className="w-full bg-gold-medium/10 border border-gold-medium/20 text-gold-medium hover:bg-gold-medium/20 text-xs font-black"
                    variant="outline"
                  >
                    {generatingForms
                      ? <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />Gerando...</>
                      : <><FileText className="w-3.5 h-3.5 mr-2" />{paidApp.forms_status === 'generated' ? 'Regenerar PDFs' : 'Gerar PDFs'}</>}
                  </Button>
                </CardContent>
              </Card>

              {/* 2. Pacote MatriculaUSA */}
              <Card className="bg-black/30 border border-white/10">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-black uppercase tracking-widest text-gray-300">Pacote MatriculaUSA</span>
                    {paidApp.package_status && (
                      <span className={cn(
                        'ml-auto text-[9px] font-black uppercase px-2 py-0.5 rounded-full border',
                        paidApp.package_status === 'ready' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      )}>
                        {paidApp.package_status}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    Monta ZIP com formulários + documentos e gera link de download (7 dias).
                  </p>
                  <Button
                    size="sm"
                    disabled={buildingPackage}
                    onClick={() => handleBuildPackage(paidApp.id)}
                    className="w-full bg-blue-500/10 border border-blue-500/20 text-blue-300 hover:bg-blue-500/20 text-xs font-black"
                    variant="outline"
                  >
                    {buildingPackage
                      ? <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />Montando...</>
                      : <><Package className="w-3.5 h-3.5 mr-2" />{paidApp.package_status === 'ready' ? 'Remontar Pacote' : 'Montar Pacote'}</>}
                  </Button>
                  {paidApp.package_storage_url && (
                    <a
                      href={paidApp.package_storage_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Baixar ZIP
                    </a>
                  )}
                </CardContent>
              </Card>

              {/* 3. Carta de Aceite */}
              <Card className="bg-black/30 border border-white/10">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Link className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-black uppercase tracking-widest text-gray-300">Carta de Aceite / I-20</span>
                    {paidApp.acceptance_letter_url && (
                      <span className="ml-auto text-[9px] font-black uppercase px-2 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                        Disponível
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    Cole a URL da carta de aceite/I-20 recebida do MatriculaUSA para liberar ao aluno.
                  </p>
                  {paidApp.acceptance_letter_url && (
                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                      <span className="text-xs text-gray-400 truncate flex-1 font-mono">{paidApp.acceptance_letter_url}</span>
                      <a href={paidApp.acceptance_letter_url} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={letterUrlInput}
                      onChange={e => setLetterUrlInput(e.target.value)}
                      placeholder="https://..."
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 outline-none focus:border-emerald-500/40"
                    />
                    <Button
                      size="sm"
                      disabled={savingLetterUrl || !letterUrlInput.trim()}
                      onClick={() => handleSaveLetterUrl(paidApp.id)}
                      className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 text-xs font-black shrink-0"
                      variant="outline"
                    >
                      {savingLetterUrl ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Salvar'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* 4. 2ª Parcela Placement Fee */}
              {needs2nd && (
                <Card className="bg-black/30 border border-amber-500/20">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-black uppercase tracking-widest text-gray-300">2ª Parcela Placement Fee</span>
                      <span className="ml-auto text-[9px] font-black uppercase px-2 py-0.5 rounded-full border bg-amber-500/10 text-amber-400 border-amber-500/20">
                        Pendente
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      Aluno pagou em 2x. Confirme o recebimento da 2ª parcela para desbloquear a carta de aceite.
                    </p>
                    <Button
                      size="sm"
                      disabled={confirming2nd}
                      onClick={() => handleConfirm2ndInstallment(paidApp.id)}
                      className="w-full bg-amber-500/10 border border-amber-500/20 text-amber-300 hover:bg-amber-500/20 text-xs font-black"
                      variant="outline"
                    >
                      {confirming2nd
                        ? <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />Confirmando...</>
                        : <><CheckCircle className="w-3.5 h-3.5 mr-2" />Confirmar 2ª Parcela Recebida</>}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* V11 feedback */}
            {v11Msg && (
              <div className={cn(
                'rounded-xl px-4 py-3 text-sm border',
                v11Msg.ok
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                  : 'bg-red-500/10 border-red-500/20 text-red-300'
              )}>
                {v11Msg.ok
                  ? <CheckCircle2 className="w-4 h-4 inline mr-2" />
                  : <AlertTriangle className="w-4 h-4 inline mr-2" />}
                {v11Msg.text}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Confirmation Dialog ── */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="bg-[#0f0f0f] border border-white/10 text-white max-w-md rounded-3xl">
          <DialogTitle className="text-lg font-black uppercase tracking-tight">
            Confirmar Aprovação de Bolsa
          </DialogTitle>
          <DialogDescription className="text-gray-400 text-sm leading-relaxed">
            Ao confirmar, você aprovará a seleção abaixo, rejeitará as demais e um link de pagamento
            Parcelow será gerado automaticamente para o Placement Fee.
          </DialogDescription>

          {selectedAppId && (() => {
            const app = applications.find(a => a.id === selectedAppId);
            const scholar = app?.institution_scholarships;
            return (
              <div className="bg-gold-medium/5 border border-gold-medium/20 rounded-xl p-4 space-y-2">
                <p className="font-black text-white">{app?.institutions?.name}</p>
                {app?.institutions?.institution_courses?.[0] && (
                  <p className="text-sm text-gray-400">{app.institutions.institution_courses[0].course_name}</p>
                )}
                {scholar && (
                  <div className="flex gap-2 flex-wrap mt-2">
                    <span className="text-xs text-gold-medium font-bold">
                      Placement Fee: ${scholar.placement_fee_usd.toLocaleString()}
                    </span>
                    <span className="text-xs text-emerald-400 font-bold">
                      {scholar.discount_percent}% de desconto
                    </span>
                  </div>
                )}
              </div>
            );
          })()}

          <div className="flex gap-3 mt-2">
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              disabled={processing}
              className="flex-1 border-white/10 text-white bg-transparent hover:bg-white/10"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleApprove}
              disabled={processing}
              className="flex-1 bg-gold-medium hover:bg-gold-light text-black font-black"
            >
              {processing
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Aprovando...</>
                : <><CheckCircle2 className="w-4 h-4 mr-2" />Confirmar Aprovação</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
