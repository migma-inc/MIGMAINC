import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { adminSupabase } from '@/lib/auth';
import { calculateNetAmount } from '@/lib/seller-commissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { EditSellerModal } from '@/components/admin/EditSellerModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AdminSellerAnalytics } from '@/pages/admin/AdminSellerAnalytics';
import { ChevronDown, ChevronRight, DollarSign, Users, ShoppingCart, Eye, Coins, Wallet, Clock, TrendingUp, Award, Trash2, Edit, ShoppingBag, Filter, X } from 'lucide-react';
import { HorizontalStatBar } from '@/components/seller/HorizontalStatBar';
import { PeriodFilter, type PeriodOption, type CustomDateRange } from '@/components/seller/PeriodFilter';
import { getPeriodDates, getAnalyticsData, getPreviousPeriod, calculatePercentageChange, type AnalyticsData } from '@/lib/seller-analytics';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ComparisonCard } from '@/components/seller/ComparisonCard';
import { CommissionConversionCard } from '@/components/seller/CommissionConversionCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExportButton } from '@/components/seller/ExportButton';

// Helper function to calculate net amount and fee
const calculateNetAmountAndFee = (order: Order) => {
  const netAmount = calculateNetAmount(order);
  const totalPrice = parseFloat(order.total_price_usd || '0');
  // Fee is the difference between total price and net amount (what was deducted)
  const feeAmount = Math.max(totalPrice - netAmount, 0);

  return {
    netAmount,
    feeAmount
  };
};

interface Seller {
  id: string;
  seller_id_public: string;
  full_name: string;
  email: string;
  phone: string | null;
  created_at: string;
  user_id: string;
  status: string;
  role?: string;
  head_of_sales_id?: string | null;
}

interface Order {
  id: string;
  order_number: string;
  product_slug: string;
  client_name: string;
  client_email: string;
  total_price_usd: string;
  payment_status: string;
  payment_method: string;
  payment_metadata?: any;
  created_at: string;
}

interface SellerBalance {
  available_balance: number;
  pending_balance: number;
  next_withdrawal_date: string | null;
  can_request: boolean;
  last_request_date: string | null;
  next_request_window_start?: string | null;
  next_request_window_end?: string | null;
  is_in_request_window?: boolean;
}

interface PaymentRequest {
  id: string;
  seller_id: string;
  amount: number;
  status: string;
  requested_at: string;
  payment_method: string;
}

interface SellerStats {
  seller: Seller;
  totalOrders: number;
  paidOrders: number;
  pendingOrders: number;
  totalRevenue: number;
  orders: Order[];
  balance: SellerBalance;
  totalCommissions: number;
  previousTotalRevenue: number;
  previousTotalCommissions: number;
  pendingPaymentRequests: PaymentRequest[];
}


