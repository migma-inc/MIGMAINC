import { useState, useEffect } from 'react';
import { 
  Activity, 
  Search, 
  Filter, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  ChevronRight,
  MousePointer2
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface TrackingStep {
  id: string;
  slug: string;
  name: string;
  status: 'pending' | 'initiated' | 'paid';
  updated_at: string;
}

interface TrackingJourney {
  client_email: string;
  client_name: string;
  seller_name: string;
  seller_id_public: string;
  journey_name: string;
  journey_type: 'initial' | 'cos' | 'transfer' | 'eb2' | 'eb3' | 'other';
  last_activity: string;
  steps: TrackingStep[];
  is_full_paid: boolean;
}

const JOURNEY_CONFIG: Record<string, { label: string, total_steps: number, patterns: { pattern: string, label: string }[] }> = {
  'initial': { 
    label: 'Initial Application', 
    total_steps: 3, 
    patterns: [
      { pattern: 'selection', label: 'Selection' },
      { pattern: 'scholarship', label: 'Scholarship' },
      { pattern: 'i20', label: 'I-20' }
    ] 
  },
  'cos': { 
    label: 'Change of Status (COS)', 
    total_steps: 3, 
    patterns: [
      { pattern: 'selection', label: 'Selection' },
      { pattern: 'scholarship', label: 'Scholarship' },
      { pattern: 'i20', label: 'I-20' }
    ] 
  },
  'transfer': { 
    label: 'Transfer', 
    total_steps: 3, 
    patterns: [
      { pattern: 'selection', label: 'Selection' },
      { pattern: 'scholarship', label: 'Scholarship' },
      { pattern: 'i20', label: 'I-20' }
    ] 
  },
  'eb2': { 
    label: 'EB-2 Program', 
    total_steps: 2, 
    patterns: [
      { pattern: 'full-process', label: 'Full Process' },
      { pattern: 'initial-payment', label: 'Initial' }
    ] 
  },
  'eb3': { 
    label: 'EB-3 Program', 
    total_steps: 6, 
    patterns: [
      { pattern: 'step-plan-initial', label: 'Initial (Step)' },
      { pattern: 'step-plan-job', label: 'Job (Step)' },
      { pattern: 'installment-plan-initial', label: 'Initial (Inst)' },
      { pattern: 'installment-plan-job', label: 'Job (Inst)' },
      { pattern: 'installment-monthly', label: 'Monthly' },
      { pattern: 'full-process', label: 'Full Process' }
    ] 
  },
};

export function AdminTracking() {
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [journeys, setJourneys] = useState<TrackingJourney[]>([]);

  const [stats, setStats] = useState({
    active: 0,
    abandoned: 0,
    conversion: 0
  });

  useEffect(() => {
    async function loadTrackingData() {
      try {
        setLoading(true);
        
        // 1. Fetch prefill tokens
        const { data: prefills } = await supabase
          .from('checkout_prefill_tokens')
          .select('*, sellers(full_name, seller_id_public)')
          .order('created_at', { ascending: false });

        // 2. Fetch visa orders
        const { data: orders } = await supabase
          .from('visa_orders')
          .select('client_email, product_slug, created_at, payment_status')
          .eq('payment_status', 'completed');

        const grouped: Record<string, TrackingJourney> = {};
        let totalInitiated = 0;
        let totalPaid = 0;
        let abandoned24h = 0;
        const now = new Date();

        prefills?.forEach(token => {
          const clientData = token.client_data || {};
          const email = (clientData.clientEmail || clientData.customerEmail || clientData.email || 'unknown@migma.com').toLowerCase();
          const seller = token.sellers || { full_name: 'Direct Sale', seller_id_public: 'MIGMA' };
          const slugLower = (token.product_slug || '').toLowerCase();
          
          totalInitiated++;

          let journey_type: TrackingJourney['journey_type'] = 'other';
          if (slugLower.includes('initial')) journey_type = 'initial';
          else if (slugLower.includes('cos') || slugLower.includes('status')) journey_type = 'cos';
          else if (slugLower.includes('transfer')) journey_type = 'transfer';
          else if (slugLower.includes('eb2') || slugLower.includes('eb-2')) journey_type = 'eb2';
          else if (slugLower.includes('eb3') || slugLower.includes('eb-3')) journey_type = 'eb3';

          if (!grouped[email]) {
            grouped[email] = {
              client_email: email,
              client_name: token.client_data?.clientName || 'Anonymous',
              seller_name: seller.full_name,
              seller_id_public: seller.seller_id_public,
              journey_name: JOURNEY_CONFIG[journey_type]?.label || 'Other Service',
              journey_type: journey_type,
              last_activity: token.created_at,
              steps: [],
              is_full_paid: false
            };
          }

          const isFull = slugLower.includes('full') || slugLower.includes('total');
          const isPaid = orders?.some(o => o.client_email.toLowerCase() === email && o.product_slug.toLowerCase() === slugLower);

          if (isPaid) {
            totalPaid++;
          } else {
             // Check if abandoned in last 24h (no payment found for this attempt)
             const createdDate = new Date(token.created_at);
             const diffMs = now.getTime() - createdDate.getTime();
             const diffHours = diffMs / (1000 * 60 * 60);
             // Ensure it's within the 24h window (and not from future)
             if (diffHours >= 0 && diffHours <= 24) {
                abandoned24h++;
             }
          }

          if (isFull && isPaid) {
            grouped[email].is_full_paid = true;
          }

          let stepName = 'Step';
          const config = JOURNEY_CONFIG[journey_type];
          if (config) {
            const patternMatch = config.patterns.find(p => slugLower.includes(p.pattern));
            if (patternMatch) stepName = patternMatch.label;
          }

          grouped[email].steps.push({
            id: token.id,
            slug: token.product_slug,
            name: stepName,
            status: isPaid ? 'paid' : 'initiated',
            updated_at: token.created_at
          });
          
          if (new Date(token.created_at) > new Date(grouped[email].last_activity)) {
             grouped[email].last_activity = token.created_at;
          }
        });

        const journeyList = Object.values(grouped).sort((a, b) => 
          new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime()
        );

        setJourneys(journeyList);
        setStats({
          active: journeyList.length,
          abandoned: abandoned24h,
          conversion: totalInitiated > 0 ? Math.round((totalPaid / totalInitiated) * 100) : 0
        });

      } catch (err) {
        console.error('Error loading tracking:', err);
      } finally {
        setLoading(false);
      }
    }

    loadTrackingData();
  }, []);

  const filteredJourneys = journeys.filter(j => 
    j.client_email.toLowerCase().includes(search.toLowerCase()) ||
    j.client_name.toLowerCase().includes(search.toLowerCase()) ||
    j.seller_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <Activity className="w-8 h-8 text-gold-medium" />
            PAYMENT JOURNEY TRACKING
          </h1>
          <p className="text-gray-400 mt-1 font-medium italic">Monitor real-time checkout progress and identify abandoned steps.</p>
        </div>

        <div className="flex items-center gap-3">
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
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Active Sessions', value: stats.active, color: 'text-gold-light', icon: MousePointer2 },
          { label: 'Abandoned (24h)', value: stats.abandoned, color: 'text-red-400', icon: AlertCircle },
          { label: 'Step Conversion', value: `${stats.conversion}%`, color: 'text-green-400', icon: CheckCircle2 },
        ].map((stat, i) => (
          <div key={i} className="bg-black/40 border border-white/5 p-6 rounded-2xl flex items-center justify-between group hover:border-gold-medium/20 transition-all">
            <div>
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">{stat.label}</p>
              <h3 className={cn("text-3xl font-black", stat.color)}>{stat.value}</h3>
            </div>
            <div className="p-4 bg-white/5 rounded-2xl group-hover:scale-110 transition-all">
              <stat.icon className={cn("w-6 h-6", stat.color)} />
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-20 text-gray-500 font-bold animate-pulse">Synchronizing Journey Data...</div>
        ) : filteredJourneys.length === 0 ? (
          <div className="text-center py-20 bg-black/20 rounded-2xl border border-dashed border-white/10 text-gray-600">
            No active journeys found.
          </div>
        ) : (
          filteredJourneys.map((journey, idx) => {
            const config = JOURNEY_CONFIG[journey.journey_type] || { label: 'Generic Service', total_steps: 1 };
            const paidSteps = journey.is_full_paid ? config.total_steps : journey.steps.filter(s => s.status === 'paid').length;
            const progress = (paidSteps / config.total_steps) * 100;
            
            return (
              <Card key={idx} className="bg-black/40 border-white/5 hover:border-gold-medium/20 transition-all overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex flex-col lg:flex-row">
                    {/* Client Info */}
                    <div className="p-6 lg:w-[30%] border-b lg:border-b-0 lg:border-r border-white/5 bg-white/[0.01]">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <Badge className="bg-gold-medium text-black border-none text-[9px] font-black uppercase mb-2">
                            {journey.journey_name}
                          </Badge>
                          <h4 className="text-lg font-black text-white leading-tight uppercase truncate max-w-[200px]">{journey.client_name}</h4>
                          <p className="text-xs text-gray-500 font-mono italic">{journey.client_email}</p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-gold-medium/10 flex items-center justify-center text-gold-medium font-black border border-gold-medium/20 shrink-0">
                          {journey.client_name[0]}
                        </div>
                      </div>
                      
                      <div className="mt-6 pt-6 border-t border-white/5 flex items-center justify-between text-[9px] font-bold text-gray-500 uppercase tracking-widest">
                        <div className="flex flex-col">
                          <span>Seller</span>
                          <span className="text-white mt-1">{journey.seller_name}</span>
                        </div>
                        <div className="flex flex-col text-right">
                          <span>Activity</span>
                          <div className="flex items-center gap-1.5 text-gray-400 mt-1">
                            <Clock className="w-3 h-3" />
                            <span>{new Date(journey.last_activity).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Progress */}
                    <div className="p-6 lg:flex-1 relative flex flex-col justify-center bg-black/20">
                      {config.total_steps > 1 ? (
                        <>
                          <div className="flex items-center justify-between mb-8">
                             <h5 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">Lifecycle Progress</h5>
                             <div className="flex items-center gap-2">
                                <div className="h-1.5 w-24 bg-white/5 rounded-full overflow-hidden">
                                  <div className="h-full bg-gold-medium" style={{ width: `${progress}%` }} />
                                </div>
                                <span className="text-[10px] font-black text-gold-medium">
                                  {paidSteps}/{config.total_steps} STEPS
                                </span>
                             </div>
                          </div>

                          <div className="flex items-center justify-between relative px-4">
                            <div className="absolute top-1/2 left-0 w-full h-[1px] bg-white/5 -translate-y-1/2 z-0" />
                            
                            {Array.from({ length: config.total_steps }).map((_, i) => {
                              const stepIdx = i + 1;
                              const isPaid = journey.is_full_paid || paidSteps >= stepIdx;
                              // Simplified check: if it's the next step after the last paid one, it might be initiated
                              const isInitiated = !isPaid && journey.steps.some(s => s.status === 'initiated');
                              
                              return (
                                <div key={i} className="relative z-10 flex flex-col items-center gap-3">
                                  <div className={cn(
                                    "w-10 h-10 rounded-full flex items-center justify-center transition-all border-2",
                                    isPaid ? "bg-green-500/20 border-green-500 text-green-500 shadow-[0_0_15px_rgba(34,197,94,0.2)]" :
                                    isInitiated ? "bg-gold-medium/20 border-gold-medium text-gold-medium animate-pulse" :
                                    "bg-zinc-900 border-white/5 text-gray-700"
                                  )}>
                                    {isPaid ? <CheckCircle2 className="w-5 h-5" /> : <span className="font-black text-xs">{stepIdx}</span>}
                                  </div>
                                  <span className={cn(
                                    "text-[8px] font-black uppercase tracking-widest",
                                    isPaid ? "text-green-500" : isInitiated ? "text-gold-light" : "text-gray-600"
                                  )}>
                                    {config.patterns?.[i]?.label || `Step ${stepIdx}`}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center justify-between">
                           <div className="space-y-1">
                              <h5 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">Single Step Service</h5>
                              <div className="flex items-center gap-2">
                                 {journey.is_full_paid || (journey.steps.some(s => s.status === 'paid')) ? (
                                   <Badge className="bg-green-500/20 text-green-500 border-green-500/30">Payment Confirmed</Badge>
                                 ) : (
                                   <Badge className="bg-gold-medium/10 text-gold-medium border-gold-medium/20">Checkout Initiated</Badge>
                                 )}
                              </div>
                           </div>
                           <p className="text-[10px] font-mono text-gray-600 max-w-[200px] truncate">{journey.steps[0]?.slug}</p>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="p-6 lg:w-[15%] flex flex-row lg:flex-col items-center justify-center gap-3 bg-white/[0.005]">
                      <Button variant="ghost" className="w-full bg-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase tracking-widest gap-2">
                         <MousePointer2 className="w-3.5 h-3.5" /> Logs
                      </Button>
                      <Button variant="ghost" className="w-full bg-gold-medium/10 hover:bg-gold-medium/20 text-gold-medium text-[10px] font-black uppercase tracking-widest border border-gold-medium/20">
                         Resume <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
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
