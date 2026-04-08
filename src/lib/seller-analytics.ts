import { supabase } from './supabase';
import { calculateNetAmount } from './seller-commissions';

export interface ChartDataPoint {
  date: string;
  revenue: number;
  contracts: number;
  commission: number;
}

export interface ProductMetric {
  productSlug: string;
  productName: string;
  sales: number;
  revenue: number;
  avgRevenue: number;
  percentage: number;
}

export interface PeriodSummary {
  totalRevenue: number;
  totalSales: number;
  soldContracts: number;
  completedOrders: number;
  commissions: number;
}

export interface PeriodComparison {
  previousPeriod: { start: Date; end: Date };
  previousSummary: PeriodSummary;
  revenueChange: number; // %
  salesChange: number; // %
  completedOrdersChange: number; // %
  commissionChange: number; // %
  previousChartData?: ChartDataPoint[];
  previousCommissionChartData?: ChartDataPoint[];
}

export interface TrendsData {
  direction: 'up' | 'down' | 'stable';
  growthRate: number; // %
  projection: {
    nextMonth: number;
    nextQuarter: number;
  };
}

export interface CommissionSummary {
  totalCommissions: number;
  availableCommissions: number;
  pendingCommissions: number;
  paidCommissions: number;
  commissionRate: number; // Average commission rate (%)
}

export interface CommissionByProduct {
  productSlug: string;
  productName: string;
  totalCommissions: number;
  sales: number;
  avgCommission: number;
  percentage: number;
}

export interface AnalyticsData {
  period: { start: Date; end: Date };
  summary: {
    totalRevenue: number;
    totalSales: number;
    soldContracts: number;
    completedOrders: number;
    pendingOrders: number;
    commission: number;
  };
  commissionSummary?: CommissionSummary;
  comparison?: PeriodComparison;
  chartData: ChartDataPoint[];
  productMetrics: ProductMetric[];
  commissionByProduct?: CommissionByProduct[];
  trends: TrendsData;
}

export interface TeamMemberPerformance {
  sellerId: string;
  name: string;
  sales: number;
  revenue: number;
  percentage: number;
}

export interface TeamMonthlyData {
  month: string;
  sales: number;
  revenue: number;
  sellers: { [sellerName: string]: number }; // Para gráfico empilhado
  sellerRevenues: { [sellerName: string]: number }; // Para gráfico de receita mensal agrupada
}

export interface WeeklyMetric {
  weekLabel: string;
  sales: number;
  revenue: number;
  sellers: { [sellerName: string]: number };
}

export interface TeamYearlyAnalytics {
  monthlyData: TeamMonthlyData[];
  sellerPerformance: TeamMemberPerformance[];
  productDistribution: ProductMetric[];
  productDistributionByMonth: { [monthIdx: number]: ProductMetric[] };
  totalSales: number;
  totalRevenue: number;
  avgSalesPerMonth: number;
  weeklyData: { [monthIdx: number]: WeeklyMetric[] };
  monthlyRankings: { [monthIdx: number]: TeamMemberPerformance[] };
}

export function getHeadOfSalesAnalyticsStartDate(
  year: number,
  headOfSalesStartedAt?: string | null
): Date {
  const yearStart = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));

  if (!headOfSalesStartedAt) {
    return yearStart;
  }

  const parsed = new Date(headOfSalesStartedAt);
  if (Number.isNaN(parsed.getTime())) {
    return yearStart;
  }

  const normalizedStart = new Date(
    Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate(), 0, 0, 0, 0)
  );

  return normalizedStart > yearStart ? normalizedStart : yearStart;
}

