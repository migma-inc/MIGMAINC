import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { adminSupabase } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { SellerAnalyticsContent, type PreviousSummary } from '@/components/seller/SellerAnalyticsContent';
import { type PeriodOption, type CustomDateRange } from '@/components/seller/PeriodFilter';
import { getAnalyticsData, getPreviousPeriod, getCommissionChartData, getSellerChartData } from '@/lib/seller-analytics';
import type { AnalyticsData } from '@/lib/seller-analytics';
import { ShoppingCart, BarChart3 } from 'lucide-react';

interface SellerInfo {
  id: string;
  seller_id_public: string;
  full_name: string;
  email: string;
  status: string;
}

interface AdminSellerAnalyticsProps {
  sellerId?: string;
  isModal?: boolean;
}

export function AdminSellerAnalytics({ sellerId: propSellerId, isModal }: AdminSellerAnalyticsProps = {}) {
  const params = useParams<{ sellerId: string }>();
  const sellerId = propSellerId || params.sellerId;
  const [seller, setSeller] = useState<SellerInfo | null>(null);
  const [sellerLoading, setSellerLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState<PeriodOption>('thismonth');
  const [customDateRange, setCustomDateRange] = useState<CustomDateRange>(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  });
  const [granularity, setGranularity] = useState<'day' | 'week' | 'month'>('day');
  const [enableComparison, setEnableComparison] = useState(true);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  // Buscar seller pelo seller_id_public
  useEffect(() => {
    const loadSeller = async () => {
      if (!sellerId) {
        setSellerLoading(false);
        return;
      }

      try {
        setSellerLoading(true);
        const { data: sellerData, error } = await adminSupabase
          .from('sellers')
          .select('*')
          .eq('seller_id_public', sellerId)
          .single();

        if (error || !sellerData) {
          console.error('[AdminSellerAnalytics] Error loading seller:', error);
          setSeller(null);
          return;
        }

        setSeller(sellerData);
      } catch (err) {
        console.error('[AdminSellerAnalytics] Error loading seller:', err);
        setSeller(null);
      } finally {
        setSellerLoading(false);
      }
    };

    loadSeller();
  }, [sellerId]);

  useEffect(() => {
    const loadAnalytics = async () => {
      if (!seller) return;

      setLoading(true);
      try {
        const data = await getAnalyticsData(
          seller.seller_id_public,
          periodFilter === 'custom' ? 'custom' : periodFilter,
          enableComparison,
          periodFilter === 'custom' ? customDateRange : undefined
        );
        setAnalyticsData(data);
      } catch (error) {
        console.error('[AdminSellerAnalytics] Error loading analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAnalytics();
  }, [seller, periodFilter, customDateRange, enableComparison]);

  const [comparisonChartData, setComparisonChartData] = useState<any[]>([]);
  const [comparisonCommissionData, setComparisonCommissionData] = useState<any[]>([]);
  const [loadingComparison, setLoadingComparison] = useState(false);

  useEffect(() => {
    const loadComparisonData = async () => {
      if (!seller || !enableComparison || !analyticsData) {
        setComparisonChartData([]);
        setComparisonCommissionData([]);
        setLoadingComparison(false);
        return;
      }

      setLoadingComparison(true);
      try {
        const previousPeriod = getPreviousPeriod(analyticsData.period.start, analyticsData.period.end);
        const [prevData, prevCommissionData] = await Promise.all([
          getSellerChartData(seller.seller_id_public, previousPeriod, granularity),
          getCommissionChartData(seller.seller_id_public, previousPeriod, granularity),
        ]);
        setComparisonChartData(prevData);
        setComparisonCommissionData(prevCommissionData);
      } catch (error) {
        console.error('[AdminSellerAnalytics] Error loading comparison data:', error);
        setComparisonChartData([]);
        setComparisonCommissionData([]);
      } finally {
        setLoadingComparison(false);
      }
    };

    loadComparisonData();
  }, [seller, enableComparison, analyticsData, granularity]);

  const periodLabel = periodFilter === 'thismonth' ? 'This Month' :
    periodFilter === 'lastmonth' ? 'Last Month' :
      periodFilter === 'last7days' ? 'Last 7 Days' :
        periodFilter === 'last30days' ? 'Last 30 Days' :
          periodFilter === 'last3months' ? 'Last 3 Months' :
            periodFilter === 'last6months' ? 'Last 6 Months' :
              periodFilter === 'lastyear' ? 'Last Year' :
                periodFilter === 'all_time' ? 'All Time' :
                  periodFilter === 'custom' ? `${customDateRange.start} to ${customDateRange.end}` : 'Period';

  const previousSummary: PreviousSummary | null = analyticsData?.comparison?.previousSummary
    ? {
        totalRevenue: analyticsData.comparison.previousSummary.totalRevenue ?? 0,
        soldContracts: analyticsData.comparison.previousSummary.soldContracts ?? 0,
        completedOrders: analyticsData.comparison.previousSummary.completedOrders ?? 0,
        commissions: analyticsData.comparison.previousSummary.commissions ?? 0,
      }
    : null;

  const previousCommissionRate = previousSummary && analyticsData?.commissionSummary
    ? (previousSummary.commissions / (previousSummary.totalRevenue || 1)) * 100
    : undefined;

  if (sellerLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-medium mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading seller data...</p>
        </div>
      </div>
    );
  }

  if (!seller) {
    return (
      <div className={`${isModal ? '' : 'min-h-screen bg-black'} flex items-center justify-center p-8`}>
        <div className="text-center">
          <p className="text-gray-400 text-lg">Seller not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className={isModal ? "" : "min-h-screen bg-gradient-to-b from-black via-[#1a1a1a] to-black p-4 sm:p-6 lg:p-8"}>
      <div className={isModal ? "" : "max-w-7xl mx-auto space-y-6"}>
        {/* Admin Header — seller info + link to orders */}
        {!isModal && (
          <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="mb-2 min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-bold migma-gold-text flex items-center gap-2 truncate">
                <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
                <span className="truncate">Analytics - {seller.full_name || seller.email}</span>
              </h1>
              <p className="text-gray-400 text-[10px] sm:text-xs mt-1 truncate">
                ID: {seller.seller_id_public} | Performance de vendas e comissões
              </p>
            </div>
            <Link to={`/dashboard/sellers/${seller.seller_id_public}/orders`} className="w-full sm:w-auto">
              <Button variant="outline" className="w-full sm:w-auto bg-black border-gold-medium/50 text-gold-light hover:bg-gold-medium/10 h-9 text-xs">
                <ShoppingCart className="w-4 h-4 mr-2" />
                Ver Pedidos
              </Button>
            </Link>
          </div>
        )}

        <SellerAnalyticsContent
          analyticsData={analyticsData}
          loading={loading}
          loadingComparison={loadingComparison}
          enableComparison={enableComparison}
          setEnableComparison={setEnableComparison}
          periodFilter={periodFilter}
          setPeriodFilter={setPeriodFilter}
          customDateRange={customDateRange}
          setCustomDateRange={setCustomDateRange}
          granularity={granularity}
          setGranularity={setGranularity}
          comparisonChartData={comparisonChartData}
          comparisonCommissionData={comparisonCommissionData}
          periodLabel={periodLabel}
          previousSummary={previousSummary}
          previousCommissionRate={previousCommissionRate}
        />
      </div>
    </div>
  );
}
