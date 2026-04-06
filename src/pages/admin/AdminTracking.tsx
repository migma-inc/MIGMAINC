import { useState, useEffect } from 'react';
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
  Calendar,
  DollarSign,
  TrendingUp,
  Users,
  Loader2, 
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface TrackingStep {
  label: string;
  slug: string;
  status: 'paid' | 'pending';
  paid_at: string | null;
}

/*
- [x] Add `CustomSwitch` component and pagination states to `AdminTracking.tsx`
- [x] Implement 4 colorful gradient stats cards
- [x] Implement pill-style filter buttons
- [x] Replace grid/card view with a Unified Table View (Desktop & Mobile-optimized)
- [x] Implement pagination logic (15 items per page)
- [x] Add pagination controls (Prev/Next/Dots)
- [x] Final UI polish and verification
*/

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
  const [stats, setStats] = useState({ 
    total: 0, 
    incomplete: 0, 
    complete: 0,
    paid_today: 0 
  });
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

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

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const paidTodayItems = result.filter(j => 
          j.steps.some(s => s.status === 'paid' && s.paid_at && new Date(s.paid_at) >= today)
        ).length;

        const complete = result.filter(j => j.paid_count === j.total_steps).length;

        setJourneys(result);
        setStats({
          total: result.length,
          incomplete: result.length - complete,
          complete,
          paid_today: paidTodayItems
        });
      } catch (err) {
        console.error('[Tracking] Unexpected error:', err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  // Final filtering logic
  const filteredData = journeys.filter(j => {
    const matchesSearch = j.client_email.toLowerCase().includes(search.toLowerCase()) ||
                         j.client_name.toLowerCase().includes(search.toLowerCase()) ||
                         j.seller_name.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;

    if (filterStatus === 'all') return true;
    if (filterStatus === 'on-track') return j.paid_count > 0 && j.paid_count < j.total_steps;
    if (filterStatus === 'abandoned') return j.paid_count === 0;
    if (filterStatus === 'completed') return j.paid_count === j.total_steps;
    return true;
  });

  const totalPages = Math.ceil(filteredData.length / pageSize);
  const currentData = filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const getStatusBadge = (journey: TrackingJourney) => {
    if (journey.paid_count === journey.total_steps) {
        return { label: 'Completed', className: 'bg-green-500/20 text-green-400 border-green-500/50' };
    }
    if (journey.paid_count === 0) {
        return { label: 'Abandoned', className: 'bg-red-500/20 text-red-400 border-red-500/50' };
    }
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
            onClick={() => window.location.reload()}
            variant="outline"
            className="gap-2 w-full sm:w-auto border-gray-700 bg-transparent hover:bg-white/10 text-white"
          >
            <Loader2 className="w-4 h-4" /> Refresh List
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Active Leads', value: stats.total, color: 'border-blue-500/30 from-blue-500/10 to-blue-600/5', icon: Users, iconColor: 'text-blue-400' },
          { label: 'Abandoned 24h', value: stats.incomplete, color: 'border-red-500/30 from-red-500/10 to-red-600/5', icon: TrendingUp, iconColor: 'text-red-400' },
          { label: 'Paid Today', value: stats.paid_today, color: 'border-green-500/30 from-green-500/10 to-green-600/5', icon: DollarSign, iconColor: 'text-green-400' },
          { label: 'Conversions', value: stats.complete, color: 'border-gold-medium/30 from-gold-light/10 to-gold-dark/5', icon: Calendar, iconColor: 'text-gold-light' },
        ].map((stat, i) => (
          <Card key={i} className={cn("bg-gradient-to-br border", stat.color)}>
             <CardHeader className="pb-1.5 p-3 sm:p-6 sm:pb-2">
                <CardTitle className="text-[10px] sm:text-sm font-medium text-gray-400 flex items-center gap-1.5">
                   <stat.icon className={cn("w-3.5 h-3.5 sm:w-4 h-4", stat.iconColor)} />
                   {stat.label}
                </CardTitle>
             </CardHeader>
             <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                <div className="text-xl sm:text-3xl font-bold text-white">{stat.value}</div>
             </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters (Pills) */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {[
          { id: 'all', label: 'All' },
          { id: 'on-track', label: 'On Track' },
          { id: 'abandoned', label: 'Abandoned' },
          { id: 'completed', label: 'Completed' },
        ].map(filter => (
          <Button
            key={filter.id}
            variant={filterStatus === filter.id ? 'default' : 'outline'}
            onClick={() => { setFilterStatus(filter.id); setCurrentPage(1); }}
            className={cn(
              "text-xs sm:text-sm whitespace-nowrap px-6 rounded-full h-9",
              filterStatus === filter.id 
                ? "bg-gold-medium hover:bg-gold-dark text-black border-none" 
                : "border-white/10 bg-black/40 text-gray-400 hover:bg-white/5"
            )}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      {/* Main Table View */}
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
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/5 text-[11px] font-black uppercase text-gray-500 tracking-[0.2em]">
                      <th className="px-6 py-4">Client</th>
                      <th className="px-6 py-4">Journey</th>
                      <th className="px-6 py-4">Progress</th>
                      <th className="px-6 py-4">Last Payment</th>
                      <th className="px-6 py-4">Seller</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {currentData.map((journey, i) => {
                      const status = getStatusBadge(journey);
                      const progress = (journey.paid_count / journey.total_steps) * 100;
                      
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
                                  className={cn("h-full transition-all duration-500", progress === 100 ? "bg-green-500" : "bg-gold-medium")} 
                                  style={{ width: `${progress}%` }} 
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-gray-400 text-xs font-mono">
                            {new Date(journey.last_activity).toLocaleDateString()}
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

              {/* Pagination Controls */}
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
                     // Only show neighbors of current page
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
                    disabled={currentPage === totalPages}
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
