import { useEffect, useState } from 'react';
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
  Loader2,
  Mail,
  MapPin,
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

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

type Tab = 'overview' | 'orders' | 'documents' | 'timeline' | 'messages' | 'followups' | 'survey' | 'journey' | 'scholarship';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'journey', label: 'Journey' },
  { id: 'survey', label: 'Survey' },
  { id: 'scholarship', label: 'Bolsas V11' },
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

function OrdersTab({ orders }: { orders: CrmVisaOrder[] }) {
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
};

function buildVisaOrderDocuments(orders: CrmVisaOrder[]): VisaOrderDocument[] {
  const docs: VisaOrderDocument[] = [];

  for (const order of orders) {
    const orderNumber = order.order_number;
    const baseId = order.id;

    if (order.contract_document_url) {
      docs.push({
        id: `${baseId}-contract-document`,
        label: 'Contract document',
        url: order.contract_document_url,
        orderNumber,
      });
    }

    if (order.contract_selfie_url) {
      docs.push({
        id: `${baseId}-contract-selfie`,
        label: 'Contract selfie',
        url: order.contract_selfie_url,
        orderNumber,
      });
    }

    if (order.signature_image_url) {
      docs.push({
        id: `${baseId}-signature`,
        label: 'Signature image',
        url: order.signature_image_url,
        orderNumber,
      });
    }

    if (order.contract_pdf_url) {
      docs.push({
        id: `${baseId}-contract-pdf`,
        label: 'Signed contract PDF',
        url: order.contract_pdf_url,
        orderNumber,
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

  const openReviewDialog = (scope: 'student' | 'global', decision: 'approve' | 'reject') => {
    setReviewDialog({ scope, decision });
    setRejectionReason('');
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
    if (files.length === 0 && studentDocuments.length === 0 && globalDocumentRequests.length === 0) { setLoadingUrls(false); return; }
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
      setResolvedUrls(resolved);
      setLoadingUrls(false);
    })();
  }, [files, studentDocuments, globalDocumentRequests]);

  const hasAnything = files.length > 0 || srDocuments.length > 0 || studentDocuments.length > 0 || globalDocumentRequests.length > 0 || orderDocuments.length > 0;
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
      {/* Visa order documents */}
      {orderDocuments.length > 0 && (
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-3">Order Documents</div>
          <div className="flex flex-wrap gap-4">
            {orderDocuments.map((doc) => {
              const url = doc.url;
              const label = doc.label;
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
      {studentDocuments.length > 0 && (
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
            {studentDocuments.map((doc) => {
              const url = resolvedUrls[doc.id];
              const label = (DOC_TYPE_LABELS[doc.type ?? ''] ?? toLabel(doc.type)) || 'Document';
              const pdf = url ? isPdf(url) : false;
              return (
                <div
                  key={doc.id}
                  onClick={() => {
                    if (url) {
                      openModal(url, label, {
                        scope: 'student',
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
                  <div className="absolute bottom-0 inset-x-0 bg-black/80 text-[9px] leading-tight min-h-[32px] flex items-center justify-center text-center text-white py-1 px-1 uppercase tracking-wider z-10 font-bold line-clamp-2">
                      {label}
                  </div>
                  <div className="absolute top-2 right-2">
                    <Badge className={cn('text-[8px] font-black uppercase border rounded-sm px-1.5 py-0.5', studentDocBadge(doc.status))}>
                      {toLabel(doc.status)}
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
  diploma: 'High School / College Diploma',
  transcript: 'Official Transcript',
  proof_of_funds: 'Proof of Funds',
  funds_proof: 'Proof of Funds',
  i94: 'I-94',
  visa: 'Current Visa',
  other: 'Other',
};

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
  const { profile, visaOrders, serviceRequests, stageHistory, studentDocuments, globalDocumentRequests } = detail;
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

  const load = async () => {
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
  };

  useEffect(() => { load(); }, [profileId]);

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
            : tab.id === 'documents' ? detail.identityFiles.length + detail.srDocuments.length + detail.globalDocumentRequests.length + orderDocuments.length
            : tab.id === 'timeline' ? detail.events.length + detail.stageHistory.length
            : tab.id === 'messages' ? detail.messages.length
            : tab.id === 'followups' ? detail.followups.length
            : tab.id === 'survey' ? detail.surveyResponses.length
            : tab.id === 'journey' ? (detail.studentDocuments.length + detail.stageHistory.length) || null
            : null;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-5 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition-colors shrink-0',
                activeTab === tab.id
                  ? 'border-gold-medium text-gold-light'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              )}
            >
              {tab.label}
              {count !== null && count > 0 && (
                <span className="ml-1.5 text-[10px] bg-white/10 text-gray-400 rounded-full px-1.5 py-0.5">
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
        {activeTab === 'orders' && <OrdersTab orders={detail.visaOrders} />}
        {activeTab === 'documents' && (
          <DocumentsTab
            profileId={detail.profile.id}
            profileUserId={detail.profile.user_id}
            adminId={currentAdminId}
            onRefresh={load}
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
      </div>
    </div>
  );
}
