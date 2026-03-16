import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Briefcase, Layers, TrendingUp, BarChart3 } from 'lucide-react';
import type { SellerInfo } from '@/types/seller';
import { subDays, startOfMonth, isWithinInterval } from 'date-fns';
import { Button } from '@/components/ui/button';

export function HeadOfSalesTotalSales() {
    const { seller } = useOutletContext<{ seller: SellerInfo }>();
    const [orders, setOrders] = useState<any[]>([]);
    const [filteredOrders, setFilteredOrders] = useState<any[]>([]);
    const [period, setPeriod] = useState<'all' | 'month' | 'week' | 'day'>('all');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadAllSales() {
            try {
                const { data: teamMembers } = await supabase
                    .from('sellers')
                    .select('seller_id_public, full_name')
                    .eq('head_of_sales_id', seller.id);

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
    }, [seller.id]);

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
                    <h1 className="text-3xl font-bold text-white tracking-tight">Vendas Totais</h1>
                    <p className="text-gray-400 mt-1">Visão consolidada de todas as vendas realizadas pelo time.</p>
                </div>

                <div className="flex items-center gap-2 bg-black/40 p-1 rounded-lg border border-gold-medium/20">
                    <Button 
                        variant={period === 'all' ? 'default' : 'ghost'} 
                        size="sm" 
                        onClick={() => setPeriod('all')}
                        className={period === 'all' ? 'bg-gold-medium text-black' : 'text-gray-400'}
                    >Tudo</Button>
                    <Button 
                        variant={period === 'month' ? 'default' : 'ghost'} 
                        size="sm" 
                        onClick={() => setPeriod('month')}
                        className={period === 'month' ? 'bg-gold-medium text-black' : 'text-gray-400'}
                    >Mês</Button>
                    <Button 
                        variant={period === 'week' ? 'default' : 'ghost'} 
                        size="sm" 
                        onClick={() => setPeriod('week')}
                        className={period === 'week' ? 'bg-gold-medium text-black' : 'text-gray-400'}
                    >Semana</Button>
                    <Button 
                        variant={period === 'day' ? 'default' : 'ghost'} 
                        size="sm" 
                        onClick={() => setPeriod('day')}
                        className={period === 'day' ? 'bg-gold-medium text-black' : 'text-gray-400'}
                    >Hoje</Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-black/40 border-gold-medium/20 backdrop-blur-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-400">Volume Bruto do Período</CardTitle>
                        <BarChart3 className="w-4 h-4 text-gold-medium" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-gold-light">
                            {loading ? '...' : formatCurrency(totalSalesValue)}
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-black/40 border-gold-medium/20 backdrop-blur-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-400">Total de Unidades</CardTitle>
                        <Layers className="w-4 h-4 text-blue-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-400">
                            {loading ? '...' : filteredOrders.length}
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-black/40 border-gold-medium/20 backdrop-blur-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-400">Ticket Médio</CardTitle>
                        <TrendingUp className="w-4 h-4 text-green-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-400">
                            {loading ? '...' : formatCurrency(filteredOrders.length > 0 ? totalSalesValue / filteredOrders.length : 0)}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-black/40 border-gold-medium/20">
                    <CardHeader>
                        <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                            <Briefcase className="w-5 h-5 text-gold-medium" />
                            Vendas por Produto
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {Object.entries(productStats).map(([slug, stats]: [string, any]) => (
                                <div key={slug} className="flex items-center justify-between p-3 rounded bg-white/5 border border-white/10">
                                    <div>
                                        <div className="font-medium text-gray-200 uppercase text-xs">{slug}</div>
                                        <div className="text-xl font-bold text-white">{stats.count} vds</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs text-gray-500 uppercase">Faturamento</div>
                                        <div className="text-lg font-bold text-gold-light">{formatCurrency(stats.revenue)}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-black/40 border-gold-medium/20 overflow-hidden">
                    <CardHeader>
                        <CardTitle className="text-lg font-bold text-white">Últimos Pedidos no Período</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-black/60 text-gray-400 text-xs uppercase">
                                    <tr>
                                        <th className="px-4 py-3">Vendedor</th>
                                        <th className="px-4 py-3">Produto</th>
                                        <th className="px-4 py-3 text-right">Valor</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gold-medium/10">
                                    {filteredOrders.slice(0, 8).map((o) => (
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