export const SellersPage = () => {
  const [sellersStats, setSellersStats] = useState<SellerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSellers, setExpandedSellers] = useState<Set<string>>(new Set());
  const [products, setProducts] = useState<any[]>([]);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [sellerToDelete, setSellerToDelete] = useState<{ id: string, name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [sellerToEdit, setSellerToEdit] = useState<Seller | null>(null);
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);
  const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const [periodFilter, setPeriodFilter] = useState<PeriodOption>('all_time');
  const [customDateRange, setCustomDateRange] = useState<CustomDateRange>(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  });
  const [enableComparison, setEnableComparison] = useState(false);
  const [globalAnalyticsData, setGlobalAnalyticsData] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [granularity, setGranularity] = useState<'day' | 'week' | 'month'>('day');
  const [headsOfSales, setHeadsOfSales] = useState<{ id: string; full_name: string; email: string }[]>([]);


  useEffect(() => {
    loadSellersData();
    loadGlobalAnalytics();
  }, [periodFilter, customDateRange, enableComparison, granularity]);

  const loadGlobalAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const data = await getAnalyticsData(
        null,
        periodFilter === 'all_time' ? { start: '2000-01-01', end: new Date().toISOString() } : periodFilter,
        enableComparison,
        periodFilter === 'custom' ? customDateRange : undefined,
        granularity
      );
      setGlobalAnalyticsData(data);
    } catch (error) {
      console.error('Error loading global analytics:', error);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const periodLabel = periodFilter === 'thismonth' ? 'This Month' :
    periodFilter === 'lastmonth' ? 'Last Month' :
      periodFilter === 'today' ? 'Today' :
        periodFilter === 'yesterday' ? 'Yesterday' :
          periodFilter === 'last7days' ? 'Last 7 Days' :
            periodFilter === 'last30days' ? 'Last 30 Days' :
              periodFilter === 'last3months' ? 'Last 3 Months' :
                periodFilter === 'last6months' ? 'Last 6 Months' :
                  periodFilter === 'lastyear' ? 'Last Year' :
                    periodFilter === 'all_time' ? 'All Time' :
                      periodFilter === 'custom' ? `${customDateRange.start} to ${customDateRange.end}` : 'Period';

  const [previousTotalSellers, setPreviousTotalSellers] = useState(0);

  const currentTotalSellers = sellersStats.length;

  const loadSellersData = async () => {
    try {
      setLoading(true);

      // Load products for name mapping
      const { data: productsData } = await adminSupabase
        .from('visa_products')
        .select('slug, name');
      if (productsData) setProducts(productsData);

      const { start: prevStart, end: prevEnd } = getPeriodDates(
        periodFilter === 'all_time' ? { start: '2000-01-01', end: new Date().toISOString() } : periodFilter,
        periodFilter === 'custom' ? customDateRange : undefined
      );
      const previousPeriod = getPreviousPeriod(prevStart, prevEnd, periodFilter === 'custom' ? 'custom' : periodFilter);

      // Load sellers
      const { data: sellers, error: sellersError } = await adminSupabase
        .from('sellers')
        .select('*');

      if (sellersError) {
        console.error('Error loading sellers:', sellersError);
        return;
      }

      // Calculate previous total sellers
      const prevSellersCount = (sellers || []).filter(s => {
        const createdDate = new Date(s.created_at);
        return createdDate <= previousPeriod.end;
      }).length;
      setPreviousTotalSellers(prevSellersCount);

      const availableSellers = sellers || [];

      // Extract Heads of Sales for the dropdowns
      const hosList = availableSellers
        .filter(s => s.role === 'head_of_sales')
        .map(s => ({ id: s.id, full_name: s.full_name, email: s.email }));
      setHeadsOfSales(hosList);

      if (availableSellers.length === 0) {
        setSellersStats([]);
        setLoading(false);
        return;
      }

      // For each seller, load their orders, balance, commissions, and payment requests
      const statsPromises = availableSellers.map(async (seller) => {
        // Load orders
        let ordersQuery = adminSupabase
          .from('visa_orders')
          .select('*, payment_metadata')
          .eq('seller_id', seller.seller_id_public);

        if (periodFilter !== 'all_time') {
          ordersQuery = ordersQuery
            .gte('created_at', prevStart.toISOString())
            .lte('created_at', prevEnd.toISOString());
        }

        const { data: orders, error: ordersError } = await ordersQuery
          .order('created_at', { ascending: false });

        // Load PREVIOUS period orders for comparison
        let prevOrdersQuery = adminSupabase
          .from('visa_orders')
          .select('*, payment_metadata')
          .eq('seller_id', seller.seller_id_public);

        prevOrdersQuery = prevOrdersQuery
          .gte('created_at', previousPeriod.start.toISOString())
          .lte('created_at', previousPeriod.end.toISOString());

        const { data: prevOrders } = await prevOrdersQuery;
        const prevOrdersList = (prevOrders || []) as Order[];

        if (ordersError) {
          console.error(`Error loading orders for seller ${seller.seller_id_public}:`, ordersError);
        }

        const ordersList = (orders || []) as Order[];
        const totalOrders = ordersList.length;
        const paidOrders = ordersList.filter(o => o.payment_status === 'paid' || o.payment_status === 'completed').length;
        const pendingOrders = ordersList.filter(o => o.payment_status === 'pending').length;

        // Calculate total revenue WITHOUT Stripe fees (net amount)
        const totalRevenue = ordersList
          .filter(o => o.payment_status === 'paid' || o.payment_status === 'completed')
          .reduce((sum, o) => {
            return sum + calculateNetAmount(o);
          }, 0);

        // Load balance using RPC
        let balance: SellerBalance = {
          available_balance: 0,
          pending_balance: 0,
          next_withdrawal_date: null,
          can_request: false,
          last_request_date: null,
        };

        try {
          const { data: balanceData, error: balanceError } = await adminSupabase.rpc('get_seller_available_balance', {
            p_seller_id: seller.seller_id_public,
          });

          if (!balanceError && balanceData) {
            const result = Array.isArray(balanceData) ? balanceData[0] : balanceData;
            if (result) {
              balance = {
                available_balance: parseFloat(result.available_balance || '0'),
                pending_balance: parseFloat(result.pending_balance || '0'),
                next_withdrawal_date: result.next_withdrawal_date || null,
                can_request: result.can_request || false,
                last_request_date: result.last_request_date || null,
                next_request_window_start: result.next_request_window_start || null,
                next_request_window_end: result.next_request_window_end || null,
                is_in_request_window: result.is_in_request_window || false,
              };
            }
          }
        } catch (err) {
          console.error(`Error loading balance for seller ${seller.seller_id_public}:`, err);
        }

        // Load total commissions
        let totalCommissions = 0;
        // Load commissions
        let commQuery = adminSupabase
          .from('seller_commissions')
          .select('commission_amount_usd')
          .eq('seller_id', seller.seller_id_public);

        if (periodFilter !== 'all_time') {
          commQuery = commQuery
            .gte('created_at', prevStart.toISOString())
            .lte('created_at', prevEnd.toISOString());
        }

        try {
          const { data: commissions, error: commissionsError } = await commQuery;

          if (commissionsError) {
            console.error(`Error loading commissions for seller ${seller.seller_id_public}:`, commissionsError);
          } else if (commissions) {
            totalCommissions = commissions.reduce(
              (sum, c) => sum + parseFloat(c.commission_amount_usd || '0'),
              0
            );
          }
        } catch (err) {
          console.error(`Error loading commissions for seller ${seller.seller_id_public}:`, err);
        }

        // Load PREVIOUS period commissions for comparison
        let previousTotalCommissions = 0;
        let prevCommQuery = adminSupabase
          .from('seller_commissions')
          .select('commission_amount_usd')
          .eq('seller_id', seller.seller_id_public)
          .gte('created_at', previousPeriod.start.toISOString())
          .lte('created_at', previousPeriod.end.toISOString());

        try {
          const { data: prevCommissions } = await prevCommQuery;
          if (prevCommissions) {
            previousTotalCommissions = prevCommissions.reduce(
              (sum, c) => sum + parseFloat(c.commission_amount_usd || '0'),
              0
            );
          }
        } catch (err) {
          console.error(`Error loading prev commissions for seller ${seller.seller_id_public}:`, err);
        }

        const previousTotalRevenue = prevOrdersList
          .filter(o => o.payment_status === 'paid' || o.payment_status === 'completed')
          .reduce((sum, o) => sum + calculateNetAmount(o), 0);

        // PAYMENT REQUEST - COMENTADO TEMPORARIAMENTE
        // Load pending payment requests
        let pendingPaymentRequests: PaymentRequest[] = [];
        // try {
        //   const { data: requestsData } = await adminSupabase
        //     .from('seller_payment_requests')
        //     .select('id, seller_id, amount, status, requested_at, payment_method')
        //     .eq('seller_id', seller.seller_id_public)
        //     .eq('status', 'pending')
        //     .order('requested_at', { ascending: false });

        //   if (requestsData) {
        //     pendingPaymentRequests = requestsData.map((req: any) => ({
        //       id: req.id,
        //       seller_id: req.seller_id,
        //       amount: parseFloat(req.amount || '0'),
        //       status: req.status,
        //       requested_at: req.requested_at || req.created_at,
        //       payment_method: req.payment_method,
        //     }));
        //   }
        // } catch (err) {
        //   console.error(`Error loading payment requests for seller ${seller.seller_id_public}:`, err);
        // }

        return {
          seller,
          totalOrders,
          paidOrders,
          pendingOrders,
          totalRevenue,
          orders: ordersList,
          balance,
          totalCommissions,
          previousTotalRevenue,
          previousTotalCommissions,
          pendingPaymentRequests,
        } as SellerStats;
      });

      const stats = await Promise.all(statsPromises);
      const validStats = stats.filter(s => s !== null) as SellerStats[];

      // Sort sellers by last sale date (most recent first)
      // Sellers with sales come first, ordered by most recent sale
      // Sellers without sales come last, ordered by account creation date
      validStats.sort((a, b) => {
        const aLastSale = a.orders.length > 0
          ? new Date(a.orders[0].created_at).getTime() // Most recent order
          : 0;
        const bLastSale = b.orders.length > 0
          ? new Date(b.orders[0].created_at).getTime()
          : 0;

        // If both have sales, sort by most recent
        if (aLastSale > 0 && bLastSale > 0) {
          return bLastSale - aLastSale; // Most recent first
        }

        // If only one has sales, prioritize it
        if (aLastSale > 0 && bLastSale === 0) return -1;
        if (aLastSale === 0 && bLastSale > 0) return 1;

        // If neither has sales, sort by account creation date (most recent first)
        return new Date(b.seller.created_at).getTime() - new Date(a.seller.created_at).getTime();
      });

      setSellersStats(validStats);
    } catch (err) {
      console.error('Error loading sellers data:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSeller = (sellerId: string) => {
    setExpandedSellers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sellerId)) {
        newSet.delete(sellerId);
      } else {
        newSet.add(sellerId);
      }
      return newSet;
    });
  };

  const handleDeleteSeller = (sellerId: string, fullName: string) => {
    setSellerToDelete({ id: sellerId, name: fullName });
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteSeller = async () => {
    if (!sellerToDelete) return;

    try {
      setIsDeleting(true);
      const { error } = await adminSupabase
        .from('sellers')
        .delete()
        .eq('id', sellerToDelete.id);

      if (error) {
        console.error('Error deleting seller:', error);
        alert(`Error deleting seller: ${error.message}`);
        setIsDeleting(false);
        return;
      }

      // Refresh data
      await loadSellersData();
      setIsDeleteModalOpen(false);
      setSellerToDelete(null);
    } catch (err) {
      console.error('Unexpected error deleting seller:', err);
      alert('An unexpected error occurred while deleting the seller.');
    } finally {
      setIsDeleting(false);
    }
  };

  const getProductName = (slug: string) => {
    return products.find(p => p.slug === slug)?.name || slug;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
      case 'paid':
        return <Badge className="bg-green-500/20 text-green-300 border-green-500/50">Paid</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/50">Pending</Badge>;
      case 'failed':
        return <Badge className="bg-red-500/20 text-red-300 border-red-500/50">Failed</Badge>;
      case 'cancelled':
        return <Badge className="bg-gray-500/20 text-gray-300 border-gray-500/50">Cancelled</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const formatTimeUntilRelease = (dateString: string | null): string => {
    if (!dateString) return 'N/A';

    const releaseDate = new Date(dateString);
    const now = new Date();
    const diff = releaseDate.getTime() - now.getTime();

    if (diff <= 0) return 'Available now';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return `${days}d ${hours}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  // Get top sellers by revenue
  const topSellersByRevenue = [...sellersStats]
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 5);

  // Get top sellers by commissions
  const topSellersByCommissions = [...sellersStats]
    .sort((a, b) => b.totalCommissions - a.totalCommissions)
    .slice(0, 5);

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <Skeleton className="h-9 w-64 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-3.5 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header & Filters Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
          <div className="flex items-center justify-between w-full md:w-auto">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-gold-medium" />
              <h1 className="text-lg font-black uppercase tracking-widest text-white">
                Sellers & Sales
              </h1>
            </div>
            <div className="flex items-center gap-2 md:hidden">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                className={`p-2 h-8 w-8 rounded-lg border transition-all duration-200 ${isFiltersOpen ? 'bg-gold-medium/20 border-gold-medium/50 text-gold-light' : 'bg-black/40 border-gold-medium/20 text-gray-400'}`}
              >
                {isFiltersOpen ? <X className="w-4 h-4" /> : <Filter className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          <div className={`${isFiltersOpen ? 'flex' : 'hidden md:flex'} flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full xl:w-auto animate-in fade-in slide-in-from-top-2 duration-300`}>
            <div className="bg-black/20 p-1.5 rounded-xl border border-gold-medium/10 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full">
              <div className="flex-1 sm:flex-initial">
                <PeriodFilter
                  value={periodFilter}
                  onChange={setPeriodFilter}
                  customDateRange={customDateRange}
                  onCustomDateRangeChange={setCustomDateRange}
                  showLabel={true}
                  locale="en"
                />
              </div>

              <div className="hidden sm:block w-px h-6 bg-gold-medium/20" />

              <div className="flex items-center justify-between gap-2 px-1 sm:px-0">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="granularity" className="text-gray-500 text-[9px] uppercase font-black tracking-widest whitespace-nowrap">
                    Group by:
                  </Label>
                  <Select
                    value={granularity}
                    onValueChange={(value) => setGranularity(value as 'day' | 'week' | 'month')}
                  >
                    <SelectTrigger
                      id="granularity"
                      className="w-full sm:w-[85px] h-7 bg-black/40 border-gold-medium/10 text-white text-[10px] hover:bg-black/60 focus:ring-1 focus:ring-gold-medium rounded-lg"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-gold-medium/30 text-white">
                      <SelectItem value="day">Daily</SelectItem>
                      <SelectItem value="week">Weekly</SelectItem>
                      <SelectItem value="month">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-1.5 bg-black/40 px-2 h-7 rounded-lg border border-gold-medium/10">
                    <Checkbox
                      id="comparison"
                      checked={enableComparison}
                      onCheckedChange={(checked) => setEnableComparison(checked === true)}
                      className="h-3 w-3 border-gold-medium/30 data-[state=checked]:bg-gold-medium data-[state=checked]:text-black"
                    />
                    <Label htmlFor="comparison" className="text-gray-500 text-[9px] uppercase font-black tracking-widest cursor-pointer whitespace-nowrap">
                      Compare
                    </Label>
                  </div>
                </div>
              </div>
            </div>

            {globalAnalyticsData && (
              <div className="shrink-0">
                <ExportButton data={globalAnalyticsData} periodLabel={periodLabel} />
              </div>
            )}
          </div>
        </div>

        {/* Global Summary Statistics */}
        <div className="mb-4 sm:mb-8">
          {analyticsLoading || !globalAnalyticsData ? (
             <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 sm:gap-4">
               {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-16 md:h-32 rounded-xl" />)}
             </div>
          ) : (
            <>
              {/* Mobile View: Horizontal Bars */}
              <div className="md:hidden space-y-1.5">
                <HorizontalStatBar
                  title="Total Sellers"
                  value={currentTotalSellers.toString()}
                  trend={calculatePercentageChange(currentTotalSellers, previousTotalSellers)}
                  icon={Users}
                  variant="gold"
                />
                <HorizontalStatBar
                  title="Total Revenue"
                  value={formatCurrency(globalAnalyticsData.summary.totalRevenue)}
                  trend={calculatePercentageChange(globalAnalyticsData.summary.totalRevenue, globalAnalyticsData.comparison?.previousSummary.totalRevenue || 0)}
                  icon={DollarSign}
                  variant="green"
                />
                <HorizontalStatBar
                  title="Total Commissions"
                  value={formatCurrency(globalAnalyticsData.summary.commission)}
                  trend={calculatePercentageChange(globalAnalyticsData.summary.commission, globalAnalyticsData.comparison?.previousSummary.commissions || 0)}
                  icon={Coins}
                  variant="purple"
                />
                <HorizontalStatBar
                  title="Commission Rate"
                  value={`${(globalAnalyticsData.commissionSummary?.commissionRate || 0).toFixed(2)}%`}
                  icon={TrendingUp}
                  variant="blue"
                />
              </div>

              {/* Desktop View: Grid Cards */}
              <div className="hidden md:grid md:grid-cols-4 gap-4">
                <ComparisonCard
                  title="Total Sellers"
                  currentValue={currentTotalSellers}
                  previousValue={previousTotalSellers}
                  formatValue={(v) => v.toString()}
                  icon={<Users className="w-5 h-5 text-gold-light" />}
                />
                <ComparisonCard
                  title="Total Revenue"
                  currentValue={globalAnalyticsData.summary.totalRevenue}
                  previousValue={globalAnalyticsData.comparison?.previousSummary.totalRevenue || 0}
                  formatValue={(v) => formatCurrency(v)}
                  icon={<DollarSign className="w-5 h-5 text-green-400" />}
                />
                <ComparisonCard
                  title="Total Commissions"
                  currentValue={globalAnalyticsData.summary.commission}
                  previousValue={globalAnalyticsData.comparison?.previousSummary.commissions || 0}
                  formatValue={(v) => formatCurrency(v)}
                  icon={<Coins className="w-5 h-5 text-purple-400" />}
                />
                <CommissionConversionCard
                  currentRate={globalAnalyticsData.commissionSummary?.commissionRate || 0}
                  previousRate={globalAnalyticsData.comparison?.previousSummary.commissions ? (globalAnalyticsData.comparison.previousSummary.commissions / globalAnalyticsData.comparison.previousSummary.totalRevenue) * 100 : undefined}
                  currentRevenue={globalAnalyticsData.summary.totalRevenue}
                  currentCommissions={globalAnalyticsData.summary.commission}
                />
              </div>
            </>
          )}
        </div>


        {/* Top Sellers Section */}
        {sellersStats.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6 mb-4 sm:mb-8">
            {/* Top Sellers by Revenue */}
            <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30 overflow-hidden">
              <CardHeader className="p-3 pb-1 md:p-6 md:pb-2">
                <CardTitle className="text-white flex items-center gap-2 text-[11px] md:text-base font-black uppercase tracking-widest">
                  <TrendingUp className="w-3.5 h-3.5 text-gold-light" />
                  Top Revenue
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2.5 md:p-6 pt-0">
                <div className="space-y-1.5 md:space-y-2">
                  {topSellersByRevenue.length === 0 ? (
                    <p className="text-gray-400 text-[10px] text-center py-4">No data</p>
                  ) : (
                    topSellersByRevenue.map((stats, index) => (
                      <div
                        key={stats.seller.id}
                        className="flex items-center justify-between p-1.5 md:p-2 bg-black/40 rounded-xl border border-gold-medium/10 hover:border-gold-medium/30 transition-all group"
                      >
                        <div className="flex items-center gap-2 md:gap-2.5 flex-1 min-w-0">
                          <div className="hidden md:flex items-center justify-center w-6 h-6 rounded-lg bg-gold-medium/10 text-gold-light font-black text-[10px] shrink-0 border border-gold-medium/20">
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className="text-white text-[10px] md:text-sm font-bold truncate cursor-pointer hover:text-gold-light transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSellerId(stats.seller.seller_id_public);
                                setIsAnalyticsModalOpen(true);
                              }}
                            >
                              {stats.seller.full_name || stats.seller.email}
                            </p>
                            <p className="hidden md:block text-[8px] sm:text-xs text-gray-500 truncate tracking-tight font-mono opacity-60 uppercase">{stats.seller.seller_id_public}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-gold-light font-black text-[10px] md:text-sm tracking-tight">{formatCurrency(stats.totalRevenue)}</p>
                          <p className="text-[7px] md:text-[8px] text-gray-500 font-bold uppercase">{stats.paidOrders} ORD</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Top Sellers by Commissions */}
            <Card className="bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-purple-500/10 border border-purple-500/30 overflow-hidden">
              <CardHeader className="p-3 pb-1 md:p-6 md:pb-2">
                <CardTitle className="text-white flex items-center gap-2 text-[11px] md:text-base font-black uppercase tracking-widest">
                  <Award className="w-3.5 h-3.5 text-purple-300" />
                  Top Commissions
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2.5 md:p-6 pt-0">
                <div className="space-y-1.5 md:space-y-2">
                  {topSellersByCommissions.length === 0 ? (
                    <p className="text-gray-400 text-[10px] text-center py-4">No data</p>
                  ) : (
                    topSellersByCommissions.map((stats, index) => (
                      <div
                        key={stats.seller.id}
                        className="flex items-center justify-between p-1.5 md:p-2 bg-black/40 rounded-xl border border-purple-500/10 hover:border-purple-500/30 transition-all group"
                      >
                        <div className="flex items-center gap-2 md:gap-2.5 flex-1 min-w-0">
                          <div className="hidden md:flex items-center justify-center w-6 h-6 rounded-lg bg-purple-500/10 text-purple-300 font-black text-[10px] shrink-0 border border-purple-500/20">
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className="text-white text-[10px] md:text-sm font-bold truncate cursor-pointer hover:text-purple-300 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSellerId(stats.seller.seller_id_public);
                                setIsAnalyticsModalOpen(true);
                              }}
                            >
                              {stats.seller.full_name || stats.seller.email}
                            </p>
                            <p className="hidden md:block text-[8px] sm:text-xs text-gray-500 truncate tracking-tight font-mono opacity-60 uppercase">{stats.seller.seller_id_public}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-purple-300 font-black text-[10px] md:text-sm tracking-tight">{formatCurrency(stats.totalCommissions)}</p>
                          <p className="text-[7px] md:text-[8px] text-gray-500 font-bold uppercase">{stats.paidOrders} ORD</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* All Sellers List */}
        <Dialog open={isAnalyticsModalOpen} onOpenChange={setIsAnalyticsModalOpen}>
          <DialogContent className="max-w-[98vw] w-full lg:max-w-[1600px] max-h-[98vh] h-full overflow-y-auto p-0 border-white/20 bg-black [&>button]:text-white [&>button]:right-6 [&>button]:top-6 [&>button]:opacity-100 hover:[&>button]:opacity-80 [&>button:focus]:ring-white [&>button:focus]:ring-offset-black [&>button[data-state=open]]:bg-black [&>button]:border [&>button]:border-transparent">
            <div className="p-2 sm:p-4">
              {selectedSellerId && (
                <AdminSellerAnalytics sellerId={selectedSellerId} isModal={true} />
              )}
            </div>
          </DialogContent>
        </Dialog>
        {sellersStats.length === 0 ? (
          <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
            <CardContent className="p-6 text-center">
              <p className="text-gray-400">No sellers found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2 md:space-y-4">
            <h2 className="text-base md:text-xl font-black text-white uppercase tracking-widest mb-2 md:mb-4 px-1">All Sellers</h2>
            {sellersStats.map((stats) => {
              const isExpanded = expandedSellers.has(stats.seller.id);

              return (
                <Card
                  key={stats.seller.id}
                  className="bg-zinc-900/40 border-gold-medium/20 hover:border-gold-medium/40 transition-all overflow-hidden"
                >
                  <CardHeader className="p-2 md:p-6 pb-1 md:pb-4 cursor-pointer hover:bg-white/5 transition-all" onClick={() => toggleSeller(stats.seller.id)}>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-3">
                      <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSeller(stats.seller.id);
                          }}
                          className="p-0 h-6 md:h-10 w-6 md:w-10 text-gold-medium hover:text-gold-light hover:bg-gold-medium/10 shrink-0"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 md:w-6 md:h-6" />
                          ) : (
                            <ChevronRight className="w-4 h-4 md:w-6 md:h-6 transition-transform" />
                          )}
                        </Button>
                        <div className="flex-1 min-w-0">
                          <CardTitle
                            className="text-white text-[11px] md:text-xl font-black uppercase tracking-tight break-words cursor-pointer hover:text-gold-light transition-colors flex items-center gap-1.5 md:gap-2 leading-none"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSellerId(stats.seller.seller_id_public);
                              setIsAnalyticsModalOpen(true);
                            }}
                          >
                            {stats.seller.full_name || stats.seller.email}
                            {stats.seller.role === 'head_of_sales' && (
                              <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/50 text-[8px] md:text-[10px] uppercase font-black tracking-widest px-1.5 py-0 h-3.5 flex items-center">
                                HOS
                              </Badge>
                            )}
                          </CardTitle>
                          <div className="flex flex-col md:flex-row md:items-center gap-1 mt-0.5">
                            <p className="text-[9px] md:text-sm text-gray-500 font-mono uppercase opacity-70 leading-none">
                              {stats.seller.seller_id_public}
                            </p>
                            {stats.seller.role !== 'head_of_sales' && stats.seller.head_of_sales_id && (
                              <p className="text-[8px] md:text-xs text-purple-400/60 uppercase font-black tracking-widest leading-none flex items-center gap-1">
                                HOS: {headsOfSales.find(h => h.id === stats.seller.head_of_sales_id)?.full_name || '...'}
                              </p>
                            )}
                          </div>

                          {/* Mobile Mini Stats Summary (only when collapsed) */}
                          {!isExpanded && (
                            <div className="md:hidden flex items-center gap-3 mt-1.5 px-2 py-1 bg-black/40 rounded-lg border border-gold-medium/10 w-fit">
                              <div className="flex items-center gap-1">
                                <ShoppingCart className="w-2.5 h-2.5 text-gold-light" />
                                <span className="text-[10px] font-black text-white">{stats.totalOrders}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <DollarSign className="w-2.5 h-2.5 text-green-400" />
                                <span className="text-[10px] font-black text-green-300">{formatCurrency(stats.totalRevenue)}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Coins className="w-2.5 h-2.5 text-purple-400" />
                                <span className="text-[10px] font-black text-purple-300">{formatCurrency(stats.totalCommissions)}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 md:gap-2 ml-8 md:ml-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            const url = `/dashboard/sellers/${stats.seller.seller_id_public}/orders`;
                            window.open(url, '_blank', 'width=1400,height=900,resizable=yes,scrollbars=yes');
                          }}
                          className="h-7 md:h-9 w-7 md:w-9 p-0 text-gold-light hover:bg-gold-medium/10 border border-gold-medium/10"
                          title="View Orders"
                        >
                          <ShoppingCart className="w-3.5 h-3.5 md:w-5 md:h-5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSellerToEdit(stats.seller);
                            setIsEditModalOpen(true);
                          }}
                          className="h-7 md:h-9 w-7 md:w-9 p-0 text-blue-400 hover:bg-blue-500/10 border border-blue-500/10"
                          title="Edit Seller"
                        >
                          <Edit className="w-3.5 h-3.5 md:w-5 md:h-5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSeller(stats.seller.id, stats.seller.full_name || stats.seller.email);
                          }}
                          className="h-7 md:h-9 w-7 md:w-9 p-0 text-red-500 hover:bg-red-500/10 border border-red-500/10"
                          title="Delete Seller"
                        >
                          <Trash2 className="w-3.5 h-3.5 md:w-5 md:h-5" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-2 md:p-6 pt-0">
                    {/* Full Statistics Grid */}
                    <div className={`${isExpanded ? 'grid' : 'hidden md:grid'} grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2 sm:gap-4 mb-3`}>
                      {/* Total Orders */}
                      <div className="bg-black/40 rounded-xl p-2.5 sm:p-4 border border-gold-medium/10 shadow-inner group transition-all hover:bg-black/60">
                        <div className="flex items-center gap-1.5 mb-1 text-gray-500">
                          <ShoppingCart className="w-3 h-3 text-gold-light" />
                          <span className="text-[9px] sm:text-sm font-black uppercase tracking-widest">Orders</span>
                        </div>
                        <p className="text-base sm:text-2xl font-black text-white leading-none">{stats.totalOrders}</p>
                        <p className="text-[8px] text-gray-500 font-bold uppercase mt-1 opacity-70">{stats.paidOrders} PAID</p>
                      </div>

                      {/* Total Revenue */}
                      <div className="bg-green-900/10 rounded-xl p-2.5 sm:p-4 border border-green-500/20 group transition-all hover:bg-green-900/20">
                        <div className="flex items-center justify-between gap-1.5 mb-1">
                          <div className="flex items-center gap-1.5 text-gray-500">
                            <DollarSign className="w-3 h-3 text-green-300" />
                            <span className="text-[9px] sm:text-sm font-black uppercase tracking-widest">Revenue</span>
                          </div>
                          {enableComparison && stats.previousTotalRevenue > 0 && (
                            <div className={`flex items-center gap-0.5 text-[8px] font-black ${stats.totalRevenue >= stats.previousTotalRevenue ? 'text-green-400' : 'text-red-400'}`}>
                              {calculatePercentageChange(stats.totalRevenue, stats.previousTotalRevenue).toFixed(0)}%
                            </div>
                          )}
                        </div>
                        <p className="text-base sm:text-lg md:text-xl font-black text-green-300 leading-none">
                          {formatCurrency(stats.totalRevenue)}
                        </p>
                      </div>

                      {/* Total Commissions */}
                      <div className="bg-purple-900/10 rounded-xl p-2.5 sm:p-4 border border-purple-500/20 group transition-all hover:bg-purple-900/20">
                        <div className="flex items-center justify-between gap-1.5 mb-1">
                          <div className="flex items-center gap-1.5 text-gray-500">
                            <Coins className="w-3 h-3 text-purple-300" />
                            <span className="text-[9px] sm:text-sm font-black uppercase tracking-widest">Commission</span>
                          </div>
                          {enableComparison && stats.previousTotalCommissions > 0 && (
                            <div className={`flex items-center gap-0.5 text-[8px] font-black ${stats.totalCommissions >= stats.previousTotalCommissions ? 'text-purple-300' : 'text-red-400'}`}>
                               {calculatePercentageChange(stats.totalCommissions, stats.previousTotalCommissions).toFixed(0)}%
                            </div>
                          )}
                        </div>
                        <p className="text-base sm:text-lg md:text-xl font-black text-purple-300 leading-none">
                          {formatCurrency(stats.totalCommissions)}
                        </p>
                      </div>

                      {/* Available Balance */}
                      <div className="bg-blue-900/10 rounded-xl p-2.5 sm:p-4 border border-blue-500/20 group transition-all hover:bg-blue-900/20">
                        <div className="flex items-center gap-1.5 mb-1 text-gray-500">
                          <Wallet className="w-3 h-3 text-blue-300" />
                          <span className="text-[9px] sm:text-sm font-black uppercase tracking-widest">Available</span>
                        </div>
                        <p className="text-base sm:text-lg md:text-xl font-black text-blue-300 leading-none">
                          {formatCurrency(stats.balance.available_balance)}
                        </p>
                      </div>

                      {/* Pending Balance */}
                      <div className="bg-yellow-900/10 rounded-xl p-2.5 sm:p-4 border border-yellow-500/20 group transition-all hover:bg-yellow-900/20">
                        <div className="flex items-center gap-1.5 mb-1 text-gray-500">
                          <Clock className="w-3 h-3 text-yellow-300" />
                          <span className="text-[9px] sm:text-sm font-black uppercase tracking-widest">Pending</span>
                        </div>
                        <p className="text-base sm:text-lg md:text-xl font-black text-yellow-300 leading-none">
                          {formatCurrency(stats.balance.pending_balance)}
                        </p>
                        {stats.balance.next_withdrawal_date && (
                          <p className="text-[8px] text-gray-500 font-medium truncate mt-1 opacity-60">
                             {formatTimeUntilRelease(stats.balance.next_withdrawal_date)}
                          </p>
                        )}
                      </div>

                      {/* Pending Requests */}
                      <div className="bg-orange-900/10 rounded-xl p-2.5 sm:p-4 border border-orange-500/20 group transition-all hover:bg-orange-900/20">
                        <div className="flex items-center gap-1.5 mb-1 text-gray-500">
                          <Clock className="w-3 h-3 text-orange-300" />
                          <span className="text-[9px] sm:text-sm font-black uppercase tracking-widest">Requests</span>
                        </div>
                        <p className="text-base sm:text-lg md:text-xl font-black text-orange-300 leading-none">
                          0
                        </p>
                      </div>
                    </div>

                    {/* PAYMENT REQUEST - COMENTADO TEMPORARIAMENTE */}
                    {/* Pending Payment Requests */}
                    {/* {stats.pendingPaymentRequests.length > 0 && (
                      <div className="mb-4 p-4 bg-orange-500/10 rounded-lg border border-orange-500/30">
                        <h4 className="text-sm font-semibold text-orange-300 mb-3 flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          Pending Payment Requests ({stats.pendingPaymentRequests.length})
                        </h4>
                        <div className="space-y-2">
                          {stats.pendingPaymentRequests.map((request) => (
                            <div
                              key={request.id}
                              className="flex items-center justify-between p-2 bg-black/30 rounded border border-orange-500/20"
                            >
                              <div className="flex-1">
                                <p className="text-white text-sm font-semibold">
                                  ${request.amount.toFixed(2)} via {request.payment_method}
                                </p>
                                <p className="text-xs text-gray-400">
                                  Requested: {new Date(request.requested_at).toLocaleString()}
                                </p>
                              </div>
                              <Link to="/dashboard/payment-requests">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-orange-500/50 bg-black/50 text-orange-300 hover:bg-black hover:border-orange-500 hover:text-orange-200"
                                >
                                  <Eye className="w-3 h-3 mr-1" />
                                  View
                                </Button>
                              </Link>
                            </div>
                          ))}
                        </div>
                      </div>
                    )} */}

                    {/* Orders List (when expanded) */}
                    {isExpanded && (
                      <div className="mt-6 pt-6 border-t border-gold-medium/30">
                        <h3 className="text-lg font-semibold text-white mb-4">Orders</h3>
                        {stats.orders.length === 0 ? (
                          <p className="text-gray-400 text-center py-4 text-sm">No orders found</p>
                        ) : (
                        <>
                          <div className="hidden md:block overflow-x-auto">
                            <table className="w-full">
                              <thead>
                                <tr className="border-b border-gold-medium/30">
                                  <th className="text-left py-3 px-4 text-[10px] uppercase font-bold text-gray-500 tracking-wider">Order #</th>
                                  <th className="text-left py-3 px-4 text-[10px] uppercase font-bold text-gray-500 tracking-wider">Client</th>
                                  <th className="text-left py-3 px-4 text-[10px] uppercase font-bold text-gray-500 tracking-wider">Product</th>
                                  <th className="text-left py-3 px-4 text-[10px] uppercase font-bold text-gray-500 tracking-wider">Total</th>
                                  <th className="text-left py-3 px-4 text-[10px] uppercase font-bold text-gray-500 tracking-wider">Net</th>
                                  <th className="text-left py-3 px-4 text-[10px] uppercase font-bold text-gray-500 tracking-wider">Status</th>
                                  <th className="text-left py-3 px-4 text-[10px] uppercase font-bold text-gray-500 tracking-wider">Date</th>
                                  <th className="text-right py-3 px-4 text-[10px] uppercase font-bold text-gray-500 tracking-wider">Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {stats.orders.map((order) => {
                                  const { netAmount } = calculateNetAmountAndFee(order);
                                  return (
                                    <tr key={order.id} className="border-b border-gold-medium/10 hover:bg-white/5 group transition-colors">
                                      <td className="py-3 px-4 text-sm text-white font-mono group-hover:text-gold-light transition-colors">{order.order_number}</td>
                                      <td className="py-3 px-4">
                                        <div className="text-sm">
                                          <p className="text-white font-medium">{order.client_name}</p>
                                          <p className="text-gray-500 text-[10px] uppercase font-mono tracking-tighter">{order.client_email}</p>
                                        </div>
                                      </td>
                                      <td className="py-3 px-4 text-sm text-white/90">{getProductName(order.product_slug)}</td>
                                      <td className="py-3 px-4 text-sm text-gold-light font-bold">
                                        {formatCurrency(order.total_price_usd)}
                                      </td>
                                      <td className="py-3 px-4 text-sm text-white font-semibold">
                                        {formatCurrency(netAmount)}
                                      </td>
                                      <td className="py-3 px-4">
                                        {getStatusBadge(order.payment_status)}
                                      </td>
                                      <td className="py-3 px-4 text-xs text-gray-500">
                                        {new Date(order.created_at).toLocaleDateString()}
                                      </td>
                                      <td className="py-3 px-4 text-right">
                                        <Link to={`/dashboard/visa-orders/${order.id}`}>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 border-gold-medium/30 bg-black/50 text-gold-light hover:bg-gold-medium text-[10px] font-bold uppercase tracking-wider px-3"
                                          >
                                            <Eye className="w-3.5 h-3.5 mr-1.5" />
                                            View
                                          </Button>
                                        </Link>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          <div className="md:hidden space-y-2">
                            {stats.orders.map((order) => {
                              const { netAmount } = calculateNetAmountAndFee(order);
                              return (
                                <div key={order.id} className="bg-black/40 border border-gold-medium/10 rounded-xl p-2.5 space-y-2 shadow-lg">
                                  <div className="flex justify-between items-start gap-2">
                                    <div className="min-w-0 flex-1">
                                      <p className="text-[9px] text-gray-500 font-mono uppercase tracking-widest leading-none mb-1 opacity-60">{order.order_number}</p>
                                      <p className="text-white font-bold text-xs truncate leading-none">{order.client_name}</p>
                                      <p className="text-gray-500 text-[9px] truncate opacity-80 mt-0.5">{order.client_email}</p>
                                    </div>
                                    <div className="shrink-0 scale-90 origin-top-right">
                                      {getStatusBadge(order.payment_status)}
                                    </div>
                                  </div>

                                  <div className="py-2 border-y border-white/5 flex items-center justify-between gap-4">
                                    <div className="min-w-0 flex-1">
                                      <p className="text-[8px] text-gray-500 uppercase font-black mb-0.5 opacity-60">Product</p>
                                      <p className="text-white text-[10px] font-medium truncate leading-tight uppercase">{getProductName(order.product_slug)}</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <p className="text-[8px] text-gray-500 uppercase font-black mb-0.5 opacity-60">Net</p>
                                      <p className="text-gold-light text-[11px] font-black leading-tight">{formatCurrency(netAmount)}</p>
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 bg-black/40 px-2 py-0.5 rounded border border-white/5">
                                      <p className="text-[8px] text-gray-500 uppercase font-bold opacity-60">Total:</p>
                                      <p className="text-white text-[10px] font-black">{formatCurrency(parseFloat(order.total_price_usd || '0'))}</p>
                                    </div>
                                    <Link to={`/dashboard/visa-orders/${order.id}`}>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 border-gold-medium/30 bg-black/50 text-gold-light hover:bg-gold-medium text-[9px] font-black uppercase tracking-widest px-2.5"
                                      >
                                        <Eye className="w-3 h-3 mr-1" />
                                        View
                                      </Button>
                                    </Link>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}


        <ConfirmModal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            if (!isDeleting) {
              setIsDeleteModalOpen(false);
              setSellerToDelete(null);
            }
          }}
          onConfirm={confirmDeleteSeller}
          title="Delete Seller"
          message={`Are you sure you want to delete seller "${sellerToDelete?.name}"? This action cannot be undone and will remove all associated data.`}
          confirmText="Delete Now"
          cancelText="Cancel"
          variant="danger"
          isLoading={isDeleting}
        />

        {sellerToEdit && (
          <EditSellerModal
            seller={sellerToEdit}
            headsOfSales={headsOfSales}
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false);
              setSellerToEdit(null);
            }}
            onSuccess={() => {
              loadSellersData();
            }}
          />
        )}

        <Dialog open={isAnalyticsModalOpen} onOpenChange={setIsAnalyticsModalOpen}>
          <DialogContent className="max-w-[95vw] w-full max-h-[90vh] overflow-y-auto custom-scrollbar bg-black border-gold-medium/30 p-0 sm:p-2">
            <DialogHeader className="p-4 sm:p-6 pb-0">
              <DialogTitle className="text-xl sm:text-2xl font-bold migma-gold-text">
                Seller Analytics
              </DialogTitle>
            </DialogHeader>
            <div className="p-2 sm:p-4">
              {selectedSellerId && (
                <AdminSellerAnalytics sellerId={selectedSellerId} isModal={true} />
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};
