import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { PeriodFilter, type PeriodOption, type CustomDateRange } from '@/components/seller/PeriodFilter';
import { RevenueChart } from '@/components/seller/RevenueChart';
import { ContractsChart } from '@/components/seller/ContractsChart';
import { ProductMetricsChart } from '@/components/seller/ProductMetricsChart';
import { CommissionChart } from '@/components/seller/CommissionChart';
import { CommissionByProductChart } from '@/components/seller/CommissionByProductChart';
import { CommissionConversionCard } from '@/components/seller/CommissionConversionCard';
import { ComparisonCard } from '@/components/seller/ComparisonCard';
import { ExportButton } from '@/components/seller/ExportButton';
import type { AnalyticsData } from '@/lib/seller-analytics';
import { formatCurrency } from '@/lib/utils';
import { ShoppingCart, CheckCircle, DollarSign, BarChart3, Coins } from 'lucide-react';

export interface PreviousSummary {
  totalRevenue: number;
  soldContracts: number;
  completedOrders: number;
  commissions: number;
}

interface SellerAnalyticsContentProps {
  analyticsData: AnalyticsData | null;
  loading: boolean;
  loadingComparison: boolean;
  enableComparison: boolean;
  setEnableComparison: (v: boolean) => void;
  periodFilter: PeriodOption;
  setPeriodFilter: (v: PeriodOption) => void;
  customDateRange: CustomDateRange;
  setCustomDateRange: (v: CustomDateRange) => void;
  granularity: 'day' | 'week' | 'month';
  setGranularity: (v: 'day' | 'week' | 'month') => void;
  comparisonChartData: any[];
  comparisonCommissionData: any[];
  periodLabel: string;
  previousSummary: PreviousSummary | null;
  previousCommissionRate: number | undefined;
}

