import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  Archive,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Globe,
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
  type OperationalStage,
  OPERATIONAL_STAGE_COLORS,
  OPERATIONAL_STAGE_LABELS,
  loadOnboardingBoard,
  loadPersistedFilters,
  persistFilters,
} from '@/lib/onboarding-crm';

// ---------------------------------------------------------------------------
// Stage → workflow_stage mapping for drag-and-drop
// ---------------------------------------------------------------------------

const KANBAN_COLUMNS: OperationalStage[] = [
  'payment_pending',
  'awaiting_payment_confirmation',
  'contract_pending',
  'contract_under_review',
  'contract_rejected',
  'documents_pending',
  'documents_under_review',
  'in_processing',
  'completed',
  'blocked',
];

// ---------------------------------------------------------------------------
// KanbanView
// ---------------------------------------------------------------------------

interface KanbanViewProps {
  cases: OnboardingCase[];
}

function KanbanView({ cases }: KanbanViewProps) {
  const navigate = useNavigate();

  const byStage = useMemo(() => {
    const map = new Map<OperationalStage, OnboardingCase[]>();
    for (const stage of KANBAN_COLUMNS) map.set(stage, []);
    for (const c of cases) {
      if (KANBAN_COLUMNS.includes(c.operationalStage)) {
        map.get(c.operationalStage)!.push(c);
      }
    }
    return map;
  }, [cases]);

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 min-h-[400px] touch-manipulation" style={{ WebkitOverflowScrolling: 'touch' }}>
      {KANBAN_COLUMNS.map((stage) => {
        const cards = byStage.get(stage) ?? [];

        return (
          <div
            key={stage}
            className={cn(
              'flex-shrink-0 w-56 rounded-lg border flex flex-col transition-colors border-white/5 bg-black/30'
            )}
          >
            {/* Column header */}
            <div className="px-3 py-2.5 border-b border-white/5 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                {OPERATIONAL_STAGE_LABELS[stage]}
              </span>
              <span className="text-[10px] font-bold text-gray-600 bg-white/5 px-1.5 py-0.5 rounded-full">
                {cards.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[600px]">
              {cards.length === 0 ? (
                <p className="text-[10px] text-gray-700 text-center py-4 italic">Empty</p>
              ) : (
                cards.map((c) => {
                  const isTransfer = c.visaOrder?.product_slug?.startsWith('transfer-');
                  const isCos = c.visaOrder?.product_slug?.startsWith('cos-');
                  const deadlineDays = isTransfer
                    ? daysUntil(c.profile.transfer_deadline_date)
                    : isCos
                      ? daysUntil(c.profile.cos_i94_expiry_date)
                      : null;
                  const missingDeadline = (isTransfer || isCos) && deadlineDays === null &&
                    (isTransfer ? !c.profile.transfer_deadline_date : !c.profile.cos_i94_expiry_date);

                  return (
                    <div
                      key={c.profile.id}
                      onClick={() => navigate(`/dashboard/users/${c.profile.id}`)}
                      className={cn(
                        'bg-black/60 border rounded-md p-2.5 space-y-1.5 transition-all cursor-pointer hover:border-white/10',
                        isCos && deadlineDays !== null && deadlineDays <= 15
                          ? 'border-red-500/40'
                          : 'border-white/5'
                      )}
                    >
                      <p className="text-[11px] font-bold text-white uppercase truncate leading-tight">
                        {c.profile.full_name || c.profile.email || 'Unnamed'}
                      </p>
                      {c.visaOrder?.order_number && (
                        <p className="text-[9px] text-gray-500 font-mono truncate">
                          {c.visaOrder.order_number}
                        </p>
                      )}
                      <div className="flex items-center gap-1 flex-wrap">
                        {c.visaOrder?.payment_status && (
                          <Badge className={cn(
                            'text-[8px] font-black uppercase border rounded-sm px-1 py-0',
                            c.visaOrder.payment_status === 'completed'
                              ? 'bg-green-500/20 text-green-300 border-green-500/30'
                              : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          )}>
                            {c.visaOrder.payment_status}
                          </Badge>
                        )}
                        {c.serviceRequest?.priority && c.serviceRequest.priority !== 'normal' && (
                          <Badge className="text-[8px] font-black uppercase border rounded-sm px-1 py-0 bg-red-500/20 text-red-300 border-red-500/30">
                            {c.serviceRequest.priority}
                          </Badge>
                        )}
                        {deadlineDays !== null && (isTransfer || isCos) && (
                          <DeadlineBadge
                            days={deadlineDays}
                            label={isTransfer ? 'PRAZO' : 'I-94'}
                            redThreshold={isTransfer ? 7 : 15}
                            yellowThreshold={isTransfer ? 15 : 30}
                          />
                        )}
                        {missingDeadline && (
                          <Badge className="text-[8px] font-black uppercase border rounded-sm px-1 py-0 bg-white/5 text-gray-600 border-white/5">
                            {isTransfer ? 'PRAZO?' : 'I-94?'}
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toLabel(value: string | null | undefined) {
  if (!value) return '-';
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
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

function shortId(value: string | null | undefined) {
  if (!value) return '—';
  return value.length > 12 ? `${value.slice(0, 8)}…` : value;
}

/**
 * Returns days until a deadline date string (YYYY-MM-DD or ISO).
 * Returns null if date is absent or already passed.
 */
function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? diff : null;
}

interface DeadlineBadgeProps {
  days: number;
  label: string;
  redThreshold: number;
  yellowThreshold: number;
}
function DeadlineBadge({ days, label, redThreshold, yellowThreshold }: DeadlineBadgeProps) {
  const colorClass =
    days <= redThreshold
      ? 'bg-red-500/20 text-red-300 border-red-500/40'
      : days <= yellowThreshold
        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
        : 'bg-white/5 text-gray-400 border-white/10';
  return (
    <Badge className={cn('text-[8px] font-black uppercase border rounded-sm px-1 py-0', colorClass)}>
      {label} {days}d
    </Badge>
  );
}

function paymentStatusColor(status: string | null) {
  if (status === 'completed') return 'bg-green-500/20 text-green-300 border-green-500/30';
  if (status === 'cancelled') return 'bg-white/5 text-gray-500 border-white/10';
  return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
}

const APPLICATION_FLOW_STEPS: OperationalStage[] = [
  'checkout_started',
  'payment_pending',
  'awaiting_payment_confirmation',
  'payment_confirmed',
  'contract_pending',
  'contract_under_review',
  'documents_pending',
  'documents_under_review',
  'in_processing',
  'completed',
];

function getApplicationFlowProgress(stage: OperationalStage) {
  const index = APPLICATION_FLOW_STEPS.indexOf(stage);
  const totalSteps = APPLICATION_FLOW_STEPS.length;

  if (index >= 0) {
    const currentStep = index + 1;
    return {
      currentStep,
      totalSteps,
      percent: (currentStep / totalSteps) * 100,
      label: 'Application Flow',
      status: OPERATIONAL_STAGE_LABELS[stage],
    };
  }

  return {
    currentStep: 0,
    totalSteps,
    percent: 0,
    label: stage === 'blocked' ? 'Paused' : 'Application Flow',
    status: OPERATIONAL_STAGE_LABELS[stage],
  };
}

// ---------------------------------------------------------------------------
// Filter predicates
// ---------------------------------------------------------------------------

const PAGE_SIZE = 15;

function applyFilters(
  cases: OnboardingCase[],
  search: string,
  filters: OnboardingCrmFilters
): OnboardingCase[] {
  const term = search.trim().toLowerCase();

  return cases.filter(({ profile, serviceRequest, visaOrder, operationalStage }) => {
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

    const { profileTab } = filters;
    if (profileTab === 'completed' && !profile.onboarding_completed) return false;
    if (profileTab === 'in_progress' && !!profile.onboarding_completed) return false;
    if (profileTab === 'selection_paid' && !profile.has_paid_selection_process_fee) return false;
    if (profileTab === 'placement' && !profile.placement_fee_flow) return false;

    const hasOwnership = !!(profile.migma_seller_id || profile.migma_agent_id);
    if (filters.ownership === 'owned' && !hasOwnership) return false;
    if (filters.ownership === 'unassigned' && hasOwnership) return false;

    if (filters.paymentStatus !== 'all') {
      if (!visaOrder) return false;
      if (visaOrder.payment_status !== filters.paymentStatus) return false;
    }

    if (filters.caseStatus !== 'all') {
      if (!serviceRequest) return false;
      if (serviceRequest.case_status !== filters.caseStatus) return false;
    }

    return true;
  });
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface OnboardingCrmBoardProps {
  productLine?: 'cos' | 'transfer';
  title: string;
  description: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OnboardingCrmBoard({ productLine, title, description }: OnboardingCrmBoardProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState<OnboardingCase[]>([]);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<OnboardingCrmFilters>(() => loadPersistedFilters());
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
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
    () => applyFilters(cases, search, filters),
    [cases, search, filters]
  );

  const totalPages = Math.max(1, Math.ceil(filteredCases.length / PAGE_SIZE));
  const currentData = filteredCases.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  useEffect(() => setCurrentPage(1), [search, filters]);
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const stats = useMemo(() => {
    const all = cases.filter(({ operationalStage }) => operationalStage !== 'cancelled');
    const owned = all.filter((c) => !!(c.profile.migma_seller_id || c.profile.migma_agent_id));
    return {
      total: all.length,
      owned: owned.length,
      unassigned: all.length - owned.length,
      paymentPending: all.filter(
        (c) =>
          c.operationalStage === 'payment_pending' ||
          c.operationalStage === 'awaiting_payment_confirmation'
      ).length,
      inProcessing: all.filter(
        (c) =>
          c.operationalStage === 'in_processing' ||
          c.operationalStage === 'documents_pending' ||
          c.operationalStage === 'documents_under_review' ||
          c.operationalStage === 'contract_pending' ||
          c.operationalStage === 'contract_under_review'
      ).length,
      completed: all.filter((c) => c.operationalStage === 'completed').length,
      blocked: all.filter((c) => c.operationalStage === 'blocked').length,
    };
  }, [cases]);

  const filterTabs: Array<{ id: OnboardingCrmFilters['profileTab']; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'in_progress', label: 'In Progress' },
    { id: 'completed', label: 'Completed' },
    { id: 'selection_paid', label: 'Selection Paid' },
    { id: 'placement', label: 'Placement' },
  ];

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-3 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 overflow-hidden">
          <div className="p-2 bg-gold-medium/10 rounded-lg shrink-0">
            <UserRound className="w-5 h-5 sm:w-8 sm:h-8 text-gold-medium" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-3xl font-bold text-white uppercase tracking-tight truncate">
              {title}
            </h1>
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
            {/* View toggle */}
            <div className="flex border border-white/10 rounded-lg overflow-hidden shrink-0 h-9">
              <button
                onClick={() => setViewMode('table')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 text-xs transition-colors',
                  viewMode === 'table'
                    ? 'bg-gold-medium/20 text-gold-light'
                    : 'bg-transparent text-gray-500 hover:text-gray-300'
                )}
              >
                <Table2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Table</span>
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 text-xs transition-colors border-l border-white/10',
                  viewMode === 'kanban'
                    ? 'bg-gold-medium/20 text-gold-light'
                    : 'bg-transparent text-gray-500 hover:text-gray-300'
                )}
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
              <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
              <span className="sm:inline hidden">Refresh</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
        {[
          { label: 'Active Cases', value: stats.total,         valueColor: 'text-white'       },
          { label: 'Pmt Pending',  value: stats.paymentPending, valueColor: 'text-amber-400'   },
          { label: 'In Process',   value: stats.inProcessing,  valueColor: 'text-sky-400'     },
          { label: 'Blocked',      value: stats.blocked,       valueColor: 'text-red-400'     },
          { label: 'Completed',    value: stats.completed,     valueColor: 'text-gold-light'  },
          { label: 'Owned',        value: stats.owned,         valueColor: 'text-gray-400'    },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-black/40 border border-white/5 p-2 sm:p-3 rounded-xl flex items-center justify-between hover:border-white/10 transition-all"
          >
            <span className="text-[9px] sm:text-[10px] text-gray-500 font-black uppercase tracking-widest leading-none">
              {stat.label}
            </span>
            <span className={cn('font-black text-sm sm:text-base leading-none', stat.valueColor)}>
              {stat.value}
            </span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="space-y-4">
        <div className="flex gap-2 overflow-x-auto pb-2 touch-manipulation" style={{ WebkitOverflowScrolling: 'touch' }}>
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

        <div className="flex overflow-x-auto pb-2 gap-3 items-center touch-manipulation" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="flex gap-1.5 shrink-0 bg-white/5 p-1 rounded-lg border border-white/5">
            {(['all', 'pending', 'completed', 'cancelled'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setFilters((f) => ({ ...f, paymentStatus: v }))}
                className={cn(
                  'h-7 px-3 text-[9px] font-black uppercase tracking-widest rounded-md whitespace-nowrap transition-all',
                  filters.paymentStatus === v
                    ? 'bg-white/10 text-white shadow-inner'
                    : 'text-gray-500 hover:text-gray-300'
                )}
              >
                {v === 'all' ? 'Pmt: All' : v}
              </button>
            ))}
          </div>

          <div className="flex gap-1.5 shrink-0 bg-white/5 p-1 rounded-lg border border-white/5">
            {(['all', 'owned', 'unassigned'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setFilters((f) => ({ ...f, ownership: v }))}
                className={cn(
                  'h-7 px-3 text-[9px] font-black uppercase tracking-widest rounded-md whitespace-nowrap transition-all',
                  filters.ownership === v
                    ? 'bg-white/10 text-white shadow-inner'
                    : 'text-gray-500 hover:text-gray-300'
                )}
              >
                {v === 'all' ? 'Owner: All' : v === 'owned' ? 'Assigned' : 'Open'}
              </button>
            ))}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilters((f) => ({ ...f, showArchived: !f.showArchived }))}
            className={cn(
              'h-9 px-3 text-[9px] font-black uppercase tracking-widest rounded-lg shrink-0 transition-all border border-white/5',
              filters.showArchived ? 'text-gold-light' : 'text-gray-500'
            )}
          >
            <Archive className="w-3.5 h-3.5 mr-2" />
            {filters.showArchived ? 'Hide' : 'Show'} Archived
          </Button>
        </div>
      </div>

      {/* Kanban */}
      {viewMode === 'kanban' && (
        loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-gold-medium" />
          </div>
        ) : (
          <KanbanView cases={filteredCases} />
        )
      )}

      {/* Table */}
      {viewMode === 'table' && <Card className="bg-gradient-to-br from-gold-light/5 via-transparent to-gold-dark/5 border border-white/5">
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
              {/* Desktop table */}
              {!isMobile && <div className="overflow-x-auto touch-manipulation" style={{ WebkitOverflowScrolling: 'touch' }}>
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/5 text-[10px] lg:text-[11px] font-black uppercase text-gray-500 tracking-[0.2em]">
                      <th className="px-3 py-3 lg:px-5 lg:py-4">Client</th>
                      <th className="px-3 py-3 lg:px-5 lg:py-4">Stage</th>
                      <th className="px-3 py-3 lg:px-5 lg:py-4">Progress</th>
                      <th className="px-3 py-3 lg:px-5 lg:py-4">Order</th>
                      <th className="px-3 py-3 lg:px-5 lg:py-4">Owner</th>
                      <th className="px-3 py-3 lg:px-5 lg:py-4">Activity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {currentData.map(({ profile, serviceRequest, visaOrder, operationalStage }) => {
                      const flowProgress = getApplicationFlowProgress(operationalStage);

                      return (
                        <tr
                          key={profile.id}
                          className="group hover:bg-white/[0.02] transition-colors cursor-pointer border-b border-white/[0.02] last:border-0"
                          onClick={() => navigate(`/dashboard/users/${profile.id}`)}
                        >
                        <td className="px-3 py-3 lg:px-5 lg:py-4 min-w-[140px] max-w-[200px] lg:max-w-none">
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="text-white font-bold text-sm tracking-tight uppercase truncate">
                              {profile.full_name || profile.email || 'Unnamed'}
                            </span>
                            <span className="text-[10px] text-gray-500 font-mono italic truncate">
                              {profile.email || '—'}
                            </span>
                            <span className="text-[10px] text-gray-600 uppercase font-bold tracking-wider truncate">
                              {profile.phone || '—'}
                            </span>
                            <div className="flex flex-wrap gap-1 pt-1 opacity-70">
                              <Badge className="text-[8px] font-black uppercase rounded-sm border bg-white/5 text-gray-400 border-white/10 shrink-0">
                                {profile.onboarding_current_step || 'step 0'}
                              </Badge>
                              <Badge className="text-[8px] font-black uppercase rounded-sm border bg-white/5 text-gray-400 border-white/10 shrink-0">
                                {profile.migma_seller_id ? 'owned' : 'open'}
                              </Badge>
                            </div>
                          </div>
                        </td>

                        <td className="px-3 py-3 lg:px-5 lg:py-4">
                          <div className="flex flex-col gap-1.5">
                            <Badge
                              className={cn(
                                'w-fit text-[9px] font-black uppercase rounded-sm border',
                                OPERATIONAL_STAGE_COLORS[operationalStage]
                              )}
                            >
                              {OPERATIONAL_STAGE_LABELS[operationalStage]}
                            </Badge>
                            {serviceRequest?.priority && serviceRequest.priority !== 'normal' && (
                              <Badge
                                className={cn(
                                  'w-fit text-[9px] font-black uppercase rounded-sm border',
                                  serviceRequest.priority === 'urgent'
                                    ? 'bg-red-500/20 text-red-300 border-red-500/30'
                                    : serviceRequest.priority === 'high'
                                    ? 'bg-orange-500/20 text-orange-300 border-orange-500/30'
                                    : 'bg-white/5 text-gray-400 border-white/10'
                                )}
                              >
                                {serviceRequest.priority}
                              </Badge>
                            )}
                          </div>
                        </td>

                        <td className="px-3 py-3 lg:px-5 lg:py-4 w-1/4 min-w-[110px]">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] lg:text-xs text-white font-black">
                                {flowProgress.currentStep}/{flowProgress.totalSteps}
                              </span>
                              <span className="text-[8px] lg:text-[9px] text-gray-500 uppercase font-bold tracking-tighter truncate">
                                {flowProgress.label}
                              </span>
                            </div>
                            <Progress
                              value={flowProgress.percent}
                              className="h-1 bg-white/10"
                            />
                            <div className="flex items-center justify-between gap-1 text-[8px] lg:text-[9px] text-gray-500 uppercase font-bold tracking-tighter">
                              <span className="truncate">{flowProgress.status}</span>
                              <span>{Math.round(flowProgress.percent)}%</span>
                            </div>
                          </div>
                        </td>

                        <td className="px-3 py-3 lg:px-5 lg:py-4 min-w-[100px]">
                          {visaOrder ? (
                            <div className="flex flex-col gap-1 min-w-0">
                              <span className="text-[10px] text-gray-300 font-mono truncate">
                                {visaOrder.order_number || 'Order'}
                              </span>
                              <Badge
                                className={cn(
                                  'w-fit text-[9px] font-black uppercase rounded-sm border',
                                  paymentStatusColor(visaOrder.payment_status)
                                )}
                              >
                                {visaOrder.payment_status || 'pending'}
                              </Badge>
                              <span className="text-[10px] text-gray-600 uppercase tracking-wider truncate">
                                {visaOrder.payment_method || '—'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-gray-600 italic">No order</span>
                          )}
                        </td>

                        <td className="px-3 py-3 lg:px-5 lg:py-4">
                          <div className="flex flex-col gap-1.5">
                            {serviceRequest?.owner_user_id ? (
                              <div className="flex items-center gap-1.5">
                                <UserCheck className="w-3.5 h-3.5 text-gold-medium shrink-0" />
                                <span className="text-[10px] text-gray-300 font-mono break-all max-w-[100px]">
                                  {serviceRequest.owner_user_id.slice(0, 8)}…
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-gray-600 italic">Unassigned</span>
                            )}
                            <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                              seller {shortId(profile.migma_seller_id)}
                            </span>
                            <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                              agent {shortId(profile.migma_agent_id)}
                            </span>
                          </div>
                        </td>

                        <td className="px-3 py-3 lg:px-5 lg:py-4 text-right">
                          <div className="flex flex-col gap-1 items-end">
                            <span className="text-[9px] text-gray-500 font-mono whitespace-nowrap">
                              {timeAgo(profile.updated_at)}
                            </span>
                            <div className="flex items-center gap-2">
                               <Badge className="w-fit text-[8px] font-black uppercase rounded-sm border bg-white/5 text-gray-500 border-white/10 group-hover:border-gold-medium/30 group-hover:text-gold-light transition-colors px-2 py-0.5">
                                View
                              </Badge>
                            </div>
                          </div>
                        </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>}

              {/* Mobile card list */}
              {isMobile && <div className="p-3 space-y-3">
                {currentData.map(({ profile, serviceRequest, visaOrder, operationalStage }) => {
                  const flowProgress = getApplicationFlowProgress(operationalStage);
                  const isTransfer = visaOrder?.product_slug?.startsWith('transfer-');
                  const isCos = visaOrder?.product_slug?.startsWith('cos-');

                  return (
                    <Card
                      key={profile.id}
                      className="hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-zinc-900 via-black to-zinc-900 border border-gold-medium/20 hover:border-gold-medium/40 group relative overflow-hidden cursor-pointer w-full"
                      onClick={() => navigate(`/dashboard/users/${profile.id}`)}
                    >
                      <div className="absolute top-0 right-0 w-32 h-32 bg-gold-medium/5 blur-3xl -mr-16 -mt-16 group-hover:bg-gold-medium/10 transition-all rounded-full" />

                      <CardHeader className="p-3 pb-2 relative">
                        <div className="flex flex-col gap-2">
                          <div className="flex-1 min-w-0">
                            {/* Nome — igual ao contracts */}
                            <div className="flex items-center gap-2 mb-1">
                              <div className="p-1.5 bg-gold-medium/10 rounded-lg border border-gold-medium/20 shrink-0">
                                <User className="w-3.5 h-3.5 text-gold-light" />
                              </div>
                              <CardTitle className="text-base font-black uppercase tracking-tight text-white leading-tight">
                                {profile.full_name || profile.email || 'Unnamed'}
                              </CardTitle>
                            </div>

                            {/* Email + phone + stage — igual ao email+country+date do contracts */}
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                              <span className="text-gray-400 break-all normal-case font-normal opacity-80">
                                {profile.email || '—'}
                              </span>
                              {profile.phone && (
                                <span className="bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                                  {profile.phone}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Stage badge — igual ao VerificationStatusBadge do contracts */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={cn('text-[9px] font-black uppercase rounded-sm border', OPERATIONAL_STAGE_COLORS[operationalStage])}>
                              {OPERATIONAL_STAGE_LABELS[operationalStage]}
                            </Badge>
                            {serviceRequest?.priority && serviceRequest.priority !== 'normal' && (
                              <Badge className={cn(
                                'text-[9px] font-black uppercase rounded-sm border',
                                serviceRequest.priority === 'urgent'
                                  ? 'bg-red-500/20 text-red-300 border-red-500/30'
                                  : 'bg-orange-500/20 text-orange-300 border-orange-500/30'
                              )}>
                                {serviceRequest.priority}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="p-3 pt-0 relative">
                        {/* Seção "Application Flow" — igual ao "Legal Records" do contracts */}
                        <div className="mb-3 p-2.5 bg-black/40 rounded-xl border border-white/5 space-y-2">
                          <h4 className="text-[10px] font-black text-gold-light/80 uppercase tracking-[0.2em] flex items-center gap-2 opacity-80">
                            <Activity className="w-3 h-3 text-gold-medium" />
                            Application Flow
                          </h4>
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-gold-medium/40 shrink-0" />
                              <div className="flex items-baseline gap-2 min-w-0">
                                <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest whitespace-nowrap">Stage</span>
                                <span className="text-white font-black text-[10px] truncate">{flowProgress.status}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-gold-medium/40 shrink-0" />
                              <div className="flex items-baseline gap-2">
                                <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest whitespace-nowrap">Progress</span>
                                <span className="text-white font-black font-mono text-[10px]">{flowProgress.currentStep}/{flowProgress.totalSteps}</span>
                              </div>
                            </div>
                            {visaOrder?.order_number && (
                              <div className="flex items-center gap-2.5">
                                <Globe className="w-3 h-3 text-gold-medium/60 shrink-0" />
                                <div className="flex items-baseline gap-2 min-w-0 overflow-hidden">
                                  <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest whitespace-nowrap">Order</span>
                                  <span className="text-gray-400 font-mono text-[9px] truncate opacity-70 italic">{visaOrder.order_number}</span>
                                </div>
                              </div>
                            )}
                            {visaOrder?.payment_status && (
                              <div className="flex items-center gap-2.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-gold-medium/40 shrink-0" />
                                <div className="flex items-baseline gap-2">
                                  <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest whitespace-nowrap">Payment</span>
                                  <Badge className={cn('text-[8px] font-black uppercase rounded-sm border', paymentStatusColor(visaOrder.payment_status))}>
                                    {visaOrder.payment_status}
                                  </Badge>
                                </div>
                              </div>
                            )}
                          </div>
                          {/* Progress bar */}
                          <div className="relative h-1.5 w-full bg-white/5 rounded-full overflow-hidden mt-1">
                            <div
                              className="absolute top-0 left-0 h-full bg-gradient-to-r from-gold-dark to-gold-light transition-all duration-500"
                              style={{ width: `${flowProgress.percent}%` }}
                            />
                          </div>
                        </div>

                        {/* Botão View — igual aos botões VIEW/PDF do contracts */}
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            className="bg-gold-medium/5 hover:bg-gold-medium/20 text-gold-light border border-gold-medium/10 h-9 text-[10px] font-black uppercase tracking-widest transition-all rounded-md flex items-center justify-center gap-2"
                            onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/users/${profile.id}`); }}
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
              </div>}

              {/* Pagination */}
              <div className="p-3 sm:p-4 border-t border-white/5 flex items-center justify-between gap-2 sm:gap-4">
                <p className="text-[9px] sm:text-[10px] uppercase font-black text-gray-600 tracking-widest">
                  {filteredCases.length === 0
                    ? 'No results'
                    : `${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(
                        currentPage * PAGE_SIZE,
                        filteredCases.length
                      )} of ${filteredCases.length}`}
                </p>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="h-8 w-8 border-white/10 bg-black/40 text-gray-400 hover:bg-white/5 disabled:opacity-30"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </Button>
                  <span className="text-[10px] sm:text-[11px] text-gray-400 font-black uppercase tracking-wider px-1">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
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
      </Card>}
    </div>
  );
}
