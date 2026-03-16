import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Coins, TrendingUp, UserCheck } from 'lucide-react';
import type { SellerInfo } from '@/types/seller';
import { format } from 'date-fns';

export function HeadOfSalesCommissions() {
    const { seller } = useOutletContext<{ seller: SellerInfo }>();
    const [commissions, setCommissions] = useState<any[]>([]);
    const [totalTeamCommission, setTotalTeamCommission] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadCommissions() {
            try {
                // 1. Obter membros da equipe
                const { data: teamMembers } = await supabase
                    .from('sellers')
                    .select('id, full_name, seller_id_public')
                    .eq('head_of_sales_id', seller.id);

                if (teamMembers && teamMembers.length > 0) {
                    const sellerIds = teamMembers.map(m => m.seller_id_public);

                    // 2. Buscar pedidos de todos esses vendedores
                    const { data: orders } = await supabase
                        .from('visa_orders')
                        .select('id, order_number, base_price_usd, extra_units, extra_unit_price_usd, discount_amount, upsell_price_usd, seller_id, client_name, product_slug, created_at')
                        .in('seller_id', sellerIds)
                        .eq('payment_status', 'completed');

                    if (orders && orders.length > 0) {
                        const orderIds = orders.map(o => o.id);

                        // 3. Buscar comissões vinculadas a esses pedidos
                        const { data: commissionsData } = await supabase
                            .from('seller_commissions')
                            .select('*')
                            .in('order_id', orderIds);

                        // 4. Processar dados
                        const processed = orders.map(order => {
                            const comm = commissionsData?.find(c => c.order_id === order.id);
                            const sellerName = teamMembers.find(m => m.seller_id_public === order.seller_id)?.full_name || 'Unknown';
                            
                            // Valor líquido calculado (regra HoS)
                            const netValue = Number(order.base_price_usd || 0) + 
                                           (Number(order.extra_units || 0) * Number(order.extra_unit_price_usd || 0)) + 
                                           Number(order.upsell_price_usd || 0) - 
                                           Number(order.discount_amount || 0);

                            return {
                                id: order.id,
                                order_number: order.order_number,
                                seller_name: sellerName,
                                client_name: order.client_name,
                                net_value: netValue,
                                commission_amount: Number(comm?.commission_amount_usd || 0),
                                date: order.created_at
                            };
                        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                        setCommissions(processed);
                        setTotalTeamCommission(processed.reduce((acc, curr) => acc + curr.commission_amount, 0));
                    }
                }
            } catch (error) {
                console.error('Error loading team commissions:', error);
            } finally {
                setLoading(false);
            }
        }

        if (seller.id) {
            loadCommissions();
        }
    }, [seller.id]);

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-white tracking-tight">Comissões de Gestão (Overrides)</h1>
                <p className="text-gray-400 mt-1">Acompanhe seus ganhos de override sobre as vendas realizadas pelo seu time.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-black/40 border-gold-medium/20 backdrop-blur-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-400">Total em Overrides (Gestão)</CardTitle>
                        <Coins className="w-4 h-4 text-gold-medium" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-gold-light">
                            {loading ? '...' : formatCurrency(totalTeamCommission)}
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-black/40 border-gold-medium/20 backdrop-blur-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-400">Vendas com Comissão</CardTitle>
                        <TrendingUp className="w-4 h-4 text-green-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-400">
                            {loading ? '...' : commissions.length}
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-black/40 border-gold-medium/20 backdrop-blur-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-400">Média por Venda</CardTitle>
                        <UserCheck className="w-4 h-4 text-blue-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-400">
                            {loading ? '...' : formatCurrency(commissions.length > 0 ? totalTeamCommission / commissions.length : 0)}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="bg-black/40 border-gold-medium/20 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="text-xs text-gray-500 uppercase bg-black/40 border-b border-gold-medium/10">
                            <tr>
                                <th className="px-6 py-4">Vendedor</th>
                                <th className="px-6 py-4">Cliente</th>
                                <th className="px-6 py-4">Valor Líquido</th>
                                <th className="px-6 py-4">Meu Override</th>
                                <th className="px-6 py-4 text-right">Data</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gold-medium/10">
                            {loading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse bg-white/5 h-16" />
                                ))
                            ) : commissions.length > 0 ? (
                                commissions.map((item) => (
                                    <tr key={item.id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-white">{item.seller_name}</div>
                                            <div className="text-[10px] text-gray-500">{item.order_number}</div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-300">{item.client_name}</td>
                                        <td className="px-6 py-4 font-medium text-gray-400">{formatCurrency(item.net_value)}</td>
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-gold-light">{formatCurrency(item.commission_amount)}</div>
                                        </td>
                                        <td className="px-6 py-4 text-right text-xs text-gray-500">
                                            {format(new Date(item.date), 'dd/MM/yyyy HH:mm')}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500 italic">
                                        Nenhuma comissão de gestão (override) gerada até o momento.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
