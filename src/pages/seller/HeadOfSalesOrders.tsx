import { useOutletContext } from 'react-router-dom';
import type { SellerInfo } from '@/types/seller';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShoppingCart } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useDashboardCache } from '@/contexts/DashboardCacheContext';
import { Skeleton } from '@/components/ui/skeleton';

export function HeadOfSalesOrders() {
    const { seller } = useOutletContext<{ seller: SellerInfo }>();
    const { cache, setCacheValue } = useDashboardCache();
    const [orders, setOrders] = useState<any[]>(cache.orders || []);
    const [loading, setLoading] = useState(!cache.orders);

    useEffect(() => {
        async function loadOrders() {
            if (!seller.team_id) {
                setLoading(false);
                return;
            }

            try {
                // 1. Fetch ALL sellers to map names (including former ones)
                const { data: allSellers } = await supabase
                    .from('sellers')
                    .select('seller_id_public, full_name, team_id');

                const sellerMap = allSellers?.reduce((acc, current) => {
                    acc[current.seller_id_public] = {
                        name: current.full_name,
                        is_current: current.team_id === seller.team_id
                    };
                    return acc;
                }, {} as Record<string, { name: string, is_current: boolean }>);

                // 2. Fetch orders for the TEAM ID directly
                const { data } = await supabase
                    .from('visa_orders')
                    .select('*')
                    .eq('team_id', seller.team_id)
                    .order('created_at', { ascending: false })
                    .limit(100);

                if (data) {
                    const withDetails = data.map(o => {
                        const sellerDetail = sellerMap?.[o.seller_id];
                        return {
                            ...o,
                            seller_name: sellerDetail?.name || o.seller_id,
                            is_former: !sellerDetail?.is_current
                        };
                    });
                    setOrders(withDetails);
                    setCacheValue('orders', withDetails);
                } else {
                    setOrders([]);
                    setCacheValue('orders', []);
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
    }, [seller.id, seller.team_id]);

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Team Orders</h1>
                    <p className="text-gray-400 mt-1">Latest orders placed by your sellers.</p>
                </div>
            </div>

            <Card className="bg-black/40 border-gold-medium/20">
                <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                        <ShoppingCart className="w-5 h-5 text-gold-light" />
                        Recent Sales
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loading && orders.length === 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="text-xs text-gray-400 uppercase bg-white/5 border-b border-white/10">
                                    <tr>
                                        {Array(6).fill(0).map((_, i) => (
                                            <th key={i} className="px-6 py-3"><Skeleton className="h-4 w-20" /></th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {Array(5).fill(0).map((_, i) => (
                                        <tr key={i} className="border-b border-white/10">
                                            {Array(6).fill(0).map((_, j) => (
                                                <td key={j} className="px-6 py-4"><Skeleton className="h-4 w-full" /></td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : orders.length === 0 ? (
                        <p className="text-gray-400 text-center py-6">No orders found in your team.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-gray-300">
                                <thead className="text-xs text-gray-400 uppercase bg-white/5 border-b border-white/10">
                                    <tr>
                                        <th className="px-6 py-3">Seller</th>
                                        <th className="px-6 py-3">Client</th>
                                        <th className="px-6 py-3">Product</th>
                                        <th className="px-6 py-3">Value</th>
                                        <th className="px-6 py-3">Status</th>
                                        <th className="px-6 py-3">Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {orders.map(order => (
                                        <tr key={order.id} className="border-b border-white/10 hover:bg-white/5">
                                            <td className="px-6 py-4 font-medium text-purple-300">
                                                <div className="flex flex-col">
                                                    <span>{order.seller_name}</span>
                                                    {order.is_former && (
                                                        <span className="text-[10px] text-red-400 font-bold uppercase tracking-tighter">
                                                            Former Member
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
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
