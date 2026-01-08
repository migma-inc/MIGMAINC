import { useState, useEffect } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ShoppingCart, CheckCircle, Clock, DollarSign } from 'lucide-react';

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
  const [periodFilter, setPeriodFilter] = useState<'month' | 'all'>('month');
  const [stats, setStats] = useState<Stats>({
    totalSales: 0,
    completedSales: 0,
    pendingSales: 0,
    totalRevenue: 0,
  });
  const [loading, setLoading] = useState(true);

  // Função para calcular data de início do mês quando necessário
  const getStartDate = (): string | null => {
    if (periodFilter === 'month') {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return startOfMonth.toISOString();
    }
    return null; // 'all' - não filtra por data
  };

  useEffect(() => {
    const loadStats = async () => {
      if (!seller) return;

      try {
        // Construir query base
        const startDate = getStartDate();
        let query = supabase
          .from('visa_orders')
          .select('*')
          .eq('seller_id', seller.seller_id_public);

        // Adicionar filtro de data se necessário
        if (startDate) {
          query = query.gte('created_at', startDate);
        }

        const { data: ordersData } = await query.order('created_at', { ascending: false });

        if (ordersData) {
          const completed = ordersData.filter(o => o.payment_status === 'completed' || o.payment_status === 'paid');
          const pending = ordersData.filter(o => o.payment_status === 'pending');
          const revenue = completed.reduce((sum, o) => sum + parseFloat(o.total_price_usd || '0'), 0);

          setStats({
            totalSales: ordersData.length,
            completedSales: completed.length,
            pendingSales: pending.length,
            totalRevenue: revenue,
          });
        }
      } catch (err) {
        console.error('Error loading stats:', err);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [seller, periodFilter]);

  if (loading) {
    return (
      <div>
        <div className="mb-8">
          <Skeleton className="h-9 w-64 mb-2" />
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-32 mt-1" />
        </div>

        {/* Stats Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
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
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <Label htmlFor="period-filter" className="text-white text-sm whitespace-nowrap">
              Período:
            </Label>
            <Select
              value={periodFilter}
              onValueChange={(value) => setPeriodFilter(value as 'month' | 'all')}
            >
              <SelectTrigger 
                id="period-filter"
                className="w-full sm:w-[160px] bg-black/50 border-gold-medium/50 text-white hover:bg-black/70"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Este Mês</SelectItem>
                <SelectItem value="all">Acumulado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
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


