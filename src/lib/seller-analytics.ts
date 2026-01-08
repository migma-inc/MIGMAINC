import { supabase } from './supabase';

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

export interface PeriodComparison {
  previousPeriod: { start: Date; end: Date };
  revenueChange: number; // %
  salesChange: number; // %
  completedOrdersChange: number; // %
  commissionChange: number; // %
}

export interface TrendsData {
  direction: 'up' | 'down' | 'stable';
  growthRate: number; // %
  projection: {
    nextMonth: number;
    nextQuarter: number;
  };
}

export interface AnalyticsData {
  period: { start: Date; end: Date };
  summary: {
    totalRevenue: number;
    totalSales: number;
    completedOrders: number;
    pendingOrders: number;
    commission: number;
  };
  comparison?: PeriodComparison;
  chartData: ChartDataPoint[];
  productMetrics: ProductMetric[];
  trends: TrendsData;
}

/**
 * Calcula a data de início e fim de um período baseado em uma opção pré-definida
 */
export function getPeriodDates(period: string): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  
  let start: Date;

  switch (period) {
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
    default:
      // Custom - retornar período padrão (este mês)
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      start.setHours(0, 0, 0, 0);
  }

  return { start, end };
}

/**
 * Calcula o período anterior equivalente
 */
export function getPreviousPeriod(start: Date, end: Date): { start: Date; end: Date } {
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
  sellerId: string,
  period: { start: Date; end: Date },
  granularity: 'day' | 'week' | 'month' = 'day'
): Promise<ChartDataPoint[]> {
  try {
    const { data: orders, error } = await supabase
      .from('visa_orders')
      .select('*')
      .eq('seller_id', sellerId)
      .gte('created_at', period.start.toISOString())
      .lte('created_at', period.end.toISOString())
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[Analytics] Error fetching orders:', error);
      return [];
    }

    if (!orders || orders.length === 0) {
      return [];
    }

    // Agrupar por período conforme granularidade
    const grouped = new Map<string, ChartDataPoint>();

    orders.forEach((order) => {
      const orderDate = new Date(order.created_at);
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
      const revenue = parseFloat(order.total_price_usd || '0');

      existing.revenue += isCompleted ? revenue : 0;
      existing.contracts += 1;
      // Comissão será calculada separadamente quando o sistema estiver implementado
      // Por enquanto, assumir 10% como padrão
      existing.commission += isCompleted ? revenue * 0.1 : 0;

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
  sellerId: string,
  period: { start: Date; end: Date }
): Promise<ProductMetric[]> {
  try {
    const { data: orders, error } = await supabase
      .from('visa_orders')
      .select('*')
      .eq('seller_id', sellerId)
      .gte('created_at', period.start.toISOString())
      .lte('created_at', period.end.toISOString());

    if (error) {
      console.error('[Analytics] Error fetching orders for product metrics:', error);
      return [];
    }

    if (!orders || orders.length === 0) {
      return [];
    }

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
      const revenue = parseFloat(order.total_price_usd || '0');

      existing.sales += 1;
      existing.revenue += isCompleted ? revenue : 0;
      
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
  sellerId: string,
  currentPeriod: { start: Date; end: Date },
  previousPeriod: { start: Date; end: Date }
): Promise<PeriodComparison> {
  try {
    // Buscar dados do período atual
    const { data: currentOrders } = await supabase
      .from('visa_orders')
      .select('*')
      .eq('seller_id', sellerId)
      .gte('created_at', currentPeriod.start.toISOString())
      .lte('created_at', currentPeriod.end.toISOString());

    // Buscar dados do período anterior
    const { data: previousOrders } = await supabase
      .from('visa_orders')
      .select('*')
      .eq('seller_id', sellerId)
      .gte('created_at', previousPeriod.start.toISOString())
      .lte('created_at', previousPeriod.end.toISOString());

    const currentStats = calculateStats(currentOrders || []);
    const previousStats = calculateStats(previousOrders || []);

    return {
      previousPeriod,
      revenueChange: calculatePercentageChange(currentStats.totalRevenue, previousStats.totalRevenue),
      salesChange: calculatePercentageChange(currentStats.totalSales, previousStats.totalSales),
      completedOrdersChange: calculatePercentageChange(currentStats.completedOrders, previousStats.completedOrders),
      commissionChange: calculatePercentageChange(currentStats.commission, previousStats.commission),
    };
  } catch (error) {
    console.error('[Analytics] Error in getPeriodComparison:', error);
    return {
      previousPeriod,
      revenueChange: 0,
      salesChange: 0,
      completedOrdersChange: 0,
      commissionChange: 0,
    };
  }
}

/**
 * Calcula tendências e projeções
 */
export async function getTrends(
  sellerId: string,
  period: { start: Date; end: Date }
): Promise<TrendsData> {
  try {
    // Buscar dados históricos dos últimos 3 meses para calcular tendência
    const historicalStart = new Date(period.start);
    historicalStart.setMonth(historicalStart.getMonth() - 3);
    
    const { data: orders } = await supabase
      .from('visa_orders')
      .select('created_at, total_price_usd, payment_status')
      .eq('seller_id', sellerId)
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

    // Agrupar receita por mês
    const monthlyRevenue = new Map<string, number>();
    orders.forEach((order) => {
      if (order.payment_status === 'completed' || order.payment_status === 'paid') {
        const date = new Date(order.created_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const revenue = parseFloat(order.total_price_usd || '0');
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
  sellerId: string,
  periodOption: string,
  enableComparison: boolean = false
): Promise<AnalyticsData> {
  const period = getPeriodDates(periodOption);
  
  // Buscar pedidos do período
  const { data: orders } = await supabase
    .from('visa_orders')
    .select('*')
    .eq('seller_id', sellerId)
    .gte('created_at', period.start.toISOString())
    .lte('created_at', period.end.toISOString());

  const summary = calculateStats(orders || []);

  // Buscar dados em paralelo
  const [chartData, productMetrics, trends, comparison] = await Promise.all([
    getSellerChartData(sellerId, period, 'day'),
    getProductMetrics(sellerId, period),
    getTrends(sellerId, period),
    enableComparison
      ? getPeriodComparison(sellerId, period, getPreviousPeriod(period.start, period.end))
      : Promise.resolve(undefined),
  ]);

  return {
    period,
    summary,
    comparison,
    chartData,
    productMetrics,
    trends,
  };
}

// Funções auxiliares

function calculateStats(orders: any[]): {
  totalRevenue: number;
  totalSales: number;
  completedOrders: number;
  pendingOrders: number;
  commission: number;
} {
  const completed = orders.filter(
    o => o.payment_status === 'completed' || o.payment_status === 'paid'
  );
  const pending = orders.filter(o => o.payment_status === 'pending');
  
  const revenue = completed.reduce(
    (sum, o) => sum + parseFloat(o.total_price_usd || '0'),
    0
  );
  
  // Assumir 10% de comissão (será substituído quando sistema de comissão estiver implementado)
  const commission = revenue * 0.1;

  return {
    totalRevenue: revenue,
    totalSales: orders.length,
    completedOrders: completed.length,
    pendingOrders: pending.length,
    commission,
  };
}

function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return ((current - previous) / previous) * 100;
}

