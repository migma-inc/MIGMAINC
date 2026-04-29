import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  DollarSign,
  FileText,
  Image,
  Download,
  Loader2,
  Mail,
  MapPin,
  Package,
  PauseCircle,
  Phone,
  PlayCircle,
  RefreshCw,
  Shield,
  Tag,
  TrendingUp,
  User,
  UserCheck,
  Workflow,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { getSecureUrl } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import {
  type CaseDetailPage,
  type CrmDocument,
  type CrmEvent,
  type CrmFollowup,
  type CrmIdentityFile,
  type CrmMessage,
  type CrmStageHistory,
  type CrmSurveyResponse,
  type CrmSupportHandoff,
  type CrmSupportChatMessage,
  type CrmVisaOrder,
  OPERATIONAL_STAGE_COLORS,
  OPERATIONAL_STAGE_LABELS,
  createFollowup,
  loadDetailPage,
  resolveFollowup,
  updateCaseOwner,
  updateCaseStatus,
} from '@/lib/onboarding-crm';
import {
  ALL_QUESTIONS,
  SURVEY_SECTIONS,
} from '@/data/migmaSurveyQuestions';
import { reviewGlobalDocuments, reviewStudentDocuments } from '@/lib/student-documents';
import { ScholarshipApprovalTab } from './ScholarshipApprovalTab';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(value: string | number | null) {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(n)) return String(value);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function toLabel(value: string | null | undefined) {
  if (!value) return '—';
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Erro inesperado';
}

function metadataString(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === 'string' ? value : null;
}

function metadataPathString(metadata: Record<string, unknown> | null | undefined, path: string[]) {
  let current: unknown = metadata;
  for (const key of path) {
    if (!current || typeof current !== 'object') return null;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'string' ? current : null;
}

function metadataNumber(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === 'number' ? value : null;
}

function timeAgo(iso: string | null | undefined) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function paymentBadge(status: string | null) {
  if (status === 'completed') return 'bg-green-500/20 text-green-300 border-green-500/30';
  if (status === 'cancelled') return 'bg-white/5 text-gray-500 border-white/10';
  return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
}

function SlaCountdown({ surveyCompletedAt }: { surveyCompletedAt: string | null }) {
  const [timeLeft, setTimeLeft] = useState<{ hours: number; mins: number; secs: number; expired: boolean } | null>(null);

  useEffect(() => {
    if (!surveyCompletedAt) return;
    
    const calculate = () => {
      const deadline = new Date(surveyCompletedAt).getTime() + 24 * 60 * 60 * 1000;
      const diff = deadline - Date.now();
      
      if (diff <= 0) {
        setTimeLeft({ hours: 0, mins: 0, secs: 0, expired: true });
        return;
      }
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft({ hours, mins, secs, expired: false });
    };

    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [surveyCompletedAt]);

  if (!timeLeft) return null;

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div className={cn(
      "rounded-lg border px-4 py-3 flex flex-col items-center justify-center gap-1",
      timeLeft.expired 
        ? "bg-red-500/20 border-red-500/40 text-red-400 animate-pulse" 
        : timeLeft.hours < 6 
          ? "bg-orange-500/20 border-orange-500/40 text-orange-300" 
          : "bg-emerald-500/20 border-emerald-300/40 text-emerald-300"
    )}>
      <span className="text-[10px] font-black uppercase tracking-widest opacity-70">
        {timeLeft.expired ? 'SLA Expirado' : 'Tempo Restante (SLA 24h)'}
      </span>
      <span className="text-2xl font-black tabular-nums">
        {pad(timeLeft.hours)}:{pad(timeLeft.mins)}:{pad(timeLeft.secs)}
      </span>
    </div>
  );
}

function contractBadge(status: string | null) {
  if (status === 'approved') return 'bg-green-500/20 text-green-300 border-green-500/30';
  if (status === 'rejected') return 'bg-red-500/20 text-red-300 border-red-500/30';
  if (status === 'pending') return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
  return 'bg-white/5 text-gray-500 border-white/10';
}

function stageBadge(stage: string | null) {
  if (!stage) return 'bg-white/5 text-gray-500 border-white/10';
  if (stage.includes('awaiting')) return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
  if (stage === 'document_review') return 'bg-sky-500/20 text-sky-300 border-sky-500/30';
  if (stage === 'completed') return 'bg-green-500/20 text-green-300 border-green-500/30';
  if (stage === 'blocked') return 'bg-red-500/20 text-red-300 border-red-500/30';
  if (stage === 'cancelled') return 'bg-white/5 text-gray-500 border-white/10';
  return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 border-b border-white/5 last:border-0">
      <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">{label}</span>
      <span className="text-sm text-white">{value || '—'}</span>
    </div>
  );
}

