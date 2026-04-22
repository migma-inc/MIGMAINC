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

      const { data: orders, error } = await supabase
        .from('visa_orders')
        .select('client_email, client_name, product_slug, seller_id, paid_at, created_at, payment_status, contract_approval_status')
        .in('payment_status', ['completed', 'pending', 'manual_pending', 'processing'])
        .order('created_at', { ascending: false });

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

      // Group by email
      const grouped: Record<string, {
        client_name: string;
        client_email: string;
        seller_id: string;
        slugs: { slug: string; paid_at: string | null; created_at: string; status: string; contract_status: string | null }[];
        last_activity: string;
        last_paid_at: string | null;
      }> = {};

      for (const order of orders) {
        const normalizedName = order.client_name?.toLowerCase().trim();
        const email = (order.client_email || '').toLowerCase().trim();
        const key = email || normalizedName;
        if (!key) continue;

        if (!grouped[key]) {
          grouped[key] = {
            client_name: order.client_name || email || 'Unknown Client',
            client_email: email,
            seller_id: order.seller_id || '',
            slugs: [],
            last_activity: order.paid_at ?? order.created_at,
            last_paid_at: order.paid_at || null,
          };
        }

        grouped[key].slugs.push({
          slug: order.product_slug || '',
          paid_at: order.paid_at,
          created_at: order.created_at,
          status: order.payment_status || '',
          contract_status: order.contract_approval_status || null,
        });

        const orderDate = order.paid_at ?? order.created_at;
        if (orderDate > grouped[key].last_activity) {
          grouped[key].last_activity = orderDate;
        }

        // Track latest real payment date separately
        if (order.paid_at && (!grouped[key].last_paid_at || order.paid_at > grouped[key].last_paid_at)) {
          grouped[key].last_paid_at = order.paid_at;
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
            if (s.status !== 'completed') return false; // Only completed counts as paid step
            const oS = s.slug.toLowerCase().replace(/[^a-z0-9]/g, '');
            const p = stepDef.pattern.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (oS.includes(p) || p.includes(oS)) return true;
            if (p === 'cosselectionprocess' && oS.includes('changeofstatus') && oS.includes('selectionprocess')) return true;
            if (p === 'eb3stepinitial' && (oS.includes('eb3initial') || (oS.includes('eb3') && oS.includes('initial')))) return true;
            return false;
          });

          const pendingMatch = data.slugs.find(s => {
            if (s.status === 'completed') return false;
            const oS = s.slug.toLowerCase().replace(/[^a-z0-9]/g, '');
            const p = stepDef.pattern.toLowerCase().replace(/[^a-z0-9]/g, '');
            return oS.includes(p) || p.includes(oS);
          });

          return {
            label: stepDef.label,
            slug: stepDef.pattern,
            status: match ? 'paid' : (pendingMatch ? 'pending' : 'waiting'),
            paid_at: match ? (match.paid_at ?? null) : null,
          };
        });

        let paid_count = steps.filter(s => s.status === 'paid').length;
        const hasFullPayment = steps.some(s => s.status === 'paid' && s.label.toLowerCase().includes('full'));
        if (hasFullPayment) paid_count = config.steps.length;

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
        const slugsStr = (j.slugs || []).map(s => s?.slug?.toLowerCase()?.replace(/[^a-z0-9]/g, '') || '').join(' ');
        const hasMainSteps = slugsStr.includes('selection') && slugsStr.includes('scholarship') && slugsStr.includes('i20');
        if (hasMainSteps) return true;
        
        // Match 'fullprocess' (normalized)
        if (slugsStr.includes('fullprocess')) return true;
        
        return false;
      })();
      
      const isFullPaid = (j.slugs || []).some(s => s?.slug?.toLowerCase()?.includes('full process'));
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
