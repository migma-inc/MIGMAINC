import { useState, useEffect } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { ShoppingCart, CheckCircle, Clock, DollarSign, Coins } from 'lucide-react';
import { calculateNetAmount } from '@/lib/seller-commissions';
import { PeriodFilter, type PeriodOption, type CustomDateRange } from '@/components/seller/PeriodFilter';
import { getPeriodDates, getCommissionSummary } from '@/lib/seller-analytics';

interface SellerInfo {
  id: string;
  seller_id_public: string;
  full_name: string;
  email: string;
  status: string;
}

interface Stats {
  totalSales: number;
  completedSales: number;
  pendingSales: number;
  totalRevenue: number;
}

export function SellerOverview() {
  const { seller } = useOutletContext<{ seller: SellerInfo }>();
  const [periodFilter, setPeriodFilter] = useState<PeriodOption>('thismonth');
  const [customDateRange, setCustomDateRange] = useState<CustomDateRange>(() => {
    // Default: últimos 30 dias
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  });
  const [stats, setStats] = useState<Stats>({
    totalSales: 0,
    completedSales: 0,
    pendingSales: 0,
    totalRevenue: 0,
  });
  const [commissionBalance, setCommissionBalance] = useState({
    available: 0,
    pending: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);

  // Função para calcular range de datas do período selecionado
  const getPeriodRange = () => {
    if (periodFilter === 'custom') {
      // Para custom, usar as datas selecionadas pelo usuário
      const startDate = new Date(customDateRange.start);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(customDateRange.end);
      endDate.setHours(23, 59, 59, 999);
      return {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      };
    }
    const { start, end } = getPeriodDates(periodFilter);
    return { start: start.toISOString(), end: end.toISOString() };
  };

  useEffect(() => {
    const loadStats = async () => {
      if (!seller) return;

      try {
        setLoading(true);

        // Construir query base
        const { start, end } = getPeriodRange();
        const period = {
          start: new Date(start),
          end: new Date(end),
        };

        // Buscar pedidos e comissões em paralelo
        const [ordersResult, commissionResult] = await Promise.all([
          (async () => {
            let query = supabase
              .from('visa_orders')
              .select('*')
              .eq('seller_id', seller.seller_id_public);

            // Adicionar filtro de data se necessário
            if (start && end) {
              query = query.gte('created_at', start).lte('created_at', end);
            }

            const { data: ordersData } = await query.order('created_at', { ascending: false });
            return ordersData || [];
          })(),
          getCommissionSummary(seller.seller_id_public, period),
        ]);

        // Processar pedidos
        if (ordersResult) {
          const completed = ordersResult.filter(o => o.payment_status === 'completed' || o.payment_status === 'paid');
          const pending = ordersResult.filter(o => o.payment_status === 'pending');
          // Calculate revenue using net amount (total_price_usd - fee_amount)
          const revenue = completed.reduce((sum, o) => {
            const netAmount = calculateNetAmount(o);
            return sum + netAmount;
          }, 0);

          setStats({
            totalSales: ordersResult.length,
            completedSales: completed.length,
            pendingSales: pending.length,
            totalRevenue: revenue,
          });
        }

        // Processar comissões
        setCommissionBalance({
          available: commissionResult.availableCommissions,
          pending: commissionResult.pendingCommissions,
          total: commissionResult.totalCommissions,
        });
      } catch (err) {
        console.error('Error loading stats:', err);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [seller, periodFilter, customDateRange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-medium"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold migma-gold-text">Dashboard Overview</h1>
          <p className="text-zinc-500 mt-1">Welcome back, <span className="text-white font-medium">{seller.full_name}</span></p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] bg-zinc-900 text-zinc-400 px-2 py-0.5 rounded border border-zinc-800 uppercase tracking-wider font-mono">
              ID: {seller.seller_id_public}
            </span>
          </div>
        </div>

        <div className="w-full md:w-auto">
          <PeriodFilter
            value={periodFilter}
            onChange={setPeriodFilter}
            showLabel={false}
            customDateRange={customDateRange}
            onCustomDateRangeChange={setCustomDateRange}
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-zinc-950 border border-zinc-900 transform transition-all duration-300 hover:border-gold-medium/50 hover:bg-zinc-900/50">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Total Sales</p>
                <p className="text-3xl font-bold text-white">{stats.totalSales}</p>
              </div>
              <div className="p-2 bg-gold-medium/10 rounded-lg">
                <ShoppingCart className="w-5 h-5 text-gold-medium" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-950 border border-zinc-900 transform transition-all duration-300 hover:border-green-500/50 hover:bg-zinc-900/50">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Completed</p>
                <p className="text-3xl font-bold text-green-500">{stats.completedSales}</p>
              </div>
              <div className="p-2 bg-green-500/10 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-950 border border-zinc-900 transform transition-all duration-300 hover:border-yellow-500/50 hover:bg-zinc-900/50">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Pending</p>
                <p className="text-3xl font-bold text-yellow-500">{stats.pendingSales}</p>
              </div>
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <Clock className="w-5 h-5 text-yellow-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-950 border border-zinc-900 transform transition-all duration-300 hover:border-gold-medium/50 hover:bg-zinc-900/50">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Net Revenue</p>
                <p className="text-2xl font-bold text-white">
                  ${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="p-2 bg-gold-medium/10 rounded-lg">
                <DollarSign className="w-5 h-5 text-gold-medium" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Link to="/seller/dashboard/commissions">
          <Card className="bg-zinc-950 border border-zinc-900 transform transition-all duration-300 hover:border-purple-500/50 hover:bg-zinc-900/50 group h-full">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Commission</p>
                  <p className="text-2xl font-bold text-purple-400">
                    ${commissionBalance.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <div className="flex flex-col gap-0.5 pt-1">
                    <p className="text-[10px] text-zinc-500">Available: <span className="text-zinc-300 font-medium">${commissionBalance.available.toFixed(2)}</span></p>
                    <p className="text-[10px] text-zinc-500">Pending: <span className="text-zinc-300 font-medium">${commissionBalance.pending.toFixed(2)}</span></p>
                  </div>
                </div>
                <div className="p-2 bg-purple-500/10 rounded-lg group-hover:bg-purple-500/20 transition-colors">
                  <Coins className="w-5 h-5 text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          {
            title: "View Conversion Funnel",
            desc: "Analyze your conversion metrics & performance",
            link: "/seller/dashboard/funnel",
            icon: "📊"
          },
          {
            title: "View All Orders",
            desc: "See your complete order history and details",
            link: "/seller/dashboard/orders",
            icon: "🛍️"
          },
          {
            title: "Generate Sales Links",
            desc: "Create and manage your affiliate tracking links",
            link: "/seller/dashboard/links",
            icon: "🔗"
          }
        ].map((action, idx) => (
          <Link key={idx} to={action.link}>
            <Card className="bg-zinc-950 border border-zinc-900 transform transition-all duration-300 hover:border-gold-medium/50 hover:bg-zinc-900/50 group">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="text-2xl grayscale group-hover:grayscale-0 transition-all">{action.icon}</div>
                <div>
                  <h3 className="text-sm font-semibold text-white group-hover:text-gold-light transition-colors">{action.title}</h3>
                  <p className="text-xs text-zinc-500 leading-relaxed">{action.desc}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}


