import { useOutletContext } from 'react-router-dom';
import type { SellerInfo } from '@/types/seller';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShoppingCart } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export function HeadOfSalesOrders() {
    const { seller } = useOutletContext<{ seller: SellerInfo }>();
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadOrders() {
            try {
                const { data: teamMembers } = await supabase
                    .from('sellers')
                    .select('seller_id_public, full_name')
                    .eq('head_of_sales_id', seller.id);

                if (teamMembers && teamMembers.length > 0) {
                    const sellerMap = teamMembers.reduce((acc, current) => {
                        acc[current.seller_id_public] = current.full_name;
                        return acc;
                    }, {} as Record<string, string>);

                    const sellerIds = teamMembers.map(m => m.seller_id_public);

                    const { data } = await supabase
                        .from('visa_orders')
                        .select('*')
                        .in('seller_id', sellerIds)
                        .order('created_at', { ascending: false })
                        .limit(50);

                    if (data) {
                        const withNames = data.map(o => ({
                            ...o,
                            seller_name: sellerMap[o.seller_id] || o.seller_id
                        }));
                        setOrders(withNames);
                    }
                }
            } catch (error) {
                console.error('Error loading team orders:', error);
            } finally {
                setLoading(false);
            }
        }

        if (seller.id) {
            loadOrders();
        }
    }, [seller.id]);

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Pedidos da Equipe</h1>
                    <p className="text-gray-400 mt-1">Últimos pedidos realizados pelos seus vendedores.</p>
                </div>
            </div>

            <Card className="bg-black/40 border-gold-medium/20">
                <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                        <ShoppingCart className="w-5 h-5 text-gold-light" />
                        Vendas Recentes
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <p className="text-gray-400">Carregando...</p>
                    ) : orders.length === 0 ? (
                        <p className="text-gray-400 text-center py-6">Nenhum pedido encontrado para sua equipe.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-gray-300">
                                <thead className="text-xs text-gray-400 uppercase bg-white/5 border-b border-white/10">
                                    <tr>
                                        <th className="px-6 py-3">Vendedor</th>
                                        <th className="px-6 py-3">Cliente</th>
                                        <th className="px-6 py-3">Produto</th>
                                        <th className="px-6 py-3">Valor</th>
                                        <th className="px-6 py-3">Status</th>
                                        <th className="px-6 py-3">Data</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {orders.map(order => (
                                        <tr key={order.id} className="border-b border-white/10 hover:bg-white/5">
                                            <td className="px-6 py-4 font-medium text-purple-300">{order.seller_name}</td>
                                            <td className="px-6 py-4">{order.client_name}</td>
                                            <td className="px-6 py-4">{order.product_slug}</td>
                                            <td className="px-6 py-4 font-bold text-gold-light">
                                                {formatCurrency(
                                                    Number(order.base_price_usd || 0) + 
                                                    (Number(order.extra_units || 0) * Number(order.extra_unit_price_usd || 0)) + 
                                                    Number(order.upsell_price_usd || 0) - 
                                                    Number(order.discount_amount || 0)
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded text-xs ${order.payment_status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                                    {order.payment_status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">{new Date(order.created_at).toLocaleDateString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
