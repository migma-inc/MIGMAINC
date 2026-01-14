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
      // Calculate revenue using net amount (total_price_usd - fee_amount)
      const revenue = isCompleted ? calculateNetAmount(order) : 0;

      existing.revenue += revenue;
      existing.contracts += 1;
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
      // Calculate revenue using net amount (total_price_usd - fee_amount)
      const revenue = calculateNetAmount(order);

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

    // Get commission summaries for both periods
    const [currentCommissionSummary, previousCommissionSummary] = await Promise.all([
      getCommissionSummary(sellerId, currentPeriod),
      getCommissionSummary(sellerId, previousPeriod),
    ]);

    return {
      previousPeriod,
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
        // Calculate revenue using net amount (total_price_usd - fee_amount)
      const revenue = calculateNetAmount(order);
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
  periodOption: string | { start: string; end: string },
  enableComparison: boolean = false,
  customRange?: { start: string; end: string }
): Promise<AnalyticsData> {
  const period = typeof periodOption === 'object' 
    ? getPeriodDates(periodOption)
    : getPeriodDates(periodOption, customRange);
  
  // Buscar pedidos do período
  const { data: orders } = await supabase
    .from('visa_orders')
    .select('*')
    .eq('seller_id', sellerId)
    .gte('created_at', period.start.toISOString())
    .lte('created_at', period.end.toISOString());

  const summary = calculateStats(orders || []);

  // Buscar dados em paralelo
  const [chartData, productMetrics, trends, comparison, commissionSummary, commissionByProduct, commissionChartData] = await Promise.all([
    getSellerChartData(sellerId, period, 'day'),
    getProductMetrics(sellerId, period),
    getTrends(sellerId, period),
    enableComparison
      ? getPeriodComparison(sellerId, period, getPreviousPeriod(period.start, period.end))
      : Promise.resolve(undefined),
    getCommissionSummary(sellerId, period),
    getCommissionByProduct(sellerId, period),
    getCommissionChartData(sellerId, period, 'day'),
  ]);

  // Merge commission data into chart data
  const mergedChartData = chartData.map(point => {
    const commissionPoint = commissionChartData.find(c => c.date === point.date);
    return {
      ...point,
      commission: commissionPoint?.commission || 0,
    };
  });

  return {
    period,
    summary,
    commissionSummary,
    comparison,
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
    return true;
  }
  
  // 3. Para -scholarship ou -i20-control, verificar se já existe selection-process anterior
  if (order.product_slug?.endsWith('-scholarship') || order.product_slug?.endsWith('-i20-control')) {
    const baseService = getBaseService(order.product_slug);
    if (!baseService) return false;
    
    const selectionProcessSlug = `${baseService}-selection-process`;
    
    // Verificar se existe um pedido anterior do mesmo cliente com selection-process (completado/paid)
    const hasPreviousSelectionProcess = allOrders.some((o: any) => 
      o.id !== order.id &&
      o.client_email === order.client_email &&
      o.product_slug === selectionProcessSlug &&
      (o.payment_status === 'completed' || o.payment_status === 'paid') &&
      new Date(o.created_at) < new Date(order.created_at)
    );
    
    // Se já existe selection-process anterior, este não é primeiro pagamento
    return !hasPreviousSelectionProcess;
  }
  
  // 4. Para outros produtos, verificar se já existe pedido anterior do mesmo produto (completado/paid)
  const hasPreviousOrder = allOrders.some((o: any) => 
    o.id !== order.id &&
    o.client_email === order.client_email &&
    o.product_slug === order.product_slug &&
    (o.payment_status === 'completed' || o.payment_status === 'paid') &&
    new Date(o.created_at) < new Date(order.created_at)
  );
  
  // Se não existe pedido anterior, é primeiro pagamento
  return !hasPreviousOrder;
}

function calculateStats(orders: any[]): {
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
    (sum, o) => sum + calculateNetAmount(o),
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

function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return ((current - previous) / previous) * 100;
}

/**
 * Get commission chart data grouped by period
 */
export async function getCommissionChartData(
  sellerId: string,
  period: { start: Date; end: Date },
  granularity: 'day' | 'week' | 'month' = 'day'
): Promise<ChartDataPoint[]> {
  try {
    // Get commissions for the period
    const { data: commissions, error } = await supabase
      .from('seller_commissions')
      .select('*')
      .eq('seller_id', sellerId)
      .gte('created_at', period.start.toISOString())
      .lte('created_at', period.end.toISOString())
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[Analytics] Error fetching commissions:', error);
      return [];
    }

    if (!commissions || commissions.length === 0) {
      return [];
    }

    // Group by period according to granularity
    const grouped = new Map<string, ChartDataPoint>();

    commissions.forEach((commission) => {
      const commissionDate = new Date(commission.created_at);
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
  sellerId: string,
  period: { start: Date; end: Date }
): Promise<CommissionSummary> {
  try {
    // Get all commissions for the period
    const { data: commissions, error } = await supabase
      .from('seller_commissions')
      .select('commission_amount_usd, withdrawn_amount, available_for_withdrawal_at')
      .eq('seller_id', sellerId)
      .gte('created_at', period.start.toISOString())
      .lte('created_at', period.end.toISOString());

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

    // Calculate totals
    let totalCommissions = 0;
    let availableCommissions = 0;
    let pendingCommissions = 0;
    let paidCommissions = 0;

    commissions.forEach((c) => {
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

    // Get orders to calculate average commission rate
    const { data: orders } = await supabase
      .from('visa_orders')
      .select('total_price_usd, payment_status, payment_metadata')
      .eq('seller_id', sellerId)
      .gte('created_at', period.start.toISOString())
      .lte('created_at', period.end.toISOString());

    // Calculate revenue using net amount (total_price_usd - fee_amount)
    const totalRevenue = (orders || [])
      .filter(o => o.payment_status === 'completed' || o.payment_status === 'paid')
      .reduce((sum, o) => sum + calculateNetAmount(o), 0);

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
  sellerId: string,
  period: { start: Date; end: Date }
): Promise<CommissionByProduct[]> {
  try {
    // Get commissions for the period
    const { data: commissions, error } = await supabase
      .from('seller_commissions')
      .select('order_id, commission_amount_usd')
      .eq('seller_id', sellerId)
      .gte('created_at', period.start.toISOString())
      .lte('created_at', period.end.toISOString());

    if (error) {
      console.error('[Analytics] Error fetching commissions for products:', error);
      return [];
    }

    if (!commissions || commissions.length === 0) {
      return [];
    }

    // Get order IDs
    const orderIds = commissions.map(c => c.order_id);

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

    commissions.forEach((commission) => {
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