export function SellerAnalyticsContent({
  analyticsData,
  loading,
  loadingComparison,
  enableComparison,
  setEnableComparison,
  periodFilter,
  setPeriodFilter,
  customDateRange,
  setCustomDateRange,
  granularity,
  setGranularity,
  comparisonChartData,
  comparisonCommissionData,
  periodLabel,
  previousSummary,
  previousCommissionRate,
}: SellerAnalyticsContentProps) {
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Export Button */}
      {analyticsData && (
        <div className="w-full sm:w-auto">
          <ExportButton data={analyticsData} periodLabel={periodLabel} />
        </div>
      )}

      {/* Compact Filter Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 p-3 bg-black/20 rounded-xl border border-gold-medium/10">
        <div className="flex-1 min-w-0">
          <PeriodFilter
            value={periodFilter}
            onChange={setPeriodFilter}
            showLabel={true}
            locale="en"
            customDateRange={customDateRange}
            onCustomDateRangeChange={setCustomDateRange}
          />
        </div>

        <div className="flex flex-wrap items-center gap-4 pt-3 lg:pt-0 lg:border-l lg:border-gold-medium/20 lg:pl-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="analytics-granularity" className="text-gray-400 text-[10px] uppercase font-bold tracking-tight whitespace-nowrap">
              Group by:
            </Label>
            <Select
              value={granularity}
              onValueChange={(value) => setGranularity(value as 'day' | 'week' | 'month')}
            >
              <SelectTrigger
                id="analytics-granularity"
                className="w-[90px] h-8 bg-black/40 border-gold-medium/20 text-white text-xs hover:bg-black/60"
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

          <div className="flex items-center gap-2 bg-black/40 px-3 h-8 rounded-lg border border-gold-medium/20">
            <Checkbox
              id="analytics-comparison"
              checked={enableComparison}
              onCheckedChange={(checked) => setEnableComparison(checked === true)}
              className="h-3.5 w-3.5 border-gold-medium/50 data-[state=checked]:bg-gold-medium data-[state=checked]:text-black"
            />
            <Label htmlFor="analytics-comparison" className="text-gray-400 text-[10px] uppercase font-bold tracking-tight cursor-pointer whitespace-nowrap">
              Compare
            </Label>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="mb-6 sm:mb-8">
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] gap-3 sm:gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-[140px] sm:h-[146px]" />
              ))}
            </div>
            <Skeleton className="h-[150px] sm:h-[180px] lg:h-full lg:min-h-[296px]" />
          </div>
        ) : !analyticsData ? (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg">Error loading analytics data</p>
          </div>
        ) : previousSummary ? (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] gap-3 sm:gap-4 items-stretch">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <ComparisonCard
                title="Sold Contracts"
                currentValue={analyticsData.summary.soldContracts}
                previousValue={previousSummary.soldContracts}
                formatValue={(v) => Math.round(v).toLocaleString('en-US')}
                icon={<ShoppingCart className="w-5 h-5 text-gold-light" />}
              />
              <ComparisonCard
                title="Completed Orders"
                currentValue={analyticsData.summary.completedOrders}
                previousValue={previousSummary.completedOrders}
                formatValue={(v) => Math.round(v).toLocaleString('en-US')}
                icon={<CheckCircle className="w-5 h-5 text-green-400" />}
              />
              <ComparisonCard
                title="Commission Rate"
                currentValue={analyticsData.commissionSummary?.commissionRate ?? 0}
                previousValue={previousCommissionRate ?? 0}
                formatValue={(v) => `${v.toFixed(2)}%`}
                icon={<BarChart3 className="w-5 h-5 text-gold-light" />}
              />
              <ComparisonCard
                title="Total Commissions"
                currentValue={analyticsData.commissionSummary?.totalCommissions ?? 0}
                previousValue={previousSummary.commissions}
                formatValue={(v) => formatCurrency(v)}
                icon={<Coins className="w-5 h-5 text-gold-light" />}
              />
            </div>
            <ComparisonCard
              title="Total Revenue"
              currentValue={analyticsData.summary.totalRevenue}
              previousValue={previousSummary.totalRevenue}
              formatValue={(v) => formatCurrency(v)}
              icon={<DollarSign className="w-5 h-5 text-gold-light" />}
              className="h-full"
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] gap-3 sm:gap-4 items-stretch">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30 overflow-hidden group">
                <CardContent className="p-3 sm:p-5 lg:p-6">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[9px] sm:text-sm text-gray-400 uppercase font-black tracking-widest mb-1">Sold Contracts</p>
                      <p className="text-base sm:text-3xl font-black text-white truncate">{Math.round(analyticsData.summary.soldContracts).toLocaleString('en-US')}</p>
                    </div>
                    <ShoppingCart className="w-4 h-4 sm:w-8 sm:h-8 text-gold-light shrink-0 opacity-40 group-hover:opacity-60 transition-opacity" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-green-500/10 via-green-500/5 to-green-500/10 border border-green-500/30 overflow-hidden group">
                <CardContent className="p-3 sm:p-5 lg:p-6">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[9px] sm:text-sm text-gray-400 uppercase font-black tracking-widest mb-1">Completed Orders</p>
                      <p className="text-base sm:text-3xl font-black text-green-300 truncate">{Math.round(analyticsData.summary.completedOrders).toLocaleString('en-US')}</p>
                    </div>
                    <CheckCircle className="w-4 h-4 sm:w-8 sm:h-8 text-green-400 shrink-0 opacity-40 group-hover:opacity-60 transition-opacity" />
                  </div>
                </CardContent>
              </Card>
              <CommissionConversionCard
                title="Commission Rate"
                currentRate={analyticsData.commissionSummary?.commissionRate ?? 0}
                previousRate={previousCommissionRate}
                currentRevenue={analyticsData.summary.totalRevenue}
                currentCommissions={analyticsData.commissionSummary?.totalCommissions ?? 0}
              />
              <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30 overflow-hidden group">
                <CardContent className="p-3 sm:p-5 lg:p-6">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[9px] sm:text-sm text-gray-400 uppercase font-black tracking-widest mb-1">Total Commissions</p>
                      <p className="text-base sm:text-2xl font-black text-gold-light truncate">
                        {formatCurrency(analyticsData.commissionSummary?.totalCommissions ?? 0)}
                      </p>
                    </div>
                    <Coins className="w-4 h-4 sm:w-8 sm:h-8 text-gold-light shrink-0 opacity-40 group-hover:opacity-60 transition-opacity" />
                  </div>
                </CardContent>
              </Card>
            </div>
            <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30 h-full">
              <CardContent className="p-4 sm:p-6 h-full flex flex-col justify-center">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-sm text-gray-400 uppercase font-black tracking-widest mb-2">Total Revenue</p>
                    <p className="text-2xl sm:text-4xl font-black text-gold-light truncate">
                      {formatCurrency(analyticsData.summary.totalRevenue)}
                    </p>
                  </div>
                  <DollarSign className="w-6 h-6 sm:w-10 sm:h-10 text-gold-light shrink-0 opacity-40" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Charts */}
      <div className="space-y-4 sm:space-y-6">
        {loading ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
              <Skeleton className="h-[300px] sm:h-[350px]" />
              <Skeleton className="h-[300px] sm:h-[350px]" />
            </div>
            <Skeleton className="h-[350px] sm:h-[400px]" />
          </>
        ) : !analyticsData ? (
          <div className="text-center py-8 sm:py-12">
            <p className="text-gray-400 text-base sm:text-lg">Error loading charts</p>
          </div>
        ) : (
          <>
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

            {loadingComparison && enableComparison ? (
              <Skeleton className="h-[350px]" />
            ) : (
              <CommissionChart
                data={analyticsData.chartData}
                comparisonData={enableComparison ? comparisonCommissionData : undefined}
                showComparison={enableComparison}
              />
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
              <ProductMetricsChart data={analyticsData.productMetrics} chartType="bar" />
              {analyticsData.commissionByProduct && analyticsData.commissionByProduct.length > 0 && (
                <CommissionByProductChart data={analyticsData.commissionByProduct} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
