import { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  Search,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import {
  Calendar,
  Users,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Timer,
  CheckCircle,
  HelpCircle
} from 'lucide-react';

interface TrackingStep {
  label: string;
  slug: string;
  status: 'paid' | 'pending' | 'waiting';
  paid_at: string | null;
}

interface TrackingJourney {
  client_email: string;
  client_name: string;
  seller_name: string;
  journey_name: string;
  journey_type: string;
  last_activity: string;
  last_paid_at: string | null; // real payment date, null if no real payment
  steps: TrackingStep[];
  paid_count: number;
  total_steps: number;
  slugs: { slug: string; paid_at: string | null; created_at: string; status: string; contract_status: string | null }[];
}

type TrackingGroupData = {
  client_name: string;
  client_email: string;
  seller_id: string;
  slugs: { slug: string; paid_at: string | null; created_at: string; status: string; contract_status: string | null }[];
  last_activity: string;
  last_paid_at: string | null;
  identifiers: Set<string>;
};

const PAID_PAYMENT_STATUSES = new Set(['completed', 'paid']);
const TRACKABLE_PAYMENT_STATUSES = ['completed', 'paid', 'pending', 'manual_pending', 'processing'];
const PAYMENT_COUNT_RECONCILED_JOURNEYS = new Set(['initial', 'cos', 'transfer']);
// Visual-only credits for legacy payments made before the checkout existed.
const LEGACY_VISUAL_PAYMENT_CREDITS = [
  {
    client_email: 'saragscontato@gmail.com',
    journey_type: 'transfer',
    minimum_paid_count: 2,
  },
];
const TRACKING_ORDER_EXCLUSIONS = [
  {
    order_number: 'ORD-INT-20260331003601-302',
    journey_type: 'transfer',
  },
];

const JOURNEY_CONFIG: Record<string, {
  label: string;
  steps: { pattern: string; label: string }[];
}> = {
  initial: {
    label: 'Initial Application',
    steps: [
      { pattern: 'initial-selection-process', label: 'Selection Process' },
      { pattern: 'initial-scholarship',       label: 'Scholarship' },
      { pattern: 'initial-i20-control',       label: 'I-20 Control' },
    ],
  },
  cos: {
    label: 'Change of Status (COS)',
    steps: [
      { pattern: 'cos-selection-process', label: 'Selection Process' },
      { pattern: 'cos-scholarship',       label: 'Scholarship' },
      { pattern: 'cos-i20-control',       label: 'I-20 Control' },
    ],
  },
  transfer: {
    label: 'Transfer',
    steps: [
      { pattern: 'transfer-selection-process', label: 'Selection Process' },
      { pattern: 'transfer-scholarship',       label: 'Scholarship' },
      { pattern: 'transfer-i20-control',       label: 'I-20 Control' },
    ],
  },
  sponsored: {
    label: 'EB-3 / EB-2 NIW / B1-B2',
    steps: [
      { pattern: 'eb3-step-initial', label: 'EB3 Initial' },
      { pattern: 'eb3-vinicius', label: 'EB3 Step 1' },
      { pattern: 'eb3-vinicius-parte-2', label: 'EB3 Step 2' },
      { pattern: 'eb2-niw-initial-payment', label: 'EB2 Initial' },
      { pattern: 'eb2-installment-initial-payment', label: 'EB2 Installment Initial' },
      { pattern: 'b1-revolution', label: 'B1 Revolution' },
      { pattern: 'b1-premium', label: 'B1 Premium' },
    ],
  },
  other: {
    label: 'Tourist / Consultation / Other',
    steps: [
      { pattern: 'consultation-common', label: 'Consultation' },
      { pattern: 'ceo-tourist-plan', label: 'Tourist CEO' },
      { pattern: 'canada-tourist-premium', label: 'Canada Tourist' },
      { pattern: 'rfe-defense', label: 'RFE Defense' },
      { pattern: 'sponsor-profissional', label: 'Sponsor' },
    ],
  },
};

// Known journey slug prefixes — more specific than a loose .includes() check
const JOURNEY_PREFIXES: [string, string][] = [
  ['eb3-', 'sponsored'],
  ['eb-3', 'sponsored'],
  ['eb2-', 'sponsored'],
  ['eb-2', 'sponsored'],
  ['b1-', 'sponsored'],
  ['cos-', 'cos'],
  ['change of status', 'cos'],
  ['us-visa-change-of-status', 'cos'],
  ['transfer-', 'transfer'],
  ['initial-', 'initial'],
  ['initial application', 'initial'],
  ['consultation', 'other'],
  ['tourist', 'other'],
  ['canada', 'other'],
  ['rfe-', 'other'],
];

function detectJourneyType(slugs: string[]): string | null {
  for (const slug of slugs) {
    const s = slug.toLowerCase().trim();
    for (const [prefix, type] of JOURNEY_PREFIXES) {
      if (s.startsWith(prefix) || s.includes(prefix)) return type;
    }
  }
  return null;
}

function normalizeSlug(slug: string) {
  return slug.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isPaidStatus(status?: string | null) {
  return PAID_PAYMENT_STATUSES.has((status || '').toLowerCase());
}

function getEffectivePaidAt(order: { payment_status?: string | null; paid_at?: string | null; created_at: string }) {
  if (!isPaidStatus(order.payment_status)) return null;
  return order.paid_at ?? order.created_at;
}

function isFullProcessSlug(slug?: string | null) {
  const normalized = normalizeSlug(slug || '');
  return normalized.includes('fullprocess') || normalized.includes('totalprocess');
}

function slugMatchesStep(slug: string, pattern: string) {
  const orderSlug = normalizeSlug(slug);
  const stepPattern = normalizeSlug(pattern);
  if (orderSlug.includes(stepPattern) || stepPattern.includes(orderSlug)) return true;
  if (stepPattern === 'cosselectionprocess' && orderSlug.includes('changeofstatus') && orderSlug.includes('selectionprocess')) return true;
  if (stepPattern === 'eb3stepinitial' && (orderSlug.includes('eb3initial') || (orderSlug.includes('eb3') && orderSlug.includes('initial')))) return true;
  return false;
}

function normalizeTrackingIdentifiers(order: {
  client_whatsapp?: string | null;
  client_email?: string | null;
  client_name?: string | null;
}) {
  const identifiers: string[] = [];
  const email = order.client_email?.toLowerCase().trim();
  if (email) identifiers.push(`email:${email}`);

  const phone = order.client_whatsapp?.replace(/\D/g, '');
  if (phone && phone.length >= 8) identifiers.push(`phone:${phone}`);

  if (identifiers.length > 0) return identifiers;

  const name = order.client_name?.toLowerCase().trim().replace(/\s+/g, ' ');
  return name ? [`name:${name}`] : [];
}

function mergeTrackingGroups(
  grouped: Record<string, TrackingGroupData>,
  identifierToGroupKey: Map<string, string>,
  targetKey: string,
  sourceKey: string,
) {
  if (targetKey === sourceKey) return targetKey;

  const target = grouped[targetKey];
  const source = grouped[sourceKey];
  if (!target || !source) return targetKey;

  target.slugs.push(...source.slugs);

  if (!target.client_email && source.client_email) {
    target.client_email = source.client_email;
  }

  if ((!target.client_name || target.client_name === 'Unknown Client') && source.client_name) {
    target.client_name = source.client_name;
  }

  if (!target.seller_id && source.seller_id) {
    target.seller_id = source.seller_id;
  }

  if (source.last_activity > target.last_activity) {
    target.last_activity = source.last_activity;
  }

  if (source.last_paid_at && (!target.last_paid_at || source.last_paid_at > target.last_paid_at)) {
    target.last_paid_at = source.last_paid_at;
  }

  source.identifiers.forEach(identifier => {
    target.identifiers.add(identifier);
    identifierToGroupKey.set(identifier, targetKey);
  });

  delete grouped[sourceKey];
  return targetKey;
}

function applyLegacyVisualPaymentCredit(
  data: TrackingGroupData,
  journeyType: string,
  paidCount: number,
  totalSteps: number,
) {
  const clientEmail = data.client_email.toLowerCase().trim();
  const visualCredit = LEGACY_VISUAL_PAYMENT_CREDITS.find(credit =>
    credit.client_email === clientEmail &&
    credit.journey_type === journeyType
  );

  if (!visualCredit) return paidCount;

  return Math.min(totalSteps, Math.max(paidCount, visualCredit.minimum_paid_count));
}

function isTrackingOrderExcluded(order: { order_number?: string | null }, journeyType: string) {
  return TRACKING_ORDER_EXCLUSIONS.some(exclusion =>
    exclusion.order_number === order.order_number &&
    exclusion.journey_type === journeyType
  );
}

type TimeRange = '24h' | '7d' | '30d' | 'all';

const TIME_RANGE_MS: Record<Exclude<TimeRange, 'all'>, number> = {
  '24h': 86_400_000,
  '7d':  604_800_000,
  '30d': 2_592_000_000,
};

export function AdminTracking() {
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [journeys, setJourneys] = useState<TrackingJourney[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const loadData = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('visa_orders')
        .select('order_number, client_email, client_name, client_whatsapp, product_slug, seller_id, paid_at, created_at, payment_status, contract_approval_status')
        .in('payment_status', TRACKABLE_PAYMENT_STATUSES)
        .order('created_at', { ascending: false });

      if (!isLocal) {
        query = query.not('client_email', 'ilike', '%@uorak.com');
      }

      const { data: orders, error } = await query;

      if (error || !orders) {
        console.error('[Tracking] Error fetching orders:', error);
        return;
      }

      console.log('[Tracking] Total raw orders:', orders.length);

      const sellerIds = [...new Set(orders.map(o => o.seller_id).filter(Boolean))];
      const { data: sellers } = await supabase
        .from('sellers')
        .select('seller_id_public, full_name')
        .in('seller_id_public', sellerIds);

      const sellerMap = new Map((sellers || []).map(s => [s.seller_id_public, s.full_name]));

      const grouped: Record<string, TrackingGroupData> = {};
      const identifierToGroupKey = new Map<string, string>();
      let groupSequence = 0;

      for (const order of orders) {
        const journeyType = detectJourneyType([order.product_slug]);
        if (!journeyType) continue;
        if (isTrackingOrderExcluded(order, journeyType)) continue;

        const email = (order.client_email || '').toLowerCase().trim();
        const identifiers = normalizeTrackingIdentifiers(order).map(identifier => `${journeyType}:${identifier}`);
        if (identifiers.length === 0) continue;

        const existingKeys = [...new Set(
          identifiers
            .map(identifier => identifierToGroupKey.get(identifier))
            .filter((key): key is string => !!key && !!grouped[key])
        )];

        let key = existingKeys[0] ?? `${journeyType}:${++groupSequence}`;
        for (const sourceKey of existingKeys.slice(1)) {
          key = mergeTrackingGroups(grouped, identifierToGroupKey, key, sourceKey);
        }

        const effectivePaidAt = getEffectivePaidAt(order);

        if (!grouped[key]) {
          grouped[key] = {
            client_name: order.client_name || email || 'Unknown Client',
            client_email: email,
            seller_id: order.seller_id || '',
            slugs: [],
            last_activity: effectivePaidAt ?? order.created_at,
            last_paid_at: effectivePaidAt,
            identifiers: new Set(),
          };
        }

        identifiers.forEach(identifier => {
          grouped[key].identifiers.add(identifier);
          identifierToGroupKey.set(identifier, key);
        });

        const group = grouped[key];

        group.slugs.push({
          slug: order.product_slug,
          paid_at: effectivePaidAt,
          created_at: order.created_at,
          status: order.payment_status || '',
          contract_status: order.contract_approval_status || null,
        });

        const orderDate = effectivePaidAt ?? order.created_at;
        if (orderDate > group.last_activity) {
          group.last_activity = orderDate;
        }

        // Track latest real payment date separately
        if (effectivePaidAt && (!group.last_paid_at || effectivePaidAt > group.last_paid_at)) {
          group.last_paid_at = effectivePaidAt;
        }
      }

      console.log('[Tracking] Client groups:', Object.keys(grouped).length);

      const result: TrackingJourney[] = [];

      for (const [, data] of Object.entries(grouped)) {
        const slugList = data.slugs.map(s => s.slug);
        const journeyType = detectJourneyType(slugList);
        if (!journeyType) continue;

        const config = JOURNEY_CONFIG[journeyType];
        const steps: TrackingStep[] = config.steps.map(stepDef => {
          const match = data.slugs.find(s => {
            if (!isPaidStatus(s.status)) return false; // Only paid orders count as paid steps
            return slugMatchesStep(s.slug, stepDef.pattern);
          });

          const pendingMatch = data.slugs.find(s => {
            if (isPaidStatus(s.status)) return false;
            return slugMatchesStep(s.slug, stepDef.pattern);
          });

          return {
            label: stepDef.label,
            slug: stepDef.pattern,
            status: match ? 'paid' : (pendingMatch ? 'pending' : 'waiting'),
            paid_at: match ? (match.paid_at ?? null) : null,
          };
        });

        const matchedPaidStepCount = steps.filter(s => s.status === 'paid').length;
        const paidOrderCount = data.slugs.filter(s => isPaidStatus(s.status)).length;
        let paid_count = matchedPaidStepCount;

        if (PAYMENT_COUNT_RECONCILED_JOURNEYS.has(journeyType)) {
          paid_count = Math.min(config.steps.length, Math.max(matchedPaidStepCount, paidOrderCount));
        }

        const hasFullPayment = data.slugs.some(s => isPaidStatus(s.status) && isFullProcessSlug(s.slug));
        if (hasFullPayment) paid_count = config.steps.length;
        paid_count = applyLegacyVisualPaymentCredit(data, journeyType, paid_count, config.steps.length);

        result.push({
          client_email: data.client_email || 'no-email@migma.io',
          client_name: data.client_name,
          seller_name: sellerMap.get(data.seller_id) || data.seller_id || 'Direct',
          journey_name: config.label,
          journey_type: journeyType,
          last_activity: data.last_activity,
          last_paid_at: data.last_paid_at,
          steps,
          paid_count,
          total_steps: config.steps.length,
          slugs: data.slugs,
        });
      }

      // Incomplete first, then by recency
      result.sort((a, b) => {
        const aComplete = a.paid_count === a.total_steps;
        const bComplete = b.paid_count === b.total_steps;
        if (aComplete !== bComplete) return aComplete ? 1 : -1;
        return new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime();
      });

      console.log('[Tracking] Final journeys:', result.length);
      setJourneys(result);
    } catch (err) {
      console.error('[Tracking] Unexpected error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // --- Derived data (all reactive to timeRange) ---

  const timeFilteredJourneys = useMemo(() => {
    if (timeRange === 'all') return journeys;
    const threshold = Date.now() - TIME_RANGE_MS[timeRange];
    return journeys.filter(j => new Date(j.last_activity).getTime() >= threshold);
  }, [journeys, timeRange]);

  const journeysWithCompletion = useMemo(() => {
    return timeFilteredJourneys.map(j => {
      const isCompleted = (() => {
        if (j.paid_count >= j.total_steps) return true;
        const paidSlugsStr = (j.slugs || [])
          .filter(s => isPaidStatus(s?.status))
          .map(s => normalizeSlug(s?.slug || ''))
          .join(' ');
        if (paidSlugsStr.includes('selection') && paidSlugsStr.includes('scholarship') && paidSlugsStr.includes('i20')) return true;
        
        // Match paid full-process slugs only.
        if (paidSlugsStr.includes('fullprocess') || paidSlugsStr.includes('totalprocess')) return true;
        
        return false;
      })();
      
      const isFullPaid = (j.slugs || []).some(s => isPaidStatus(s?.status) && isFullProcessSlug(s?.slug));
      return { ...j, is_completed: isCompleted, is_full_paid: isFullPaid };
    });
  }, [timeFilteredJourneys]);

  const stats = useMemo(() => {
    let abandoned = 0;
    let complete = 0;
    let paidInPeriod = 0;
    const now = Date.now();
    const threshold = timeRange === 'all' ? 0 : now - TIME_RANGE_MS[timeRange];

    journeysWithCompletion.forEach(j => {
      if (j.is_completed) complete++;
      else if (j.paid_count === 0) abandoned++;
      
      // Count if last payment was within the selected time range
      if (j.last_paid_at) {
        const lastPaidTime = new Date(j.last_paid_at).getTime();
        if (timeRange === 'all' || lastPaidTime >= threshold) {
          paidInPeriod++;
        }
      }
    });

    return { total: journeysWithCompletion.length, abandoned, complete, paidInPeriod };
  }, [journeysWithCompletion, timeRange]);

  const filterCounts = useMemo(() => ({
    all:       journeysWithCompletion.length,
    'on-track': journeysWithCompletion.filter(j => j.paid_count > 0 && !j.is_completed).length,
    'step-1':   journeysWithCompletion.filter(j => j.paid_count === 1 && !j.is_completed).length,
    'step-2':   journeysWithCompletion.filter(j => j.paid_count === 2 && !j.is_completed).length,
    'step-3':   journeysWithCompletion.filter(j => j.paid_count >= 3 && !j.is_completed).length,
    abandoned:  journeysWithCompletion.filter(j => j.paid_count === 0).length,
    completed:  journeysWithCompletion.filter(j => j.is_completed).length,
  }), [journeysWithCompletion]);

  const filteredData = useMemo(() => journeysWithCompletion.filter(j => {
    const q = search.toLowerCase();
    const matchesSearch = !q ||
      j.client_email.toLowerCase().includes(q) ||
      j.client_name.toLowerCase().includes(q) ||
      j.seller_name.toLowerCase().includes(q);
    if (!matchesSearch) return false;

    if (filterStatus === 'all')       return true;
    if (filterStatus === 'on-track')  return j.paid_count > 0 && !j.is_completed;
    if (filterStatus === 'step-1')    return j.paid_count === 1 && !j.is_completed;
    if (filterStatus === 'step-2')    return j.paid_count === 2 && !j.is_completed;
    if (filterStatus === 'step-3')    return j.paid_count >= 3 && !j.is_completed;
    if (filterStatus === 'abandoned') return j.paid_count === 0;
    if (filterStatus === 'completed') return j.is_completed;
    return true;
  }), [journeysWithCompletion, search, filterStatus]);

  const totalPages  = Math.ceil(filteredData.length / pageSize);
  const currentData = filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const getStatusBadge = (journey: TrackingJourney & { is_completed: boolean; is_full_paid?: boolean }) => {
    if (journey.is_completed) {
      if (journey.is_full_paid) return { label: 'FULL PAID', className: 'bg-gold-medium/20 text-gold-light border-gold-medium/50' };
      return { label: 'Completed', className: 'bg-green-500/20 text-green-400 border-green-500/50' };
    }
    if (journey.paid_count === 0)
      return { label: 'Abandoned', className: 'bg-red-500/20 text-red-400 border-red-500/50' };
    return { label: 'On Track', className: 'bg-blue-500/20 text-blue-400 border-blue-500/50' };
  };


  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2 uppercase tracking-tight flex items-center gap-3">
            <Activity className="w-8 h-8 text-gold-medium" />
            Payment Journey Tracking
          </h1>
          <p className="text-gray-400 text-sm sm:text-base">Monitor checkout progress and service lifecycle across all programs.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              placeholder="Search lead or seller..."
              value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
              className="bg-black/40 border-white/10 pl-10 w-full text-white"
            />
          </div>
          <Button
            onClick={() => { loadData(); setCurrentPage(1); }}
            variant="outline"
            className="gap-2 w-full sm:w-auto border-gray-700 bg-transparent hover:bg-white/10 text-white"
          >
            <Loader2 className="w-4 h-4" /> Refresh List
          </Button>
        </div>
      </div>

      {/* Time Range Selector */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase font-black text-gray-600 tracking-widest mr-1">Period:</span>
        {(['24h', '7d', '30d', 'all'] as TimeRange[]).map(range => (
          <Button
            key={range}
            variant={timeRange === range ? 'default' : 'outline'}
            onClick={() => { setTimeRange(range); setCurrentPage(1); }}
            className={cn(
              "text-[10px] font-black uppercase tracking-widest px-4 h-7 rounded-full",
              timeRange === range
                ? "bg-white/20 text-white border-white/30"
                : "border-white/10 bg-black/40 text-gray-600 hover:bg-white/5 hover:text-gray-400"
            )}
          >
            {range === 'all' ? 'All Time' : range}
          </Button>
        ))}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { 
            label: 'Active Leads',  
            value: stats.total,     
            sub: 'Total in period', 
            help: 'Clientes que realizaram pagamentos ou tiveram atividade no período selecionado.',
            color: 'border-blue-500/30 from-blue-500/10 to-blue-500/5', 
            icon: Users,      
            iconColor: 'text-blue-400' 
          },
          { 
            label: 'Abandoned',     
            value: stats.abandoned, 
            sub: 'No successful pay', 
            help: 'Leads que iniciaram o checkout (geraram ordem) mas não completaram nenhum pagamento.',
            color: 'border-red-500/30 from-red-500/10 to-red-500/5',    
            icon: Timer,      
            iconColor: 'text-red-400' 
          },
          { 
            label: `Paid (${timeRange.toUpperCase()})`, 
            value: stats.paidInPeriod, 
            sub: 'Recent payments', 
            help: 'Total de clientes que realizaram pagamentos (Steps ou Full) dentro deste período.',
            color: 'border-green-500/30 from-green-500/10 to-green-500/5', 
            icon: CheckCircle, 
            iconColor: 'text-green-400' 
          },
          { 
            label: 'Completed',   
            value: stats.complete,  
            sub: 'Process finished', 
            help: 'Clientes que atingiram o objetivo final e quitaram o valor total do serviço (3/3 ou Full Payment).',
            color: 'border-gold-medium/30 from-gold-light/10 to-gold-dark/5', 
            icon: Calendar,   
            iconColor: 'text-gold-light' 
          },
        ].map((stat, i) => (
          <Card key={i} className={cn("bg-gradient-to-br border", stat.color)}>
            <CardHeader className="pb-1.5 p-3 sm:p-6 sm:pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <stat.icon className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4", stat.iconColor)} />
                  <CardTitle className="text-[10px] sm:text-sm font-medium text-gray-400">
                    {stat.label}
                  </CardTitle>
                  
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="outline-none">
                        <HelpCircle 
                          className="h-3 w-3 text-gray-500 cursor-help opacity-60 hover:opacity-100 transition-opacity" 
                        />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 text-xs p-3 bg-gray-900 border-gray-800 text-gray-300">
                      <p className="font-medium mb-1 text-gray-100">{stat.label}</p>
                      {stat.help}
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
              <div className="text-xl sm:text-3xl font-bold text-white">{stat.value}</div>
              <div className="text-[9px] text-gray-600 uppercase font-bold tracking-widest mt-0.5">{stat.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Status Filters (Pills) with counts */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {[
          { id: 'all',       label: 'All' },
          { id: 'on-track',  label: 'On Track' },
          { id: 'abandoned', label: 'Abandoned' },
          { id: 'completed', label: 'Completed' },
        ].map(filter => (
          <Button
            key={filter.id}
            variant={filterStatus === filter.id ? 'default' : 'outline'}
            onClick={() => { setFilterStatus(filter.id); setCurrentPage(1); }}
            className={cn(
              "text-xs sm:text-sm whitespace-nowrap px-5 rounded-full h-9 gap-2",
              filterStatus === filter.id
                ? "bg-gold-medium hover:bg-gold-dark text-black border-none"
                : "border-white/10 bg-black/40 text-gray-400 hover:bg-white/5"
            )}
          >
            {filter.label}
            <span className={cn(
              "text-[9px] font-black px-1.5 py-0.5 rounded-full",
              filterStatus === filter.id ? "bg-black/20 text-black" : "bg-white/10 text-gray-500"
            )}>
              {filterCounts[filter.id as keyof typeof filterCounts]}
            </span>
          </Button>
        ))}
      </div>

      {/* Main Table */}
      <Card className="bg-gradient-to-br from-gold-light/5 via-transparent to-gold-dark/5 border border-white/5">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="w-10 h-10 animate-spin text-gold-medium" />
            </div>
          ) : currentData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500">
              <AlertCircle className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-lg font-medium">No leads found in this category.</p>
              {timeRange !== 'all' && (
                <p className="text-xs mt-2 text-gray-600">
                  Try switching to <button className="underline text-gray-500 hover:text-gray-300" onClick={() => { setTimeRange('all'); setCurrentPage(1); }}>All Time</button>
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/5 text-[11px] font-black uppercase text-gray-500 tracking-[0.2em]">
                      <th className="px-6 py-4">Client</th>
                      <th className="px-6 py-4">Journey</th>
                      <th className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">Progress</span>
                          <select 
                            className="bg-zinc-800 text-[10px] text-white border border-white/30 rounded px-2 py-0.5 focus:ring-0 cursor-pointer outline-none font-black uppercase appearance-none"
                            style={{ WebkitAppearance: 'none' }}
                            value={filterStatus.startsWith('step-') ? filterStatus : 'all'}
                            onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
                          >
                            <option value="all" className="bg-zinc-900 text-white">ALL</option>
                            <option value="step-1" className="bg-zinc-900 text-white">1/X PAID</option>
                            <option value="step-2" className="bg-zinc-900 text-white">2/X PAID</option>
                            <option value="step-3" className="bg-zinc-900 text-white">3/X+ PAID</option>
                          </select>
                        </div>
                      </th>
                      <th className="px-6 py-4">Last Payment</th>
                      <th className="px-6 py-4">Seller</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {currentData.map((journey, i) => {
                      const status   = getStatusBadge(journey);
                      const progress = (journey.paid_count / journey.total_steps) * 100;
                      const hasPaidAt = !!journey.last_paid_at;

                      return (
                        <tr key={i} className="group hover:bg-white/[0.02] transition-colors">
                          <td className="px-6 py-5">
                            <div className="flex flex-col">
                              <span className="text-white font-bold uppercase text-sm tracking-tight">{journey.client_name}</span>
                              <span className="text-[10px] text-gray-500 font-mono italic">{journey.client_email}</span>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex flex-col gap-1.5">
                              <Badge className={cn("w-fit text-[9px] font-black uppercase rounded-sm border-none", status.className)}>
                                {status.label}
                                {journey.slugs.some(s => s.contract_status === 'pending') && (
                                  <Timer className="w-2.5 h-2.5 ml-1.5 animate-pulse text-white" />
                                )}
                              </Badge>
                              <span className="text-[10px] text-gray-400 font-medium uppercase tracking-tighter">{journey.journey_name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex flex-col gap-1.5 min-w-[120px]">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-white font-black">{journey.paid_count}/{journey.total_steps}</span>
                                <span className="text-[9px] text-gray-600 uppercase font-bold tracking-tighter">steps</span>
                              </div>
                              <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                                <div
                                  className={cn("h-full transition-all duration-500", journey.is_completed ? "bg-green-500" : "bg-gold-medium")}
                                  style={{ width: `${journey.is_completed ? 100 : progress}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-xs font-mono">
                            {hasPaidAt
                              ? <span className="text-gray-400">{new Date(journey.last_paid_at!).toLocaleDateString()}</span>
                              : <span className="text-gray-700 italic">—</span>
                            }
                          </td>
                          <td className="px-6 py-5 text-gray-400 text-xs uppercase font-bold tracking-tighter">
                            {journey.seller_name}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="p-4 border-t border-white/5 flex items-center justify-between">
                <p className="text-[10px] uppercase font-black text-gray-600 tracking-widest">
                  Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredData.length)} of {filteredData.length} leads
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="h-8 w-8 border-white/10 bg-black/40 text-gray-400 hover:bg-white/5 disabled:opacity-30"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>

                  {Array.from({ length: totalPages }).map((_, i) => {
                    const page = i + 1;
                    if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                      return (
                        <Button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={cn(
                            "h-8 w-8 text-[11px] font-black rounded-lg",
                            currentPage === page
                              ? "bg-gold-medium text-black border-none"
                              : "bg-transparent text-gray-500 border border-white/5 hover:border-white/10 hover:text-white"
                          )}
                        >
                          {page}
                        </Button>
                      );
                    }
                    if (page === currentPage - 2 || page === currentPage + 2) {
                      return <span key={page} className="text-gray-700 font-bold p-1">...</span>;
                    }
                    return null;
                  })}

                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="h-8 w-8 border-white/10 bg-black/40 text-gray-400 hover:bg-white/5 disabled:opacity-30"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
