import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart3, TrendingUp, Calendar, Filter, ShoppingCart, Award, DollarSign } from 'lucide-react';
import type { SellerInfo } from '@/types/seller';
import { getTeamYearlyAnalytics, type TeamYearlyAnalytics } from '@/lib/seller-analytics';
import { formatCurrency } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabase';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Componentes de gráficos
import { MonthlyHistoryChart } from '@/components/seller/charts/MonthlyHistoryChart';
import { SellerRankChart } from '@/components/seller/charts/SellerRankChart';
import { ServiceRankChart } from '@/components/seller/charts/ServiceRankChart';
import { SubProductPieChart } from '@/components/seller/charts/SubProductPieChart';
import { WeeklyHistoryChart } from '@/components/seller/charts/WeeklyHistoryChart';
import { ClusteredSellerChart } from '@/components/seller/charts/ClusteredSellerChart';
import { SellerRankChart as MonthlySellerRankChart } from '@/components/seller/charts/SellerRankChart';

import { MonthlyRevenueChart } from '@/components/seller/charts/MonthlyRevenueChart';
import { ServiceRevenueChart } from '@/components/seller/charts/ServiceRevenueChart';
import { SellerRevenueRankChart } from '@/components/seller/charts/SellerRevenueRankChart';

import { MonthlySellerRevenueHistoryChart } from '@/components/seller/charts/MonthlySellerRevenueHistoryChart';

import { WeeklyRevenueBarChart } from '@/components/seller/charts/WeeklyRevenueBarChart';
import { MonthlySellerRevenueBarChart } from '@/components/seller/charts/MonthlySellerRevenueBarChart';
import { WeeklyFilteredSellerRevenueChart } from '@/components/seller/charts/WeeklyFilteredSellerRevenueChart';

