import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Briefcase, Layers, TrendingUp, BarChart3 } from 'lucide-react';
import type { SellerInfo } from '@/types/seller';
import { subDays, startOfMonth, isWithinInterval } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useDashboardCache } from '@/contexts/DashboardCacheContext';
import { Skeleton } from '@/components/ui/skeleton';

export function HeadOfSalesTotalSales() {
    const { seller } = useOutletContext<{ seller: SellerInfo }>();
    const { cache, setCacheValue } = useDashboardCache();
    const [orders, setOrders] = useState<any[]>(cache.totalSales || []);
    const [filteredOrders, setFilteredOrders] = useState<any[]>(cache.totalSales || []);
    const [period, setPeriod] = useState<'all' | 'month' | 'week' | 'day'>('all');
    const [loading, setLoading] = useState(!cache.totalSales);

    useEffect(() => {
        async function loadAllSales() {
            if (!seller.team_id) {
                setLoading(false);
                return;
            }

            try {
                const { data: teamMembers } = await supabase
                    .from('sellers')
                    .select('seller_id_public, full_name')
                    .eq('team_id', seller.team_id);

                if (teamMembers && teamMembers.length > 0) {
                    const sellerIds = teamMembers.map(m => m.seller_id_public);

                    const { data: teamOrders } = await supabase
                        .from('visa_orders')
                        .select('*')
                        .in('seller_id', sellerIds)
                        .eq('payment_status', 'completed');

                    const processed = teamOrders?.map(order => ({
                        ...order,
                        seller_name: teamMembers.find(m => m.seller_id_public === order.seller_id)?.full_name || 'Unknown',
                        net_value: Number(order.base_price_usd || 0) + 
                                   (Number(order.extra_units || 0) * Number(order.extra_unit_price_usd || 0)) + 
                                   Number(order.upsell_price_usd || 0) - 
                                   Number(order.discount_amount || 0)
                    })).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

                    setOrders(processed || []);
                    setFilteredOrders(processed || []);
                    setCacheValue('totalSales', processed);
                } else {
                    setOrders([]);
                    setFilteredOrders([]);
                    setCacheValue('totalSales', []);
                }
            } catch (error) {
                console.error('Error loading team sales:', error);
            } finally {
                setLoading(false);
            }
        }

        if (seller.id) {
            loadAllSales();
        }
    }, [seller.id, seller.team_id]);

    useEffect(() => {
        const now = new Date();
        let startOfPeriod: Date | null = null;

        if (period === 'month') startOfPeriod = startOfMonth(now);
        if (period === 'week') startOfPeriod = subDays(now, 7);
        if (period === 'day') startOfPeriod = subDays(now, 1);

        if (!startOfPeriod) {
            setFilteredOrders(orders);
        } else {
            setFilteredOrders(orders.filter(o => 
                isWithinInterval(new Date(o.created_at), { start: startOfPeriod!, end: now })
            ));
        }
    }, [period, orders]);

    const totalSalesValue = filteredOrders.reduce((acc, curr) => acc + curr.net_value, 0);

    // Group by product
    const productStats = filteredOrders.reduce((acc: any, curr) => {
        const slug = curr.product_slug || 'Other';
        if (!acc[slug]) acc[slug] = { count: 0, revenue: 0 };
        acc[slug].count += 1;
        acc[slug].revenue += curr.net_value;
        return acc;
    }, {});

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Team Total Sales</h1>
                    <p className="text-gray-400 mt-1">Consolidated view of all sales made by your team.</p>
                </div>

                <div className="flex items-center gap-2 bg-black/40 p-1 rounded-lg border border-gold-medium/20">
                    <Button 
                        variant={period === 'all' ? 'default' : 'ghost'} 
                        size="sm" 
                        onClick={() => setPeriod('all')}
                        className={period === 'all' ? 'bg-gold-medium text-black' : 'text-gray-400'}
                    >All</Button>
                    <Button 
                        variant={period === 'month' ? 'default' : 'ghost'} 
                        size="sm" 
                        onClick={() => setPeriod('month')}
                        className={period === 'month' ? 'bg-gold-medium text-black' : 'text-gray-400'}
                    >Month</Button>
                    <Button 
                        variant={period === 'week' ? 'default' : 'ghost'} 
                        size="sm" 
                        onClick={() => setPeriod('week')}
                        className={period === 'week' ? 'bg-gold-medium text-black' : 'text-gray-400'}
                    >Week</Button>
                    <Button 
                        variant={period === 'day' ? 'default' : 'ghost'} 
                        size="sm" 
                        onClick={() => setPeriod('day')}
                        className={period === 'day' ? 'bg-gold-medium text-black' : 'text-gray-400'}
                    >Today</Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-black/40 border-gold-medium/20 backdrop-blur-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-400">Gross Volume (Period)</CardTitle>
                        <BarChart3 className="w-4 h-4 text-gold-medium" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-gold-light">
                            {loading && orders.length === 0 ? <Skeleton className="h-8 w-32" /> : formatCurrency(totalSalesValue)}
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-black/40 border-gold-medium/20 backdrop-blur-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-400">Total Units</CardTitle>
                        <Layers className="w-4 h-4 text-blue-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-400">
                            {loading && orders.length === 0 ? <Skeleton className="h-8 w-12" /> : filteredOrders.length}
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-black/40 border-gold-medium/20 backdrop-blur-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-400">Average Ticket</CardTitle>
                        <TrendingUp className="w-4 h-4 text-green-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-400">
                            {loading && orders.length === 0 ? <Skeleton className="h-8 w-24" /> : formatCurrency(filteredOrders.length > 0 ? totalSalesValue / filteredOrders.length : 0)}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-black/40 border-gold-medium/20">
                    <CardHeader className="border-b border-gold-medium/10">
                        <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                            <Briefcase className="w-5 h-5 text-gold-medium" />
                            Sales by Product
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="space-y-3">
                            {loading && orders.length === 0 ? (
                                Array(3).fill(0).map((_, i) => (
                                    <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                                        <div className="space-y-2 flex-1">
                                            <Skeleton className="h-3 w-16" />
                                            <Skeleton className="h-5 w-32" />
                                        </div>
                                        <div className="text-right space-y-2">
                                            <Skeleton className="h-3 w-16 ml-auto" />
                                            <Skeleton className="h-5 w-24 ml-auto" />
                                        </div>
                                    </div>
                                ))
                            ) : Object.entries(productStats).length === 0 ? (
                                <div className="text-center py-8 text-gray-500 italic">No sales found in the team for this period.</div>
                            ) : (
                                Object.entries(productStats)
                                    .sort(([, a]: any, [, b]: any) => b.revenue - a.revenue)
                                    .map(([slug, stats]: [string, any]) => {
                                        const formatName = (s: string) => {
                                            return s.split('-')
                                                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                                                .join(' ');
                                        };

                                        return (
                                            <div key={slug} className="group relative overflow-hidden flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:border-gold-medium/30 hover:bg-white/[0.08] transition-all">
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-[10px] font-bold text-gold-medium uppercase tracking-wider mb-1 opacity-70 group-hover:opacity-100 transition-opacity">
                                                        {slug.includes('-') ? slug.split('-')[0] : 'Product'}
                                                    </div>
                                                    <h3 className="font-semibold text-white text-sm sm:text-base truncate pr-4">
                                                        {formatName(slug)}
                                                    </h3>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <div className="px-1.5 py-0.5 rounded bg-gold-medium/20 text-[10px] font-bold text-gold-light border border-gold-medium/20">
                                                            {stats.count} {stats.count === 1 ? 'Sale' : 'Sales'}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <div className="text-[10px] text-gray-500 uppercase font-bold tracking-tighter mb-0.5">Revenue</div>
                                                    <div className="text-lg font-bold text-gold-light tabular-nums leading-none">
                                                        {formatCurrency(stats.revenue)}
                                                    </div>
                                                </div>
                                                
                                                {/* Subtle progress bar background indicator */}
                                                <div 
                                                    className="absolute bottom-0 left-0 h-[2px] bg-gold-medium/30 transition-all duration-500" 
                                                    style={{ width: `${Math.min((stats.revenue / totalSalesValue) * 100, 100)}%` }}
                                                />
                                            </div>
                                        );
                                    })
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-black/40 border-gold-medium/20 overflow-hidden">
                    <CardHeader>
                        <CardTitle className="text-lg font-bold text-white">Latest Orders in Period</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-black/60 text-gray-400 text-xs uppercase">
                                    <tr>
                                        <th className="px-4 py-3">Seller</th>
                                        <th className="px-4 py-3">Product</th>
                                        <th className="px-4 py-3 text-right">Value</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gold-medium/10">
                                    {loading && orders.length === 0 ? (
                                        Array(5).fill(0).map((_, i) => (
                                            <tr key={i} className="h-12">
                                                <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                                                <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                                                <td className="px-4 py-3 text-right"><Skeleton className="h-4 w-16 ml-auto" /></td>
                                            </tr>
                                        ))
                                    ) : filteredOrders.slice(0, 8).map((o) => (
                                        <tr key={o.id} className="hover:bg-white/5 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-white">{o.seller_name}</div>
                                                <div className="text-[10px] text-gray-500">{o.order_number}</div>
                                            </td>
                                            <td className="px-4 py-3 text-gray-400">{o.product_slug}</td>
                                            <td className="px-4 py-3 text-right font-bold text-gold-light">{formatCurrency(o.net_value)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
