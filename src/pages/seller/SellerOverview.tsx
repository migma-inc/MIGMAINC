import { useState, useEffect } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
      <div>
        <div className="mb-8">
          <Skeleton className="h-9 w-64 mb-2" />
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-32 mt-1" />
        </div>

        {/* Stats Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i} className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <Skeleton className="h-4 w-20 mb-3" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                  <Skeleton className="h-10 w-10 rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions Skeleton */}
        <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-4 bg-black/50 rounded-lg border border-gold-medium/20">
                  <Skeleton className="h-5 w-40 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col gap-4 mb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold migma-gold-text mb-2">Dashboard Overview</h1>
            <p className="text-sm sm:text-base text-gray-400">Welcome back, {seller.full_name}</p>
            <p className="text-xs sm:text-sm text-gold-light mt-1">Seller ID: {seller.seller_id_public}</p>
          </div>
          <PeriodFilter 
            value={periodFilter} 
            onChange={setPeriodFilter} 
            showLabel={true}
            customDateRange={customDateRange}
            onCustomDateRangeChange={setCustomDateRange}
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-400">Total Sales</p>
                <p className="text-2xl sm:text-3xl font-bold text-white">{stats.totalSales}</p>
              </div>
              <ShoppingCart className="w-8 h-8 sm:w-10 sm:h-10 text-gold-light shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 via-green-500/5 to-green-500/10 border border-green-500/30">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-400">Completed</p>
                <p className="text-2xl sm:text-3xl font-bold text-green-300">{stats.completedSales}</p>
              </div>
              <CheckCircle className="w-8 h-8 sm:w-10 sm:h-10 text-green-400 shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-500/10 via-yellow-500/5 to-yellow-500/10 border border-yellow-500/30">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-400">Pending</p>
                <p className="text-2xl sm:text-3xl font-bold text-yellow-300">{stats.pendingSales}</p>
              </div>
              <Clock className="w-8 h-8 sm:w-10 sm:h-10 text-yellow-400 shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-400">Total Revenue</p>
                <p className="text-xl sm:text-2xl font-bold text-gold-light">
                  ${stats.totalRevenue.toFixed(2)}
                </p>
              </div>
              <DollarSign className="w-8 h-8 sm:w-10 sm:h-10 text-gold-light shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Link to="/seller/dashboard/commissions">
          <Card className="bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-purple-500/10 border border-purple-500/30 hover:border-purple-500/50 transition cursor-pointer">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-gray-400">Commission</p>
                  <p className="text-xl sm:text-2xl font-bold text-purple-300">
                    ${commissionBalance.total.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Available: ${commissionBalance.available.toFixed(2)} • Pending: ${commissionBalance.pending.toFixed(2)}
                  </p>
                </div>
                <Coins className="w-8 h-8 sm:w-10 sm:h-10 text-purple-400 shrink-0" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Quick Actions */}
      <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
        <CardHeader>
          <CardTitle className="text-white text-lg sm:text-xl">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <Link
              to="/seller/dashboard/funnel"
              className="p-4 bg-black/50 rounded-lg border border-gold-medium/20 hover:bg-gold-medium/10 transition block"
            >
              <p className="text-white font-semibold mb-1">View Conversion Funnel</p>
              <p className="text-xs text-gray-400">Analyze your conversion metrics</p>
            </Link>
            <Link
              to="/seller/dashboard/orders"
              className="p-4 bg-black/50 rounded-lg border border-gold-medium/20 hover:bg-gold-medium/10 transition block"
            >
              <p className="text-white font-semibold mb-1">View All Orders</p>
              <p className="text-xs text-gray-400">See your complete order history</p>
            </Link>
            <Link
              to="/seller/dashboard/links"
              className="p-4 bg-black/50 rounded-lg border border-gold-medium/20 hover:bg-gold-medium/10 transition block"
            >
              <p className="text-white font-semibold mb-1">Generate Sales Links</p>
              <p className="text-xs text-gray-400">Create and copy your links</p>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


