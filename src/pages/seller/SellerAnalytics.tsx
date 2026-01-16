import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { PeriodFilter, type PeriodOption, type CustomDateRange } from '@/components/seller/PeriodFilter';
import { RevenueChart } from '@/components/seller/RevenueChart';
import { ContractsChart } from '@/components/seller/ContractsChart';
import { ProductMetricsChart } from '@/components/seller/ProductMetricsChart';
import { CommissionChart } from '@/components/seller/CommissionChart';
import { CommissionByProductChart } from '@/components/seller/CommissionByProductChart';
import { CommissionConversionCard } from '@/components/seller/CommissionConversionCard';
import { ComparisonCard } from '@/components/seller/ComparisonCard';
import { ExportButton } from '@/components/seller/ExportButton';
import { getAnalyticsData, getPreviousPeriod, getCommissionChartData } from '@/lib/seller-analytics';
import type { AnalyticsData } from '@/lib/seller-analytics';
import { useSellerStats } from '@/hooks/useSellerStats';
import { ShoppingCart, CheckCircle, DollarSign, BarChart3, Coins, Wallet } from 'lucide-react';

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
    // Default: últimos 30 dias
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

  // Use shared hook for commission stats
  const { balance } = useSellerStats(seller?.seller_id_public);

  useEffect(() => {
    const loadAnalytics = async () => {
      if (!seller) return;

      setLoading(true);
      try {
        // Se for período customizado, passar as datas customizadas
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

  // Buscar dados de comparação separadamente para gráficos
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
          (await import('@/lib/seller-analytics')).getSellerChartData(seller.seller_id_public, previousPeriod, granularity),
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
      periodFilter === 'last7days' ? 'Last 7 Days' :
        periodFilter === 'last30days' ? 'Last 30 Days' :
          periodFilter === 'last3months' ? 'Last 3 Months' :
            periodFilter === 'last6months' ? 'Last 6 Months' :
              periodFilter === 'lastyear' ? 'Last Year' :
                periodFilter === 'custom' ? `${customDateRange.start} to ${customDateRange.end}` : 'Period';

  // Calcular valores do período anterior para comparação
  const previousSummary = analyticsData?.comparison ? {
    revenue: analyticsData.summary.totalRevenue - (analyticsData.summary.totalRevenue * analyticsData.comparison.revenueChange / 100),
    sales: analyticsData.summary.totalSales - Math.round((analyticsData.summary.totalSales * analyticsData.comparison.salesChange / 100)),
    soldContracts: analyticsData.summary.soldContracts - Math.round((analyticsData.summary.soldContracts * analyticsData.comparison.salesChange / 100)),
    completedOrders: analyticsData.summary.completedOrders - Math.round((analyticsData.summary.completedOrders * analyticsData.comparison.completedOrdersChange / 100)),
    commissions: analyticsData.commissionSummary?.totalCommissions
      ? analyticsData.commissionSummary.totalCommissions - (analyticsData.commissionSummary.totalCommissions * analyticsData.comparison.commissionChange / 100)
      : 0,
  } : null;

  // Calculate previous commission rate
  const previousCommissionRate = previousSummary && analyticsData?.commissionSummary
    ? (previousSummary.commissions / (previousSummary.revenue || 1)) * 100
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

        {analyticsData && (
          <div className="w-full md:w-auto">
            <ExportButton data={analyticsData} periodLabel={periodLabel} />
          </div>
        )}
      </div>

      {/* Filters */}
      <Card className="bg-zinc-950 border border-zinc-900">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-6">
            <div className="flex-1">
              <PeriodFilter
                value={periodFilter}
                onChange={setPeriodFilter}
                showLabel={true}
                customDateRange={customDateRange}
                onCustomDateRangeChange={setCustomDateRange}
              />
            </div>

            <div className="h-px lg:h-8 lg:w-px bg-zinc-900" />

            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-3">
                <Label htmlFor="granularity" className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">
                  Grouping
                </Label>
                <Select
                  value={granularity}
                  onValueChange={(value) => setGranularity(value as 'day' | 'week' | 'month')}
                >
                  <SelectTrigger
                    id="granularity"
                    className="w-32 h-9 bg-zinc-900/50 border-zinc-800 text-white text-xs focus:ring-gold-medium/20 focus:border-gold-medium"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-950 border-zinc-800 text-white">
                    <SelectItem value="day">Daily</SelectItem>
                    <SelectItem value="week">Weekly</SelectItem>
                    <SelectItem value="month">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-3 bg-zinc-900/30 px-3 py-2 rounded-lg border border-zinc-900">
                <Checkbox
                  id="comparison"
                  checked={enableComparison}
                  onCheckedChange={(checked) => setEnableComparison(checked === true)}
                  className="h-4 w-4 border-zinc-700 data-[state=checked]:bg-gold-medium data-[state=checked]:border-gold-medium"
                />
                <Label htmlFor="comparison" className="text-zinc-400 text-xs font-medium cursor-pointer select-none">
                  Previous Period Comparison
                </Label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {!analyticsData ? (
          <div className="col-span-full text-center py-12 text-zinc-500 bg-zinc-950 border border-zinc-900 rounded-xl">
            <p>Unable to load analytics data</p>
          </div>
        ) : previousSummary ? (
          <>
            <ComparisonCard
              title="Total Revenue"
              currentValue={analyticsData.summary.totalRevenue}
              previousValue={previousSummary.revenue}
              formatValue={(v) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              icon={<DollarSign className="w-5 h-5 text-gold-medium" />}
            />
            <ComparisonCard
              title="Sold Contracts"
              currentValue={analyticsData.summary.soldContracts}
              previousValue={previousSummary.soldContracts}
              formatValue={(v) => Math.round(v).toLocaleString('en-US')}
              icon={<ShoppingCart className="w-5 h-5 text-gold-medium" />}
            />
            <ComparisonCard
              title="Completed Orders"
              currentValue={analyticsData.summary.completedOrders}
              previousValue={previousSummary.completedOrders}
              formatValue={(v) => Math.round(v).toLocaleString('en-US')}
              icon={<CheckCircle className="w-5 h-5 text-green-500" />}
            />
            {analyticsData.commissionSummary && (
              <>
                <ComparisonCard
                  title="Total Commissions"
                  currentValue={analyticsData.commissionSummary.totalCommissions}
                  previousValue={previousSummary.commissions}
                  formatValue={(v) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  icon={<Coins className="w-5 h-5 text-gold-medium" />}
                />
                <ComparisonCard
                  title="Available Balance"
                  currentValue={balance.available_balance}
                  previousValue={0}
                  formatValue={(v) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  icon={<Wallet className="w-5 h-5 text-gold-medium" />}
                />
                <CommissionConversionCard
                  currentRate={analyticsData.commissionSummary.commissionRate}
                  previousRate={previousCommissionRate}
                  currentRevenue={analyticsData.summary.totalRevenue}
                  currentCommissions={analyticsData.commissionSummary.totalCommissions}
                />
              </>
            )}
          </>
        ) : (
          <>
            {/* Simple View Cards when comparison is off */}
            {[
              { label: "Total Revenue", value: `$${analyticsData.summary.totalRevenue.toFixed(2)}`, icon: <DollarSign className="w-5 h-5 text-gold-medium" /> },
              { label: "Sold Contracts", value: Math.round(analyticsData.summary.soldContracts).toLocaleString(), icon: <ShoppingCart className="w-5 h-5 text-gold-medium" /> },
              { label: "Completed Orders", value: Math.round(analyticsData.summary.completedOrders).toLocaleString(), icon: <CheckCircle className="w-5 h-5 text-green-500" /> }
            ].map((stat, i) => (
              <Card key={i} className="bg-zinc-950 border border-zinc-900">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{stat.label}</p>
                      <p className="text-2xl font-bold text-white">{stat.value}</p>
                    </div>
                    <div className="p-2 bg-zinc-900 rounded-lg">{stat.icon}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </>
        )}
      </div>

      {/* Charts Section */}
      <div className="space-y-6">
        {analyticsData && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-4 sm:p-6 overflow-hidden">
                {loadingComparison && enableComparison ? (
                  <div className="h-[350px] flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold-medium"></div></div>
                ) : (
                  <RevenueChart
                    data={analyticsData.chartData}
                    comparisonData={enableComparison ? comparisonChartData : undefined}
                    showComparison={enableComparison}
                  />
                )}
              </div>
              <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-4 sm:p-6 overflow-hidden">
                <ContractsChart data={analyticsData.chartData} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-4 sm:p-6 overflow-hidden">
                {loadingComparison && enableComparison ? (
                  <div className="h-[350px] flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold-medium"></div></div>
                ) : (
                  <CommissionChart
                    data={analyticsData.chartData}
                    comparisonData={enableComparison ? comparisonCommissionData : undefined}
                    showComparison={enableComparison}
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-4 sm:p-6 overflow-hidden">
                <ProductMetricsChart data={analyticsData.productMetrics} chartType="bar" />
              </div>
              {analyticsData.commissionByProduct && analyticsData.commissionByProduct.length > 0 && (
                <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-4 sm:p-6 overflow-hidden">
                  <CommissionByProductChart data={analyticsData.commissionByProduct} />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

