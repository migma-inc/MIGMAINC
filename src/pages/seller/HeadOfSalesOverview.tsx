import { useOutletContext } from 'react-router-dom';
import type { SellerInfo } from '@/types/seller';
import { Users, DollarSign, Award, ShieldCheck, TrendingUp, ArrowUpRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { useDashboardCache } from '@/contexts/DashboardCacheContext';
import { Skeleton } from '@/components/ui/skeleton';

export function HeadOfSalesOverview() {
    const { seller } = useOutletContext<{ seller: SellerInfo }>();
    const { cache, setCacheValue } = useDashboardCache();
    
    // Initialize states from cache if available
    const [teamSize, setTeamSize] = useState(cache.overview?.teamSize || 0);
    const [teamSales, setTeamSales] = useState(cache.overview?.teamSales || 0);
    const [ordersCount, setOrdersCount] = useState(cache.overview?.ordersCount || 0);
    const [conversionRate, setConversionRate] = useState(cache.overview?.conversionRate || 0);
    const [topSellers, setTopSellers] = useState<any[]>(cache.overview?.topSellers || []);
    const [recentOrders, setRecentOrders] = useState<any[]>(cache.overview?.recentOrders || []);
    const [loading, setLoading] = useState(!cache.overview);

    useEffect(() => {
        async function loadStats() {
            if (!seller.team_id) {
                setLoading(false);
                return;
            }

            try {
                // 1. Obter membros ATUAIS da equipe
                const { data: currentMembers } = await supabase
                    .from('sellers')
                    .select('id, full_name, seller_id_public, team_id')
                    .eq('team_id', seller.team_id);

                // 2. Obter TODOS os vendedores (para mapear nomes de ex-membros)
                const { data: allSellers } = await supabase
                    .from('sellers')
                    .select('seller_id_public, full_name, team_id');

                const sellerMap = allSellers?.reduce((acc, s) => {
                    acc[s.seller_id_public] = {
                        name: s.full_name,
                        is_current: s.team_id === seller.team_id
                    };
                    return acc;
                }, {} as Record<string, { name: string, is_current: boolean }>);

                setTeamSize(currentMembers?.length || 0);

                // 3. Buscar TODAS as vendas do TIME (por team_id)
                const { data: teamOrders } = await supabase
                    .from('visa_orders')
                    .select('base_price_usd, extra_units, extra_unit_price_usd, discount_amount, upsell_price_usd, seller_id, client_name, product_slug, created_at, payment_status')
                    .eq('team_id', seller.team_id)
                    .eq('payment_status', 'completed');

                const totalOrders = teamOrders?.length || 0;
                setOrdersCount(totalOrders);

                const totalRevenue = teamOrders?.reduce((acc, order) => {
                    const base = Number(order.base_price_usd) || 0;
                    const extras = (Number(order.extra_units) || 0) * (Number(order.extra_unit_price_usd) || 0);
                    const upsell = Number(order.upsell_price_usd) || 0;
                    const discount = Number(order.discount_amount) || 0;
                    return acc + (base + extras + upsell - discount);
                }, 0) || 0;
                setTeamSales(totalRevenue);

                // 4. Calcular Conversão (Orders / Leads)
                // Buscamos os seller_ids históricos (quem já vendeu pelo time) + membros atuais
                const historicalSellerIds = Array.from(new Set([
                    ...(currentMembers?.map(m => m.seller_id_public) || []),
                    ...(teamOrders?.map(o => o.seller_id) || [])
                ]));

                const { count: leadsCount } = await supabase
                    .from('service_requests')
                    .select('*', { count: 'exact', head: true })
                    .in('seller_id', historicalSellerIds);
                
                if (leadsCount && leadsCount > 0) {
                    setConversionRate((totalOrders / leadsCount) * 100);
                }

                // 5. Ranking de Vendedores (inclui ex-membros que tiveram vendas para este time)
                const uniqueSellerIdsInOrders = Array.from(new Set(teamOrders?.map(o => o.seller_id) || []));
                
                const sellersRanking = uniqueSellerIdsInOrders.map(sid => {
                    const detail = sellerMap?.[sid];
                    const memberOrders = teamOrders?.filter(o => o.seller_id === sid) || [];
                    const revenue = memberOrders.reduce((acc, order) => {
                        const base = Number(order.base_price_usd) || 0;
                        const extras = (Number(order.extra_units) || 0) * (Number(order.extra_unit_price_usd) || 0);
                        const upsell = Number(order.upsell_price_usd) || 0;
                        const discount = Number(order.discount_amount) || 0;
                        return acc + (base + extras + upsell - discount);
                    }, 0);
                    return {
                        name: detail?.name || sid,
                        revenue,
                        orderCount: memberOrders.length,
                        is_former: !detail?.is_current
                    };
                })
                .sort((a, b) => b.revenue - a.revenue)
                .slice(0, 5);
                setTopSellers(sellersRanking);

                // 6. Pedidos Recentes
                const recent = teamOrders
                    ?.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                    .slice(0, 5)
                    .map(order => {
                        const detail = sellerMap?.[order.seller_id];
                        return {
                            ...order,
                            seller_name: detail?.name || order.seller_id,
                            is_former: !detail?.is_current,
                            net_value: Number(order.base_price_usd || 0) + 
                                       (Number(order.extra_units || 0) * Number(order.extra_unit_price_usd || 0)) + 
                                       Number(order.upsell_price_usd || 0) - 
                                       Number(order.discount_amount || 0)
                        };
                    });
                setRecentOrders(recent || []);

                // Update Cache
                setCacheValue('overview', {
                    teamSize: currentMembers?.length || 0,
                    teamSales: totalRevenue,
                    ordersCount: totalOrders,
                    conversionRate: leadsCount && leadsCount > 0 ? (totalOrders / leadsCount) * 100 : 0,
                    topSellers: sellersRanking,
                    recentOrders: recent || []
                });
            } catch (error) {
                console.error('Error loading team stats:', error);
            } finally {
                setLoading(false);
            }
        }

        if (seller.id) {
            loadStats();
        }
    }, [seller.id, seller.team_id]);

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Team Management</h1>
                    <p className="text-gray-400 mt-1">Welcome, {seller.full_name}. Monitor your team's real-time results.</p>
                </div>
            </div>

            {/* Top Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="bg-black/40 border-gold-medium/20 backdrop-blur-md transition-all hover:bg-black/60 hover:border-gold-medium/40">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-400">Revenue</CardTitle>
                        <DollarSign className="w-4 h-4 text-green-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-400">
                            {loading && !cache.overview ? <Skeleton className="h-8 w-32" /> : formatCurrency(teamSales)}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Net (no fees)</p>
                    </CardContent>
                </Card>

                <Card className="bg-black/40 border-gold-medium/20 backdrop-blur-md transition-all hover:bg-black/60 hover:border-gold-medium/40">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-400">Total Orders</CardTitle>
                        <ShieldCheck className="w-4 h-4 text-blue-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-400">
                            {loading && !cache.overview ? <Skeleton className="h-8 w-12" /> : ordersCount}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Completed sales</p>
                    </CardContent>
                </Card>

                <Card className="bg-black/40 border-gold-medium/20 backdrop-blur-md transition-all hover:bg-black/60 hover:border-gold-medium/40">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-400">Average Conversion</CardTitle>
                        <TrendingUp className="w-4 h-4 text-purple-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-purple-400">
                            {loading && !cache.overview ? <Skeleton className="h-8 w-16" /> : `${conversionRate.toFixed(1)}%`}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Sales funnel</p>
                    </CardContent>
                </Card>

                <Card className="bg-black/40 border-gold-medium/20 backdrop-blur-md transition-all hover:bg-black/60 hover:border-gold-medium/40">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-400">Team Size</CardTitle>
                        <Users className="w-4 h-4 text-gold-medium" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-gold-light">
                            {loading && !cache.overview ? <Skeleton className="h-8 w-12" /> : teamSize}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Linked sellers</p>
                    </CardContent>
                </Card>
            </div>

            {/* Detailed Sections */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Ranking Vendedores */}
                <Card className="bg-black/40 border-gold-medium/20 backdrop-blur-md overflow-hidden">
                    <CardHeader className="border-b border-gold-medium/10">
                        <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                            <Award className="w-5 h-5 text-gold-medium" />
                            Top Sellers (Top 5)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-gold-medium/10">
                            {loading && !cache.overview ? (
                                Array(3).fill(0).map((_, i) => (
                                    <div key={i} className="p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <Skeleton className="w-8 h-8 rounded-full" />
                                            <div className="space-y-2">
                                                <Skeleton className="h-4 w-32" />
                                                <Skeleton className="h-3 w-16" />
                                            </div>
                                        </div>
                                        <div className="text-right space-y-2">
                                            <Skeleton className="h-4 w-20 ml-auto" />
                                            <Skeleton className="h-3 w-24 ml-auto" />
                                        </div>
                                    </div>
                                ))
                            ) : topSellers.length > 0 ? (
                                topSellers.map((seller, idx) => (
                                    <div key={idx} className="p-4 flex items-center justify-between group hover:bg-white/5 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="w-8 h-8 rounded-full bg-gold-medium/20 flex items-center justify-center font-bold text-gold-light text-sm">
                                                {idx + 1}
                                            </div>
                                            <div>
                                                <div className="flex items-center">
                                                    <span className="text-gray-300 font-medium">{seller.name}</span>
                                                    {seller.is_former && (
                                                        <span className="ml-2 text-[10px] text-red-400 font-bold uppercase tracking-tighter">
                                                            Former Member
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-gray-500">{seller.orderCount} orders</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-bold text-gold-light">{formatCurrency(seller.revenue)}</div>
                                            <div className="text-[10px] text-green-500/80 flex items-center justify-end gap-1">
                                                <ArrowUpRight className="w-3 h-3" /> Revenue
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="p-8 text-center text-gray-500">No sales data available</div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Pedidos Recentes */}
                <Card className="bg-black/40 border-gold-medium/20 backdrop-blur-md overflow-hidden">
                    <CardHeader className="border-b border-gold-medium/10">
                        <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-blue-400" />
                            Recent Team Orders
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="text-xs text-gray-500 uppercase bg-black/40">
                                    <tr>
                                        <th className="px-4 py-3">Seller</th>
                                        <th className="px-4 py-3">Product</th>
                                        <th className="px-4 py-3">Value</th>
                                        <th className="px-4 py-3">Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gold-medium/10">
                                    {loading && !cache.overview ? (
                                        Array(3).fill(0).map((_, i) => (
                                            <tr key={i} className="h-12 border-b border-white/5">
                                                <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                                                <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                                                <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                                                <td className="px-4 py-3"><Skeleton className="h-4 w-12 ml-auto" /></td>
                                            </tr>
                                        ))
                                    ) : recentOrders.length > 0 ? (
                                        recentOrders.map((order, idx) => (
                                            <tr key={idx} className="hover:bg-white/5 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-col">
                                                        <p className="text-sm font-medium text-white">{order.seller_name}</p>
                                                        {order.is_former && (
                                                            <span className="text-[10px] text-red-400 font-bold uppercase tracking-tighter">
                                                                Former Member
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-[10px] text-gray-500">{order.client_name}</div>
                                                </td>
                                                <td className="px-4 py-3 text-gray-400">{order.product_slug}</td>
                                                <td className="px-4 py-3 font-bold text-gold-light">{formatCurrency(order.net_value)}</td>
                                                <td className="px-4 py-3 text-xs text-gray-500">
                                                    {format(new Date(order.created_at), 'dd/MM HH:mm')}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={4} className="p-8 text-center text-gray-500">Waiting for first sales...</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
