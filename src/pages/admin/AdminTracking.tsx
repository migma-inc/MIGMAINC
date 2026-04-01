import { useState, useEffect } from 'react';
import {
  Activity,
  Search,
  Clock,
  AlertCircle,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface TrackingStep {
  label: string;
  slug: string;
  status: 'paid' | 'pending';
  paid_at: string | null;
}

interface TrackingJourney {
  client_email: string;
  client_name: string;
  seller_name: string;
  journey_name: string;
  journey_type: string;
  last_activity: string;
  steps: TrackingStep[];
  paid_count: number;
  total_steps: number;
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
};

function detectJourneyType(slugs: string[]): string | null {
  for (const slug of slugs) {
    if (slug.startsWith('initial-')) return 'initial';
    if (slug.startsWith('cos-')) return 'cos';
    if (slug.startsWith('transfer-')) return 'transfer';
  }
  return null;
}

export function AdminTracking() {
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [journeys, setJourneys] = useState<TrackingJourney[]>([]);
  const [stats, setStats] = useState({ total: 0, incomplete: 0, complete: 0 });

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);

        // Fetch all completed orders + seller name
        const { data: orders, error } = await supabase
          .from('visa_orders')
          .select('client_email, client_name, product_slug, seller_id, paid_at, created_at')
          .eq('payment_status', 'completed')
          .order('created_at', { ascending: false });

        if (error || !orders) {
          console.error('[Tracking] Error fetching orders:', error);
          return;
        }

        // Fetch sellers for name lookup
        const sellerIds = [...new Set(orders.map(o => o.seller_id).filter(Boolean))];
        const { data: sellers } = await supabase
          .from('sellers')
          .select('seller_id_public, full_name')
          .in('seller_id_public', sellerIds);

        const sellerMap = new Map((sellers || []).map(s => [s.seller_id_public, s.full_name]));

        // Group by client_email
        const grouped: Record<string, {
          client_name: string;
          seller_id: string;
          slugs: { slug: string; paid_at: string | null; created_at: string }[];
          last_activity: string;
        }> = {};

        for (const order of orders) {
          const email = (order.client_email || '').toLowerCase();
          if (!email) continue;

          if (!grouped[email]) {
            grouped[email] = {
              client_name: order.client_name || email,
              seller_id: order.seller_id || '',
              slugs: [],
              last_activity: order.paid_at ?? order.created_at,
            };
          }

          grouped[email].slugs.push({
            slug: order.product_slug,
            paid_at: order.paid_at,
            created_at: order.created_at,
          });

          const orderDate = order.paid_at ?? order.created_at;
          if (orderDate > grouped[email].last_activity) {
            grouped[email].last_activity = orderDate;
          }
        }

        // Build journey list — only clients in a known journey
        const result: TrackingJourney[] = [];

        for (const [email, data] of Object.entries(grouped)) {
          const slugList = data.slugs.map(s => s.slug);
          const journeyType = detectJourneyType(slugList);
          if (!journeyType) continue;

          const config = JOURNEY_CONFIG[journeyType];
          const slugMap = new Map(data.slugs.map(s => [s.slug, s]));

          const steps: TrackingStep[] = config.steps.map(stepDef => {
            const match = slugMap.get(stepDef.pattern);
            return {
              label: stepDef.label,
              slug: stepDef.pattern,
              status: match ? 'paid' : 'pending',
              paid_at: match ? (match.paid_at ?? match.created_at) : null,
            };
          });

          const paid_count = steps.filter(s => s.status === 'paid').length;

          result.push({
            client_email: email,
            client_name: data.client_name,
            seller_name: sellerMap.get(data.seller_id) || data.seller_id || 'Direct',
            journey_name: config.label,
            journey_type: journeyType,
            last_activity: data.last_activity,
            steps,
            paid_count,
            total_steps: config.steps.length,
          });
        }

        // Sort: incomplete first (most actionable), then by last activity
        result.sort((a, b) => {
          const aComplete = a.paid_count === a.total_steps;
          const bComplete = b.paid_count === b.total_steps;
          if (aComplete !== bComplete) return aComplete ? 1 : -1;
          return new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime();
        });

        const complete = result.filter(j => j.paid_count === j.total_steps).length;

        setJourneys(result);
        setStats({
          total: result.length,
          incomplete: result.length - complete,
          complete,
        });
      } catch (err) {
        console.error('[Tracking] Unexpected error:', err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const filtered = journeys.filter(j =>
    j.client_email.toLowerCase().includes(search.toLowerCase()) ||
    j.client_name.toLowerCase().includes(search.toLowerCase()) ||
    j.seller_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <Activity className="w-8 h-8 text-gold-medium" />
            PAYMENT JOURNEY TRACKING
          </h1>
          <p className="text-gray-400 mt-1 font-medium italic">
            Monitor which clients have pending steps in their journey.
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            placeholder="Search client or seller..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-black/40 border-white/10 pl-10 w-full md:w-[300px] text-white"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Total Journeys',    value: stats.total,      color: 'text-gold-light',  Icon: Activity },
          { label: 'Pending Steps',     value: stats.incomplete, color: 'text-red-400',     Icon: AlertCircle },
          { label: 'Fully Complete',    value: stats.complete,   color: 'text-green-400',   Icon: CheckCircle2 },
        ].map(({ label, value, color, Icon }) => (
          <div key={label} className="bg-black/40 border border-white/5 p-6 rounded-2xl flex items-center justify-between group hover:border-gold-medium/20 transition-all">
            <div>
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">{label}</p>
              <h3 className={cn('text-3xl font-black', color)}>{value}</h3>
            </div>
            <div className="p-4 bg-white/5 rounded-2xl group-hover:scale-110 transition-all">
              <Icon className={cn('w-6 h-6', color)} />
            </div>
          </div>
        ))}
      </div>

      {/* Journey List */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-20 text-gray-500 font-bold animate-pulse">
            Loading journey data...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-black/20 rounded-2xl border border-dashed border-white/10 text-gray-600">
            No journeys found.
          </div>
        ) : (
          filtered.map((journey, idx) => {
            const isComplete = journey.paid_count === journey.total_steps;
            const progress = (journey.paid_count / journey.total_steps) * 100;

            return (
              <Card key={idx} className="bg-black/40 border-white/5 hover:border-gold-medium/20 transition-all overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex flex-col lg:flex-row">

                    {/* Client Info */}
                    <div className="p-6 lg:w-[28%] border-b lg:border-b-0 lg:border-r border-white/5 bg-white/[0.01]">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <Badge className={cn(
                            'border-none text-[9px] font-black uppercase mb-2',
                            isComplete ? 'bg-green-500/20 text-green-400' : 'bg-gold-medium text-black'
                          )}>
                            {journey.journey_name}
                          </Badge>
                          <h4 className="text-lg font-black text-white leading-tight uppercase truncate max-w-[200px]">
                            {journey.client_name}
                          </h4>
                          <p className="text-xs text-gray-500 font-mono italic">{journey.client_email}</p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-gold-medium/10 flex items-center justify-center text-gold-medium font-black border border-gold-medium/20 shrink-0">
                          {journey.client_name[0]?.toUpperCase()}
                        </div>
                      </div>

                      <div className="mt-6 pt-6 border-t border-white/5 flex items-center justify-between text-[9px] font-bold text-gray-500 uppercase tracking-widest">
                        <div className="flex flex-col">
                          <span>Seller</span>
                          <span className="text-white mt-1">{journey.seller_name}</span>
                        </div>
                        <div className="flex flex-col text-right">
                          <span>Last Payment</span>
                          <div className="flex items-center gap-1.5 text-gray-400 mt-1">
                            <Clock className="w-3 h-3" />
                            <span>{new Date(journey.last_activity).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Steps Progress */}
                    <div className="p-6 lg:flex-1 flex flex-col justify-center bg-black/20">
                      <div className="flex items-center justify-between mb-8">
                        <h5 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">
                          Journey Progress
                        </h5>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 bg-white/5 rounded-full overflow-hidden">
                            <div
                              className={cn('h-full transition-all', isComplete ? 'bg-green-500' : 'bg-gold-medium')}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className={cn('text-[10px] font-black', isComplete ? 'text-green-400' : 'text-gold-medium')}>
                            {journey.paid_count}/{journey.total_steps} PAID
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between relative px-4">
                        <div className="absolute top-5 left-0 w-full h-[1px] bg-white/5 z-0" />

                        {journey.steps.map((step, i) => (
                          <div key={i} className="relative z-10 flex flex-col items-center gap-3">
                            <div className={cn(
                              'w-10 h-10 rounded-full flex items-center justify-center transition-all border-2',
                              step.status === 'paid'
                                ? 'bg-green-500/20 border-green-500 text-green-500 shadow-[0_0_15px_rgba(34,197,94,0.2)]'
                                : 'bg-zinc-900 border-white/10 text-gray-600'
                            )}>
                              {step.status === 'paid'
                                ? <CheckCircle2 className="w-5 h-5" />
                                : <Circle className="w-4 h-4" />
                              }
                            </div>
                            <div className="flex flex-col items-center gap-0.5">
                              <span className={cn(
                                'text-[8px] font-black uppercase tracking-widest text-center',
                                step.status === 'paid' ? 'text-green-500' : 'text-gray-600'
                              )}>
                                {step.label}
                              </span>
                              {step.paid_at && (
                                <span className="text-[8px] text-gray-600 font-mono">
                                  {new Date(step.paid_at).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
