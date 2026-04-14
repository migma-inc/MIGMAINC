import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Archive,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Kanban,
  Loader2,
  RefreshCw,
  Search,
  Table2,
  User,
  UserCheck,
  UserRound,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  type OnboardingCase,
  type OnboardingCrmFilters,
  OPERATIONAL_STAGE_COLORS,
  OPERATIONAL_STAGE_LABELS,
  loadOnboardingBoard,
  loadPersistedFilters,
  persistFilters,
} from '@/lib/onboarding-crm';

type CrmView = 'pre_onboarding' | 'onboarding';
type PreOnboardingTab = 'all' | 'pre_pending' | 'pre_zelle' | 'pre_card';

const PAGE_SIZE = 15;

const ONBOARDING_STEPS: { key: string; label: string }[] = [
  { key: 'identity_verification', label: 'Profile' },
  { key: 'selection_survey', label: 'Survey' },
  { key: 'scholarship_selection', label: 'Scholarship' },
  { key: 'documents_upload', label: 'Documents' },
  { key: 'payment', label: 'Application Fee' },
  { key: 'placement_fee', label: 'Placement Fee' },
  { key: 'my_applications', label: 'My Applications' },
];

const PRE_ONBOARDING_COLUMNS = ['pending_zelle', 'pending_card', 'confirmed'] as const;
const ONBOARDING_KANBAN_COLUMNS = [
  'identity_verification',
  'selection_survey',
  'scholarship_selection',
  'documents_upload',
  'payment',
  'placement_fee',
  'my_applications',
] as const;

interface OnboardingCrmBoardProps {
  productLine?: 'cos' | 'transfer';
  title: string;
  description: string;
}

interface StuckState {
  tone: 'critical' | 'danger' | 'warning' | null;
  label: string | null;
}