async function getCommissionNetAmountMap(orderIds: string[]): Promise<Map<string, number>> {
  const validOrderIds = [...new Set(orderIds.filter(Boolean))];

  if (validOrderIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('seller_commissions')
    .select('order_id, net_amount_usd')
    .in('order_id', validOrderIds);

  if (error) {
    console.error('[Analytics] Error fetching commission net amounts:', error);
    return new Map();
  }

  return new Map(
    (data || []).map((commission) => [
      commission.order_id,
      parseFloat(commission.net_amount_usd || '0'),
    ])
  );
}

function getOrderRevenueAmount(
  order: any,
  commissionNetAmountMap?: Map<string, number>
): number {
  const commissionBackedAmount = commissionNetAmountMap?.get(order.id);

  if (typeof commissionBackedAmount === 'number' && !Number.isNaN(commissionBackedAmount)) {
    return commissionBackedAmount;
  }

  return calculateNetAmount(order);
}

async function getOrderMetadataMap(
  orderIds: string[]
): Promise<Map<string, { created_at: string; paid_at: string | null; product_slug?: string | null }>> {
  const validOrderIds = [...new Set(orderIds.filter(Boolean))];

  if (validOrderIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('visa_orders')
    .select('id, created_at, paid_at, product_slug')
    .in('id', validOrderIds);

  if (error) {
    console.error('[Analytics] Error fetching order metadata:', error);
    return new Map();
  }

  return new Map(
    (data || []).map((order) => [
      order.id,
      {
        created_at: order.created_at,
        paid_at: order.paid_at,
        product_slug: order.product_slug,
      },
    ])
  );
}

export function getOrderEffectiveDate(order: { created_at: string; paid_at?: string | null }): Date {
  return new Date(order.paid_at ?? order.created_at);
}

function isOrderWithinPeriod(
  order: { created_at: string; paid_at?: string | null },
  period: { start: Date; end: Date }
): boolean {
  const effectiveDate = getOrderEffectiveDate(order);
  return effectiveDate >= period.start && effectiveDate <= period.end;
}


/**
 * Calcula a data de início e fim de um período baseado em uma opção pré-definida
 * @param period - Opção de período pré-definido ou objeto com datas customizadas
 * @param customRange - Opcional: objeto com start e end como strings ISO (YYYY-MM-DD)
 */
/**
 * Calcula a data de início e fim de um período baseado em uma opção pré-definida
 * @param period - Opção de período pré-definido ou objeto com datas customizadas
 * @param customRange - Opcional: objeto com start e end como strings ISO (YYYY-MM-DD)
 */
export function getPeriodDates(
  period: string | { start: string; end: string },
  customRange?: { start: string; end: string }
): { start: Date; end: Date } {
  // Se for um objeto, tratar como datas customizadas
  if (typeof period === 'object' && period.start && period.end) {
    const start = new Date(period.start);
    start.setHours(0, 0, 0, 0);
    const end = new Date(period.end);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  // Se for 'custom' e tiver customRange, usar as datas customizadas
  if (period === 'custom' && customRange) {
    const start = new Date(customRange.start);
    start.setHours(0, 0, 0, 0);
    const end = new Date(customRange.end);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  let start: Date;

  switch (period) {
    case 'today':
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
      break;
    case 'yesterday':
      start = new Date(now);
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
      break;
    case 'last7days':
      start = new Date(now);
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      break;
    case 'last30days':
      start = new Date(now);
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      break;
    case 'thismonth':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      start.setHours(0, 0, 0, 0);
      break;
    case 'lastmonth':
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(0); // Último dia do mês passado
      end.setHours(23, 59, 59, 999);
      break;
    case 'last3months':
      start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      start.setHours(0, 0, 0, 0);
      break;
    case 'last6months':
      start = new Date(now.getFullYear(), now.getMonth() - 6, 1);
      start.setHours(0, 0, 0, 0);
      break;
    case 'lastyear':
      start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      start.setHours(0, 0, 0, 0);
      break;
    case 'all_time':
      // Data arbitrária no passado (ex: início de 2024 ou da plataforma)
      start = new Date('2024-01-01');
      start.setHours(0, 0, 0, 0);
      break;
    case 'custom':
      // Se for custom mas não tiver customRange, usar último ano como padrão
      start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      start.setHours(0, 0, 0, 0);
      break;
    default:
      // Período padrão (este mês)
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      start.setHours(0, 0, 0, 0);
  }

  return { start, end };
}

/**
 * Calcula o período anterior equivalente
 * Agora suporta lógica inteligente de MTD (Month to Date)
 */
export function getPreviousPeriod(
  start: Date,
  end: Date,
  periodType?: string
): { start: Date; end: Date } {
  // Lógica Especial para MTD (Este Mês)
  // Compara os mesmos dias do mês anterior. Ex: 1-5 Fev vs 1-5 Jan
  if (periodType === 'thismonth') {
    const prevStart = new Date(start);
    prevStart.setMonth(prevStart.getMonth() - 1);

    // O fim deve ser o mesmo dia do mês, mas no mês anterior
    const prevEnd = new Date(end);
    prevEnd.setMonth(prevEnd.getMonth() - 1);

    // Ajuste para virada de ano
    if (start.getMonth() === 0) { // Janeiro
      prevStart.setFullYear(start.getFullYear() - 1);
      prevStart.setMonth(11); // Dezembro
    }
    if (end.getMonth() === 0) {
      prevEnd.setFullYear(end.getFullYear() - 1);
      prevEnd.setMonth(11);
    }

    return { start: prevStart, end: prevEnd };
  }

  // Lógica Especial para "Mês Passado"
  // Compara com o mês retrasado inteiro
  if (periodType === 'lastmonth') {
    const prevStart = new Date(start);
    prevStart.setMonth(prevStart.getMonth() - 1);

    const prevEnd = new Date(start); // Começo do mês passado
    prevEnd.setDate(0); // Último dia do mês retrasado
    prevEnd.setHours(23, 59, 59, 999);

    return { start: prevStart, end: prevEnd };
  }

  // Lógica Padrão (Subtrai Duração)
  const duration = end.getTime() - start.getTime();
  const prevEnd = new Date(start);
  prevEnd.setTime(prevEnd.getTime() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setTime(prevStart.getTime() - duration);

  return { start: prevStart, end: prevEnd };
}

/**
 * Agrega dados de vendas por período para gráficos
 */
export async function getSellerChartData(
  sellerId: string | null | undefined,
  period: { start: Date; end: Date },
  granularity: 'day' | 'week' | 'month' = 'day'
): Promise<ChartDataPoint[]> {
  try {
    let query = supabase
      .from('visa_orders')
      .select('*');

    if (sellerId) {
      query = query.eq('seller_id', sellerId);
    }

    // Expand range 60 days back to capture orders created before but paid within the period
    const expandedStart = new Date(period.start.getTime() - 60 * 24 * 60 * 60 * 1000);

    const { data: orders, error } = await query
      .gte('created_at', expandedStart.toISOString())
      .lte('created_at', period.end.toISOString())
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[Analytics] Error fetching orders:', error);
      return [];
    }

    if (!orders || orders.length === 0) {
      return [];
    }

    const commissionNetAmountMap = await getCommissionNetAmountMap(
      orders.map((order) => order.id)
    );

    const grouped = new Map<string, ChartDataPoint>();

    const sortedOrders = [...orders].sort((a, b) =>
      new Date(a.paid_at ?? a.created_at).getTime() - new Date(b.paid_at ?? b.created_at).getTime()
    );

    orders.forEach((order) => {
      // Use paid_at (actual payment date) if available, fall back to created_at
      const orderDate = new Date(order.paid_at ?? order.created_at);

      // Filter: only include orders whose effective date falls within the requested period
      if (orderDate < period.start || orderDate > period.end) return;

      let key: string;

      if (granularity === 'day') {
        key = orderDate.toISOString().split('T')[0]; // YYYY-MM-DD
      } else if (granularity === 'week') {
        const weekStart = new Date(orderDate);
        weekStart.setDate(orderDate.getDate() - orderDate.getDay());
        key = weekStart.toISOString().split('T')[0];
      } else {
        // month
        key = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
      }

      const existing = grouped.get(key) || {
        date: key,
        revenue: 0,
        contracts: 0,
        commission: 0,
      };

      const isCompleted = order.payment_status === 'completed' || order.payment_status === 'paid';
      const revenue = isCompleted ? getOrderRevenueAmount(order, commissionNetAmountMap) : 0;

      // FIX: Use isFirstPayment logic to count contracts consistent with summary
      // Only count as contract if completed AND is first payment
      const isContract = isCompleted && isFirstPayment(order, sortedOrders);

      existing.revenue += revenue;
      if (isContract) {
        existing.contracts += 1;
      }

      // Commission will be calculated from actual commission records
      existing.commission += 0; // Will be populated by getCommissionChartData

      grouped.set(key, existing);
    });

    // Converter para array e ordenar por data
    return Array.from(grouped.values()).sort((a, b) => a.date.localeCompare(b.date));
  } catch (error) {
    console.error('[Analytics] Error in getSellerChartData:', error);
    return [];
  }
}

/**
 * Calcula métricas por produto
 */
export async function getProductMetrics(
  sellerId: string | null | undefined,
  period: { start: Date; end: Date }
): Promise<ProductMetric[]> {
  try {
    let query = supabase
      .from('visa_orders')
      .select('*');

    if (sellerId) {
      query = query.eq('seller_id', sellerId);
    }

    // Expand range 60 days back to capture orders created before but paid within the period
    const expandedStart = new Date(period.start.getTime() - 60 * 24 * 60 * 60 * 1000);

    const { data: rawOrders, error } = await query
      .gte('created_at', expandedStart.toISOString())
      .lte('created_at', period.end.toISOString());

    if (error) {
      console.error('[Analytics] Error fetching orders for product metrics:', error);
      return [];
    }

    if (!rawOrders || rawOrders.length === 0) {
      return [];
    }

    // Filter by effective date (paid_at if available, otherwise created_at)
    const orders = rawOrders.filter((order) => {
      const effectiveDate = new Date(order.paid_at ?? order.created_at);
      return effectiveDate >= period.start && effectiveDate <= period.end;
    });

    if (orders.length === 0) return [];

    const commissionNetAmountMap = await getCommissionNetAmountMap(
      orders.map((order) => order.id)
    );

    // Buscar nomes dos produtos
    const productSlugs = [...new Set(orders.map(o => o.product_slug).filter(Boolean))];
    const { data: products } = await supabase
      .from('visa_products')
      .select('slug, name')
      .in('slug', productSlugs);

    const productMap = new Map(
      (products || []).map(p => [p.slug, p.name])
    );

    // Agrupar por produto
    const productStats = new Map<string, { sales: number; revenue: number }>();

    orders.forEach((order) => {
      const slug = order.product_slug || 'unknown';
      const existing = productStats.get(slug) || { sales: 0, revenue: 0 };

      const isCompleted = order.payment_status === 'completed' || order.payment_status === 'paid';
      const revenue = getOrderRevenueAmount(order, commissionNetAmountMap);

      if (isCompleted) {
        existing.sales += 1;
        existing.revenue += revenue;
      }

      productStats.set(slug, existing);
    });

    // Calcular total de receita para percentuais
    const totalRevenue = Array.from(productStats.values()).reduce((sum, stat) => sum + stat.revenue, 0);

    // Converter para array de ProductMetric
    const metrics: ProductMetric[] = Array.from(productStats.entries()).map(([slug, stats]) => ({
      productSlug: slug,
      productName: productMap.get(slug) || slug,
      sales: stats.sales,
      revenue: stats.revenue,
      avgRevenue: stats.sales > 0 ? stats.revenue / stats.sales : 0,
      percentage: totalRevenue > 0 ? (stats.revenue / totalRevenue) * 100 : 0,
    }));

    // Ordenar por receita (maior para menor)
    return metrics.sort((a, b) => b.revenue - a.revenue);
  } catch (error) {
    console.error('[Analytics] Error in getProductMetrics:', error);
    return [];
  }
}

/**
 * Calcula comparação entre período atual e anterior
 */
export async function getPeriodComparison(
  sellerId: string | null | undefined,
  currentPeriod: { start: Date; end: Date },
  previousPeriod: { start: Date; end: Date }
): Promise<PeriodComparison> {
  try {
    // Buscar dados do período atual
    let currentQuery = supabase
      .from('visa_orders')
      .select('*');

    if (sellerId) {
      currentQuery = currentQuery.eq('seller_id', sellerId);
    }

    const currentExpandedStart = new Date(currentPeriod.start.getTime() - 60 * 24 * 60 * 60 * 1000);
    const { data: rawCurrentOrders } = await currentQuery
      .gte('created_at', currentExpandedStart.toISOString())
      .lte('created_at', currentPeriod.end.toISOString());

    const currentOrders = (rawCurrentOrders || []).filter((o) => {
      const d = new Date(o.paid_at ?? o.created_at);
      return d >= currentPeriod.start && d <= currentPeriod.end;
    });

    // Buscar dados do período anterior
    let prevQuery = supabase
      .from('visa_orders')
      .select('*');

    if (sellerId) {
      prevQuery = prevQuery.eq('seller_id', sellerId);
    }

    const prevExpandedStart = new Date(previousPeriod.start.getTime() - 60 * 24 * 60 * 60 * 1000);
    const { data: rawPreviousOrders } = await prevQuery
      .gte('created_at', prevExpandedStart.toISOString())
      .lte('created_at', previousPeriod.end.toISOString());

    const previousOrders = (rawPreviousOrders || []).filter((o) => {
      const d = new Date(o.paid_at ?? o.created_at);
      return d >= previousPeriod.start && d <= previousPeriod.end;
    });

    const [currentCommissionNetAmountMap, previousCommissionNetAmountMap] = await Promise.all([
      getCommissionNetAmountMap(currentOrders.map((order) => order.id)),
      getCommissionNetAmountMap(previousOrders.map((order) => order.id)),
    ]);

    const currentStats = calculateStats(currentOrders, currentCommissionNetAmountMap);
    const previousStats = calculateStats(previousOrders, previousCommissionNetAmountMap);

    // Get commission summaries for both periods
    const [currentCommissionSummary, previousCommissionSummary] = await Promise.all([
      getCommissionSummary(sellerId, currentPeriod),
      getCommissionSummary(sellerId, previousPeriod),
    ]);

    return {
      previousPeriod,
      previousSummary: {
        totalRevenue: previousStats.totalRevenue,
        totalSales: previousStats.totalSales,
        soldContracts: previousStats.soldContracts,
        completedOrders: previousStats.completedOrders,
        commissions: previousCommissionSummary.totalCommissions,
      },
      revenueChange: calculatePercentageChange(currentStats.totalRevenue, previousStats.totalRevenue),
      salesChange: calculatePercentageChange(currentStats.soldContracts, previousStats.soldContracts),
      completedOrdersChange: calculatePercentageChange(currentStats.completedOrders, previousStats.completedOrders),
      commissionChange: calculatePercentageChange(
        currentCommissionSummary.totalCommissions,
        previousCommissionSummary.totalCommissions
      ),
    };
  } catch (error) {
    console.error('[Analytics] Error in getPeriodComparison:', error);
    return {
      previousPeriod,
      revenueChange: 0,
      salesChange: 0,
      completedOrdersChange: 0,
      commissionChange: 0,
      previousSummary: {
        totalRevenue: 0,
        totalSales: 0,
        soldContracts: 0,
        completedOrders: 0,
        commissions: 0,
      }
    };
  }
}

/**
 * Calcula tendências e projeções
 */
export async function getTrends(
  sellerId: string | null | undefined,
  period: { start: Date; end: Date }
): Promise<TrendsData> {
  try {
    // Buscar dados históricos dos últimos 3 meses para calcular tendência
    const historicalStart = new Date(period.start);
    historicalStart.setMonth(historicalStart.getMonth() - 3);

    let query = supabase
      .from('visa_orders')
      .select('id, created_at, paid_at, total_price_usd, payment_status, payment_metadata');

    if (sellerId) {
      query = query.eq('seller_id', sellerId);
    }

    const { data: orders } = await query
      .gte('created_at', historicalStart.toISOString())
      .lte('created_at', period.end.toISOString())
      .order('created_at', { ascending: true });

    if (!orders || orders.length === 0) {
      return {
        direction: 'stable',
        growthRate: 0,
        projection: { nextMonth: 0, nextQuarter: 0 },
      };
    }

    const commissionNetAmountMap = await getCommissionNetAmountMap(
      orders.map((order) => order.id)
    );

    // Agrupar receita por mês usando paid_at (data efetiva de pagamento)
    const monthlyRevenue = new Map<string, number>();
    orders.forEach((order) => {
      if (order.payment_status === 'completed' || order.payment_status === 'paid') {
        const date = new Date(order.paid_at ?? order.created_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const revenue = getOrderRevenueAmount(order, commissionNetAmountMap);
        monthlyRevenue.set(monthKey, (monthlyRevenue.get(monthKey) || 0) + revenue);
      }
    });

    const months = Array.from(monthlyRevenue.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([_, revenue]) => revenue);

    if (months.length < 2) {
      return {
        direction: 'stable',
        growthRate: 0,
        projection: { nextMonth: months[0] || 0, nextQuarter: (months[0] || 0) * 3 },
      };
    }

    // Calcular taxa de crescimento média
    const growthRates: number[] = [];
    for (let i = 1; i < months.length; i++) {
      if (months[i - 1] > 0) {
        const growth = ((months[i] - months[i - 1]) / months[i - 1]) * 100;
        growthRates.push(growth);
      }
    }

    const avgGrowthRate = growthRates.length > 0
      ? growthRates.reduce((sum, rate) => sum + rate, 0) / growthRates.length
      : 0;

    const lastMonthRevenue = months[months.length - 1];
    const direction: 'up' | 'down' | 'stable' = avgGrowthRate > 5 ? 'up' : avgGrowthRate < -5 ? 'down' : 'stable';

    // Projeção: assumir crescimento linear baseado na taxa média
    const nextMonth = lastMonthRevenue * (1 + avgGrowthRate / 100);
    const nextQuarter = nextMonth * 3;

    return {
      direction,
      growthRate: avgGrowthRate,
      projection: {
        nextMonth: Math.max(0, nextMonth),
        nextQuarter: Math.max(0, nextQuarter),
      },
    };
  } catch (error) {
    console.error('[Analytics] Error in getTrends:', error);
    return {
      direction: 'stable',
      growthRate: 0,
      projection: { nextMonth: 0, nextQuarter: 0 },
    };
  }
}

/**
 * Busca todos os dados de analytics de uma vez
 */
export async function getAnalyticsData(
  sellerId: string | null | undefined,
  periodOption: string | { start: string; end: string },
  enableComparison: boolean = false,
  customRange?: { start: string; end: string },
  granularity: 'day' | 'week' | 'month' = 'day'
): Promise<AnalyticsData> {
  const period = typeof periodOption === 'string'
    ? getPeriodDates(periodOption, customRange)
    : getPeriodDates(periodOption, customRange);

  // Buscar pedidos do período
  let query = supabase
    .from('visa_orders')
    .select('*');

  if (sellerId) {
    query = query.eq('seller_id', sellerId);
  }

  const analyticsExpandedStart = new Date(period.start.getTime() - 60 * 24 * 60 * 60 * 1000);
  const { data: rawAnalyticsOrders } = await query
    .gte('created_at', analyticsExpandedStart.toISOString())
    .lte('created_at', period.end.toISOString());

  const orders = (rawAnalyticsOrders || []).filter((o) => {
    const d = new Date(o.paid_at ?? o.created_at);
    return d >= period.start && d <= period.end;
  });

  const commissionNetAmountMap = await getCommissionNetAmountMap(
    orders.map((order) => order.id)
  );

  const summary = calculateStats(orders, commissionNetAmountMap);

  const periodType = typeof periodOption === 'string' ? periodOption : 'custom';

  const [chartData, productMetrics, trends, compData, commissionSummary, commissionByProduct, commissionChartData] = await Promise.all([
    getSellerChartData(sellerId, period, granularity),
    getProductMetrics(sellerId, period),
    getTrends(sellerId, period),
    enableComparison ? getPeriodComparison(sellerId, period, getPreviousPeriod(period.start, period.end, periodType)) : Promise.resolve(undefined),
    getCommissionSummary(sellerId, period),
    getCommissionByProduct(sellerId, period),
    getCommissionChartData(sellerId, period, granularity),
  ]);

  // Merge commission data into chart data
  const mergedChartData = chartData.map(point => {
    const commissionPoint = commissionChartData.find(c => c.date === point.date);
    return {
      ...point,
      commission: commissionPoint?.commission || 0,
    };
  });

  // Fetch comparison data if enabled
  let periodComparison: PeriodComparison | undefined = undefined;
  if (enableComparison) {
    const previousPeriod = getPreviousPeriod(period.start, period.end, periodType);
    const [prevChartData, prevCommChartData] = await Promise.all([
      getSellerChartData(sellerId, previousPeriod, granularity),
      getCommissionChartData(sellerId, previousPeriod, granularity),
    ]);

    if (compData) {
      periodComparison = {
        ...compData,
        previousChartData: prevChartData,
        previousCommissionChartData: prevCommChartData,
      };
    }
  }

  return {
    period,
    summary,
    commissionSummary,
    comparison: periodComparison,
    chartData: mergedChartData,
    productMetrics,
    commissionByProduct,
    trends,
  };
}

// Funções auxiliares

/**
 * Lista de produtos que NÃO devem ser contabilizados como "Contrato Vendido"
 */
const BLACKLISTED_PRODUCTS = [
  'consultation-brant',
  'consultation-common',
  'visa-retry-defense',
  'rfe-defense',
];

/**
 * Verifica se um produto está na blacklist (não deve contar como contrato vendido)
 */
function isBlacklistedProduct(productSlug: string | null | undefined): boolean {
  if (!productSlug) return false;

  // Verificar se está na lista direta
  if (BLACKLISTED_PRODUCTS.includes(productSlug)) {
    return true;
  }

  // Verificar se termina com -scholarship ou -i20-control
  if (productSlug.endsWith('-scholarship') || productSlug.endsWith('-i20-control')) {
    return true;
  }

  return false;
}

/**
 * Extrai o serviço base de um produto slug
 * Ex: "initial-selection-process" -> "initial"
 *     "cos-scholarship" -> "cos"
 *     "transfer-i20-control" -> "transfer"
 */
function getBaseService(productSlug: string | null | undefined): string | null {
  if (!productSlug) return null;

  // Para produtos initial, cos, transfer
  if (productSlug.startsWith('initial-')) return 'initial';
  if (productSlug.startsWith('cos-')) return 'cos';
  if (productSlug.startsWith('transfer-')) return 'transfer';

  // Para outros produtos, retornar o slug completo como base
  return productSlug;
}

/**
 * Verifica se um pedido é o primeiro pagamento (contrato vendido)
 * Regras:
 * 1. Se está na blacklist, nunca é contrato vendido
 * 2. Se é -selection-process, sempre é contrato vendido
 * 3. Se é -scholarship ou -i20-control, verificar se já existe um -selection-process anterior do mesmo serviço
 * 4. Para outros produtos, verificar se já existe um pedido anterior do mesmo produto
 * 
 * IMPORTANTE: Apenas pedidos completados/paid são considerados para verificar se é primeiro pagamento
 */
function isFirstPayment(order: any, allOrders: any[]): boolean {
  // Apenas considerar pedidos completados/paid como contratos vendidos
  if (order.payment_status !== 'completed' && order.payment_status !== 'paid') {
    return false;
  }

  // 1. Se está na blacklist, nunca conta
  if (isBlacklistedProduct(order.product_slug)) {
    return false;
  }

  // 2. Se é -selection-process, sempre é primeiro pagamento
  if (order.product_slug?.endsWith('-selection-process')) {
    // Verificar se existe outro selection-process ANTERIOR para o mesmo cliente
    // (Caso raro onde o cliente comprou 2x o selection process)
    const hasPreviousSelection = allOrders.some((o: any) => {
      if (o.id === order.id) return false;
      if (o.client_email !== order.client_email) return false;
      if (!o.product_slug?.endsWith('-selection-process')) return false;
      if (o.payment_status !== 'completed' && o.payment_status !== 'paid') return false;

      const dateA = new Date(o.created_at).getTime();
      const dateB = new Date(order.created_at).getTime();

      // Se data for menor, é anterior.
      if (dateA < dateB) return true;

      // Se data for igual, usar ID para desempatar (ordem alfabética ou uuid)
      // Se o ID do 'o' for menor que o ID do 'order', consideramos 'o' como anterior
      if (dateA === dateB && o.id < order.id) return true;

      return false;
    });
    return !hasPreviousSelection;
  }

  // 3. Para -scholarship ou -i20-control, verificar se já existe selection-process anterior
  if (order.product_slug?.endsWith('-scholarship') || order.product_slug?.endsWith('-i20-control')) {
    const baseService = getBaseService(order.product_slug);
    if (!baseService) return false;

    const selectionProcessSlug = `${baseService}-selection-process`;

    // Verificar se existe um pedido anterior do mesmo cliente com selection-process (completado/paid)
    // Se existir, então este pedido ATUAL não é o contrato inicial (o contrato foi a selection)
    const hasPreviousSelectionProcess = allOrders.some((o: any) =>
      o.id !== order.id &&
      o.client_email === order.client_email &&
      o.product_slug === selectionProcessSlug &&
      (o.payment_status === 'completed' || o.payment_status === 'paid') &&
      // Qualquer selection process anterior invalida este como "novo contrato"
      // Não precisamos desempatar por ID aqui, pois se existe QUALQUER selection process anterior, 
      // já conta como contrato vendido lá atrás.
      new Date(o.created_at) <= new Date(order.created_at)
    );

    // Se já existe selection-process anterior, este não é primeiro pagamento
    if (hasPreviousSelectionProcess) return false;
  }

  // 4. Para outros produtos (ou se não achou selection process nos casos acima), 
  // verificar se já existe pedido anterior do mesmo produto (completado/paid)
  const hasPreviousOrder = allOrders.some((o: any) => {
    if (o.id === order.id) return false;
    if (o.client_email !== order.client_email) return false;
    if (o.product_slug !== order.product_slug) return false;
    if (o.payment_status !== 'completed' && o.payment_status !== 'paid') return false;

    const dateA = new Date(o.created_at).getTime();
    const dateB = new Date(order.created_at).getTime();

    if (dateA < dateB) return true;
    if (dateA === dateB && o.id < order.id) return true;

    return false;
  });

  // Se não existe pedido anterior, é primeiro pagamento
  return !hasPreviousOrder;
}

function calculateStats(
  orders: any[],
  commissionNetAmountMap?: Map<string, number>
): {
  totalRevenue: number;
  totalSales: number;
  soldContracts: number;
  completedOrders: number;
  pendingOrders: number;
  commission: number;
} {
  const completed = orders.filter(
    o => o.payment_status === 'completed' || o.payment_status === 'paid'
  );
  const pending = orders.filter(o => o.payment_status === 'pending');

  // Calculate revenue using net amount (total_price_usd - fee_amount)
  const revenue = completed.reduce(
    (sum, o) => sum + getOrderRevenueAmount(o, commissionNetAmountMap),
    0
  );

  // Calculate sold contracts (first payments only, excluding blacklisted products)
  // Ordenar pedidos por data para verificar corretamente quais são primeiros
  const sortedOrders = [...orders].sort((a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const soldContracts = completed.filter(order =>
    isFirstPayment(order, sortedOrders)
  ).length;

  // Commission will be calculated from actual commission records
  const commission = 0;

  return {
    totalRevenue: revenue,
    totalSales: orders.length,
    soldContracts,
    completedOrders: completed.length,
    pendingOrders: pending.length,
    commission,
  };
}

export function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return ((current - previous) / previous) * 100;
}

/**
 * Get commission chart data grouped by period
 */
export async function getCommissionChartData(
  sellerId: string | null | undefined,
  period: { start: Date; end: Date },
  granularity: 'day' | 'week' | 'month' = 'day'
): Promise<ChartDataPoint[]> {
  try {
    // Get commissions for the period
    let query = supabase
      .from('seller_commissions')
      .select('*');

    if (sellerId) {
      query = query.eq('seller_id', sellerId);
    }

    const { data: commissions, error } = await query.order('created_at', { ascending: true });

    if (error) {
      console.error('[Analytics] Error fetching commissions:', error);
      return [];
    }

    if (!commissions || commissions.length === 0) {
      return [];
    }

    const orderMetadataMap = await getOrderMetadataMap(
      commissions.map((commission) => commission.order_id)
    );

    // Group by period according to granularity
    const grouped = new Map<string, ChartDataPoint>();

    commissions.forEach((commission) => {
      const orderMetadata = orderMetadataMap.get(commission.order_id);
      if (!orderMetadata || !isOrderWithinPeriod(orderMetadata, period)) {
        return;
      }

      const commissionDate = getOrderEffectiveDate(orderMetadata);
      let key: string;

      if (granularity === 'day') {
        key = commissionDate.toISOString().split('T')[0]; // YYYY-MM-DD
      } else if (granularity === 'week') {
        const weekStart = new Date(commissionDate);
        weekStart.setDate(commissionDate.getDate() - commissionDate.getDay());
        key = weekStart.toISOString().split('T')[0];
      } else {
        // month
        key = `${commissionDate.getFullYear()}-${String(commissionDate.getMonth() + 1).padStart(2, '0')}`;
      }

      const existing = grouped.get(key) || {
        date: key,
        revenue: 0,
        contracts: 0,
        commission: 0,
      };

      const commissionAmount = parseFloat(commission.commission_amount_usd || '0');
      existing.commission += commissionAmount;

      grouped.set(key, existing);
    });

    // Convert to array and sort by date
    return Array.from(grouped.values()).sort((a, b) => a.date.localeCompare(b.date));
  } catch (error) {
    console.error('[Analytics] Error in getCommissionChartData:', error);
    return [];
  }
}

/**
 * Get commission metrics summary for a period
 */
export async function getCommissionSummary(
  sellerId: string | null | undefined,
  period: { start: Date; end: Date }
): Promise<CommissionSummary> {
  try {
    let commQuery = supabase
      .from('seller_commissions')
      .select('order_id, commission_amount_usd, withdrawn_amount, available_for_withdrawal_at, net_amount_usd');

    if (sellerId) {
      commQuery = commQuery.eq('seller_id', sellerId);
    }

    const { data: commissions, error } = await commQuery;

    if (error) {
      console.error('[Analytics] Error fetching commissions for summary:', error);
      return {
        totalCommissions: 0,
        availableCommissions: 0,
        pendingCommissions: 0,
        paidCommissions: 0,
        commissionRate: 0,
      };
    }

    if (!commissions || commissions.length === 0) {
      return {
        totalCommissions: 0,
        availableCommissions: 0,
        pendingCommissions: 0,
        paidCommissions: 0,
        commissionRate: 0,
      };
    }

    const orderMetadataMap = await getOrderMetadataMap(
      commissions.map((commission: any) => commission.order_id).filter(Boolean)
    );

    const filteredCommissions = commissions.filter((commission: any) => {
      const orderMetadata = orderMetadataMap.get(commission.order_id);
      return orderMetadata ? isOrderWithinPeriod(orderMetadata, period) : true;
    });

    if (filteredCommissions.length === 0) {
      return {
        totalCommissions: 0,
        availableCommissions: 0,
        pendingCommissions: 0,
        paidCommissions: 0,
        commissionRate: 0,
      };
    }

    // Calculate totals
    let totalCommissions = 0;
    let availableCommissions = 0;
    let pendingCommissions = 0;
    let paidCommissions = 0;

    filteredCommissions.forEach((c) => {
      const total = parseFloat(c.commission_amount_usd || '0');
      const withdrawn = parseFloat(c.withdrawn_amount || '0');
      const remaining = total - withdrawn;

      totalCommissions += total;
      paidCommissions += withdrawn;

      if (c.available_for_withdrawal_at) {
        const availableDate = new Date(c.available_for_withdrawal_at);
        if (availableDate <= new Date()) {
          availableCommissions += remaining;
        } else {
          pendingCommissions += remaining;
        }
      } else {
        pendingCommissions += remaining;
      }
    });

    const totalRevenue = filteredCommissions.reduce(
      (sum, c) => sum + parseFloat(c.net_amount_usd || '0'),
      0
    );

    const commissionRate = totalRevenue > 0 ? (totalCommissions / totalRevenue) * 100 : 0;

    return {
      totalCommissions: Math.round(totalCommissions * 100) / 100,
      availableCommissions: Math.round(availableCommissions * 100) / 100,
      pendingCommissions: Math.round(pendingCommissions * 100) / 100,
      paidCommissions: Math.round(paidCommissions * 100) / 100,
      commissionRate: Math.round(commissionRate * 100) / 100,
    };
  } catch (error) {
    console.error('[Analytics] Error in getCommissionSummary:', error);
    return {
      totalCommissions: 0,
      availableCommissions: 0,
      pendingCommissions: 0,
      paidCommissions: 0,
      commissionRate: 0,
    };
  }
}

/**
 * Get commissions grouped by product
 */
export async function getCommissionByProduct(
  sellerId: string | null | undefined,
  period: { start: Date; end: Date }
): Promise<CommissionByProduct[]> {
  try {
    let query = supabase
      .from('seller_commissions')
      .select('order_id, commission_amount_usd');

    if (sellerId) {
      query = query.eq('seller_id', sellerId);
    }

    const { data: commissions, error } = await query;

    if (error) {
      console.error('[Analytics] Error fetching commissions for products:', error);
      return [];
    }

    if (!commissions || commissions.length === 0) {
      return [];
    }

    const orderMetadataMap = await getOrderMetadataMap(
      commissions.map((commission) => commission.order_id)
    );

    const filteredCommissions = commissions.filter((commission) => {
      const orderMetadata = orderMetadataMap.get(commission.order_id);
      return orderMetadata ? isOrderWithinPeriod(orderMetadata, period) : true;
    });

    if (filteredCommissions.length === 0) {
      return [];
    }

    // Get order IDs
    const orderIds = filteredCommissions.map(c => c.order_id);

    // Get orders with product info
    const { data: orders } = await supabase
      .from('visa_orders')
      .select('id, product_slug')
      .in('id', orderIds);

    if (!orders) {
      return [];
    }

    // Create order map
    const orderMap = new Map(orders.map(o => [o.id, o.product_slug]));

    // Get product names
    const productSlugs = [...new Set(Array.from(orderMap.values()).filter(Boolean))];
    const { data: products } = await supabase
      .from('visa_products')
      .select('slug, name')
      .in('slug', productSlugs);

    const productNameMap = new Map(
      (products || []).map(p => [p.slug, p.name])
    );

    // Group commissions by product
    const productStats = new Map<string, { commissions: number; sales: number }>();

    filteredCommissions.forEach((commission) => {
      const orderId = commission.order_id;
      const productSlug = orderMap.get(orderId) || 'unknown';
      const existing = productStats.get(productSlug) || { commissions: 0, sales: 0 };

      existing.commissions += parseFloat(commission.commission_amount_usd || '0');
      existing.sales += 1;

      productStats.set(productSlug, existing);
    });

    // Calculate total for percentages
    const totalCommissions = Array.from(productStats.values())
      .reduce((sum, stat) => sum + stat.commissions, 0);

    // Convert to array
    const result: CommissionByProduct[] = Array.from(productStats.entries()).map(([slug, stats]) => ({
      productSlug: slug,
      productName: productNameMap.get(slug) || slug,
      totalCommissions: Math.round(stats.commissions * 100) / 100,
      sales: stats.sales,
      avgCommission: stats.sales > 0 ? Math.round((stats.commissions / stats.sales) * 100) / 100 : 0,
      percentage: totalCommissions > 0 ? Math.round((stats.commissions / totalCommissions) * 100 * 100) / 100 : 0,
    }));

    // Sort by total commissions (highest first)
    return result.sort((a, b) => b.totalCommissions - a.totalCommissions);
  } catch (error) {
    console.error('[Analytics] Error in getCommissionByProduct:', error);
    return [];
  }
}

/**
 * Busca dados analíticos para um time inteiro em um ano específico
 */
export async function getTeamYearlyAnalytics(
  teamId: string,
  year: number,
  productSlug: string = 'all',
  headOfSalesStartedAt?: string | null
): Promise<TeamYearlyAnalytics> {
  try {
    const startDate = getHeadOfSalesAnalyticsStartDate(year, headOfSalesStartedAt);
    const endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
    const expandedStart = new Date(startDate.getTime() - 60 * 24 * 60 * 60 * 1000);

    let query = supabase
      .from('visa_orders')
      .select('*')
      .eq('team_id', teamId)
      .in('payment_status', ['completed', 'paid'])
      .gte('created_at', expandedStart.toISOString())
      .lte('created_at', endDate.toISOString());

    if (productSlug !== 'all') {
      if (productSlug === 'student') {
        query = query.like('product_slug', 'initial-%').or('product_slug.like.cos-%').or('product_slug.like.transfer-%');
      } else if (productSlug === 'tourist') {
        query = query.in('product_slug', ['b1-premium', 'b1-revolution', 'canada-tourist-premium']);
      } else {
        query = query.eq('product_slug', productSlug);
      }
    }

    const { data: fetchedOrders, error } = await query;

    if (error) throw error;
    const orders = (fetchedOrders || []).filter((order) => {
      const effectiveDate = getOrderEffectiveDate(order);
      return effectiveDate >= startDate && effectiveDate <= endDate;
    });
    
    // 0. Buscar TODOS os membros do time (ativos ou não) para o ranking fixo
    const { data: teamMembers } = await supabase
      .from('sellers')
      .select('seller_id_public, full_name, team_id')
      .eq('team_id', teamId);

    const teamSellersMap = new Map((teamMembers || []).map(s => [s.seller_id_public, s.full_name]));

    // 1. Buscar nomes dos vendedores que fizeram vendas mas podem não estar no time atual (vendas históricas)
    const sellerPublicIds = [...new Set(orders.map(o => o.seller_id).filter(Boolean))];
    const missingSellerIds = sellerPublicIds.filter(id => !teamSellersMap.has(id));
    
    if (missingSellerIds.length > 0) {
      const { data: extraSellers } = await supabase
        .from('sellers')
        .select('seller_id_public, full_name')
        .in('seller_id_public', missingSellerIds);
        
      (extraSellers || []).forEach(s => teamSellersMap.set(s.seller_id_public, s.full_name));
    }

    // Buscar nomes dos produtos para a distribuição
    const productSlugsArr = [...new Set(orders.map(o => o.product_slug).filter(Boolean))] as string[];
    const productMap = new Map<string, string>();
    if (productSlugsArr.length > 0) {
      const { data: products } = await supabase
        .from('visa_products')
        .select('slug, name')
        .in('slug', productSlugsArr);
      (products || []).forEach(p => productMap.set(p.slug, p.name));
    }

    // 2. Processar Dados Mensais (Gráficos 1 e 2)
    const monthlyMap = new Map<number, TeamMonthlyData>();
    for (let i = 0; i < 12; i++) {
      const monthLabel = new Date(year, i, 1).toLocaleDateString('en-US', { month: 'short' });
      monthlyMap.set(i, {
        month: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
        sales: 0,
        revenue: 0,
        sellers: {},
        sellerRevenues: {}
      });
    }

    // Inicializar vendedores nos meses para o gráfico empilhado (opcional, para garantir ordenação)
    monthlyMap.forEach(m => {
      teamSellersMap.forEach((name) => {
        m.sellers[name] = 0;
        m.sellerRevenues[name] = 0;
      });
    });

    // Estruturas para novos dados (semanais e rankings mensais)
    const weeklyDataMap: { [monthIdx: number]: WeeklyMetric[] } = {};
    const monthlySellerStats = new Map<number, Map<string, { sales: number, revenue: number }>>();

    for (let i = 0; i < 12; i++) {
        weeklyDataMap[i] = [
            { weekLabel: 'W1', sales: 0, revenue: 0, sellers: {} },
            { weekLabel: 'W2', sales: 0, revenue: 0, sellers: {} },
            { weekLabel: 'W3', sales: 0, revenue: 0, sellers: {} },
            { weekLabel: 'W4', sales: 0, revenue: 0, sellers: {} },
            { weekLabel: 'W5', sales: 0, revenue: 0, sellers: {} },
        ];
        weeklyDataMap[i].forEach(w => {
            teamSellersMap.forEach((name) => {
                w.sellers[name] = 0;
            });
        });

        monthlySellerStats.set(i, new Map());
        // Inicializar vendedores no ranking mensal com 0
        teamSellersMap.forEach((_, sid) => {
            monthlySellerStats.get(i)!.set(sid, { sales: 0, revenue: 0 });
        });
    }

    orders.forEach(order => {
      const date = getOrderEffectiveDate(order);
      const monthIdx = date.getUTCMonth();
      const day = date.getUTCDate();
      const monthData = monthlyMap.get(monthIdx)!;
      const sid = order.seller_id || 'unknown';
      const sellerName = teamSellersMap.get(sid) || sid || 'Unknown';
      const netAmount = calculateNetAmount(order);
      const slug = order.product_slug || '';

      // Regra de Contratos: I-20 e Scholarship não contam como "venda de contrato"
      const isContract = !slug.includes('i20') && !slug.includes('scholarship');
      const salesAdd = isContract ? 1 : 0;

      // Dados Mensais Básicos
      monthData.sales += salesAdd;
      monthData.revenue += netAmount;
      if (salesAdd > 0) {
        monthData.sellers[sellerName] = (monthData.sellers[sellerName] || 0) + 1;
      }
      monthData.sellerRevenues[sellerName] = (monthData.sellerRevenues[sellerName] || 0) + netAmount;

      // Dados Semanais
      let weekIdx = 0;
      if (day <= 7) weekIdx = 0;
      else if (day <= 14) weekIdx = 1;
      else if (day <= 21) weekIdx = 2;
      else if (day <= 28) weekIdx = 3;
      else weekIdx = 4;
      
      weeklyDataMap[monthIdx][weekIdx].sales += salesAdd;
      weeklyDataMap[monthIdx][weekIdx].revenue += netAmount;
      weeklyDataMap[monthIdx][weekIdx].sellers[sellerName] += netAmount;

      // Stats Mensais por Vendedor (para ranking mensal)
      const mStats = monthlySellerStats.get(monthIdx)!;
      const currentSM = mStats.get(sid) || { sales: 0, revenue: 0 };
      currentSM.sales += salesAdd;
      currentSM.revenue += netAmount;
      mStats.set(sid, currentSM);
    });

    // Converter stats mensais em rankings
    const monthlyRankings: { [monthIdx: number]: TeamMemberPerformance[] } = {};
    monthlySellerStats.forEach((mStats, monthIdx) => {
        // Agora só consideramos para a % as vendas válidas (contracts)
        const monthTotalSales = Array.from(mStats.values()).reduce((sum, s) => sum + s.sales, 0);
        monthlyRankings[monthIdx] = Array.from(mStats.entries()).map(([sid, stats]) => ({
            sellerId: sid,
            name: teamSellersMap.get(sid) || sid,
            sales: stats.sales,
            revenue: stats.revenue,
            percentage: monthTotalSales > 0 ? (stats.sales / monthTotalSales) * 100 : 0
        })).sort((a, b) => b.sales - a.sales);
    });

    const monthlyData = Array.from(monthlyMap.values());
    const totalSales = orders.reduce((sum, o) => {
        const s = o.product_slug || '';
        return sum + (!s.includes('i20') && !s.includes('scholarship') ? 1 : 0);
    }, 0);

    const now = new Date();
    const activeEndMonth = year === now.getUTCFullYear() ? now.getUTCMonth() : 11;
    const activeMonthCount = startDate > endDate ? 0 : Math.max(1, activeEndMonth - startDate.getUTCMonth() + 1);
    const avgSalesPerMonth = activeMonthCount > 0 ? totalSales / activeMonthCount : 0;

    // 3. Processar Performance por Vendedor (Gráfico Rank Anual)
    const sellerStats = new Map<string, { sales: number, revenue: number }>();
    teamSellersMap.forEach((_, sid) => {
        sellerStats.set(sid, { sales: 0, revenue: 0 });
    });

    orders.forEach(order => {
      const sid = order.seller_id || 'unknown';
      const current = sellerStats.get(sid) || { sales: 0, revenue: 0 };
      const slug = order.product_slug || '';
      const isContract = !slug.includes('i20') && !slug.includes('scholarship');

      current.sales += isContract ? 1 : 0;
      current.revenue += calculateNetAmount(order);
      sellerStats.set(sid, current);
    });

    const sellerPerformance: TeamMemberPerformance[] = Array.from(sellerStats.entries()).map(([sid, stats]) => ({
      sellerId: sid,
      name: teamSellersMap.get(sid) || sid,
      sales: stats.sales,
      revenue: stats.revenue,
      percentage: totalSales > 0 ? (stats.sales / totalSales) * 100 : 0
    })).sort((a, b) => b.sales - a.sales);

    // 4. Distribuição por Produto (Gráfico 4)
    const productStatsMap = new Map<string, { sales: number, revenue: number }>();
    const productStatsByMonth = new Map<number, Map<string, { sales: number, revenue: number }>>();

    for (let i = 0; i < 12; i++) {
        productStatsByMonth.set(i, new Map());
    }

    orders.forEach(order => {
        const slug = order.product_slug;
        if (!slug) return;

        const monthIdx = getOrderEffectiveDate(order).getUTCMonth();
        const current = productStatsMap.get(slug) || { sales: 0, revenue: 0 };
        const isContract = !slug.includes('i20') && !slug.includes('scholarship');
        const revenue = calculateNetAmount(order);
        current.sales += isContract ? 1 : 0;
        current.revenue += revenue;
        productStatsMap.set(slug, current);

        const monthlyStats = productStatsByMonth.get(monthIdx)!;
        const currentMonthStats = monthlyStats.get(slug) || { sales: 0, revenue: 0 };
        currentMonthStats.sales += isContract ? 1 : 0;
        currentMonthStats.revenue += revenue;
        monthlyStats.set(slug, currentMonthStats);
    });

    const productDistribution: ProductMetric[] = Array.from(productStatsMap.entries())
        .filter(([_, stats]) => stats.sales > 0 || stats.revenue > 0)
        .map(([slug, stats]) => ({
            productSlug: slug,
            productName: productMap.get(slug) || slug,
            sales: stats.sales,
            revenue: stats.revenue,
            avgRevenue: stats.sales > 0 ? stats.revenue / stats.sales : 0,
            percentage: totalSales > 0 ? (stats.sales / totalSales) * 100 : 0
        })).sort((a, b) => b.sales - a.sales);

    const productDistributionByMonth: { [monthIdx: number]: ProductMetric[] } = {};
    productStatsByMonth.forEach((monthStats, monthIdx) => {
        const monthTotalSales = Array.from(monthStats.values()).reduce((sum, stats) => sum + stats.sales, 0);

        productDistributionByMonth[monthIdx] = Array.from(monthStats.entries())
            .filter(([_, stats]) => stats.sales > 0 || stats.revenue > 0)
            .map(([slug, stats]) => ({
                productSlug: slug,
                productName: productMap.get(slug) || slug,
                sales: stats.sales,
                revenue: stats.revenue,
                avgRevenue: stats.sales > 0 ? stats.revenue / stats.sales : 0,
                percentage: monthTotalSales > 0 ? (stats.sales / monthTotalSales) * 100 : 0
            }))
            .sort((a, b) => b.sales - a.sales);
    });

    return {
      totalSales,
      totalRevenue: orders.reduce((sum, o) => sum + calculateNetAmount(o), 0),
      avgSalesPerMonth,
      monthlyData,
      sellerPerformance,
      productDistribution,
      productDistributionByMonth,
      weeklyData: weeklyDataMap,
      monthlyRankings
    };
  } catch (error) {
    console.error('[Analytics] Error in getTeamYearlyAnalytics:', error);
    throw error;
  }
}
