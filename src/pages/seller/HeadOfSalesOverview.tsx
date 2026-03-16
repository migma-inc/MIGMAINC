import { useOutletContext } from 'react-router-dom';
import type { SellerInfo } from '@/types/seller';
import { Users, DollarSign, Award, ShieldCheck, TrendingUp, ArrowUpRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';

export function HeadOfSalesOverview() {
    const { seller } = useOutletContext<{ seller: SellerInfo }>();
    const [teamSize, setTeamSize] = useState(0);
    const [teamSales, setTeamSales] = useState(0);
    const [ordersCount, setOrdersCount] = useState(0);
    const [conversionRate, setConversionRate] = useState(0);
    const [topSellers, setTopSellers] = useState<any[]>([]);
    const [recentOrders, setRecentOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadStats() {
            try {
                // 1. Obter membros da equipe
                const { data: teamMembers } = await supabase
                    .from('sellers')
                    .select('id, full_name, seller_id_public')
                    .eq('head_of_sales_id', seller.id);

                setTeamSize(teamMembers?.length || 0);

                if (teamMembers && teamMembers.length > 0) {
                    const sellerIds = teamMembers.map(m => m.seller_id_public);

                    // 2. Buscar vendas concluídas
                    const { data: teamOrders } = await supabase
                        .from('visa_orders')
                        .select('base_price_usd, extra_units, extra_unit_price_usd, discount_amount, upsell_price_usd, seller_id, client_name, product_slug, created_at, payment_status')
                        .in('seller_id', sellerIds)
                        .eq('payment_status', 'completed');

                    // 3. Calcular faturamento e contagem
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
                    const { count: leadsCount } = await supabase
                        .from('service_requests')
                        .select('*', { count: 'exact', head: true })
                        .in('seller_id', sellerIds);
                    
                    if (leadsCount && leadsCount > 0) {
                        setConversionRate((totalOrders / leadsCount) * 100);
                    }

                    // 5. Ranking de Vendedores
                    const sellersRanking = teamMembers.map(member => {
                        const memberOrders = teamOrders?.filter(o => o.seller_id === member.seller_id_public) || [];
                        const revenue = memberOrders.reduce((acc, order) => {
                            const base = Number(order.base_price_usd) || 0;
                            const extras = (Number(order.extra_units) || 0) * (Number(order.extra_unit_price_usd) || 0);
                            const upsell = Number(order.upsell_price_usd) || 0;
                            const discount = Number(order.discount_amount) || 0;
                            return acc + (base + extras + upsell - discount);
                        }, 0);
                        return {
                            name: member.full_name,
                            revenue,
                            orderCount: memberOrders.length
                        };
                    })
                    .sort((a, b) => b.revenue - a.revenue)
                    .slice(0, 5);
                    setTopSellers(sellersRanking);

                    // 6. Pedidos Recentes
                    const recent = teamOrders
                        ?.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                        .slice(0, 5)
                        .map(order => ({
                            ...order,
                            seller_name: teamMembers.find(m => m.seller_id_public === order.seller_id)?.full_name || 'Desconhecido',
                            net_value: Number(order.base_price_usd || 0) + 
                                       (Number(order.extra_units || 0) * Number(order.extra_unit_price_usd || 0)) + 
                                       Number(order.upsell_price_usd || 0) - 
                                       Number(order.discount_amount || 0)
                        }));
                    setRecentOrders(recent || []);
                }
            } catch (error) {
                console.error('Error loading team stats:', error);
            } finally {
                setLoading(false);
            }
        }

        if (seller.id) {
            loadStats();
        }
    }, [seller.id]);

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Gestão de Equipe</h1>
                    <p className="text-gray-400 mt-1">Bem-vindo(a), {seller.full_name}. Acompanhe os resultados da sua equipe em tempo real.</p>
                </div>
            </div>

            {/* Top Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="bg-black/40 border-gold-medium/20 backdrop-blur-md transition-all hover:bg-black/60 hover:border-gold-medium/40">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-400">Faturamento Real</CardTitle>
                        <DollarSign className="w-4 h-4 text-green-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-400">
                            {loading ? '...' : formatCurrency(teamSales)}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Líquido (sem taxas)</p>
                    </CardContent>
                </Card>

                <Card className="bg-black/40 border-gold-medium/20 backdrop-blur-md transition-all hover:bg-black/60 hover:border-gold-medium/40">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-400">Total de Pedidos</CardTitle>
                        <ShieldCheck className="w-4 h-4 text-blue-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-400">
                            {loading ? '...' : ordersCount}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Vendas concluídas</p>
                    </CardContent>
                </Card>

                <Card className="bg-black/40 border-gold-medium/20 backdrop-blur-md transition-all hover:bg-black/60 hover:border-gold-medium/40">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-400">Conversão Média</CardTitle>
                        <TrendingUp className="w-4 h-4 text-purple-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-purple-400">
                            {loading ? '...' : `${conversionRate.toFixed(1)}%`}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Funnel de vendas</p>
                    </CardContent>
                </Card>

                <Card className="bg-black/40 border-gold-medium/20 backdrop-blur-md transition-all hover:bg-black/60 hover:border-gold-medium/40">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-400">Tamanho da Equipe</CardTitle>
                        <Users className="w-4 h-4 text-gold-medium" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-gold-light">
                            {loading ? '...' : teamSize}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Vendedores vinculados</p>
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
                            Melhores Vendedores (Top 5)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-gold-medium/10">
                            {loading ? (
                                Array(3).fill(0).map((_, i) => (
                                    <div key={i} className="p-4 animate-pulse bg-white/5" />
                                ))
                            ) : topSellers.length > 0 ? (
                                topSellers.map((seller, idx) => (
                                    <div key={idx} className="p-4 flex items-center justify-between group hover:bg-white/5 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="w-8 h-8 rounded-full bg-gold-medium/20 flex items-center justify-center font-bold text-gold-light text-sm">
                                                {idx + 1}
                                            </div>
                                            <div>
                                                <div className="font-bold text-white">{seller.name}</div>
                                                <div className="text-xs text-gray-500">{seller.orderCount} pedidos</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-bold text-gold-light">{formatCurrency(seller.revenue)}</div>
                                            <div className="text-[10px] text-green-500/80 flex items-center justify-end gap-1">
                                                <ArrowUpRight className="w-3 h-3" /> Faturamento Real
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="p-8 text-center text-gray-500">Nenhum dado de venda disponível</div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Pedidos Recentes */}
                <Card className="bg-black/40 border-gold-medium/20 backdrop-blur-md overflow-hidden">
                    <CardHeader className="border-b border-gold-medium/10">
                        <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-blue-400" />
                            Pedidos Recentes do Time
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="text-xs text-gray-500 uppercase bg-black/40">
                                    <tr>
                                        <th className="px-4 py-3">Vendedor</th>
                                        <th className="px-4 py-3">Produto</th>
                                        <th className="px-4 py-3">Valor</th>
                                        <th className="px-4 py-3">Data</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gold-medium/10">
                                    {loading ? (
                                        Array(3).fill(0).map((_, i) => (
                                            <tr key={i} className="animate-pulse bg-white/5 h-12" />
                                        ))
                                    ) : recentOrders.length > 0 ? (
                                        recentOrders.map((order, idx) => (
                                            <tr key={idx} className="hover:bg-white/5 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="font-medium text-white">{order.seller_name}</div>
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
                                            <td colSpan={4} className="p-8 text-center text-gray-500">Aguardando primeiras vendas...</td>
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