function SectionCard({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <Card className="bg-black/30 border border-white/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
          <Icon className="w-4 h-4 text-gold-medium" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}

function MentorAssignSection({ profileId, currentMentorId }: { profileId: string; currentMentorId: string | null }) {
  const [mentors, setMentors] = useState<{ id: string; full_name: string | null }[]>([]);
  const [selected, setSelected] = useState(currentMentorId ?? '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void supabase
      .from('referral_mentors')
      .select('profile_id, display_name')
      .eq('active', true)
      .order('display_name', { ascending: true })
      .then(({ data }) => {
        if (data) {
          setMentors(data.map((m) => ({ id: m.profile_id, full_name: m.display_name })));
        }
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    const { error } = await supabase
      .from('user_profiles')
      .update({ mentor_id: selected || null })
      .eq('id', profileId);
    setSaving(false);
    setMsg(error ? `Erro: ${error.message}` : 'Mentor salvo.');
  };

  return (
    <div className="space-y-2">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="w-full rounded-md border border-white/10 bg-white text-black text-sm px-3 py-2"
      >
        <option value="">— Sem mentor atribuído —</option>
        {mentors.map((m) => (
          <option key={m.id} value={m.id}>{m.full_name ?? m.id}</option>
        ))}
      </select>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleSave} disabled={saving} className="bg-gold-medium text-black hover:bg-gold-light font-bold">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Salvar'}
        </Button>
        {msg && <span className={`text-xs ${msg.startsWith('Erro') ? 'text-red-400' : 'text-green-400'}`}>{msg}</span>}
      </div>
      {mentors.length === 0 && (
        <p className="text-xs text-gray-500">Nenhum mentor ativo. Configure a URL de agenda em Admin Profile para criar o mentor.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

type Tab = 'overview' | 'orders' | 'documents' | 'timeline' | 'messages' | 'followups' | 'survey' | 'journey' | 'scholarship' | 'support';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'journey', label: 'Journey' },
  { id: 'survey', label: 'Survey' },
  { id: 'scholarship', label: 'Bolsas' },
  { id: 'support', label: 'Suporte IA' },
  { id: 'orders', label: 'Orders' },
  { id: 'documents', label: 'Documents' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'messages', label: 'Messages' },
  { id: 'followups', label: 'Follow-ups' },
];

// ---------------------------------------------------------------------------
// Tab: Overview
// ---------------------------------------------------------------------------

function OverviewTab({
  detail,
  ownerInput,
  setOwnerInput,
  mutating,
  mutationMsg,
  onAssign,
  onAssignToMe,
  onArchive,
  onStartBilling,
  onSuspendBilling,
  billingMsg,
}: {
  detail: CaseDetailPage;
  ownerInput: string;
  setOwnerInput: (v: string) => void;
  mutating: boolean;
  mutationMsg: string | null;
  onAssign: () => void;
  onAssignToMe: () => void;
  onArchive: () => void;
  onStartBilling: () => void;
  onSuspendBilling: (action: 'suspend' | 'cancel' | 'reactivate') => void;
  billingMsg: string | null;
}) {
  const { profile, primaryRequest, primaryOrder, operationalStage, stageHistory, userIdentity } = detail;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
      {/* Left (2/3) */}
      <div className="xl:col-span-2 space-y-5">
        {/* Client Information */}
        <SectionCard title="Client Information" icon={User}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
            <InfoRow label="Full Name" value={profile.full_name} />
            <InfoRow label="Email" value={<span className="font-mono text-xs">{profile.email}</span>} />
            <InfoRow label="Phone" value={profile.phone} />
            <InfoRow label="Dependents" value={profile.num_dependents != null ? String(profile.num_dependents) : '—'} />
            <InfoRow label="Source" value={toLabel(profile.source)} />
            <InfoRow label="Service Type" value={toLabel(profile.service_type)} />
            <InfoRow label="Onboarding Step" value={toLabel(profile.onboarding_current_step)} />
            <InfoRow label="Email Status" value={toLabel(profile.onboarding_email_status)} />
            <InfoRow label="Seller ID" value={profile.migma_seller_id ? <span className="font-mono text-xs">{profile.migma_seller_id}</span> : '—'} />
            <InfoRow label="Agent ID" value={profile.migma_agent_id ? <span className="font-mono text-xs">{profile.migma_agent_id}</span> : '—'} />
            <InfoRow label="Cross-site" value={profile.matricula_user_id ? <span className="font-mono text-xs">{profile.matricula_user_id}</span> : '—'} />
            <InfoRow label="Registered" value={fmtDate(profile.created_at)} />
            <InfoRow label="Total Paid" value={formatCurrency(profile.total_price_usd)} />
            <InfoRow label="Status" value={toLabel(profile.status)} />
          </div>
          <div className="mt-4 pt-4 border-t border-white/5">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Mentor de Indicação</p>
            <MentorAssignSection profileId={profile.id} currentMentorId={profile.mentor_id} />
          </div>
        </SectionCard>

        {/* Personal Data — user_identity */}
        <SectionCard title="Personal Data" icon={MapPin}>
          {userIdentity ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
              <InfoRow label="Birth Date" value={userIdentity.birth_date ? new Date(userIdentity.birth_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'} />
              <InfoRow label="Marital Status" value={toLabel(userIdentity.marital_status)} />
              <InfoRow label="Document Type" value={toLabel(userIdentity.document_type)} />
              <InfoRow label="Document Number" value={userIdentity.document_number} />
              <InfoRow label="Nationality" value={userIdentity.nationality} />
              <InfoRow label="Country" value={userIdentity.country} />
              <InfoRow label="Address" value={userIdentity.address} />
              <InfoRow label="City" value={userIdentity.city} />
              <InfoRow label="State" value={userIdentity.state} />
              <InfoRow label="Zip Code" value={userIdentity.zip_code} />
              <InfoRow label="Last Updated" value={fmtDate(userIdentity.updated_at)} />
            </div>
          ) : (
            <p className="text-gray-500 text-sm italic">
              {profile.identity_verified
                ? 'Identity verified but data not found.'
                : 'Student has not completed the personal data step yet.'}
            </p>
          )}
        </SectionCard>

        {/* Service Request */}
        {primaryRequest ? (
          <SectionCard title="Service Information" icon={Workflow}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
              <InfoRow label="Service ID" value={<span className="font-mono text-xs">{primaryRequest.service_id}</span>} />
              <InfoRow label="Service Type" value={toLabel(primaryRequest.service_type)} />
              <InfoRow label="Operational Step" value={toLabel(profile.onboarding_current_step)} />
              <InfoRow label="Workflow Stage" value={
                <Badge className={cn('text-[9px] font-black uppercase border rounded-sm', stageBadge(primaryRequest.workflow_stage))}>
                  {toLabel(primaryRequest.workflow_stage)}
                </Badge>
              } />
              <InfoRow label="Case Status" value={toLabel(primaryRequest.case_status)} />
              <InfoRow label="Priority" value={toLabel(primaryRequest.priority)} />
              <InfoRow label="Stage Since" value={fmtDate(primaryRequest.stage_entered_at)} />
              <InfoRow label="Last Contact" value={fmtDate(primaryRequest.last_client_contact_at)} />
              <InfoRow label="Opened" value={fmtDate(primaryRequest.created_at)} />
              <InfoRow label="Last Update" value={fmtDate(primaryRequest.updated_at)} />
              <InfoRow label="Owner ID" value={
                primaryRequest.owner_user_id
                  ? <span className="font-mono text-[11px] text-gray-400">{primaryRequest.owner_user_id}</span>
                  : <span className="text-gray-600 italic">Unassigned</span>
              } />
              <InfoRow label="Email Automation" value={toLabel(profile.onboarding_email_status)} />
            </div>
          </SectionCard>
        ) : (
          <SectionCard title="Service Information" icon={Workflow}>
            <p className="text-gray-500 text-sm italic">No service request linked to this profile.</p>
          </SectionCard>
        )}

        {/* Case Management */}
        {primaryRequest && (
          <SectionCard title="Case Management" icon={Shield}>
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <Input
                  placeholder="Owner UUID"
                  value={ownerInput}
                  onChange={(e) => setOwnerInput(e.target.value)}
                  className="bg-black/40 border-white/10 text-white font-mono text-xs flex-1"
                />
                <Button
                  onClick={onAssign}
                  disabled={mutating}
                  size="sm"
                  className="bg-gold-medium hover:bg-gold-dark text-black font-black shrink-0"
                >
                  {mutating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Owner'}
                </Button>
                <Button
                  onClick={onAssignToMe}
                  disabled={mutating}
                  size="sm"
                  className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold shrink-0"
                >
                  <UserCheck className="w-4 h-4 mr-1.5" />
                  Assign to Me
                </Button>
              </div>

              <div className="flex gap-3 pt-1">
                <Button
                  onClick={onArchive}
                  disabled={mutating}
                  size="sm"
                  className={cn(
                    'font-bold border',
                    primaryRequest.case_status === 'cancelled'
                      ? 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20'
                      : 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
                  )}
                >
                  {primaryRequest.case_status === 'cancelled' ? 'Restore Active' : 'Archive Case'}
                </Button>
              </div>

              {mutationMsg && (
                <p className="text-xs text-gold-light mt-1">{mutationMsg}</p>
              )}
            </div>
          </SectionCard>
        )}
      </div>

      {/* Right sidebar (1/3) */}
      <div className="space-y-5">
        {/* Operational Stage */}
        <SectionCard title="Operational Stage" icon={Activity}>
          <div className="space-y-3">
            <div className={cn(
              'rounded-lg border px-4 py-3 text-center font-black uppercase tracking-widest text-sm',
              OPERATIONAL_STAGE_COLORS[operationalStage]
            )}>
              {OPERATIONAL_STAGE_LABELS[operationalStage]}
            </div>

            {/* SLA Countdown if contract is pending */}
            {primaryOrder?.contract_approval_status === 'pending' && profile.selection_survey_completed_at && (
              <SlaCountdown surveyCompletedAt={profile.selection_survey_completed_at} />
            )}
          </div>
        </SectionCard>

        {/* Payment Status */}
        {primaryOrder && (
          <SectionCard title="Latest Order" icon={DollarSign}>
            <div className="space-y-1.5">
              <InfoRow label="Order" value={<span className="font-mono text-xs">#{primaryOrder.order_number}</span>} />
              <InfoRow label="Product" value={toLabel(primaryOrder.product_slug)} />
              <InfoRow label="Amount" value={formatCurrency(primaryOrder.total_price_usd)} />
              <InfoRow label="Method" value={toLabel(primaryOrder.payment_method)} />
              <InfoRow label="Payment" value={
                <Badge className={cn('text-[9px] font-black uppercase border rounded-sm', paymentBadge(primaryOrder.payment_status))}>
                  {toLabel(primaryOrder.payment_status)}
                </Badge>
              } />
              <InfoRow label="Contract" value={
                <Badge className={cn('text-[9px] font-black uppercase border rounded-sm', contractBadge(primaryOrder.contract_approval_status))}>
                  {toLabel(primaryOrder.contract_approval_status) || 'No contract'}
                </Badge>
              } />
              <InfoRow label="Annex" value={
                <Badge className={cn('text-[9px] font-black uppercase border rounded-sm', contractBadge(primaryOrder.annex_approval_status))}>
                  {toLabel(primaryOrder.annex_approval_status) || '—'}
                </Badge>
              } />
              <InfoRow label="Paid At" value={fmtDate(primaryOrder.paid_at ?? (primaryOrder.payment_status === 'completed' ? primaryOrder.created_at : null))} />
              {primaryOrder.client_country && (
                <InfoRow label="Country" value={primaryOrder.client_country} />
              )}
              {primaryOrder.client_nationality && (
                <InfoRow label="Nationality" value={primaryOrder.client_nationality} />
              )}
            </div>
          </SectionCard>
        )}

        {/* Stage History */}
        {stageHistory.length > 0 && (
          <SectionCard title="Stage History" icon={Workflow}>
            <div className="space-y-2">
              {stageHistory.slice(0, 8).map((h) => (
                <div key={h.id} className="flex flex-col gap-0.5 border-b border-white/5 pb-2 last:border-0 last:pb-0">
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="text-gray-500">{toLabel(h.from_stage) || 'Start'}</span>
                    <span className="text-gray-600">→</span>
                    <span className="text-white font-bold">{toLabel(h.to_stage)}</span>
                  </div>
                  <span className="text-[10px] text-gray-600">{timeAgo(h.created_at)} · {toLabel(h.trigger_source)}</span>
                  {h.reason && <span className="text-[10px] text-gray-500 italic">{h.reason}</span>}
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Profile flags */}
        <SectionCard title="Payment Flags" icon={CheckCircle2}>
          <div className="space-y-1.5 text-[11px]">
            {[
              { label: 'Selection Process Fee', value: profile.has_paid_selection_process_fee },
              { label: 'Application Fee', value: profile.is_application_fee_paid },
              { label: 'Scholarship Fee', value: profile.is_scholarship_fee_paid },
              { label: 'College Enrollment Fee', value: profile.has_paid_college_enrollment_fee },
              { label: 'I-20 Control Fee', value: profile.has_paid_i20_control_fee },
              { label: 'Placement Fee', value: profile.is_placement_fee_paid },
              { label: 'Selection Survey', value: profile.selection_survey_passed },
              { label: 'Placement Flow', value: profile.placement_fee_flow },
              { label: 'Onboarding Completed', value: profile.onboarding_completed },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-1 border-b border-white/5 last:border-0">
                <span className="text-gray-400">{label}</span>
                {value
                  ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                  : <span className="text-gray-600">—</span>
                }
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Billing Recorrente */}
        <SectionCard title="Billing Recorrente" icon={TrendingUp}>
          {detail.recurringCharge ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <InfoRow label="Status" value={
                  <Badge className={cn('text-[9px] font-black uppercase border rounded-sm',
                    detail.recurringCharge.status === 'active' ? 'bg-green-500/10 border-green-500/30 text-green-400' :
                    detail.recurringCharge.status === 'suspended' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' :
                    'bg-red-500/10 border-red-500/30 text-red-400'
                  )}>
                    {detail.recurringCharge.status}
                  </Badge>
                } />
                <InfoRow label="Valor/mês" value={`$${detail.recurringCharge.monthly_usd.toLocaleString('en-US')}`} />
                <InfoRow label="Parcelas" value={`${detail.recurringCharge.installments_paid} / ${detail.recurringCharge.installments_total}`} />
                <InfoRow label="Próx. cobrança" value={detail.recurringCharge.next_billing_date ?? '—'} />
                {detail.recurringCharge.suspended_reason && (
                  <InfoRow label="Motivo suspensão" value={<span className="text-yellow-400 text-xs">{detail.recurringCharge.suspended_reason}</span>} />
                )}
              </div>
              <div className="flex gap-2 pt-1 flex-wrap">
                {detail.recurringCharge.status === 'active' && (
                  <Button size="sm" onClick={() => onSuspendBilling('suspend')} disabled={mutating}
                    className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20 font-bold text-xs">
                    <PauseCircle className="w-3.5 h-3.5 mr-1.5" />Suspender
                  </Button>
                )}
                {detail.recurringCharge.status === 'suspended' && (
                  <Button size="sm" onClick={() => onSuspendBilling('reactivate')} disabled={mutating}
                    className="bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 font-bold text-xs">
                    <PlayCircle className="w-3.5 h-3.5 mr-1.5" />Reativar
                  </Button>
                )}
                {detail.recurringCharge.status !== 'cancelled' && (
                  <Button size="sm" onClick={() => onSuspendBilling('cancel')} disabled={mutating}
                    className="bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 font-bold text-xs">
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-gray-500 text-sm italic">Nenhum billing ativo.</p>
              {detail.institutionApplication && (
                <Button size="sm" onClick={onStartBilling} disabled={mutating}
                  className="bg-gold-medium hover:bg-gold-dark text-black font-black w-full">
                  <PlayCircle className="w-4 h-4 mr-1.5" />Iniciar Billing
                </Button>
              )}
              {!detail.institutionApplication && (
                <p className="text-gray-600 text-xs">Aguardando application V11.</p>
              )}
            </div>
          )}
          {billingMsg && <p className="text-xs text-gold-light mt-2">{billingMsg}</p>}
        </SectionCard>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Orders
// ---------------------------------------------------------------------------

function OrdersTab({
  orders,
}: {
  orders: CrmVisaOrder[];
}) {
  if (orders.length === 0) {
    return <EmptyState icon={DollarSign} message="No orders found for this profile." />;
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <Card key={order.id} className="bg-black/30 border border-white/5">
          <CardContent className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <Tag className="w-4 h-4 text-gold-medium shrink-0" />
                <div>
                  <span className="font-mono font-bold text-white text-sm">#{order.order_number}</span>
                  <span className="text-gray-500 text-xs ml-2">{toLabel(order.product_slug)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={cn('text-[9px] font-black uppercase border rounded-sm', paymentBadge(order.payment_status))}>
                  {toLabel(order.payment_status)}
                </Badge>
                {order.contract_approval_status && (
                  <Badge className={cn('text-[9px] font-black uppercase border rounded-sm', contractBadge(order.contract_approval_status))}>
                    Contract: {toLabel(order.contract_approval_status)}
                  </Badge>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[11px]">
              <div>
                <span className="text-gray-500 block uppercase tracking-wider mb-0.5">Amount</span>
                <span className="text-white font-bold">{formatCurrency(order.total_price_usd)}</span>
              </div>
              <div>
                <span className="text-gray-500 block uppercase tracking-wider mb-0.5">Method</span>
                <span className="text-white">{toLabel(order.payment_method)}</span>
              </div>
              <div>
                <span className="text-gray-500 block uppercase tracking-wider mb-0.5">Created</span>
                <span className="text-white">{fmtDate(order.created_at)}</span>
              </div>
              <div>
                <span className="text-gray-500 block uppercase tracking-wider mb-0.5">Paid At</span>
                <span className="text-white">{fmtDate(order.paid_at ?? (order.payment_status === 'completed' ? order.created_at : null))}</span>
              </div>
              {order.annex_approval_status && (
                <div>
                  <span className="text-gray-500 block uppercase tracking-wider mb-0.5">Annex</span>
                  <Badge className={cn('text-[9px] font-black uppercase border rounded-sm', contractBadge(order.annex_approval_status))}>
                    {toLabel(order.annex_approval_status)}
                  </Badge>
                </div>
              )}
              {order.client_country && (
                <div>
                  <span className="text-gray-500 block uppercase tracking-wider mb-0.5">Country</span>
                  <span className="text-white">{order.client_country}</span>
                </div>
              )}
              {order.client_nationality && (
                <div>
                  <span className="text-gray-500 block uppercase tracking-wider mb-0.5">Nationality</span>
                  <span className="text-white">{order.client_nationality}</span>
                </div>
              )}
              {order.service_request_id && (
                <div className="sm:col-span-2">
                  <span className="text-gray-500 block uppercase tracking-wider mb-0.5">Service Request</span>
                  <span className="font-mono text-gray-400 text-[10px]">{order.service_request_id}</span>
                </div>
              )}
              <div>
                <span className="text-gray-500 block uppercase tracking-wider mb-0.5">Terms</span>
                <span className={cn('font-bold', order.contract_accepted ? 'text-emerald-300' : 'text-red-300')}>
                  {order.contract_accepted ? 'Accepted' : 'Missing'}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block uppercase tracking-wider mb-0.5">Identity</span>
                <span className={cn('font-bold', order.contract_selfie_url ? 'text-amber-300' : 'text-red-300')}>
                  {order.contract_selfie_url ? 'Pending Review' : 'Missing'}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block uppercase tracking-wider mb-0.5">Signature</span>
                <span className={cn('font-bold', order.signature_image_url ? 'text-emerald-300' : 'text-red-300')}>
                  {order.signature_image_url ? 'Captured' : 'Missing'}
                </span>
              </div>
              {order.ip_address && (
                <div>
                  <span className="text-gray-500 block uppercase tracking-wider mb-0.5">Client IP</span>
                  <span className="font-mono text-gray-400 text-[10px]">{order.ip_address}</span>
                </div>
              )}
              {order.contract_approval_reviewed_at && (
                <div className="sm:col-span-2">
                  <span className="text-gray-500 block uppercase tracking-wider mb-0.5">Reviewed</span>
                  <span className="text-gray-300">
                    {fmtDate(order.contract_approval_reviewed_at)}
                    {order.contract_approval_reviewed_by ? ` by ${order.contract_approval_reviewed_by}` : ''}
                  </span>
                </div>
              )}
              {order.contract_approval_admin_ip && (
                <div>
                  <span className="text-gray-500 block uppercase tracking-wider mb-0.5">Admin IP</span>
                  <span className="font-mono text-gray-400 text-[10px]">{order.contract_approval_admin_ip}</span>
                </div>
              )}
            </div>

          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Documents
// ---------------------------------------------------------------------------

const FILE_TYPE_LABELS: Record<string, string> = {
  document_front: 'ID — Front',
  document_back: 'ID — Back',
  selfie_doc: 'Selfie with ID',
};

type VisaOrderDocument = {
  id: string;
  label: string;
  url: string | null;
  orderNumber: string | null;
  forceIsPdf?: boolean;
};

function buildVisaOrderDocuments(orders: CrmVisaOrder[]): VisaOrderDocument[] {
  const docs: VisaOrderDocument[] = [];

  for (const order of orders) {
    const orderNumber = order.order_number;
    const baseId = order.id;

    if (order.contract_document_url) {
      docs.push({
        id: `${baseId}-document-front`,
        label: 'Document Front',
        url: order.contract_document_url,
        orderNumber,
      });
    }

    if (order.contract_document_back_url) {
      docs.push({
        id: `${baseId}-document-back`,
        label: 'Document Back',
        url: order.contract_document_back_url,
        orderNumber,
      });
    }

    if (order.contract_selfie_url) {
      docs.push({
        id: `${baseId}-selfie`,
        label: 'Selfie with Document',
        url: order.contract_selfie_url,
        orderNumber,
      });
    }

    if (order.signature_image_url) {
      docs.push({
        id: `${baseId}-signature`,
        label: 'Signature',
        url: order.signature_image_url,
        orderNumber,
      });
    }

    if (order.contract_pdf_url) {
      docs.push({
        id: `${baseId}-contract-pdf`,
        label: 'Contract PDF',
        url: order.contract_pdf_url,
        orderNumber,
        forceIsPdf: true,
      });
    }

    if (order.annex_pdf_url) {
      docs.push({
        id: `${baseId}-annex-pdf`,
        label: 'Annex PDF',
        url: order.annex_pdf_url,
        orderNumber,
      });
    }
  }

  return docs;
}

function DocumentsTab({
  profileId,
  profileUserId,
  adminId,
  onRefresh,
  institutionApplication,
  institutionForms,
  files,
  srDocuments,
  studentDocuments,
  globalDocumentRequests,
  orderDocuments,
}: {
  profileId: string;
  profileUserId: string | null;
  adminId: string | null;
  onRefresh: () => Promise<void>;
  institutionApplication: CaseDetailPage['institutionApplication'];
  institutionForms: CaseDetailPage['institutionForms'];
  files: CrmIdentityFile[];
  srDocuments: CrmDocument[];
  studentDocuments: CaseDetailPage['studentDocuments'];
  globalDocumentRequests: CaseDetailPage['globalDocumentRequests'];
  orderDocuments: VisaOrderDocument[];
}) {
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string>>({});
  const [loadingUrls, setLoadingUrls] = useState(true);
  const [mediaModal, setMediaModal] = useState<{
    url: string;
    label: string;
    reviewTarget?: {
      scope: 'student' | 'global';
      documentId: string;
      status: string | null;
      rejectionReason?: string | null;
    };
  } | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [reviewDialog, setReviewDialog] = useState<{
    scope: 'student' | 'global';
    decision: 'approve' | 'reject';
  } | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [modalRejecting, setModalRejecting] = useState(false);
  const [generatingForms, setGeneratingForms] = useState(false);
  const [buildingPackage, setBuildingPackage] = useState(false);
  const [matriculaMsg, setMatriculaMsg] = useState<{ text: string; ok: boolean } | null>(null);

  function openModal(
    url: string,
    label: string,
    reviewTarget?: {
      scope: 'student' | 'global';
      documentId: string;
      status: string | null;
      rejectionReason?: string | null;
    }
  ) {
    setMediaModal({ url, label, reviewTarget });
    setModalRejecting(false);
  }

  function isPdf(url: string) {
    return url.split('?')[0].toLowerCase().endsWith('.pdf');
  }

  const runGenerateForms = async () => {
    if (!institutionApplication) return;

    setGeneratingForms(true);
    setMatriculaMsg(null);
    try {
      const res = await supabase.functions.invoke('generate-institution-forms', {
        body: { application_id: institutionApplication.id },
      });
      if (res.error) throw new Error(res.error.message);
      const generated = res.data?.forms_generated ?? res.data?.forms?.length ?? '?';
      setMatriculaMsg({ text: `${generated} formulários gerados com sucesso.`, ok: true });
      await onRefresh();
    } catch (e) {
      setMatriculaMsg({ text: `Erro ao gerar PDFs: ${errorMessage(e)}`, ok: false });
    } finally {
      setGeneratingForms(false);
    }
  };

  const runBuildPackage = async () => {
    if (!institutionApplication) return;

    setBuildingPackage(true);
    setMatriculaMsg(null);
    try {
      const res = await supabase.functions.invoke('package-matriculausa', {
        body: { application_id: institutionApplication.id },
      });
      if (res.error) throw new Error(res.error.message);
      setMatriculaMsg({
        text: `Pacote gerado. ${res.data?.forms_added ?? 0} formulários + ${res.data?.docs_added ?? 0} documentos.`,
        ok: true,
      });
      await onRefresh();
    } catch (e) {
      setMatriculaMsg({ text: `Erro ao montar pacote: ${errorMessage(e)}`, ok: false });
    } finally {
      setBuildingPackage(false);
    }
  };

  const runReview = async () => {
    if (!profileId || !profileUserId || !adminId) return;

    if (!reviewDialog) return;

    const reason = reviewDialog.decision === 'reject' ? rejectionReason.trim() : undefined;
    if (reviewDialog.decision === 'reject' && !reason) {
      return;
    }

    setReviewing(true);
    try {
      const result = reviewDialog.scope === 'global'
        ? await reviewGlobalDocuments(profileId, reviewDialog.decision, adminId, reason)
        : await reviewStudentDocuments(profileId, reviewDialog.decision, adminId, reason);

      if (!result.success) {
        alert(result.error || 'Falha ao revisar documentos');
        return;
      }

      setReviewDialog(null);
      await onRefresh();
    } finally {
      setReviewing(false);
    }
  };

  const runModalReview = async (decision: 'approve' | 'reject') => {
    if (!profileId || !profileUserId || !adminId || !mediaModal?.reviewTarget) return;

    const reason = decision === 'reject' ? rejectionReason.trim() : undefined;
    if (decision === 'reject' && !reason) {
      return;
    }

    setReviewing(true);
    try {
      const result = mediaModal.reviewTarget.scope === 'global'
        ? await reviewGlobalDocuments(
            profileId,
            decision,
            adminId,
            reason,
            mediaModal.reviewTarget.documentId
          )
        : await reviewStudentDocuments(
            profileId,
            decision,
            adminId,
            reason,
            mediaModal.reviewTarget.documentId
          );

      if (!result.success) {
        alert(result.error || 'Falha ao revisar documentos');
        return;
      }

      setMediaModal(null);
      setModalRejecting(false);
      setRejectionReason('');
      await onRefresh();
    } finally {
      setReviewing(false);
    }
  };

  useEffect(() => {
    if (files.length === 0 && studentDocuments.length === 0 && globalDocumentRequests.length === 0 && orderDocuments.length === 0) { setLoadingUrls(false); return; }
    (async () => {
      const resolved: Record<string, string> = {};
      for (const f of files) {
        const url = await getSecureUrl(f.file_path);
        if (url) resolved[f.id] = url;
      }
      for (const doc of studentDocuments) {
        if (!doc.file_url) continue;
        const url = await getSecureUrl(doc.file_url);
        if (url) resolved[doc.id] = url;
      }
      for (const doc of globalDocumentRequests) {
        if (!doc.submitted_url) continue;
        const url = await getSecureUrl(doc.submitted_url);
        if (url) resolved[doc.id] = url;
      }
      for (const doc of orderDocuments) {
        if (!doc.url) continue;
        const url = await getSecureUrl(doc.url);
        if (url) resolved[doc.id] = url;
      }
      setResolvedUrls(resolved);
      setLoadingUrls(false);
    })();
  }, [files, studentDocuments, globalDocumentRequests, orderDocuments]);

  const hasAnything = !!institutionApplication || institutionForms.length > 0 || files.length > 0 || srDocuments.length > 0 || studentDocuments.length > 0 || globalDocumentRequests.length > 0 || orderDocuments.length > 0;
  if (!hasAnything) {
    return <EmptyState icon={Image} message="No documents found for this case." />;
  }

  const studentReviewSummary =
    studentDocuments.length === 0
      ? null
      : studentDocuments.some((doc) => doc.status === 'rejected')
        ? 'rejected'
        : studentDocuments.every((doc) => doc.status === 'approved')
          ? 'approved'
          : studentDocuments.some((doc) => doc.status === 'under_review')
            ? 'under_review'
            : 'pending';
  const visibleStudentDocuments = studentDocuments;

  const globalDocumentOrder: Record<string, number> = {
    current_i20: 1,
    i94: 2,
    f1_visa: 3,
    history_diploma: 4,
    bank_statement: 5,
    address_us: 6,
    address_br: 7,
    certidoes: 8,
  };
  const orderedGlobalDocumentRequests = [...globalDocumentRequests].sort(
    (a, b) => (globalDocumentOrder[a.document_type] ?? 999) - (globalDocumentOrder[b.document_type] ?? 999)
  );

  return (
    <div className="space-y-8">
      {/* MatriculaUSA package operations */}
      {(institutionApplication || institutionForms.length > 0) && (
        <Card className="bg-black/30 border border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-gray-300 flex items-center gap-2">
              <Package className="w-4 h-4 text-gold-medium" />
              Formulários e Pacote MatriculaUSA
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Application</p>
                <p className="mt-1 text-sm font-bold text-white">{toLabel(institutionApplication?.status)}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">PDFs</p>
                <p className="mt-1 text-sm font-bold text-white">
                  {institutionApplication?.forms_status ? toLabel(institutionApplication.forms_status) : `${institutionForms.length} gerado(s)`}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Assinados</p>
                <p className="mt-1 text-sm font-bold text-white">
                  {institutionForms.filter((form) => !!form.signed_url || !!form.signed_at).length} / {institutionForms.length}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Lidos</p>
                <p className="mt-1 text-sm font-bold text-white">
                  {institutionForms.filter((form) => !!metadataString(form.signature_metadata_json, 'pdf_opened_at')).length} / {institutionForms.length}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Pacote</p>
                <p className="mt-1 text-sm font-bold text-white">{toLabel(institutionApplication?.package_status)}</p>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-3">
              <Button
                size="sm"
                disabled={!institutionApplication || generatingForms}
                onClick={runGenerateForms}
                className="bg-gold-medium/10 border border-gold-medium/20 text-gold-medium hover:bg-gold-medium/20 text-xs font-black"
                variant="outline"
              >
                {generatingForms
                  ? <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />Gerando PDFs...</>
                  : <><FileText className="w-3.5 h-3.5 mr-2" />{institutionApplication?.forms_status === 'generated' ? 'Regenerar PDFs' : 'Gerar PDFs'}</>}
              </Button>
              <Button
                size="sm"
                disabled={!institutionApplication || buildingPackage || institutionForms.length === 0}
                onClick={runBuildPackage}
                className="bg-blue-500/10 border border-blue-500/20 text-blue-300 hover:bg-blue-500/20 text-xs font-black"
                variant="outline"
              >
                {buildingPackage
                  ? <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />Montando pacote...</>
                  : <><Package className="w-3.5 h-3.5 mr-2" />{institutionApplication?.package_status === 'ready' ? 'Remontar Pacote' : 'Montar Pacote'}</>}
              </Button>
              {institutionApplication?.package_storage_url && (
                <a
                  href={institutionApplication.package_storage_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center justify-center rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 text-xs font-black uppercase tracking-wide text-emerald-300 hover:bg-emerald-500/20"
                >
                  <Download className="w-3.5 h-3.5 mr-2" />
                  Baixar ZIP
                </a>
              )}
            </div>

            {matriculaMsg && (
              <div className={cn(
                'rounded-xl border px-4 py-3 text-xs font-bold',
                matriculaMsg.ok
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                  : 'bg-red-500/10 border-red-500/20 text-red-300'
              )}>
                {matriculaMsg.text}
              </div>
            )}

            {institutionForms.length > 0 && (
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-3">Formulários Gerados</div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {institutionForms.map((form) => {
                    const signedUrl = form.signed_url;
                    const originalUrl = form.template_url;
                    const signed = !!signedUrl || !!form.signed_at;
                    const openedAt = metadataString(form.signature_metadata_json, 'pdf_opened_at');
                    const lastOpenedAt = metadataString(form.signature_metadata_json, 'last_pdf_opened_at') ?? openedAt;
                    const openCount = metadataNumber(form.signature_metadata_json, 'pdf_open_count');
                    const confirmedAt = metadataString(form.signature_metadata_json, 'signer_confirmed_at') ?? form.signed_at;
                    const signatureCapture = metadataString(form.signature_metadata_json, 'signature_capture');
                    const identityPhotoUrl = metadataPathString(form.signature_metadata_json, ['identity', 'identity_photo_url'])
                      ?? metadataPathString(form.signature_metadata_json, ['identity', 'selfie_doc', 'url'])
                      ?? metadataString(form.signature_metadata_json, 'selfie_doc_url')
                      ?? metadataString(form.signature_metadata_json, 'identity_photo_url');
                    const identityPhotoHash = metadataPathString(form.signature_metadata_json, ['identity', 'identity_photo_sha256'])
                      ?? metadataPathString(form.signature_metadata_json, ['identity', 'selfie_doc', 'sha256'])
                      ?? metadataString(form.signature_metadata_json, 'identity_photo_sha256');
                    const documentFrontUrl = metadataPathString(form.signature_metadata_json, ['identity', 'document_front', 'url'])
                      ?? metadataString(form.signature_metadata_json, 'document_front_url');
                    const documentBackUrl = metadataPathString(form.signature_metadata_json, ['identity', 'document_back', 'url'])
                      ?? metadataString(form.signature_metadata_json, 'document_back_url');
                    return (
                      <div key={form.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-white">{toLabel(form.form_type)}</p>
                            <p className="mt-1 text-[10px] text-gray-500">Gerado em {fmtDate(form.generated_at)}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Badge className={cn(
                              'text-[9px] font-black uppercase border rounded-sm',
                              signed ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            )}>
                              {signed ? 'Assinado' : 'Pendente'}
                            </Badge>
                            <Badge className={cn(
                              'text-[9px] font-black uppercase border rounded-sm',
                              openedAt ? 'bg-blue-500/10 text-blue-300 border-blue-500/20' : 'bg-white/5 text-gray-500 border-white/10'
                            )}>
                              {openedAt ? 'PDF lido' : 'Não lido'}
                            </Badge>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-1.5 text-[10px] text-gray-500">
                          <div className="flex items-center justify-between gap-3">
                            <span>Primeira leitura</span>
                            <span className={openedAt ? 'text-blue-300' : 'text-gray-600'}>{fmtDate(openedAt)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span>Última abertura</span>
                            <span className={lastOpenedAt ? 'text-blue-300' : 'text-gray-600'}>
                              {lastOpenedAt ? `${fmtDate(lastOpenedAt)}${openCount ? ` · ${openCount}x` : ''}` : '—'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span>Confirmação assinatura</span>
                            <span className={confirmedAt ? 'text-emerald-300' : 'text-gray-600'}>{fmtDate(confirmedAt)}</span>
                          </div>
                          {signatureCapture && (
                            <div className="flex items-center justify-between gap-3">
                              <span>Modo</span>
                              <span className="text-gray-300">{toLabel(signatureCapture)}</span>
                            </div>
                          )}
                          {(documentFrontUrl || documentBackUrl || identityPhotoUrl) && (
                            <div className="flex items-center justify-between gap-3">
                              <span>Docs identidade</span>
                              <span className="text-emerald-300">
                                {[documentFrontUrl, documentBackUrl, identityPhotoUrl].filter(Boolean).length}/3 recebidos
                              </span>
                            </div>
                          )}
                          {identityPhotoHash && (
                            <div className="flex items-center justify-between gap-3">
                              <span>Hash foto</span>
                              <span className="max-w-[160px] truncate font-mono text-gray-400" title={identityPhotoHash}>{identityPhotoHash}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {originalUrl && (
                            <a
                              href={originalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-gray-300 hover:bg-white/10"
                            >
                              <FileText className="w-3 h-3 mr-1.5" />
                              Original
                            </a>
                          )}
                          {signedUrl && (
                            <a
                              href={signedUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-emerald-300 hover:bg-emerald-500/20"
                            >
                              <CheckCircle2 className="w-3 h-3 mr-1.5" />
                              Assinado
                            </a>
                          )}
                          {identityPhotoUrl && (
                            <a
                              href={identityPhotoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center rounded-md border border-blue-500/20 bg-blue-500/10 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-blue-300 hover:bg-blue-500/20"
                            >
                              <Image className="w-3 h-3 mr-1.5" />
                              Foto ID
                            </a>
                          )}
                          {documentFrontUrl && (
                            <a
                              href={documentFrontUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center rounded-md border border-blue-500/20 bg-blue-500/10 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-blue-300 hover:bg-blue-500/20"
                            >
                              <Image className="w-3 h-3 mr-1.5" />
                              Doc Front
                            </a>
                          )}
                          {documentBackUrl && (
                            <a
                              href={documentBackUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center rounded-md border border-blue-500/20 bg-blue-500/10 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-blue-300 hover:bg-blue-500/20"
                            >
                              <Image className="w-3 h-3 mr-1.5" />
                              Doc Back
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Visa order documents */}
      {orderDocuments.length > 0 && (
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-3">Order Documents</div>
          <div className="flex flex-wrap gap-4">
            {orderDocuments.map((doc) => {
              const url = resolvedUrls[doc.id] ?? doc.url;
              const label = doc.label;
              const pdf = doc.forceIsPdf || (url ? isPdf(url) : false);
              return (
                <div
                  key={doc.id}
                  onClick={() => {
                      if (url) {
                        if (pdf) window.open(url, '_blank');
                        else openModal(url, label);
                      }
                  }}
                  className="group relative cursor-pointer w-28 h-28 sm:w-32 sm:h-32 rounded-lg overflow-hidden border border-white/20 bg-black/50 hover:border-white transition-all hover:scale-105 duration-300 shadow-lg shadow-black/50"
                >
                  {url && !pdf ? (
                    <img
                      src={url}
                      alt={label}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-white/5">
                        {pdf ? <FileText className="w-8 h-8 text-gray-400" /> : <Image className="w-8 h-8 text-gray-600" />}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      {pdf ? <FileText className="w-6 h-6 text-white" /> : <Image className="w-6 h-6 text-white" />}
                  </div>
                  <div className="absolute bottom-0 inset-x-0 bg-black/80 text-[9px] leading-tight min-h-[32px] flex items-center justify-center text-center text-white py-1 px-1 uppercase tracking-wider z-10 font-bold line-clamp-2">
                      {label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Operational documents */}
      {srDocuments.length > 0 && (
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-3">Operational Documents</div>
          <div className="flex flex-wrap gap-4">
            {srDocuments.map((doc) => {
              const url = doc.storage_url;
              const label = toLabel(doc.document_type) || 'Document';
              const pdf = url ? isPdf(url) : false;
              return (
                <div
                  key={doc.id}
                  onClick={() => {
                      if (url) {
                        if (pdf) window.open(url, '_blank');
                        else openModal(url, label);
                      }
                  }}
                  className="group relative cursor-pointer w-28 h-28 sm:w-32 sm:h-32 rounded-lg overflow-hidden border border-white/20 bg-black/50 hover:border-white transition-all hover:scale-105 duration-300 shadow-lg shadow-black/50"
                >
                  {url && !pdf ? (
                    <img
                      src={url}
                      alt={label}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-white/5">
                        {pdf ? <FileText className="w-8 h-8 text-gray-400" /> : <Image className="w-8 h-8 text-gray-600" />}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      {pdf ? <FileText className="w-6 h-6 text-white" /> : <Image className="w-6 h-6 text-white" />}
                  </div>
                  <div className="absolute bottom-0 inset-x-0 bg-black/80 text-[9px] leading-tight min-h-[32px] flex items-center justify-center text-center text-white py-1 px-1 uppercase tracking-wider z-10 font-bold line-clamp-2">
                      {label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Complementary documents */}
      {orderedGlobalDocumentRequests.length > 0 && (
        <div>
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-xs text-gray-500 uppercase tracking-widest font-bold">Post-University Documents</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            {orderedGlobalDocumentRequests.map((doc) => {
              const url = resolvedUrls[doc.id];
              const label = toLabel(doc.document_type);
              const status = doc.status || 'pending';
              const pdf = url ? isPdf(url) : false;
              const badgeKey =
                status === 'approved' || status === 'rejected' || status === 'under_review'
                  ? status
                  : 'pending';

              return (
                <div
                  key={doc.id}
                  onClick={() => {
                    if (url) {
                      openModal(url, label, {
                        scope: 'global',
                        documentId: doc.id,
                        status: doc.status,
                        rejectionReason: doc.rejection_reason,
                      });
                    }
                  }}
                  className="group relative cursor-pointer w-28 h-28 sm:w-32 sm:h-32 rounded-lg overflow-hidden border border-white/20 bg-black/50 hover:border-white transition-all hover:scale-105 duration-300 shadow-lg shadow-black/50"
                >
                  {url && !pdf ? (
                    <img
                      src={url}
                      alt={label}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-white/5">
                      {pdf ? <FileText className="w-8 h-8 text-gray-400" /> : <Image className="w-8 h-8 text-gray-600" />}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    {pdf ? <FileText className="w-6 h-6 text-white" /> : <Image className="w-6 h-6 text-white" />}
                  </div>
                  <div className="absolute top-2 right-2 z-10">
                    <Badge className={cn('text-[8px] font-black uppercase border rounded-sm px-1.5 py-0.5', studentDocBadge(badgeKey))}>
                      {toLabel(status)}
                    </Badge>
                  </div>
                  <div className="absolute bottom-0 inset-x-0 bg-black/80 text-[9px] leading-tight min-h-[32px] flex items-center justify-center text-center text-white py-1 px-1 uppercase tracking-wider z-10 font-bold line-clamp-2">
                    {label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Student onboarding documents */}
      {visibleStudentDocuments.length > 0 && (
        <div>
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-xs text-gray-500 uppercase tracking-widest font-bold">Student Onboarding Documents</div>
              {studentReviewSummary && (
                <Badge className={cn('text-[9px] font-black uppercase border rounded-sm', studentDocBadge(studentReviewSummary))}>
                  {toLabel(studentReviewSummary)}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            {visibleStudentDocuments.map((doc) => {
              const url = resolvedUrls[doc.id];
              const label = (DOC_TYPE_LABELS[doc.type ?? ''] ?? toLabel(doc.type)) || 'Document';
              const pdf = url ? isPdf(url) : false;
              const status = doc.status ?? 'pending';
              const isContractIdentityDoc = CONTRACT_IDENTITY_DOC_TYPES.has(doc.type ?? '');
              return (
                <div
                  key={doc.id}
                  onClick={() => {
                    if (url) {
                      openModal(
                        url,
                        label,
                        isContractIdentityDoc
                          ? undefined
                          : {
                              scope: 'student',
                              documentId: doc.id,
                              status: doc.status,
                              rejectionReason: doc.rejection_reason,
                            }
                      );
                    }
                  }}
                  className="group relative cursor-pointer w-28 h-28 sm:w-32 sm:h-32 rounded-lg overflow-hidden border border-white/20 bg-black/50 hover:border-white transition-all hover:scale-105 duration-300 shadow-lg shadow-black/50"
                >
                  {url && !pdf ? (
                    <img
                      src={url}
                      alt={label}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-white/5">
                        {pdf ? <FileText className="w-8 h-8 text-gray-400" /> : <Image className="w-8 h-8 text-gray-600" />}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      {pdf ? <FileText className="w-6 h-6 text-white" /> : <Image className="w-6 h-6 text-white" />}
                  </div>
                  <div className="absolute bottom-0 inset-x-0 bg-black/80 text-[9px] leading-tight min-h-[32px] flex items-center justify-center text-center text-white py-1 px-1 uppercase tracking-wider z-10 font-bold line-clamp-2">
                      {label}
                  </div>
                  <div className="absolute top-2 right-2">
                    <Badge className={cn('text-[8px] font-black uppercase border rounded-sm px-1.5 py-0.5', studentDocBadge(status))}>
                      {toLabel(status)}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Review modal */}
      <Dialog open={!!reviewDialog && !reviewing} onOpenChange={(open) => !open && setReviewDialog(null)}>
        <DialogContent className="sm:max-w-md bg-[#0b0b0b] border border-white/10 text-white">
          <DialogTitle className="text-lg font-black uppercase tracking-wide">
            {reviewDialog?.decision === 'approve' ? 'Confirmar aprovação' : 'Recusar documentos'}
          </DialogTitle>
          <div className="mt-2 text-sm text-gray-400">
            {reviewDialog?.scope === 'global'
              ? 'Essa ação vale para os documentos enviados depois da universidade.'
              : 'Essa ação vale para os documentos de onboarding do aluno.'}
          </div>

          {reviewDialog?.decision === 'reject' && (
            <div className="mt-4 space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-500">
                Motivo da rejeição
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-gray-600 focus:border-gold-medium/40"
                placeholder="Explique ao aluno o que precisa ser corrigido."
              />
            </div>
          )}

          <div className="mt-6 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setReviewDialog(null)}
              className="border-white/10 bg-white/5 text-gray-300 hover:bg-white/10"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={reviewing || (reviewDialog?.decision === 'reject' && !rejectionReason.trim())}
              onClick={runReview}
              className={reviewDialog?.decision === 'approve'
                ? 'bg-emerald-500 hover:bg-emerald-400 text-black'
                : 'bg-red-500 hover:bg-red-400 text-white'}
            >
              {reviewDialog?.decision === 'approve' ? 'Aprovar' : 'Recusar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={reviewing} onOpenChange={() => undefined}>
        <DialogContent className="sm:max-w-sm bg-[#0b0b0b] border border-white/10 text-white">
          <div className="flex flex-col items-center text-center py-2">
            <Loader2 className="w-8 h-8 animate-spin text-gold-medium" />
            <DialogTitle className="mt-4 text-lg font-black uppercase tracking-wide">
              Processando
            </DialogTitle>
            <p className="mt-2 text-sm text-gray-400">
              Atualizando os documentos e recarregando os dados do CRM.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Media modal */}
      <Dialog open={!!mediaModal} onOpenChange={(open) => { if (!open) setMediaModal(null); }}>
        <DialogContent
          className="max-w-4xl w-full max-h-[90vh] bg-black/95 border border-white/10 p-0 overflow-hidden flex flex-col"
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">
            {mediaModal?.label ?? 'Document Preview'}
          </DialogTitle>
          {mediaModal && (
            <>
              <div className="flex shrink-0 items-center justify-between px-5 py-3 border-b border-white/10">
                <span className="text-xs font-black uppercase tracking-widest text-gray-300">{mediaModal.label}</span>
                <a
                  href={mediaModal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-black uppercase tracking-widest text-gold-light hover:text-gold-medium transition-colors"
                  >
                    Open in tab
                  </a>
              </div>
              <div className="flex-1 min-h-0 overflow-auto bg-black">
                <div className="w-full h-full min-h-[55vh]">
                  {isPdf(mediaModal.url) ? (
                    <iframe
                      src={mediaModal.url}
                      className="block w-full h-full min-h-[55vh] border-none"
                      title={mediaModal.label}
                    />
                  ) : (
                    <img
                      src={mediaModal.url}
                      alt={mediaModal.label}
                      className="block w-full h-auto max-h-full object-contain"
                    />
                  )}
                </div>
              </div>
              {mediaModal.reviewTarget && (
                <div className="shrink-0 border-t border-white/10 px-5 py-4 space-y-3 bg-[#0b0b0b]/95 backdrop-blur">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <div className="text-xs font-black uppercase tracking-widest text-gray-500">
                        Review document
                      </div>
                      <div className="text-sm text-gray-300 mt-0.5">
                        {toLabel(mediaModal.reviewTarget.status)} - {mediaModal.label}
                      </div>
                      {mediaModal.reviewTarget.status === 'rejected' && mediaModal.reviewTarget.rejectionReason && (
                        <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
                          <div className="text-[10px] font-black uppercase tracking-widest text-red-300">
                            Motivo da rejeição
                          </div>
                          <div className="mt-1 text-sm text-red-100 whitespace-pre-line">
                            {mediaModal.reviewTarget.rejectionReason}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={reviewing}
                        onClick={() => setModalRejecting(true)}
                        className="border-red-500/30 text-red-300 hover:bg-red-500/10"
                      >
                        Reject
                      </Button>
                      <Button
                        type="button"
                        disabled={reviewing}
                        onClick={() => {
                          setModalRejecting(false);
                          setRejectionReason('');
                          runModalReview('approve');
                        }}
                        className="bg-emerald-500 hover:bg-emerald-400 text-black"
                      >
                        Approve
                      </Button>
                    </div>
                  </div>

                  {modalRejecting && (
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-gray-500">
                        Motivo da rejeição
                      </label>
                      <textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        rows={4}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-gray-600 focus:border-gold-medium/40"
                        placeholder="Explique o que precisa ser corrigido neste documento."
                      />
                      <div className="flex items-center justify-end gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={reviewing}
                          onClick={() => {
                            setModalRejecting(false);
                            setRejectionReason('');
                          }}
                          className="border-white/10 bg-white/5 text-gray-300 hover:bg-white/10"
                        >
                          Cancelar
                        </Button>
                        <Button
                          type="button"
                          disabled={reviewing || !rejectionReason.trim()}
                          onClick={() => runModalReview('reject')}
                          className="bg-red-500 hover:bg-red-400 text-white"
                        >
                          Confirmar recusa
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Identity files */}
      {files.length > 0 && (
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-3">Identity Files</div>
          {loadingUrls ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gold-medium" />
            </div>
          ) : (
            <div className="flex flex-wrap gap-4">
              {files.map((file) => {
                const url = resolvedUrls[file.id];
                const label = FILE_TYPE_LABELS[file.file_type] ?? toLabel(file.file_type);
                return (
                  <div
                    key={file.id}
                    onClick={() => {
                        if (url) {
                          if (isPdf(url)) window.open(url, '_blank');
                          else openModal(url, label);
                        }
                    }}
                    className="group relative cursor-pointer w-28 h-28 sm:w-32 sm:h-32 rounded-lg overflow-hidden border border-white/20 bg-black/50 hover:border-white transition-all hover:scale-105 duration-300 shadow-lg shadow-black/50"
                  >
                    {url ? (
                      <img
                        src={url}
                        alt={label}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-white/5">
                          <Image className="w-8 h-8 text-gray-600" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Image className="w-6 h-6 text-white" />
                    </div>
                    <span className="absolute bottom-0 inset-x-0 bg-black/80 text-[10px] text-center text-white py-1 uppercase tracking-widest z-10 font-bold">
                        {label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Timeline
// ---------------------------------------------------------------------------

function TimelineTab({ events, stageHistory }: { events: CrmEvent[]; stageHistory: CrmStageHistory[] }) {
  if (events.length === 0 && stageHistory.length === 0) {
    return <EmptyState icon={Activity} message="No events recorded for this case." />;
  }

  // Merge events + stage history into a unified timeline sorted by created_at desc
  type TimelineEntry =
    | { kind: 'event'; data: CrmEvent; ts: string }
    | { kind: 'stage'; data: CrmStageHistory; ts: string };

  const entries: TimelineEntry[] = [
    ...events.map((e) => ({ kind: 'event' as const, data: e, ts: e.created_at })),
    ...stageHistory.map((h) => ({ kind: 'stage' as const, data: h, ts: h.created_at })),
  ].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

  return (
    <div className="space-y-2">
      {entries.map((entry) => (
        <div
          key={entry.kind === 'event' ? `e-${entry.data.id}` : `s-${entry.data.id}`}
          className="flex gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors"
        >
          <div className="mt-0.5 shrink-0">
            {entry.kind === 'stage'
              ? <Workflow className="w-4 h-4 text-gold-medium" />
              : <Activity className="w-4 h-4 text-sky-400" />
            }
          </div>
          <div className="flex-1 min-w-0">
            {entry.kind === 'stage' ? (
              <>
                <p className="text-sm font-bold text-white">
                  {toLabel(entry.data.from_stage) || 'Start'} → {toLabel(entry.data.to_stage)}
                </p>
                {entry.data.reason && (
                  <p className="text-xs text-gray-400 mt-0.5">{entry.data.reason}</p>
                )}
              </>
            ) : (
              <>
                <p className="text-sm font-bold text-white">{toLabel(entry.data.event_type)}</p>
                {Object.keys(entry.data.payload_json ?? {}).length > 0 && (
                  <p className="text-xs text-gray-500 font-mono truncate mt-0.5">
                    {JSON.stringify(entry.data.payload_json).slice(0, 120)}…
                  </p>
                )}
              </>
            )}
            <p className="text-[10px] text-gray-600 mt-1 uppercase tracking-wider">
              {timeAgo(entry.ts)} · {toLabel(entry.kind === 'event' ? entry.data.event_source : entry.data.trigger_source)}
            </p>
          </div>
          <div className="text-[10px] text-gray-600 shrink-0 text-right">
            {entry.kind === 'stage'
              ? <span className="text-[9px] font-black uppercase text-gold-medium/50">stage</span>
              : <span className="text-[9px] font-black uppercase text-sky-500/50">event</span>
            }
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Follow-ups
// ---------------------------------------------------------------------------

const FOLLOWUP_TYPES = [
  'document_request',
  'payment_reminder',
  'contract_followup',
  'general_checkin',
  'sevis_release',
  'school_update',
  'other',
];

function FollowupsTab({
  followups,
  serviceRequestId,
  adminId,
  onRefresh,
}: {
  followups: CrmFollowup[];
  serviceRequestId: string | null;
  adminId: string | null;
  onRefresh: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [form, setForm] = useState({ type: 'general_checkin', notes: '', due_at: '' });

  async function handleCreate() {
    if (!serviceRequestId) return;
    setSaving(true);
    setErrMsg(null);
    const { error } = await createFollowup({
      serviceRequestId,
      followupType: form.type,
      notes: form.notes,
      dueAt: form.due_at || null,
      ownerUserId: adminId,
    });
    setSaving(false);
    if (error) { setErrMsg(error); return; }
    setCreating(false);
    setForm({ type: 'general_checkin', notes: '', due_at: '' });
    onRefresh();
  }

  async function handleResolve(id: string) {
    setResolving(id);
    await resolveFollowup(id);
    setResolving(null);
    onRefresh();
  }

  return (
    <div className="space-y-4">
      {/* Create button */}
      {serviceRequestId && (
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => setCreating((v) => !v)}
            className="bg-gold-medium hover:bg-gold-dark text-black font-black text-xs"
          >
            {creating ? 'Cancel' : '+ New Follow-up'}
          </Button>
        </div>
      )}

      {/* Create form */}
      {creating && (
        <Card className="bg-black/40 border border-gold-medium/20">
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 block mb-1">Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  className="w-full bg-black/40 border border-white/10 text-white text-xs rounded px-2 py-1.5"
                >
                  {FOLLOWUP_TYPES.map((t) => (
                    <option key={t} value={t}>{toLabel(t)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 block mb-1">Due Date</label>
                <input
                  type="datetime-local"
                  value={form.due_at}
                  onChange={(e) => setForm((f) => ({ ...f, due_at: e.target.value }))}
                  className="w-full bg-black/40 border border-white/10 text-white text-xs rounded px-2 py-1.5"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 block mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3}
                placeholder="Add context or instructions..."
                className="w-full bg-black/40 border border-white/10 text-white text-xs rounded px-3 py-2 resize-none"
              />
            </div>
            {errMsg && <p className="text-xs text-red-400">{errMsg}</p>}
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={saving}
                className="bg-gold-medium hover:bg-gold-dark text-black font-black text-xs"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save Follow-up'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* List */}
      {followups.length === 0 && !creating && (
        <EmptyState icon={Clock3} message="No follow-ups recorded for this case." />
      )}

      {followups.map((f) => (
        <Card key={f.id} className="bg-black/30 border border-white/5">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge className={cn(
                    'text-[9px] font-black uppercase border rounded-sm',
                    f.status === 'resolved'
                      ? 'bg-green-500/20 text-green-300 border-green-500/30'
                      : f.status === 'open'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        : 'bg-white/5 text-gray-500 border-white/10'
                  )}>
                    {f.status}
                  </Badge>
                  <span className="text-xs font-bold text-white">{toLabel(f.followup_type)}</span>
                </div>
                {f.notes && <p className="text-xs text-gray-400 mt-1">{f.notes}</p>}
                <p className="text-[10px] text-gray-600 mt-1 uppercase tracking-wider">
                  Created {timeAgo(f.created_at)}
                  {f.due_at && ` · Due ${fmtDate(f.due_at)}`}
                  {f.resolved_at && ` · Resolved ${timeAgo(f.resolved_at)}`}
                </p>
              </div>
              {f.status === 'open' && (
                <Button
                  size="sm"
                  disabled={resolving === f.id}
                  onClick={() => handleResolve(f.id)}
                  className="shrink-0 text-[10px] font-black uppercase border border-gold-medium/25 bg-black/60 text-gold-light hover:bg-gold-medium/10 hover:border-gold-medium/45 hover:text-gold-light shadow-none"
                >
                  {resolving === f.id ? <Loader2 className="w-3 h-3 animate-spin" /> : '✓ Resolve'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Messages
// ---------------------------------------------------------------------------

function MessageBody({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 600;
  const preview = isLong && !expanded ? text.slice(0, 600) + '…' : text;

  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-md text-xs text-gray-300 whitespace-pre-wrap leading-relaxed overflow-hidden">
      <div className={cn('p-3', !expanded && isLong ? 'max-h-40 overflow-hidden' : '')}>
        {preview}
      </div>
      {isLong && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-gray-300 border-t border-white/5 py-1.5 transition-colors"
        >
          {expanded ? '▲ Collapse' : '▼ Expand'}
        </button>
      )}
    </div>
  );
}

function MessagesTab({ messages }: { messages: CrmMessage[] }) {
  if (messages.length === 0) {
    return <EmptyState icon={Mail} message="No messages recorded for this case." />;
  }

  return (
    <div className="space-y-3">
      {messages.map((msg) => {
        const isInbound = msg.direction === 'inbound';
        const analysis = (msg.message_metadata as Record<string, unknown> | null)?.analysis as Record<string, unknown> | null;

        return (
          <Card key={msg.id} className={`bg-black/30 border ${isInbound ? 'border-sky-500/20' : 'border-white/5'}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-black uppercase border rounded-sm px-2 py-0.5 ${
                    isInbound
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                      : 'bg-gold-medium/10 text-gold-light border-gold-medium/20'
                  }`}>
                    {isInbound ? '← Inbound' : '→ Outbound'}
                  </span>
                  {msg.classification && (
                    <span className="text-[9px] font-black uppercase border rounded-sm px-2 py-0.5 bg-white/5 text-gray-400 border-white/10">
                      {msg.classification.replace(/_/g, ' ')}
                    </span>
                  )}
                  <span className="text-[9px] text-gray-600 uppercase tracking-wider">{msg.channel}</span>
                </div>
                <span className="text-[10px] text-gray-600 shrink-0">{fmtDate(msg.created_at)}</span>
              </div>

              <div className="space-y-1.5 text-[11px] mb-3">
                {msg.subject && (
                  <p className="text-white font-bold text-sm">{msg.subject}</p>
                )}
                <div className="flex gap-4 text-gray-500">
                  {msg.from_address && <span>From: <span className="text-gray-300 font-mono">{msg.from_address}</span></span>}
                  {msg.to_address && <span>To: <span className="text-gray-300 font-mono">{msg.to_address}</span></span>}
                </div>
              </div>

              {msg.body_text && <MessageBody text={msg.body_text} />}

              {analysis && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {typeof analysis.hasAttachments === 'boolean' && analysis.hasAttachments && (
                    <span className="text-[9px] font-black uppercase border rounded-sm px-2 py-0.5 bg-violet-500/10 text-violet-300 border-violet-500/20">
                      Has Attachments
                    </span>
                  )}
                  {typeof analysis.documentCompleteness === 'string' && (
                    <span className="text-[9px] font-black uppercase border rounded-sm px-2 py-0.5 bg-white/5 text-gray-400 border-white/10">
                      Docs: {analysis.documentCompleteness}
                    </span>
                  )}
                  {typeof analysis.sentiment === 'string' && (
                    <span className="text-[9px] font-black uppercase border rounded-sm px-2 py-0.5 bg-white/5 text-gray-400 border-white/10">
                      {analysis.sentiment}
                    </span>
                  )}
                  {Array.isArray(analysis.flags) && analysis.flags.length > 0 && (
                    analysis.flags.map((flag: unknown) => (
                      <span key={String(flag)} className="text-[9px] font-black uppercase border rounded-sm px-2 py-0.5 bg-amber-500/10 text-amber-300 border-amber-500/20">
                        {String(flag).replace(/_/g, ' ')}
                      </span>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Survey
// ---------------------------------------------------------------------------

const QUESTION_LABEL: Record<string, string> = Object.fromEntries(
  ALL_QUESTIONS.map((q) => [q.id, q.text])
);

const DOC_TYPE_LABELS: Record<string, string> = {
  passport: 'Passport',
  passport_back: 'Passport Back',
  selfie_with_doc: 'Selfie with Document',
  document_front: 'Document Front',
  document_back: 'Document Back',
  selfie_doc: 'Selfie with Document',
  diploma: 'High School / College Diploma',
  transcript: 'Official Transcript',
  proof_of_funds: 'Proof of Funds',
  funds_proof: 'Proof of Funds',
  i94: 'I-94',
  visa: 'Current Visa',
  other: 'Other',
};

const CONTRACT_IDENTITY_DOC_TYPES = new Set([
  'passport',
  'passport_back',
  'selfie_with_doc',
  'document_front',
  'document_back',
  'selfie_doc',
]);

function studentDocBadge(status: string | null) {
  if (status === 'approved') return 'bg-green-500/20 text-green-300 border-green-500/30';
  if (status === 'rejected') return 'bg-red-500/20 text-red-300 border-red-500/30';
  if (status === 'under_review') return 'bg-sky-500/20 text-sky-300 border-sky-500/30';
  if (status === 'pending') return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
  return 'bg-white/5 text-gray-400 border-white/10';
}

function formatAnswerValue(value: string | string[] | null | undefined): string {
  if (value === null || value === undefined) return '—';
  if (Array.isArray(value)) return value.join(', ') || '—';
  if (value === 'true') return 'Yes';
  if (value === 'false') return 'No';
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || '—';
}

function SurveyTab({ surveyResponses }: { surveyResponses: CrmSurveyResponse[] }) {
  if (surveyResponses.length === 0) {
    return <EmptyState icon={FileText} message="Survey not completed yet." />;
  }

  return (
    <div className="space-y-6">
      {surveyResponses.map((resp) => (
        <div key={resp.id} className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs font-black uppercase border rounded-sm px-2.5 py-1 bg-gold-medium/10 text-gold-light border-gold-medium/20">
                {resp.service_type?.toUpperCase() ?? 'UNKNOWN SERVICE'}
              </span>
              {resp.transfer_deadline_date && (
                <span className="text-xs font-black uppercase border rounded-sm px-2.5 py-1 bg-amber-500/10 text-amber-300 border-amber-500/20">
                  Transfer Deadline: {new Date(resp.transfer_deadline_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              )}
              {resp.cos_i94_expiry_date && (
                <span className="text-xs font-black uppercase border rounded-sm px-2.5 py-1 bg-red-500/10 text-red-300 border-red-500/20">
                  I-94 Expiry: {new Date(resp.cos_i94_expiry_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              )}
            </div>
            {resp.completed_at && (
              <span className="text-xs text-gray-500">
                Completed {fmtDate(resp.completed_at)}
              </span>
            )}
          </div>

          {/* Sections */}
          {SURVEY_SECTIONS.map((section) => {
            const sectionQuestions = ALL_QUESTIONS.filter((q) => q.section === section.key);
            const answers = resp.answers ?? {};
            const hasAnswers = sectionQuestions.some((q) => answers[q.id] !== undefined);
            if (!hasAnswers) return null;

            return (
              <Card key={section.key} className="bg-black/30 border border-white/5">
                <CardHeader className="pb-3 pt-5 px-6">
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-gold-medium">
                    Section {section.key} — {section.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-6 pb-5">
                  <div className="space-y-1">
                    {sectionQuestions.map((q) => {
                      const raw = answers[q.id];
                      if (raw === undefined) return null;
                      return (
                        <div key={q.id} className="flex items-start justify-between gap-6 py-2.5 border-b border-white/5 last:border-0">
                          <span className="text-sm text-gray-400 leading-snug max-w-[55%]">
                            {QUESTION_LABEL[q.id] ?? q.id}
                          </span>
                          <span className="text-sm text-white font-semibold text-right">
                            {formatAnswerValue(raw as string | string[])}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Journey
// ---------------------------------------------------------------------------

interface JourneyMilestone {
  id: string;
  label: string;
  sublabel?: string;
  ts: string | null;
  kind: 'account' | 'checkout' | 'payment' | 'survey' | 'case' | 'stage' | 'document';
}

function buildJourneyMilestones(
  detail: CaseDetailPage,
): JourneyMilestone[] {
  const { profile, visaOrders, serviceRequests, stageHistory, studentDocuments } = detail;
  const milestones: JourneyMilestone[] = [];

  // 1. Account created
  milestones.push({
    id: 'account-created',
    label: 'Account created',
    sublabel: profile.email ?? undefined,
    ts: profile.created_at,
    kind: 'account',
  });

  // 2. Checkout started (oldest order)
  const oldestOrder = [...visaOrders].sort(
    (a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime()
  )[0];
  if (oldestOrder) {
    milestones.push({
      id: `checkout-${oldestOrder.id}`,
      label: 'Checkout started',
      sublabel: toLabel(oldestOrder.product_slug),
      ts: oldestOrder.created_at,
      kind: 'checkout',
    });
  }

  // 3. Payment confirmed
  const paidOrder = visaOrders.find((o) => o.paid_at);
  if (paidOrder?.paid_at) {
    milestones.push({
      id: `payment-${paidOrder.id}`,
      label: 'Payment confirmed',
      sublabel: paidOrder.payment_method ? toLabel(paidOrder.payment_method) : undefined,
      ts: paidOrder.paid_at,
      kind: 'payment',
    });
  }

  // 4. Survey completed
  if (profile.selection_survey_completed_at) {
    milestones.push({
      id: 'survey-completed',
      label: 'Survey completed',
      sublabel: toLabel(profile.service_type),
      ts: profile.selection_survey_completed_at,
      kind: 'survey',
    });
  }

  // 5. Service request created
  for (const sr of serviceRequests) {
    if (sr.created_at) {
      milestones.push({
        id: `case-${sr.id}`,
        label: 'Operational case created',
        sublabel: toLabel(sr.service_type),
        ts: sr.created_at,
        kind: 'case',
      });
    }
  }

  // 6. Stage transitions (most recent 8)
  for (const h of [...stageHistory].reverse().slice(0, 8)) {
    milestones.push({
      id: `stage-${h.id}`,
      label: `${toLabel(h.from_stage) || 'Start'} → ${toLabel(h.to_stage)}`,
      sublabel: h.reason ?? undefined,
      ts: h.created_at,
      kind: 'stage',
    });
  }

  // 7. Student documents uploaded
  for (const doc of studentDocuments) {
    milestones.push({
      id: `doc-${doc.id}`,
      label: DOC_TYPE_LABELS[doc.type ?? ''] ?? toLabel(doc.type),
      sublabel: doc.original_filename ?? undefined,
      ts: doc.uploaded_at,
      kind: 'document',
    });
  }

  return milestones
    .filter((m) => m.ts)
    .sort((a, b) => new Date(a.ts!).getTime() - new Date(b.ts!).getTime());
}

const JOURNEY_KIND_STYLES: Record<JourneyMilestone['kind'], { dot: string; icon: React.ElementType }> = {
  account:  { dot: 'bg-white/30',      icon: User },
  checkout: { dot: 'bg-sky-500',       icon: Tag },
  payment:  { dot: 'bg-green-500',     icon: DollarSign },
  survey:   { dot: 'bg-gold-medium',   icon: FileText },
  case:     { dot: 'bg-violet-500',    icon: Workflow },
  stage:    { dot: 'bg-amber-400',     icon: Activity },
  document: { dot: 'bg-cyan-500',      icon: MapPin },
};

function JourneyTab({ detail }: { detail: CaseDetailPage }) {
  const milestones = buildJourneyMilestones(detail);

  if (milestones.length === 0) {
    return <EmptyState icon={Activity} message="No journey data available yet." />;
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-[19px] top-3 bottom-3 w-px bg-white/5" />

      <div className="space-y-0">
        {milestones.map((m, idx) => {
          const { dot, icon: Icon } = JOURNEY_KIND_STYLES[m.kind];
          const prev = milestones[idx - 1];
          const deltaMs = prev?.ts ? new Date(m.ts!).getTime() - new Date(prev.ts).getTime() : null;
          const deltaDays = deltaMs !== null ? Math.round(deltaMs / 86400000) : null;

          return (
            <div key={m.id}>
              {/* Delta between milestones */}
              {deltaDays !== null && deltaDays > 0 && (
                <div className="flex items-center gap-2 pl-[42px] py-1">
                  <span className="text-[9px] text-gray-700 uppercase tracking-widest">
                    +{deltaDays}d
                  </span>
                </div>
              )}

              <div className="flex items-start gap-4 py-2">
                {/* Dot */}
                <div className={`relative z-10 flex items-center justify-center w-9 h-9 shrink-0 rounded-full border border-white/10 bg-black`}>
                  <div className={`w-2 h-2 rounded-full ${dot}`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pt-1.5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                      <span className="text-sm font-bold text-white truncate">{m.label}</span>
                    </div>
                    <span className="text-[10px] text-gray-600 shrink-0">{fmtDate(m.ts)}</span>
                  </div>
                  {m.sublabel && (
                    <p className="text-[11px] text-gray-500 mt-0.5 pl-5">{m.sublabel}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-600">
      <Icon className="w-10 h-10 mb-4 opacity-20" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Tab: Support IA
// ---------------------------------------------------------------------------

const HANDOFF_STATUS_LABELS: Record<CrmSupportHandoff['status'], string> = {
  pending: 'Aguardando',
  in_progress: 'Em atendimento',
  resolved: 'Resolvido',
};

const HANDOFF_STATUS_COLORS: Record<CrmSupportHandoff['status'], string> = {
  pending: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  in_progress: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  resolved: 'bg-green-500/15 text-green-400 border-green-500/30',
};

function SupportTab({
  handoffs,
  chatMessages,
  profileId,
  onRefresh,
}: {
  handoffs: CrmSupportHandoff[];
  chatMessages: CrmSupportChatMessage[];
  profileId: string;
  onRefresh: () => void;
}) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [assignInput, setAssignInput] = useState<Record<string, string>>({});
  const [resolveNoteInput, setResolveNoteInput] = useState<Record<string, string>>({});
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  const updateHandoff = async (
    id: string,
    patch: Partial<Pick<CrmSupportHandoff, 'status' | 'assigned_to'>>,
  ) => {
    setUpdatingId(id);
    const update: Record<string, unknown> = { ...patch };
    if (patch.status === 'resolved') update.resolved_at = new Date().toISOString();
    await supabase.from('support_handoffs').update(update).eq('id', id);
    setUpdatingId(null);
    onRefresh();
  };

  const resolveHandoff = async (id: string) => {
    const note = resolveNoteInput[id]?.trim();
    if (!note) return;

    setUpdatingId(id);

    await supabase.from('support_handoffs').update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      resolved_note: note,
    }).eq('id', id);

    // Insere marco visual no chat do aluno
    await supabase.from('support_chat_messages').insert({
      profile_id: profileId,
      role: 'system',
      content: `Atendimento encerrado pela equipe. ${note}`,
    });

    setResolvingId(null);
    setUpdatingId(null);
    onRefresh();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <p className="text-xs text-white/40">{handoffs.length} transferência(s) · {chatMessages.length} mensagens</p>
        <button
          onClick={() => setChatOpen(true)}
          disabled={chatMessages.length === 0}
          className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 text-xs font-medium hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Ver histórico de chat
        </button>
      </div>

      {/* Handoffs */}
      {handoffs.length === 0 ? (
        <p className="text-white/30 text-sm">Nenhuma transferência registrada.</p>
      ) : (
        <div className="space-y-2">
          {handoffs.map((h) => (
            <div key={h.id} className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2">
              {/* Linha 1 — status + ações */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${HANDOFF_STATUS_COLORS[h.status]}`}>
                    {HANDOFF_STATUS_LABELS[h.status]}
                  </span>
                  <span className="text-xs text-white/30 truncate">
                    {new Date(h.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · via {h.triggered_by === 'ai_escalation' ? 'IA' : h.triggered_by === 'student_request' ? 'aluno' : 'admin'}
                  </span>
                </div>
                <div className="flex gap-2 shrink-0">
                  {h.status === 'pending' && (
                    <button onClick={() => updateHandoff(h.id, { status: 'in_progress' })} disabled={updatingId === h.id}
                      className="px-3 py-1 rounded-lg bg-blue-500/20 text-blue-400 text-xs font-medium hover:bg-blue-500/30 transition-colors disabled:opacity-50">
                      Assumir
                    </button>
                  )}
                  {h.status === 'in_progress' && resolvingId !== h.id && (
                    <button onClick={() => setResolvingId(h.id)}
                      className="px-3 py-1 rounded-lg bg-green-500/20 text-green-400 text-xs font-medium hover:bg-green-500/30 transition-colors">
                      Resolver
                    </button>
                  )}
                </div>
              </div>

              {/* Motivo + última msg */}
              {(h.reason || h.last_ai_message) && (
                <div className="space-y-1">
                  {h.reason && <p className="text-xs text-white/60"><span className="text-white/30">Motivo: </span>{h.reason}</p>}
                  {h.last_ai_message && (
                    <p className="text-xs text-white/40 italic border-l-2 border-white/10 pl-2 truncate">"{h.last_ai_message}"</p>
                  )}
                </div>
              )}

              {h.meeting_url && (
                <a
                  href={h.meeting_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-xs font-bold text-blue-300 hover:bg-blue-500/20"
                >
                  Link de agendamento humano
                </a>
              )}

              {/* Nota de resolução — expande ao clicar Resolver */}
              {h.status === 'in_progress' && resolvingId === h.id && (
                <div className="space-y-2 pt-1 border-t border-white/10">
                  <p className="text-xs text-white/50">Nota para o aluno <span className="text-red-400">*</span></p>
                  <textarea
                    value={resolveNoteInput[h.id] ?? ''}
                    onChange={(e) => setResolveNoteInput((p) => ({ ...p, [h.id]: e.target.value }))}
                    placeholder="Ex: Situação esclarecida. Seu I-94 foi verificado e está dentro do prazo."
                    rows={2}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/20 outline-none focus:border-green-500/40 resize-none"
                  />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setResolvingId(null)}
                      className="px-3 py-1 rounded-lg text-white/40 text-xs hover:text-white/60 transition-colors">
                      Cancelar
                    </button>
                    <button
                      onClick={() => resolveHandoff(h.id)}
                      disabled={!resolveNoteInput[h.id]?.trim() || updatingId === h.id}
                      className="px-3 py-1 rounded-lg bg-green-500/20 text-green-400 text-xs font-medium hover:bg-green-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {updatingId === h.id ? 'Salvando…' : 'Confirmar resolução'}
                    </button>
                  </div>
                </div>
              )}

              {/* Nota exibida após resolução */}
              {h.status === 'resolved' && h.resolved_note && (
                <p className="text-xs text-green-400/60 border-l-2 border-green-500/20 pl-2">
                  "{h.resolved_note}"
                </p>
              )}

              {/* Atribuir */}
              {h.status !== 'resolved' && (
                <div className="flex gap-2 items-center pt-1">
                  <input
                    value={assignInput[h.id] ?? h.assigned_to ?? ''}
                    onChange={(e) => setAssignInput((p) => ({ ...p, [h.id]: e.target.value }))}
                    placeholder="Atribuir a…"
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white placeholder-white/20 outline-none focus:border-[#CE9F48]/40"
                  />
                  <button
                    onClick={() => updateHandoff(h.id, { assigned_to: assignInput[h.id] ?? h.assigned_to ?? '' })}
                    disabled={updatingId === h.id}
                    className="px-2.5 py-1 rounded-lg bg-[#CE9F48]/20 text-[#CE9F48] text-xs font-medium hover:bg-[#CE9F48]/30 transition-colors disabled:opacity-50"
                  >
                    Salvar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal histórico de chat */}
      <Dialog open={chatOpen} onOpenChange={setChatOpen}>
        <DialogContent className="bg-[#111] border border-white/10 max-w-xl w-full max-h-[80vh] flex flex-col p-0">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <DialogTitle className="text-sm font-semibold text-white">
              Histórico de chat — {chatMessages.length} mensagens
            </DialogTitle>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {chatMessages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-[#CE9F48]/20 text-white border border-[#CE9F48]/20'
                    : 'bg-white/5 border border-white/10 text-white/80'
                }`}>
                  <p className={`text-xs mb-1 ${msg.role === 'user' ? 'text-[#CE9F48]/50' : 'text-white/25'}`}>
                    {msg.role === 'user' ? 'Aluno' : 'IA'} · {new Date(msg.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </p>
                  {msg.content}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function AdminUserDetail() {
  const { profileId } = useParams<{ profileId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<CaseDetailPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // Mutation state
  const [ownerInput, setOwnerInput] = useState('');
  const [mutating, setMutating] = useState(false);
  const [mutationMsg, setMutationMsg] = useState<string | null>(null);
  const [currentAdminId, setCurrentAdminId] = useState<string | null>(null);
  const [billingMsg, setBillingMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentAdminId(data?.user?.id ?? null);
    });
  }, []);

  const load = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await loadDetailPage(profileId);
    if (err || !data) {
      setError(err ?? 'Failed to load profile.');
    } else {
      setDetail(data);
      setOwnerInput(data.primaryRequest?.owner_user_id ?? '');
    }
    setLoading(false);
  }, [profileId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  // Mutations
  async function handleAssign() {
    if (!detail?.primaryRequest) return;
    setMutating(true);
    setMutationMsg(null);
    const { error: err } = await updateCaseOwner(detail.primaryRequest.id, ownerInput.trim() || null);
    setMutating(false);
    setMutationMsg(err ? `Error: ${err}` : 'Owner updated.');
    if (!err) load();
  }

  async function handleAssignToMe() {
    if (!currentAdminId || !detail?.primaryRequest) return;
    setOwnerInput(currentAdminId);
    setMutating(true);
    setMutationMsg(null);
    const { error: err } = await updateCaseOwner(detail.primaryRequest.id, currentAdminId);
    setMutating(false);
    setMutationMsg(err ? `Error: ${err}` : 'Assigned to you.');
    if (!err) load();
  }

  async function handleArchive() {
    if (!detail?.primaryRequest) return;
    const next = detail.primaryRequest.case_status === 'cancelled' ? 'active' : 'cancelled';
    setMutating(true);
    setMutationMsg(null);
    const { error: err } = await updateCaseStatus(detail.primaryRequest.id, next);
    setMutating(false);
    setMutationMsg(err ? `Error: ${err}` : next === 'cancelled' ? 'Case archived.' : 'Case restored.');
    if (!err) load();
  }

  const functionsBase = import.meta.env.VITE_FUNCTIONS_BASE_URL as string | undefined;

  async function invokeFunction(name: string, body: object): Promise<{ error: string | null }> {
    if (functionsBase) {
      // Modo híbrido: chama function local diretamente
      const res = await fetch(`${functionsBase}/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      return { error: res.ok ? null : (data?.error ?? `HTTP ${res.status}`) };
    }
    // Produção: usa cliente Supabase normal
    const { error } = await supabase.functions.invoke(name, { body });
    return { error: error?.message ?? null };
  }

  async function handleStartBilling() {
    if (!detail?.institutionApplication) return;
    setMutating(true);
    setBillingMsg(null);
    const { error } = await invokeFunction('start-migma-billing', {
      application_id: detail.institutionApplication.id,
    });
    setMutating(false);
    setBillingMsg(error ? `Erro: ${error}` : 'Billing iniciado.');
    if (!error) load();
  }

  async function handleSuspendBilling(action: 'suspend' | 'cancel' | 'reactivate') {
    if (!detail?.recurringCharge) return;
    setMutating(true);
    setBillingMsg(null);
    const { error } = await invokeFunction('suspend-migma-billing', {
      charge_id: detail.recurringCharge.id, action,
    });
    setMutating(false);
    const msgs = { suspend: 'Billing suspenso.', cancel: 'Billing cancelado.', reactivate: 'Billing reativado.' };
    setBillingMsg(error ? `Erro: ${error}` : msgs[action]);
    if (!error) load();
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-10 h-10 animate-spin text-gold-medium" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-gray-500">
        <AlertCircle className="w-12 h-12 opacity-30" />
        <p className="text-lg">{error ?? 'Profile not found.'}</p>
        <Button variant="outline" onClick={() => navigate('/dashboard/users')} className="border-white/10 text-white">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Hub
        </Button>
      </div>
    );
  }

  const { profile, operationalStage } = detail;
  const orderDocuments = buildVisaOrderDocuments(detail.visaOrders);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard/users')}
            className="text-gray-400 hover:text-white p-0 h-auto"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white uppercase tracking-tight">
              {profile.full_name || profile.email || 'Unknown Client'}
            </h1>
            <p className="text-gray-500 text-sm flex items-center gap-2 mt-0.5">
              <Mail className="w-3.5 h-3.5" />
              {profile.email}
              {profile.phone && (
                <>
                  <span className="text-gray-700">·</span>
                  <Phone className="w-3.5 h-3.5" />
                  {profile.phone}
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge className={cn('text-[10px] font-black uppercase border rounded-sm px-3 py-1', OPERATIONAL_STAGE_COLORS[operationalStage])}>
            {OPERATIONAL_STAGE_LABELS[operationalStage]}
          </Badge>
          <Button
            onClick={load}
            variant="outline"
            size="sm"
            className="border-gray-700 bg-transparent hover:bg-white/10 text-white gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/5 overflow-x-auto scrollbar-hide">
        {TABS.map((tab) => {
          const count =
            tab.id === 'orders' ? detail.visaOrders.length
            : tab.id === 'documents' ? detail.identityFiles.length + detail.srDocuments.length + detail.studentDocuments.length + detail.globalDocumentRequests.length + detail.institutionForms.length + orderDocuments.length
            : tab.id === 'timeline' ? detail.events.length + detail.stageHistory.length
            : tab.id === 'messages' ? detail.messages.length
            : tab.id === 'followups' ? detail.followups.length
            : tab.id === 'survey' ? detail.surveyResponses.length
            : tab.id === 'journey' ? (detail.studentDocuments.length + detail.stageHistory.length) || null
            : tab.id === 'support' ? detail.supportHandoffs.filter(h => h.status !== 'resolved').length || null
            : null;

          const needsAction = tab.id === 'scholarship' && detail.institutionApplication?.status === 'pending_admin_approval';

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-5 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition-colors shrink-0 flex items-center gap-1.5',
                activeTab === tab.id
                  ? 'border-gold-medium text-gold-light'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              )}
            >
              {tab.label}
              {needsAction && (
                <span className="flex h-2 w-2 rounded-full bg-red-500" />
              )}
              {count !== null && count > 0 && (
                <span className="ml-0.5 text-[10px] bg-white/10 text-gray-400 rounded-full px-1.5 py-0.5">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'overview' && (
          <OverviewTab
            detail={detail}
            ownerInput={ownerInput}
            setOwnerInput={setOwnerInput}
            mutating={mutating}
            mutationMsg={mutationMsg}
            onAssign={handleAssign}
            onAssignToMe={handleAssignToMe}
            onArchive={handleArchive}
            onStartBilling={handleStartBilling}
            onSuspendBilling={handleSuspendBilling}
            billingMsg={billingMsg}
          />
        )}
        {activeTab === 'orders' && (
          <OrdersTab
            orders={detail.visaOrders}
          />
        )}
        {activeTab === 'documents' && (
          <DocumentsTab
            profileId={detail.profile.id}
            profileUserId={detail.profile.user_id}
            adminId={currentAdminId}
            onRefresh={load}
            institutionApplication={detail.institutionApplication}
            institutionForms={detail.institutionForms}
            files={detail.identityFiles}
            srDocuments={detail.srDocuments}
            studentDocuments={detail.studentDocuments}
            globalDocumentRequests={detail.globalDocumentRequests}
            orderDocuments={orderDocuments}
          />
        )}
        {activeTab === 'timeline' && (
          <TimelineTab events={detail.events} stageHistory={detail.stageHistory} />
        )}
        {activeTab === 'messages' && <MessagesTab messages={detail.messages} />}
        {activeTab === 'followups' && (
          <FollowupsTab
            followups={detail.followups}
            serviceRequestId={detail.primaryRequest?.id ?? null}
            adminId={currentAdminId}
            onRefresh={load}
          />
        )}
        {activeTab === 'survey' && (
          <SurveyTab surveyResponses={detail.surveyResponses} />
        )}
        {activeTab === 'journey' && (
          <JourneyTab detail={detail} />
        )}
        {activeTab === 'scholarship' && (
          <ScholarshipApprovalTab detail={detail} />
        )}
        {activeTab === 'support' && (
          <SupportTab
            handoffs={detail.supportHandoffs}
            chatMessages={detail.supportChatMessages}
            profileId={detail.profile.id}
            onRefresh={load}
          />
        )}
      </div>
    </div>
  );
}
