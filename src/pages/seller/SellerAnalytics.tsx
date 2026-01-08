import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { PeriodFilter, type PeriodOption } from '@/components/seller/PeriodFilter';
import { RevenueChart } from '@/components/seller/RevenueChart';
import { ContractsChart } from '@/components/seller/ContractsChart';
import { ProductMetricsChart } from '@/components/seller/ProductMetricsChart';
import { ComparisonCard } from '@/components/seller/ComparisonCard';
import { ExportButton } from '@/components/seller/ExportButton';
import { getAnalyticsData, getPreviousPeriod } from '@/lib/seller-analytics';
import type { AnalyticsData } from '@/lib/seller-analytics';
import { ShoppingCart, CheckCircle, DollarSign, BarChart3 } from 'lucide-react';

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
  const [granularity, setGranularity] = useState<'day' | 'week' | 'month'>('day');
  const [enableComparison, setEnableComparison] = useState(true);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAnalytics = async () => {
      if (!seller) return;

      setLoading(true);
      try {
        const data = await getAnalyticsData(seller.seller_id_public, periodFilter, enableComparison);
        setAnalyticsData(data);
      } catch (error) {
        console.error('[SellerAnalytics] Error loading analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAnalytics();
  }, [seller, periodFilter, enableComparison]);

  // Buscar dados de comparação separadamente para gráficos
  const [comparisonChartData, setComparisonChartData] = useState<any[]>([]);
  const [loadingComparison, setLoadingComparison] = useState(false);

  useEffect(() => {
    const loadComparisonData = async () => {
      if (!seller || !enableComparison || !analyticsData) {
        setComparisonChartData([]);
        setLoadingComparison(false);
        return;
      }

      setLoadingComparison(true);
      try {
        const previousPeriod = getPreviousPeriod(analyticsData.period.start, analyticsData.period.end);
        const { getSellerChartData } = await import('@/lib/seller-analytics');
        const prevData = await getSellerChartData(seller.seller_id_public, previousPeriod, granularity);
        setComparisonChartData(prevData);
      } catch (error) {
        console.error('[SellerAnalytics] Error loading comparison data:', error);
        setComparisonChartData([]);
      } finally {
        setLoadingComparison(false);
      }
    };

    loadComparisonData();
  }, [seller, enableComparison, analyticsData, granularity]);

  const periodLabel = periodFilter === 'thismonth' ? 'Este Mês' :
    periodFilter === 'lastmonth' ? 'Mês Passado' :
    periodFilter === 'last7days' ? 'Últimos 7 dias' :
    periodFilter === 'last30days' ? 'Últimos 30 dias' :
    periodFilter === 'last3months' ? 'Últimos 3 meses' :
    periodFilter === 'last6months' ? 'Últimos 6 meses' :
    periodFilter === 'lastyear' ? 'Último ano' : 'Período';

  // Calcular valores do período anterior para comparação
  const previousSummary = analyticsData?.comparison ? {
    revenue: analyticsData.summary.totalRevenue - (analyticsData.summary.totalRevenue * analyticsData.comparison.revenueChange / 100),
    sales: analyticsData.summary.totalSales - Math.round((analyticsData.summary.totalSales * analyticsData.comparison.salesChange / 100)),
    completedOrders: analyticsData.summary.completedOrders - Math.round((analyticsData.summary.completedOrders * analyticsData.comparison.completedOrdersChange / 100)),
  } : null;

  return (
    <div>
      {/* Header Simplificado */}
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col gap-4 mb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold migma-gold-text flex items-center gap-2">
              <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6" />
              Analytics
            </h1>
            <p className="text-gray-400 text-xs sm:text-sm mt-1">Performance de vendas</p>
          </div>
          {analyticsData && (
            <div className="w-full sm:w-auto">
              <ExportButton data={analyticsData} periodLabel={periodLabel} />
            </div>
          )}
        </div>

        {/* Filtros Compactos */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 sm:gap-3 p-3 bg-black/20 rounded-lg border border-gold-medium/10">
          <PeriodFilter value={periodFilter} onChange={setPeriodFilter} showLabel={true} />
          
          <div className="flex items-center gap-2">
            <Label htmlFor="granularity" className="text-gray-400 text-xs whitespace-nowrap">
              Agrupar:
            </Label>
            <Select
              value={granularity}
              onValueChange={(value) => setGranularity(value as 'day' | 'week' | 'month')}
            >
              <SelectTrigger 
                id="granularity"
                className="flex-1 sm:w-[100px] h-8 bg-black/50 border-gold-medium/30 text-white text-xs hover:bg-black/70"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Diária</SelectItem>
                <SelectItem value="week">Semanal</SelectItem>
                <SelectItem value="month">Mensal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="comparison"
              checked={enableComparison}
              onCheckedChange={(checked) => setEnableComparison(checked === true)}
              className="h-4 w-4 shrink-0"
            />
            <Label htmlFor="comparison" className="text-gray-400 text-xs cursor-pointer">
              Comparar período anterior
            </Label>
          </div>
        </div>
      </div>

      {/* Resumo Executivo com Comparação */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {loading ? (
          // Skeletons apenas nos cards
          <>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </>
        ) : !analyticsData ? (
          // Erro
          <div className="col-span-3 text-center py-12">
            <p className="text-gray-400 text-lg">Erro ao carregar dados de analytics</p>
          </div>
        ) : previousSummary ? (
          <>
            <ComparisonCard
              title="Total Revenue"
              currentValue={analyticsData.summary.totalRevenue}
              previousValue={previousSummary.revenue}
              formatValue={(v) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              icon={<DollarSign className="w-5 h-5 text-gold-light" />}
            />
            <ComparisonCard
              title="Total Sales"
              currentValue={analyticsData.summary.totalSales}
              previousValue={previousSummary.sales}
              icon={<ShoppingCart className="w-5 h-5 text-gold-light" />}
            />
            <ComparisonCard
              title="Completed Orders"
              currentValue={analyticsData.summary.completedOrders}
              previousValue={previousSummary.completedOrders}
              icon={<CheckCircle className="w-5 h-5 text-green-400" />}
            />
          </>
        ) : (
          <>
            <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-gray-400">Total Revenue</p>
                    <p className="text-xl sm:text-2xl font-bold text-gold-light">
                      ${analyticsData.summary.totalRevenue.toFixed(2)}
                    </p>
                  </div>
                  <DollarSign className="w-8 h-8 sm:w-10 sm:h-10 text-gold-light shrink-0" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-gray-400">Total Sales</p>
                    <p className="text-2xl sm:text-3xl font-bold text-white">{analyticsData.summary.totalSales}</p>
                  </div>
                  <ShoppingCart className="w-8 h-8 sm:w-10 sm:h-10 text-gold-light shrink-0" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-green-500/10 via-green-500/5 to-green-500/10 border border-green-500/30">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-gray-400">Completed Orders</p>
                    <p className="text-2xl sm:text-3xl font-bold text-green-300">{analyticsData.summary.completedOrders}</p>
                  </div>
                  <CheckCircle className="w-8 h-8 sm:w-10 sm:h-10 text-green-400 shrink-0" />
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Gráficos Principais - Layout Simplificado */}
      <div className="space-y-4 sm:space-y-6">
        {loading ? (
          // Skeletons apenas nos gráficos
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
              <Skeleton className="h-[300px] sm:h-[350px]" />
              <Skeleton className="h-[300px] sm:h-[350px]" />
            </div>
            <Skeleton className="h-[350px] sm:h-[400px]" />
          </>
        ) : !analyticsData ? (
          // Erro
          <div className="text-center py-8 sm:py-12">
            <p className="text-gray-400 text-base sm:text-lg">Erro ao carregar gráficos</p>
          </div>
        ) : (
          <>
            {/* Primeira Linha: Receita e Contratos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
              {loadingComparison && enableComparison ? (
                <Skeleton className="h-[350px]" />
              ) : (
                <RevenueChart 
                  data={analyticsData.chartData} 
                  comparisonData={enableComparison ? comparisonChartData : undefined}
                  showComparison={enableComparison}
                />
              )}
              <ContractsChart data={analyticsData.chartData} />
            </div>

            {/* Segunda Linha: Produtos (Full Width) */}
            <ProductMetricsChart data={analyticsData.productMetrics} chartType="bar" />
          </>
        )}
      </div>
    </div>
  );
}