function toLabel(value: string | null | undefined) {
  if (!value) return '-';
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function shortId(value: string | null | undefined) {
  if (!value) return '-';
  return value.length > 12 ? `${value.slice(0, 8)}...` : value;
}

function timeAgo(iso: string | null | undefined) {
  if (!iso) return '-';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function daysSince(iso: string | null | undefined) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? diff : null;
}

// Step order — used to pick the furthest-along step
const STEP_ORDER = [
  'selection_fee', 'identity_verification', 'selection_survey',
  'scholarship_selection', 'documents_upload', 'payment',
  'scholarship_fee', 'placement_fee', 'my_applications', 'completed',
];

function normalizeOnboardingStep(onboardingStep: string | null | undefined) {
  const step = onboardingStep || 'selection_fee';
  if (step === 'process_type') return 'scholarship_selection';
  if (step === 'reinstatement_fee') return 'placement_fee';
  if (step === 'completed') return 'my_applications';
  return step;
}

/**
 * Deriva o step efetivo do perfil usando as flags booleanas como mínimo garantido.
 * Isso evita que o CRM mostre um step desatualizado quando o aluno avançou no
 * onboarding mas o campo `onboarding_current_step` ainda não foi persistido.
 */
function getEffectiveStep(profile: OnboardingCase['profile']): string {
  // Mínimo derivado pelas flags
  let flagMin: string;
  if (!profile.has_paid_selection_process_fee) {
    flagMin = 'selection_fee';
  } else if (!profile.identity_verified) {
    flagMin = 'identity_verification';
  } else if (!profile.selection_survey_passed) {
    flagMin = 'selection_survey';
  } else {
    flagMin = 'scholarship_selection'; // survey passou → no mínimo em scholarship
  }

  const saved = normalizeOnboardingStep(profile.onboarding_current_step);
  const flagIdx = STEP_ORDER.indexOf(flagMin);
  const savedIdx = STEP_ORDER.indexOf(saved);

  // Retorna o step mais avançado entre o derivado por flags e o salvo no banco
  return savedIdx >= flagIdx ? saved : flagMin;
}

function getOnboardingProgress(profile: OnboardingCase['profile']) {
  const step = getEffectiveStep(profile);
  // Mapeia selection_fee → identity_verification para exibição
  const displayStep = step === 'selection_fee' ? 'identity_verification' : step;
  const index = ONBOARDING_STEPS.findIndex((s) => s.key === displayStep);
  const totalSteps = ONBOARDING_STEPS.length;
  const currentStep = index >= 0 ? index + 1 : 1;
  const label = index >= 0 ? ONBOARDING_STEPS[index].label : toLabel(displayStep);

  return {
    step: displayStep,
    currentStep,
    totalSteps,
    percent: (currentStep / totalSteps) * 100,
    label,
  };
}

function isPreOnboardingCase(item: OnboardingCase) {
  // Usa o step efetivo (derivado por flags) em vez do campo bruto
  // para evitar falsos positivos quando onboarding_current_step está desatualizado
  const effective = getEffectiveStep(item.profile);
  return !item.profile.has_paid_selection_process_fee || effective === 'selection_fee';
}

function getCrmViewForCase(item: OnboardingCase): CrmView {
  return isPreOnboardingCase(item) ? 'pre_onboarding' : 'onboarding';
}

function getPreOnboardingPaymentStatus(item: OnboardingCase) {
  if (item.profile.has_paid_selection_process_fee) return 'confirmed';

  const zelleStatus = item.checkoutZellePending?.status;
  if (zelleStatus === 'pending_verification') return 'pending_zelle';
  if (zelleStatus === 'approved') return 'confirmed';

  const method = (item.profile.selection_process_fee_payment_method || item.visaOrder?.payment_method || '').toLowerCase();
  if (method === 'zelle') return 'pending_zelle';
  if (['card', 'stripe', 'credit_card', 'debit_card'].includes(method)) return 'pending_card';

  if (item.visaOrder?.payment_status === 'completed') return 'confirmed';
  if (item.visaOrder?.payment_status === 'pending' && item.visaOrder.payment_method === 'zelle') return 'pending_zelle';

  return 'pending_card';
}

function getPreOnboardingPaymentLabel(item: OnboardingCase) {
  const status = getPreOnboardingPaymentStatus(item);
  if (status === 'pending_zelle') return 'Pending Zelle';
  if (status === 'pending_card') return 'Pending Card';
  return 'Confirmed';
}

function getPreOnboardingPaymentBadgeClass(item: OnboardingCase) {
  const status = getPreOnboardingPaymentStatus(item);
  if (status === 'confirmed') return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
  if (status === 'pending_zelle') return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
  return 'bg-sky-500/20 text-sky-300 border-sky-500/30';
}

function getStuckState(item: OnboardingCase, productLine?: 'cos' | 'transfer'): StuckState {
  const currentStep = item.profile.onboarding_current_step || 'selection_fee';
  const daysIdle = daysSince(item.profile.updated_at);

  // ── Transfer: alertas em 30, 15, 7, 1 dia ──────────────────────────────
  if (productLine === 'transfer') {
    const d = daysUntil(item.profile.transfer_deadline_date);
    if (d !== null) {
      if (d <= 7)  return { tone: 'critical', label: `Deadline ${d}d` };
      if (d <= 15) return { tone: 'danger',   label: `Deadline ${d}d` };
      if (d <= 30) return { tone: 'warning',  label: `Deadline ${d}d` };
    }
  }

  // ── COS: alertas em 60, 30, 15, 7 dias ────────────────────────────────
  if (productLine === 'cos') {
    const d = daysUntil(item.profile.cos_i94_expiry_date);
    if (d !== null) {
      if (d <= 7)  return { tone: 'critical', label: `I-94 ${d}d` };
      if (d <= 15) return { tone: 'danger',   label: `I-94 ${d}d` };
      if (d <= 30) return { tone: 'warning',  label: `I-94 ${d}d` };
      if (d <= 60) return { tone: 'warning',  label: `I-94 ${d}d` };
    }
  }

  // ── All: alerta genérico por inatividade ───────────────────────────────
  if (daysIdle === null) return { tone: null, label: null };

  if (currentStep === 'selection_survey' && daysIdle > 3) {
    return { tone: 'warning', label: `Survey ${daysIdle}d` };
  }

  if (daysIdle > 7) {
    return { tone: 'danger', label: `${daysIdle}d stopped` };
  }

  return { tone: null, label: null };
}

function alertBadgeClass(tone: StuckState['tone']) {
  if (tone === 'critical') return 'bg-red-600/20 text-red-200 border-red-500/40';
  if (tone === 'danger') return 'bg-red-500/20 text-red-300 border-red-500/30';
  if (tone === 'warning') return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
  return 'bg-white/5 text-gray-500 border-white/10';
}

function getDeadlineLabel(item: OnboardingCase, productLine?: 'cos' | 'transfer') {
  if (productLine === 'transfer') {
    const days = daysUntil(item.profile.transfer_deadline_date);
    return days === null ? 'No deadline' : `Deadline ${days}d`;
  }

  if (productLine === 'cos') {
    const days = daysUntil(item.profile.cos_i94_expiry_date);
    return days === null ? 'No I-94' : `I-94 ${days}d`;
  }

  return toLabel(item.profile.onboarding_current_step);
}

function applyFilters(
  cases: OnboardingCase[],
  search: string,
  filters: OnboardingCrmFilters,
  crmView: CrmView
) {
  const term = search.trim().toLowerCase();

  return cases.filter((item) => {
    const { profile, serviceRequest, visaOrder, operationalStage } = item;

    if (getCrmViewForCase(item) !== crmView) return false;

    if (term) {
      const hit =
        (profile.full_name || '').toLowerCase().includes(term) ||
        (profile.email || '').toLowerCase().includes(term) ||
        (profile.phone || '').toLowerCase().includes(term) ||
        (profile.onboarding_current_step || '').toLowerCase().includes(term) ||
        (profile.onboarding_email_status || '').toLowerCase().includes(term) ||
        (profile.migma_seller_id || '').toLowerCase().includes(term) ||
        (profile.migma_agent_id || '').toLowerCase().includes(term) ||
        (visaOrder?.order_number || '').toLowerCase().includes(term);
      if (!hit) return false;
    }

    if (!filters.showArchived && operationalStage === 'cancelled') return false;

    if (crmView === 'pre_onboarding') {
      const preTab = filters.profileTab as PreOnboardingTab;
      const paymentStatus = getPreOnboardingPaymentStatus(item);
      if (preTab === 'pre_pending' && paymentStatus === 'confirmed') return false;
      if (preTab === 'pre_zelle' && paymentStatus !== 'pending_zelle') return false;
      if (preTab === 'pre_card' && paymentStatus !== 'pending_card') return false;
    } else {
      const { profileTab } = filters;
      if (profileTab === 'completed' && !profile.onboarding_completed) return false;
      if (profileTab === 'in_progress' && !!profile.onboarding_completed) return false;
      if (profileTab === 'selection_paid' && !profile.has_paid_selection_process_fee) return false;
      if (profileTab === 'placement' && !profile.placement_fee_flow) return false;
    }

    const hasOwnership = !!(profile.migma_seller_id || profile.migma_agent_id);
    if (filters.ownership === 'owned' && !hasOwnership) return false;
    if (filters.ownership === 'unassigned' && hasOwnership) return false;

    if (filters.paymentStatus !== 'all') {
      const effectivePaymentStatus =
        crmView === 'pre_onboarding'
          ? getPreOnboardingPaymentStatus(item) === 'confirmed'
            ? 'completed'
            : 'pending'
          : visaOrder?.payment_status;
      if (effectivePaymentStatus !== filters.paymentStatus) return false;
    }

    if (filters.caseStatus !== 'all') {
      if (!serviceRequest) return false;
      if (serviceRequest.case_status !== filters.caseStatus) return false;
    }

    return true;
  });
}

function KanbanView({
  cases,
  crmView,
  productLine,
}: {
  cases: OnboardingCase[];
  crmView: CrmView;
  productLine?: 'cos' | 'transfer';
}) {
  const navigate = useNavigate();

  if (crmView === 'pre_onboarding') {
    const byStatus = new Map<(typeof PRE_ONBOARDING_COLUMNS)[number], OnboardingCase[]>();
    for (const column of PRE_ONBOARDING_COLUMNS) byStatus.set(column, []);
    for (const item of cases) {
      byStatus.get(getPreOnboardingPaymentStatus(item))?.push(item);
    }

    const labels: Record<(typeof PRE_ONBOARDING_COLUMNS)[number], string> = {
      pending_zelle: 'Pending Zelle',
      pending_card: 'Pending Card',
      confirmed: 'Confirmed',
    };

    return (
      <div
        className="flex gap-3 overflow-x-auto pb-4 min-h-[400px] snap-x snap-mandatory scroll-p-3 scroll-smooth touch-pan-x touch-pan-y"
        style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}
      >
        {PRE_ONBOARDING_COLUMNS.map((column) => {
          const cards = byStatus.get(column) ?? [];
          return (
            <div
              key={column}
              className="flex-shrink-0 w-[85vw] max-w-[320px] sm:w-72 snap-center rounded-lg border border-white/5 bg-black/30 flex flex-col"
            >
              <div className="px-3 py-2.5 border-b border-white/5 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{labels[column]}</span>
                <span className="text-[10px] font-bold text-gray-600 bg-white/5 px-1.5 py-0.5 rounded-full">{cards.length}</span>
              </div>
              <div className="p-2 space-y-2 max-h-[600px] overflow-y-auto">
                {cards.map((item) => (
                  <button
                    key={item.profile.id}
                    onClick={() => navigate(`/dashboard/users/${item.profile.id}`)}
                    className="w-full text-left bg-black/60 border border-white/5 rounded-md p-3 space-y-2 hover:border-white/10 transition-colors"
                  >
                    <div>
                      <p className="text-[11px] font-bold text-white uppercase truncate">
                        {item.profile.full_name || item.profile.email || 'Unnamed'}
                      </p>
                      <p className="text-[10px] text-gray-500 truncate">{item.profile.email || '-'}</p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Badge className={cn('text-[8px] font-black uppercase rounded-sm border', getPreOnboardingPaymentBadgeClass(item))}>
                        {getPreOnboardingPaymentLabel(item)}
                      </Badge>
                      <Badge className="text-[8px] font-black uppercase rounded-sm border bg-white/5 text-gray-400 border-white/10">
                        {item.profile.selection_process_fee_payment_method || item.visaOrder?.payment_method || 'payment?'}
                      </Badge>
                    </div>
                    <div className="text-[10px] text-gray-400">
                      <div>Signup: {timeAgo(item.profile.created_at)}</div>
                      <div>Owner: {shortId(item.profile.migma_seller_id)}</div>
                    </div>
                  </button>
                ))}
                {cards.length === 0 && <p className="text-[10px] text-gray-700 text-center py-4 italic">Empty</p>}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const byStep = new Map<string, OnboardingCase[]>();
  for (const column of ONBOARDING_KANBAN_COLUMNS) byStep.set(column, []);
  for (const item of cases) {
    const step = getEffectiveStep(item.profile);
    const resolvedStep = byStep.has(step) ? step : 'identity_verification';
    byStep.get(resolvedStep)?.push(item);
  }

  return (
    <div
      className="flex gap-3 overflow-x-auto pb-4 min-h-[400px] snap-x snap-mandatory scroll-p-3 scroll-smooth touch-pan-x touch-pan-y"
      style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}
    >
      {ONBOARDING_KANBAN_COLUMNS.map((column) => {
        const cards = byStep.get(column) ?? [];
        return (
          <div
            key={column}
            className="flex-shrink-0 w-[85vw] max-w-[320px] sm:w-72 snap-center rounded-lg border border-white/5 bg-black/30 flex flex-col"
          >
            <div className="px-3 py-2.5 border-b border-white/5 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{toLabel(column)}</span>
              <span className="text-[10px] font-bold text-gray-600 bg-white/5 px-1.5 py-0.5 rounded-full">{cards.length}</span>
            </div>
            <div className="p-2 space-y-2 max-h-[600px] overflow-y-auto">
              {cards.map((item) => {
                const progress = getOnboardingProgress(item.profile);
                const stuckState = getStuckState(item, productLine);
                return (
                  <button
                    key={item.profile.id}
                    onClick={() => navigate(`/dashboard/users/${item.profile.id}`)}
                    className="w-full text-left bg-black/60 border border-white/5 rounded-md p-3 space-y-2 hover:border-white/10 transition-colors"
                  >
                    <div>
                      <p className="text-[11px] font-bold text-white uppercase truncate">
                        {item.profile.full_name || item.profile.email || 'Unnamed'}
                      </p>
                      <p className="text-[10px] text-gray-500 truncate">{item.profile.email || '-'}</p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[9px] text-gold-medium font-black">{progress.currentStep}/{progress.totalSteps}</span>
                        <span className="text-[8px] text-gray-500 truncate max-w-[120px]">{progress.label}</span>
                      </div>
                      <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-gold-medium rounded-full" style={{ width: `${progress.percent}%` }} />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Badge className={cn('text-[8px] font-black uppercase rounded-sm border', OPERATIONAL_STAGE_COLORS[item.operationalStage])}>
                        {OPERATIONAL_STAGE_LABELS[item.operationalStage]}
                      </Badge>
                      {stuckState.label && (
                        <Badge className={cn('text-[8px] font-black uppercase rounded-sm border', alertBadgeClass(stuckState.tone))}>
                          {stuckState.label}
                        </Badge>
                      )}
                    </div>
                  </button>
                );
              })}
              {cards.length === 0 && <p className="text-[10px] text-gray-700 text-center py-4 italic">Empty</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function OnboardingCrmBoard({ productLine, title, description }: OnboardingCrmBoardProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState<OnboardingCase[]>([]);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<OnboardingCrmFilters>(() => loadPersistedFilters());
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [crmView, setCrmView] = useState<CrmView>('pre_onboarding');
  const [showAlertLegend, setShowAlertLegend] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const loadBoard = useCallback(async () => {
    setLoading(true);
    const { cases: loaded, error } = await loadOnboardingBoard(productLine);
    if (error) console.error('[OnboardingCrmBoard] board load error:', error);
    setCases(loaded);
    setLoading(false);
  }, [productLine]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  useEffect(() => {
    persistFilters(filters);
  }, [filters]);

  const filteredCases = useMemo(
    () => applyFilters(cases, search, filters, crmView),
    [cases, search, filters, crmView]
  );

  const totalPages = Math.max(1, Math.ceil(filteredCases.length / PAGE_SIZE));
  const currentData = filteredCases.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => setCurrentPage(1), [search, filters, crmView]);
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const stats = useMemo(() => {
    const scopedCases = cases.filter(
      (item) =>
        getCrmViewForCase(item) === crmView &&
        (filters.showArchived || item.operationalStage !== 'cancelled')
    );
    const owned = scopedCases.filter((item) => !!(item.profile.migma_seller_id || item.profile.migma_agent_id)).length;

    if (crmView === 'pre_onboarding') {
      return {
        cards: [
          { label: 'Pre-Leads', value: scopedCases.length, valueColor: 'text-white' },
          { label: 'Pending', value: scopedCases.filter((item) => getPreOnboardingPaymentStatus(item) !== 'confirmed').length, valueColor: 'text-amber-400' },
          { label: 'Zelle', value: scopedCases.filter((item) => getPreOnboardingPaymentStatus(item) === 'pending_zelle').length, valueColor: 'text-orange-400' },
          { label: 'Card', value: scopedCases.filter((item) => getPreOnboardingPaymentStatus(item) === 'pending_card').length, valueColor: 'text-sky-400' },
          { label: 'Confirmed', value: scopedCases.filter((item) => getPreOnboardingPaymentStatus(item) === 'confirmed').length, valueColor: 'text-emerald-400' },
          { label: 'Owned', value: owned, valueColor: 'text-gray-400' },
        ],
      };
    }

    return {
      cards: [
        { label: 'Active Cases', value: scopedCases.length, valueColor: 'text-white' },
        { label: 'Stuck', value: scopedCases.filter((item) => {
          const tone = getStuckState(item, productLine).tone;
          return tone === 'danger' || tone === 'warning';
        }).length, valueColor: 'text-amber-400' },
        { label: 'Critical', value: scopedCases.filter((item) => getStuckState(item, productLine).tone === 'critical').length, valueColor: 'text-red-400' },
        { label: 'In Process', value: scopedCases.filter((item) => item.operationalStage === 'in_processing' || item.operationalStage === 'documents_pending' || item.operationalStage === 'documents_under_review').length, valueColor: 'text-sky-400' },
        { label: 'Completed', value: scopedCases.filter((item) => item.operationalStage === 'completed').length, valueColor: 'text-gold-light' },
        { label: 'Owned', value: owned, valueColor: 'text-gray-400' },
      ],
    };
  }, [cases, crmView, filters.showArchived, productLine]);

  const filterTabs: Array<{ id: OnboardingCrmFilters['profileTab']; label: string }> = crmView === 'pre_onboarding'
    ? [
        { id: 'all', label: 'All' },
        { id: 'pre_pending', label: 'Pending' },
        { id: 'pre_zelle', label: 'Zelle' },
        { id: 'pre_card', label: 'Card' },
      ]
    : [
        { id: 'all', label: 'All' },
        { id: 'in_progress', label: 'In Progress' },
        { id: 'completed', label: 'Completed' },
        { id: 'placement', label: 'Placement' },
      ];

  return (
    <div className="w-full max-w-full sm:max-w-7xl mx-auto overflow-x-hidden p-3 sm:p-6 space-y-3 sm:space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 overflow-hidden">
          <div className="p-2 bg-gold-medium/10 rounded-lg shrink-0">
            <UserRound className="w-5 h-5 sm:w-8 sm:h-8 text-gold-medium" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-3xl font-bold text-white uppercase tracking-tight truncate">{title}</h1>
            <p className="text-gray-500 text-[10px] sm:text-sm truncate">{description}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2 w-full lg:w-auto min-w-0">
          <div className="relative w-full sm:w-[260px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <Input
              placeholder="Search client, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-black/40 border-white/10 pl-9 w-full text-white text-sm h-9"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="flex border border-white/10 rounded-lg overflow-hidden shrink-0 h-9">
              <button
                onClick={() => setViewMode('table')}
                className={cn('flex items-center gap-1.5 px-3 py-2 text-xs transition-colors', viewMode === 'table' ? 'bg-gold-medium/20 text-gold-light' : 'bg-transparent text-gray-500 hover:text-gray-300')}
              >
                <Table2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Table</span>
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                className={cn('flex items-center gap-1.5 px-3 py-2 text-xs transition-colors border-l border-white/10', viewMode === 'kanban' ? 'bg-gold-medium/20 text-gold-light' : 'bg-transparent text-gray-500 hover:text-gray-300')}
              >
                <Kanban className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Kanban</span>
              </button>
            </div>

            <Button
              onClick={loadBoard}
              variant="outline"
              size="sm"
              className="gap-2 flex-1 sm:flex-none h-9 border-gray-700 bg-transparent hover:bg-white/10 text-white"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
              <span className="sm:inline hidden">Refresh</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:flex gap-2 sm:overflow-x-auto pb-2">
        {[
          { id: 'pre_onboarding' as const, label: 'Pre-Onboarding', description: 'Checkout done, selection fee still pending.' },
          { id: 'onboarding' as const, label: 'Onboarding', description: 'Selection fee confirmed, operational flow active.' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setCrmView(tab.id)}
            className={cn(
              'w-full sm:min-w-[220px] rounded-2xl border p-4 text-left transition-all',
              crmView === tab.id
                ? 'border-gold-medium/40 bg-gold-medium/10 shadow-[0_0_20px_rgba(206,159,72,0.15)]'
                : 'border-white/5 bg-black/30 hover:border-white/10'
            )}
          >
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-gold-light">{tab.label}</div>
            <p className="mt-2 text-xs text-gray-400 leading-relaxed">{tab.description}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
        {stats.cards.map((stat) => (
          <div key={stat.label} className="bg-black/40 border border-white/5 p-2 sm:p-3 rounded-xl flex items-center justify-between hover:border-white/10 transition-all">
            <span className="text-[9px] sm:text-[10px] text-gray-500 font-black uppercase tracking-widest leading-none">{stat.label}</span>
            <span className={cn('font-black text-sm sm:text-base leading-none', stat.valueColor)}>{stat.value}</span>
          </div>
        ))}
      </div>

      {/* Alert legend accordion */}
      {crmView === 'onboarding' && (
        <div className="rounded-xl border border-white/10 bg-black/30 overflow-hidden">
          <button
            onClick={() => setShowAlertLegend(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/5 transition-colors"
          >
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
              Alert Thresholds
            </span>
            <ChevronDown className={cn('w-4 h-4 text-gray-600 transition-transform', showAlertLegend && 'rotate-180')} />
          </button>
          {showAlertLegend && (
            <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-white/5 pt-3">
              <div className="space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-400">Transfer — Deadline</p>
                <div className="space-y-1 text-xs text-gray-400">
                  <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400 shrink-0" /> ≤ 30 dias</div>
                  <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-orange-400 shrink-0" /> ≤ 15 dias</div>
                  <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" /> ≤ 7 dias</div>
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-sky-400">COS — I-94 Expiry</p>
                <div className="space-y-1 text-xs text-gray-400">
                  <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400 shrink-0" /> ≤ 60 dias</div>
                  <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-orange-400 shrink-0" /> ≤ 15 dias</div>
                  <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" /> ≤ 7 dias</div>
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Inatividade (geral)</p>
                <div className="space-y-1 text-xs text-gray-400">
                  <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400 shrink-0" /> Survey parado &gt; 3d</div>
                  <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-orange-400 shrink-0" /> Parado &gt; 7d</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-4">
        <div className="flex flex-wrap gap-2 pb-2">
          {filterTabs.map((tab) => (
            <Button
              key={tab.id}
              variant={filters.profileTab === tab.id ? 'default' : 'outline'}
              onClick={() => setFilters((f) => ({ ...f, profileTab: tab.id }))}
              className={cn(
                'text-[11px] font-black uppercase tracking-wider whitespace-nowrap px-4 rounded-lg h-9 shrink-0 transition-all',
                filters.profileTab === tab.id
                  ? 'bg-gold-medium hover:bg-gold-dark text-black border-none shadow-[0_0_15px_rgba(206,159,72,0.3)]'
                  : 'border-white/10 bg-black/40 text-gray-400 hover:bg-white/5'
              )}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row pb-2 gap-3 items-stretch sm:items-center">
          <div className="flex flex-wrap gap-1.5 shrink-0 bg-white/5 p-1 rounded-lg border border-white/5">
            {(['all', 'pending', 'completed', 'cancelled'] as const).map((value) => (
              <button
                key={value}
                onClick={() => setFilters((f) => ({ ...f, paymentStatus: value }))}
                className={cn(
                  'h-7 px-3 text-[9px] font-black uppercase tracking-widest rounded-md whitespace-nowrap transition-all flex-1 sm:flex-none',
                  filters.paymentStatus === value ? 'bg-white/10 text-white shadow-inner' : 'text-gray-500 hover:text-gray-300'
                )}
              >
                {value === 'all' ? 'Pmt: All' : value}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5 shrink-0 bg-white/5 p-1 rounded-lg border border-white/5">
            {(['all', 'owned', 'unassigned'] as const).map((value) => (
              <button
                key={value}
                onClick={() => setFilters((f) => ({ ...f, ownership: value }))}
                className={cn(
                  'h-7 px-3 text-[9px] font-black uppercase tracking-widest rounded-md whitespace-nowrap transition-all flex-1 sm:flex-none',
                  filters.ownership === value ? 'bg-white/10 text-white shadow-inner' : 'text-gray-500 hover:text-gray-300'
                )}
              >
                {value === 'all' ? 'Owner: All' : value === 'owned' ? 'Assigned' : 'Open'}
              </button>
            ))}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilters((f) => ({ ...f, showArchived: !f.showArchived }))}
            className={cn('h-9 px-3 text-[9px] font-black uppercase tracking-widest rounded-lg shrink-0 transition-all border border-white/5 w-full sm:w-auto', filters.showArchived ? 'text-gold-light' : 'text-gray-500')}
          >
            <Archive className="w-3.5 h-3.5 mr-2" />
            {filters.showArchived ? 'Hide' : 'Show'} Archived
          </Button>
        </div>
      </div>

      {viewMode === 'kanban' && (
        loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-gold-medium" />
          </div>
        ) : (
          <KanbanView cases={filteredCases} crmView={crmView} productLine={productLine} />
        )
      )}

      {viewMode === 'table' && (
        <Card className="bg-gradient-to-br from-gold-light/5 via-transparent to-gold-dark/5 border border-white/5">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center items-center py-20">
                <Loader2 className="w-10 h-10 animate-spin text-gold-medium" />
              </div>
            ) : currentData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                <AlertCircle className="w-12 h-12 mb-4 opacity-20" />
                <p className="text-lg font-medium">No cases match the current filters.</p>
              </div>
            ) : (
              <>
                {!isMobile && (
                  <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                    <table className="w-full text-left">
                      <thead>
                        {crmView === 'pre_onboarding' ? (
                          <tr className="border-b border-white/5 text-[10px] lg:text-[11px] font-black uppercase text-gray-500 tracking-[0.2em]">
                            <th className="px-3 py-3 lg:px-5 lg:py-4">Client</th>
                            <th className="px-3 py-3 lg:px-5 lg:py-4">Signup</th>
                            <th className="px-3 py-3 lg:px-5 lg:py-4">Payment</th>
                            <th className="px-3 py-3 lg:px-5 lg:py-4">Owner</th>
                            <th className="px-3 py-3 lg:px-5 lg:py-4">Follow-Up</th>
                            <th className="px-3 py-3 lg:px-5 lg:py-4">Activity</th>
                          </tr>
                        ) : (
                          <tr className="border-b border-white/5 text-[10px] lg:text-[11px] font-black uppercase text-gray-500 tracking-[0.2em]">
                            <th className="px-3 py-3 lg:px-5 lg:py-4">Client</th>
                            <th className="px-3 py-3 lg:px-5 lg:py-4">CRM Stage</th>
                            <th className="px-3 py-3 lg:px-5 lg:py-4">Step</th>
                            <th className="px-3 py-3 lg:px-5 lg:py-4">Alert</th>
                            <th className="px-3 py-3 lg:px-5 lg:py-4">Deadline</th>
                            <th className="px-3 py-3 lg:px-5 lg:py-4">Owner</th>
                          </tr>
                        )}
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {currentData.map((item) => {
                          const { profile, serviceRequest, visaOrder, operationalStage } = item;
                          const progress = getOnboardingProgress(profile);
                          const stuckState = getStuckState(item, productLine);

                          if (crmView === 'pre_onboarding') {
                            return (
                              <tr
                                key={profile.id}
                                className="group hover:bg-white/[0.02] transition-colors cursor-pointer"
                                onClick={() => navigate(`/dashboard/users/${profile.id}`)}
                              >
                                <td className="px-3 py-3 lg:px-5 lg:py-4 min-w-[180px]">
                                  <div className="flex flex-col gap-0.5 min-w-0">
                                    <span className="text-white font-bold text-sm tracking-tight uppercase truncate">{profile.full_name || profile.email || 'Unnamed'}</span>
                                    <span className="text-[10px] text-gray-500 font-mono italic truncate">{profile.email || '-'}</span>
                                    <span className="text-[10px] text-gray-600 uppercase font-bold tracking-wider truncate">{profile.phone || '-'}</span>
                                  </div>
                                </td>
                                <td className="px-3 py-3 lg:px-5 lg:py-4">
                                  <div className="flex flex-col gap-1">
                                    <span className="text-[10px] text-gray-300">{timeAgo(profile.created_at)}</span>
                                    <span className="text-[10px] text-gray-600 uppercase tracking-wider">updated {timeAgo(profile.updated_at)}</span>
                                  </div>
                                </td>
                                <td className="px-3 py-3 lg:px-5 lg:py-4">
                                  <div className="flex flex-col gap-1">
                                    <Badge className={cn('w-fit text-[9px] font-black uppercase rounded-sm border', getPreOnboardingPaymentBadgeClass(item))}>
                                      {getPreOnboardingPaymentLabel(item)}
                                    </Badge>
                                    <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                                      {profile.selection_process_fee_payment_method || visaOrder?.payment_method || 'method?'}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-3 py-3 lg:px-5 lg:py-4">
                                  <div className="flex flex-col gap-1">
                                    <span className="text-[10px] text-gray-500 uppercase tracking-wider">seller {shortId(profile.migma_seller_id)}</span>
                                    <span className="text-[10px] text-gray-500 uppercase tracking-wider">agent {shortId(profile.migma_agent_id)}</span>
                                  </div>
                                </td>
                                <td className="px-3 py-3 lg:px-5 lg:py-4">
                                  <div className="flex flex-col gap-1">
                                    <span className="text-[10px] text-gray-300">{daysSince(profile.created_at) ?? 0}d since signup</span>
                                    {item.checkoutZellePending?.status && (
                                      <span className="text-[10px] text-gray-600 uppercase tracking-wider">{toLabel(item.checkoutZellePending.status)}</span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-3 lg:px-5 lg:py-4 text-right">
                                  <Badge className="w-fit text-[8px] font-black uppercase rounded-sm border bg-white/5 text-gray-500 border-white/10 group-hover:border-gold-medium/30 group-hover:text-gold-light transition-colors px-2 py-0.5">
                                    View
                                  </Badge>
                                </td>
                              </tr>
                            );
                          }

                          return (
                            <tr
                              key={profile.id}
                              className="group hover:bg-white/[0.02] transition-colors cursor-pointer"
                              onClick={() => navigate(`/dashboard/users/${profile.id}`)}
                            >
                              <td className="px-3 py-3 lg:px-5 lg:py-4 min-w-[180px]">
                                <div className="flex flex-col gap-0.5 min-w-0">
                                  <span className="text-white font-bold text-sm tracking-tight uppercase truncate">{profile.full_name || profile.email || 'Unnamed'}</span>
                                  <span className="text-[10px] text-gray-500 font-mono italic truncate">{profile.email || '-'}</span>
                                  <span className="text-[10px] text-gray-600 uppercase font-bold tracking-wider truncate">{profile.phone || '-'}</span>
                                </div>
                              </td>
                              <td className="px-3 py-3 lg:px-5 lg:py-4">
                                <Badge className={cn('w-fit text-[9px] font-black uppercase rounded-sm border', OPERATIONAL_STAGE_COLORS[operationalStage])}>
                                  {OPERATIONAL_STAGE_LABELS[operationalStage]}
                                </Badge>
                              </td>
                              <td className="px-3 py-3 lg:px-5 lg:py-4 min-w-[160px]">
                                <div className="flex flex-col gap-1.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-[10px] lg:text-xs text-gold-medium font-black">{progress.currentStep}/{progress.totalSteps}</span>
                                    <span className="text-[8px] lg:text-[9px] text-gray-400 font-bold tracking-tighter truncate">{progress.label}</span>
                                  </div>
                                  <Progress value={progress.percent} className="h-1.5 bg-white/10" />
                                </div>
                              </td>
                              <td className="px-3 py-3 lg:px-5 lg:py-4">
                                {stuckState.label ? (
                                  <Badge className={cn('text-[9px] font-black uppercase rounded-sm border', alertBadgeClass(stuckState.tone))}>
                                    {stuckState.label}
                                  </Badge>
                                ) : (
                                  <span className="text-[10px] text-gray-600">Healthy</span>
                                )}
                              </td>
                              <td className="px-3 py-3 lg:px-5 lg:py-4">
                                <div className="flex flex-col gap-1">
                                  <span className="text-[10px] text-gray-300">{getDeadlineLabel(item, productLine)}</span>
                                  <span className="text-[10px] text-gray-600 uppercase tracking-wider">updated {timeAgo(profile.updated_at)}</span>
                                </div>
                              </td>
                              <td className="px-3 py-3 lg:px-5 lg:py-4">
                                <div className="flex flex-col gap-1.5">
                                  {serviceRequest?.owner_user_id ? (
                                    <div className="flex items-center gap-1.5">
                                      <UserCheck className="w-3.5 h-3.5 text-gold-medium shrink-0" />
                                      <span className="text-[10px] text-gray-300 font-mono break-all max-w-[100px]">{serviceRequest.owner_user_id.slice(0, 8)}...</span>
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-gray-600 italic">Unassigned</span>
                                  )}
                                  <span className="text-[10px] text-gray-500 uppercase tracking-wider">seller {shortId(profile.migma_seller_id)}</span>
                                  <span className="text-[10px] text-gray-500 uppercase tracking-wider">agent {shortId(profile.migma_agent_id)}</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {isMobile && (
                  <div className="p-3 space-y-3">
                    {currentData.map((item) => {
                      const { profile, serviceRequest, operationalStage } = item;
                      const progress = getOnboardingProgress(profile);
                      const stuckState = getStuckState(item, productLine);

                      return (
                        <Card
                          key={profile.id}
                          className="hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-zinc-900 via-black to-zinc-900 border border-gold-medium/20 hover:border-gold-medium/40 group relative overflow-hidden cursor-pointer w-full"
                          onClick={() => navigate(`/dashboard/users/${profile.id}`)}
                        >
                          <CardHeader className="p-3 pb-2 relative">
                            <div className="flex items-start gap-2">
                              <div className="p-1.5 bg-gold-medium/10 rounded-lg border border-gold-medium/20 shrink-0">
                                <User className="w-3.5 h-3.5 text-gold-light" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <CardTitle className="text-base font-black uppercase tracking-tight text-white leading-tight">
                                  {profile.full_name || profile.email || 'Unnamed'}
                                </CardTitle>
                                <div className="mt-1 text-[10px] text-gray-500">
                                  <div className="break-all normal-case">{profile.email || '-'}</div>
                                  {profile.phone && <div>{profile.phone}</div>}
                                </div>
                              </div>
                            </div>
                          </CardHeader>

                          <CardContent className="p-3 pt-0">
                            {crmView === 'pre_onboarding' ? (
                              <div className="space-y-2">
                                <Badge className={cn('text-[9px] font-black uppercase rounded-sm border', getPreOnboardingPaymentBadgeClass(item))}>
                                  {getPreOnboardingPaymentLabel(item)}
                                </Badge>
                                <div className="text-[10px] text-gray-400 space-y-1">
                                  <div>Signup: {timeAgo(profile.created_at)}</div>
                                  <div>Method: {profile.selection_process_fee_payment_method || item.visaOrder?.payment_method || 'payment?'}</div>
                                  <div>Owner: {shortId(profile.migma_seller_id)}</div>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <Badge className={cn('text-[9px] font-black uppercase rounded-sm border', OPERATIONAL_STAGE_COLORS[operationalStage])}>
                                  {OPERATIONAL_STAGE_LABELS[operationalStage]}
                                </Badge>
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Step</span>
                                    <span className="text-gold-medium font-black text-[10px]">{progress.currentStep}/{progress.totalSteps} - {progress.label}</span>
                                  </div>
                                  <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                                    <div className="h-full bg-gold-medium rounded-full" style={{ width: `${progress.percent}%` }} />
                                  </div>
                                </div>
                                <div className="text-[10px] text-gray-400 space-y-1">
                                  <div>{getDeadlineLabel(item, productLine)}</div>
                                  <div>{stuckState.label || `Updated ${timeAgo(profile.updated_at)}`}</div>
                                  <div>{serviceRequest?.owner_user_id ? 'Assigned' : 'Unassigned'}</div>
                                </div>
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-2 mt-3">
                              <button
                                className="bg-gold-medium/5 hover:bg-gold-medium/20 text-gold-light border border-gold-medium/10 h-9 text-[10px] font-black uppercase tracking-widest transition-all rounded-md flex items-center justify-center gap-2"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/dashboard/users/${profile.id}`);
                                }}
                              >
                                <Eye className="w-3.5 h-3.5 shrink-0" />
                                View
                              </button>
                              <div className="bg-white/5 border border-white/5 h-9 text-[10px] font-black uppercase tracking-widest rounded-md flex items-center justify-center gap-2 text-gray-500">
                                {serviceRequest?.owner_user_id ? (
                                  <>
                                    <UserCheck className="w-3.5 h-3.5 text-gold-medium shrink-0" />
                                    <span className="text-gray-400">Assigned</span>
                                  </>
                                ) : (
                                  <span className="italic">Unassigned</span>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}

                <div className="p-3 sm:p-4 border-t border-white/5 flex items-center justify-between gap-2 sm:gap-4">
                  <p className="text-[9px] sm:text-[10px] uppercase font-black text-gray-600 tracking-widest">
                    {filteredCases.length === 0
                      ? 'No results'
                      : `${(currentPage - 1) * PAGE_SIZE + 1}-${Math.min(currentPage * PAGE_SIZE, filteredCases.length)} of ${filteredCases.length}`}
                  </p>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                      disabled={currentPage === 1}
                      className="h-8 w-8 border-white/10 bg-black/40 text-gray-400 hover:bg-white/5 disabled:opacity-30"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </Button>
                    <span className="text-[10px] sm:text-[11px] text-gray-400 font-black uppercase tracking-wider px-1">{currentPage} / {totalPages}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                      disabled={currentPage === totalPages}
                      className="h-8 w-8 border-white/10 bg-black/40 text-gray-400 hover:bg-white/5 disabled:opacity-30"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
