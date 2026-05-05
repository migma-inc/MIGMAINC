import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { SellerAnalyticsContent, type PreviousSummary } from '@/components/seller/SellerAnalyticsContent';
import type { PeriodOption, CustomDateRange } from '@/components/seller/PeriodFilter';
import { getAnalyticsData, getPreviousPeriod, getCommissionChartData, getSellerChartData } from '@/lib/seller-analytics';
import type { AnalyticsData } from '@/lib/seller-analytics';
import { BarChart3 } from 'lucide-react';

interface SellerInfo {
  id: string;
  seller_id_public: string;
  full_name: string;
  email: string;
  status: string;
}

export function SellerAnalytics() {
  const { seller } = useOutletContext<{ seller: SellerInfo }>();
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
        console.error('[SellerAnalytics] Error loading analytics:', error);
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
        console.error('[SellerAnalytics] Error loading comparison data:', error);
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
      periodFilter === 'today' ? 'Today' :
        periodFilter === 'yesterday' ? 'Yesterday' :
          periodFilter === 'last7days' ? 'Last 7 Days' :
            periodFilter === 'last30days' ? 'Last 30 Days' :
              periodFilter === 'last3months' ? 'Last 3 Months' :
                periodFilter === 'last6months' ? 'Last 6 Months' :
                  periodFilter === 'lastyear' ? 'Last Year' :
                    periodFilter === 'all_time' ? 'All Time' :
                      periodFilter === 'custom' ? `${customDateRange.start} to ${customDateRange.end}` : 'Period';

  const previousSummary: PreviousSummary | null = analyticsData?.comparison ? {
    totalRevenue: analyticsData.summary.totalRevenue - (analyticsData.summary.totalRevenue * analyticsData.comparison.revenueChange / 100),
    soldContracts: analyticsData.summary.soldContracts - Math.round((analyticsData.summary.soldContracts * analyticsData.comparison.salesChange / 100)),
    completedOrders: analyticsData.summary.completedOrders - Math.round((analyticsData.summary.completedOrders * analyticsData.comparison.completedOrdersChange / 100)),
    commissions: analyticsData.commissionSummary?.totalCommissions
      ? analyticsData.commissionSummary.totalCommissions - (analyticsData.commissionSummary.totalCommissions * analyticsData.comparison.commissionChange / 100)
      : 0,
  } : null;

  const previousCommissionRate = previousSummary && analyticsData?.commissionSummary
    ? (previousSummary.commissions / (previousSummary.totalRevenue || 1)) * 100
    : undefined;

  if (loading && !analyticsData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-medium"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold migma-gold-text flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-gold-medium" />
            Analytics
          </h1>
          <p className="text-zinc-500 mt-1">Detailed performance metrics for your sales and commissions</p>
        </div>
      </div>

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
  );
}