export function HeadOfSalesAnalytics() {
    const { seller } = useOutletContext<{ seller: SellerInfo }>();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<TeamYearlyAnalytics | null>(null);
    const [selectedYear, setSelectedYear] = useState('2026');
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedService, setSelectedService] = useState('all');
    const [products, setProducts] = useState<{slug: string, name: string}[]>([]);
    const [activeTab, setActiveTab] = useState(() => {
        return localStorage.getItem('migma_hos_analytics_tab') || 'contratos';
    });

    const months = [
        { value: 0, label: 'January' },
        { value: 1, label: 'February' },
        { value: 2, label: 'March' },
        { value: 3, label: 'April' },
        { value: 4, label: 'May' },
        { value: 5, label: 'June' },
        { value: 6, label: 'July' },
        { value: 7, label: 'August' },
        { value: 8, label: 'September' },
        { value: 9, label: 'October' },
        { value: 10, label: 'November' },
        { value: 11, label: 'December' }
    ];

    const years = ['2026'];

    // Títulos dinâmicos baseados nos filtros
    const selectedMonthLabel = months[selectedMonth].label;
    const selectedServiceName = selectedService === 'all' ? null : (products.find(p => p.slug === selectedService)?.name ?? selectedService);
    const serviceFilterSuffix = selectedServiceName ? ` — ${selectedServiceName}` : '';
    const monthFilterSuffix = ` — ${selectedMonthLabel}`;

    useEffect(() => {
        async function loadActiveProducts() {
            if (!seller.team_id) return;
            
            const startYear = `${selectedYear}-01-01T00:00:00Z`;
            const endYear = `${selectedYear}-12-31T23:59:59Z`;

            // Buscar slugs únicos que tiveram vendas completadas no ano/time
            const { data: soldSlugs } = await supabase
                .from('visa_orders')
                .select('product_slug')
                .eq('team_id', seller.team_id)
                .eq('payment_status', 'completed')
                .gte('created_at', startYear)
                .lte('created_at', endYear);

            const activeSlugs = [...new Set((soldSlugs || []).map(s => s.product_slug).filter(Boolean))];

            if (activeSlugs.length === 0) {
                setProducts([]);
                return;
            }

            const { data: prods } = await supabase
                .from('visa_products')
                .select('slug, name')
                .in('slug', activeSlugs)
                .order('name');
                
            if (prods) setProducts(prods);
        }
        loadActiveProducts();
    }, [seller.team_id, selectedYear]);

    useEffect(() => {
        if (selectedService === 'all') return;
        
        const isStillAvailable = products.some(p => p.slug === selectedService);
        if (!isStillAvailable && products.length > 0) {
            setSelectedService('all');
        }
    }, [products, selectedService]);

    useEffect(() => {
        async function loadData() {
            if (!seller.team_id) return;
            setLoading(true);
            try {
                const analytics = await getTeamYearlyAnalytics(
                    seller.team_id, 
                    parseInt(selectedYear), 
                    selectedService
                );
                setData(analytics);
            } catch (err) {
                console.error('Error loading team analytics:', err);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [seller.team_id, selectedYear, selectedService]);

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold migma-gold-text flex items-center gap-2">
                        <BarChart3 className="w-8 h-8 text-gold-medium" />
                        Team Analytics
                    </h1>
                    <p className="text-zinc-500 mt-1">Strategic overview of performance and sales distribution</p>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <Card className="bg-black/40 border-gold-medium/20 shadow-lg shadow-black/20">
                    <div className="px-6 pt-4 pb-0">
                        <p className="text-[10px] uppercase font-bold text-center text-zinc-500 tracking-widest">Year to Date</p>
                    </div>
                    <CardContent className="p-6 pt-2">
                        <div className="flex items-center justify-between">
                            <div className="flex-1 mr-2">
                                <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-1">Top Seller</p>
                                {loading ? (
                                    <Skeleton className="h-6 w-[120px] bg-white/10" />
                                ) : (
                                    <p 
                                        className="text-xl font-bold text-white leading-tight"
                                        title={data?.sellerPerformance[0]?.name || 'N/A'}
                                    >
                                        {data?.sellerPerformance[0]?.name || 'N/A'}
                                    </p>
                                )}
                            </div>
                            <div className="p-3 bg-gold-medium/10 rounded-xl border border-gold-medium/20 text-gold-medium">
                                <Award className="w-6 h-6" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-black/40 border-gold-medium/20 shadow-lg shadow-black/20">
                    <div className="px-6 pt-4 pb-0">
                        <p className="text-[10px] uppercase font-bold text-center text-zinc-500 tracking-widest">Year to Date</p>
                    </div>
                    <CardContent className="p-6 pt-2">
                        <div className="flex items-center justify-between">
                            <div className="flex-1 mr-2">
                                <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-1">Top Service</p>
                                {loading ? (
                                    <Skeleton className="h-6 w-[160px] bg-white/10" />
                                ) : (
                                    <p 
                                        className="text-xl font-bold text-white leading-tight"
                                        title={data?.productDistribution[0]?.productName || 'N/A'}
                                    >
                                        {data?.productDistribution[0]?.productName || 'N/A'}
                                    </p>
                                )}
                            </div>
                            <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-400">
                                <TrendingUp className="w-6 h-6" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-black/40 border-gold-medium/20 shadow-lg shadow-black/20">
                    <div className="px-6 pt-4 pb-0">
                        <p className="text-[10px] uppercase font-bold text-center text-zinc-500 tracking-widest">Year to Date</p>
                    </div>
                    <CardContent className="p-6 pt-2">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-1">Total Sales</p>
                                {loading ? (
                                    <Skeleton className="h-8 w-[60px] bg-white/10" />
                                ) : (
                                    <p className="text-2xl font-bold text-white">
                                        {data?.totalSales || 0}
                                    </p>
                                )}
                            </div>
                            <div className="p-3 bg-green-500/10 rounded-xl border border-green-500/20 text-green-400">
                                <ShoppingCart className="w-6 h-6" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-black/40 border-gold-medium/20 shadow-lg shadow-black/20">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-1">Revenue</p>
                                {loading ? (
                                    <Skeleton className="h-8 w-[140px] bg-white/10" />
                                ) : (
                                    <p className="text-2xl font-bold text-white">
                                        {formatCurrency(data?.totalRevenue || 0)}
                                    </p>
                                )}
                            </div>
                            <div className="p-3 bg-gold-medium/10 rounded-xl border border-gold-medium/20 text-gold-medium">
                                <DollarSign className="w-6 h-6" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
            
            {/* Filtros */}
            <Card className="bg-black/40 border-gold-medium/20 mb-8 overflow-hidden">
                <CardHeader className="py-3 bg-gold-medium/5 border-b border-gold-medium/10">
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-gold-medium" />
                        <CardTitle className="text-xs font-bold text-white uppercase tracking-wider">
                            Analysis Filters
                        </CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="p-6 flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                        <Select value={selectedService} onValueChange={setSelectedService}>
                            <SelectTrigger className="w-[200px] bg-black/60 border-gold-medium/30 text-white">
                                <SelectValue placeholder="Service" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#0a0a0a] border-gold-medium/30 text-white">
                                <SelectItem value="all">All Services</SelectItem>
                                {products.map(p => (
                                    <SelectItem key={p.slug} value={p.slug}>{p.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gold-medium" />
                        <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                            <SelectTrigger className="w-[140px] bg-black/60 border-gold-medium/30 text-white">
                                <SelectValue placeholder="Month Detail" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#0a0a0a] border-gold-medium/30 text-white">
                                {months.map(m => (
                                    <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gold-medium" />
                        <Select value={selectedYear} onValueChange={setSelectedYear}>
                            <SelectTrigger className="w-[100px] bg-black/60 border-gold-medium/30 text-white">
                                <SelectValue placeholder="Year" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#0a0a0a] border-gold-medium/30 text-white">
                                {years.map(y => (
                                    <SelectItem key={y} value={y}>{y}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <Card key={i} className="bg-black/40 border-gold-medium/20 h-[500px]">
                            <CardContent className="h-full flex items-center justify-center">
                                <Skeleton className="h-[80%] w-[90%] bg-gold-medium/5" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); localStorage.setItem('migma_hos_analytics_tab', v); }} className="w-full space-y-8">
                    <div className="flex justify-center md:justify-start mb-4">
                        <TabsList className="bg-black/60 border border-gold-medium/20 p-1">
                            <TabsTrigger value="contratos" className="data-[state=active]:bg-gold-medium/20 data-[state=active]:text-gold-light">
                                Contracts Sold
                            </TabsTrigger>
                            <TabsTrigger value="faturamento" className="data-[state=active]:bg-gold-medium/20 data-[state=active]:text-gold-light">
                                Revenue
                            </TabsTrigger>
                        </TabsList>
                    </div>
                    
                    <TabsContent value="contratos" className="space-y-8 mt-0 outline-none">
                        <div className="w-full">
                            <MonthlyHistoryChart 
                                data={data?.monthlyData || []} 
                                avg={data?.avgSalesPerMonth || 0} 
                                title="Annual Sales History (Overall)"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 auto-rows-min">
                            {/* Linha 1: Rankings Anuais */}
                            <SellerRankChart 
                                data={data?.sellerPerformance || []} 
                                total={data?.totalSales || 0}
                                year={selectedYear}
                                title={`Sellers Ranking`}
                            />
                            <ClusteredSellerChart 
                                data={data?.monthlyData || []} 
                                title={`Monthly History per Seller (${selectedYear})`}
                                total={data?.totalSales || 0}
                                avg={data?.avgSalesPerMonth || 0}
                            />
                            
                            {/* Linha 2: Separador Mensal */}
                            <div className="md:col-span-2 py-4">
                                <div className="flex items-center gap-4">
                            <h2 className="text-xl font-bold text-gold-medium uppercase tracking-widest">
                                Breakdown: {months[selectedMonth].label}
                            </h2>
                            <div className="h-px flex-1 bg-gold-medium/20"></div>
                        </div>
                    </div>

                    {/* Linha 3: Detalhes do Mês Selecionado */}
                    <WeeklyHistoryChart 
                        data={(data?.weeklyData && data?.weeklyData[selectedMonth]) || []}
                        title={`Weekly Sales in ${months[selectedMonth].label}`}
                    />
                    <MonthlySellerRankChart 
                        data={(data?.monthlyRankings && data?.monthlyRankings[selectedMonth]) || []}
                        total={(data?.monthlyData && data?.monthlyData[selectedMonth]?.sales) || 0}
                        title={`Team Ranking in ${months[selectedMonth].label} - Total: ${(data?.monthlyData && data?.monthlyData[selectedMonth]?.sales) || 0}`}
                    />

                    {/* Linha 4: Distribuição e Histórico Geral */}
                    <ServiceRankChart 
                        data={data?.productDistribution || []} 
                        total={data?.totalSales || 0}
                        title={`Services Distribution${serviceFilterSuffix} — Total: ${data?.totalSales || 0}`}
                    />

                    {/* Linha 5: Detalhe de Produtos */}
                    <SubProductPieChart 
                        data={data?.productDistribution || []}
                        filterType="student"
                        title={`U.S. Student Visas${serviceFilterSuffix}`}
                    />
                    <SubProductPieChart 
                        data={data?.productDistribution || []}
                        filterType="tourist-us"
                        title={`U.S. Tourist Visas${serviceFilterSuffix}`}
                    />
                    <SubProductPieChart 
                        data={data?.productDistribution || []}
                        filterType="tourist-ca"
                        title={`Canadian Tourist Visas${serviceFilterSuffix}`}
                    />
                        </div>
                    </TabsContent>

                    <TabsContent value="faturamento" className="space-y-8 mt-0 outline-none">
                        {/* Linha 1 e 2: Histórico Anual Geral e Receita por Serviço */}
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 auto-rows-min">
                            <MonthlyRevenueChart 
                                data={data?.monthlyData || []} 
                                avg={data?.totalRevenue ? (parseInt(selectedYear) === new Date().getFullYear() ? data.totalRevenue / (new Date().getMonth() + 1) : data.totalRevenue / 12) : 0} 
                                title="Monthly Revenue History"
                                total={data?.totalRevenue || 0}
                            />

                            <ServiceRevenueChart 
                                data={(data?.productDistribution || []).map(p => ({
                                    productName: p.productName,
                                    revenue: p.revenue,
                                    percentage: data?.totalRevenue ? (p.revenue / data.totalRevenue) * 100 : 0
                                }))}
                                total={data?.totalRevenue || 0}
                                title={`Revenue per service${serviceFilterSuffix}`}
                            />
                        </div>


                        {/* Ranking Anual e Granularidades Semanais/Mensais (2 colunas) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 auto-rows-min mt-8">
                            <SellerRevenueRankChart 
                                data={(data?.sellerPerformance || []).map(s => ({
                                    name: s.name,
                                    revenue: s.revenue,
                                    percentage: data?.totalRevenue ? (s.revenue / data.totalRevenue) * 100 : 0
                                }))}
                                total={data?.totalRevenue || 0}
                                year={selectedYear}
                                title={`Revenue per seller${serviceFilterSuffix}`}
                            />
                            <WeeklyRevenueBarChart 
                                data={(data?.weeklyData && data.weeklyData[selectedMonth]) || []}
                                title={`Revenue${monthFilterSuffix} per week${serviceFilterSuffix}`}
                            />
                            <MonthlySellerRevenueBarChart 
                                data={(data?.monthlyRankings && data.monthlyRankings[selectedMonth]) || []}
                                title={`Revenue per seller in ${months.find(m => m.value === selectedMonth)?.label}`}
                            />
                            <WeeklyFilteredSellerRevenueChart 
                                data={(data?.weeklyData && data.weeklyData[selectedMonth]) || []}
                                titleBase={`Revenue per seller in ${months.find(m => m.value === selectedMonth)?.label}`}
                            />
                        </div>

                        {/* Histórico Mensal - Movido para o final conforme pedido */}
                        <div className="w-full mt-8">
                            <MonthlySellerRevenueHistoryChart 
                                data={data?.monthlyData || []}
                                sellerStats={(data?.sellerPerformance || []).map(s => ({
                                    name: s.name,
                                    revenue: s.revenue
                                }))}
                                monthsCount={data && data.totalSales > 0 ? new Date().getMonth() + 1 : 12}
                                title="Monthly history of revenue per seller"
                            />
                        </div>
                    </TabsContent>
                </Tabs>
            )}
        </div>
    );
}
