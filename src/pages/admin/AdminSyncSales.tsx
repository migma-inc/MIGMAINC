import { useState, useEffect } from 'react';
import { adminSupabase } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, ShoppingBag, UserPlus, Loader2, EyeOff, HelpCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertModal } from '@/components/ui/alert-modal';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { Checkbox } from '@/components/ui/checkbox';

export function AdminSyncSales() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [sellers, setSellers] = useState<Seller[]>([]);
    const [products, setProducts] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [selectedSellerForOrder, setSelectedSellerForOrder] = useState<Record<string, string>>({});
    const [searchQuery, setSearchQuery] = useState('');
    const [alertConfig, setAlertConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        variant: 'success' | 'error' | 'warning' | 'info';
    }>({
        isOpen: false,
        title: '',
        message: '',
        variant: 'info'
    });
    const [confirmIgnore, setConfirmIgnore] = useState<{
        isOpen: boolean;
        orderIds: string[];
    }>({
        isOpen: false,
        orderIds: []
    });
    const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
    const [showHelp, setShowHelp] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        try {
            setLoading(true);

            // 1. Fetch completed orders without seller
            const { data: ordersData, error: ordersError } = await adminSupabase
                .from('visa_orders')
                .select('id, order_number, client_name, client_email, total_price_usd, product_slug, created_at, seller_id')
                .eq('payment_status', 'completed')
                .or('seller_id.is.null,seller_id.eq.""')
                .order('created_at', { ascending: false });

            if (ordersError) throw ordersError;
            setOrders(ordersData || []);

            // 2. Fetch active sellers
            const { data: sellersData, error: sellersError } = await adminSupabase
                .from('sellers')
                .select('seller_id_public, full_name, email')
                .eq('status', 'active')
                .eq('is_test', false)
                .order('full_name', { ascending: true });

            if (sellersError) throw sellersError;

            // 3. Fetch products
            const { data: productsData } = await adminSupabase
                .from('visa_products')
                .select('slug, name');

            const productsMap = (productsData || []).reduce((acc, p: any) => ({
                ...acc,
                [p.slug]: p.name
            }), {} as Record<string, string>);

            setProducts(productsMap);

            setSellers(sellersData || []);

        } catch (error) {
            console.error('[AdminSyncSales] Error loading data:', error);
            setAlertConfig({
                isOpen: true,
                title: 'Error',
                message: 'Failed to fetch orders or sellers. Please try again.',
                variant: 'error'
            });
        } finally {
            setLoading(false);
        }
    }

    async function handleSync(orderId: string) {
        const sellerId = selectedSellerForOrder[orderId];
        if (!sellerId) {
            setAlertConfig({
                isOpen: true,
                title: 'Selection Required',
                message: 'Please select a seller before syncing.',
                variant: 'warning'
            });
            return;
        }

        try {
            setProcessingId(orderId);

            const { error } = await adminSupabase
                .from('visa_orders')
                .update({ seller_id: sellerId })
                .eq('id', orderId);

            if (error) throw error;

            setAlertConfig({
                isOpen: true,
                title: 'Success!',
                message: 'Sale synchronized successfully. Commission should be calculated shortly.',
                variant: 'success'
            });
            setOrders(prev => prev.filter(o => o.id !== orderId));

        } catch (error) {
            console.error('[AdminSyncSales] Sync error:', error);
            setAlertConfig({
                isOpen: true,
                title: 'Sync Failed',
                message: 'Could not associate seller to order. Please try again.',
                variant: 'error'
            });
        } finally {
            setProcessingId(null);
        }
    }

    async function handleIgnore(orderIds: string[]) {
        try {
            setProcessingId('bulk');

            const { error } = await adminSupabase
                .from('visa_orders')
                .update({
                    seller_id: 'direct_sale',
                    payment_metadata: {
                        ignored_sync: true,
                        ignored_at: new Date().toISOString()
                    }
                })
                .in('id', orderIds);

            if (error) throw error;

            setOrders(prev => prev.filter(o => !orderIds.includes(o.id)));
            setSelectedOrderIds([]);

        } catch (error) {
            console.error('[AdminSyncSales] Ignore error:', error);
            setAlertConfig({
                isOpen: true,
                title: 'Operation Failed',
                message: 'Could not mark selected sales as direct sale. Please try again.',
                variant: 'error'
            });
        } finally {
            setProcessingId(null);
            setConfirmIgnore({ isOpen: false, orderIds: [] });
        }
    }

    const toggleSelectOrder = (id: string) => {
        setSelectedOrderIds(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        if (selectedOrderIds.length === filteredOrders.length) {
            setSelectedOrderIds([]);
        } else {
            setSelectedOrderIds(filteredOrders.map(o => o.id));
        }
    };

    const filteredOrders = orders.filter(o =>
        o.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.client_email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-gold-medium" />
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8 animate-in fade-in duration-500">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="mb-6 sm:mb-8">
                    <h1 className="text-2xl sm:text-3xl font-bold migma-gold-text mb-2">Sync Sales</h1>
                    <p className="text-sm sm:text-base text-gray-400">Manually associate sales without a seller to their respective responsible parties to generate commissions.</p>
                </div>

                <Card className="bg-zinc-950/40 border-gold-medium/20 backdrop-blur-sm overflow-hidden">
                    <CardHeader className="border-b border-gold-medium/10 pb-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <CardTitle className="text-lg flex items-center gap-2 text-white">
                                    <ShoppingBag className="w-5 h-5 text-gold-light" />
                                    Orphan Sales ({orders.length})
                                </CardTitle>
                                {selectedOrderIds.length > 0 && (
                                    <div className="flex items-center gap-2 animate-in slide-in-from-left-2 fade-in">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => setConfirmIgnore({ isOpen: true, orderIds: selectedOrderIds })}
                                            className="border-red-400/50 text-red-400 hover:bg-red-400/10 h-8 gap-2"
                                        >
                                            <EyeOff className="w-4 h-4" />
                                            Mark {selectedOrderIds.length} as Direct Sale
                                        </Button>
                                        <button
                                            onClick={() => setShowHelp(true)}
                                            className="text-gray-500 hover:text-gold-light transition-colors h-8 w-8 flex items-center justify-center rounded-full hover:bg-white/5"
                                            title="What is a Direct Sale?"
                                        >
                                            <HelpCircle className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="relative w-full md:w-72">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                <Input
                                    placeholder="Search by order or client..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9 bg-black/40 border-gold-medium/20 text-white text-sm"
                                />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-gold-medium/10 bg-black/20">
                                        <th className="py-4 px-6 w-10">
                                            <Checkbox
                                                checked={selectedOrderIds.length === filteredOrders.length && filteredOrders.length > 0}
                                                onCheckedChange={toggleSelectAll}
                                                className="border-gold-medium/50 data-[state=checked]:bg-gold-medium data-[state=checked]:text-black"
                                            />
                                        </th>
                                        <th className="text-left py-4 px-6 text-xs font-bold text-gold-light/60 uppercase tracking-wider">Order / Date</th>
                                        <th className="text-left py-4 px-6 text-xs font-bold text-gold-light/60 uppercase tracking-wider">Client</th>
                                        <th className="text-left py-4 px-6 text-xs font-bold text-gold-light/60 uppercase tracking-wider">Product / Value</th>
                                        <th className="text-left py-4 px-6 text-xs font-bold text-gold-light/60 uppercase tracking-wider">Seller</th>
                                        <th className="text-right py-4 px-6 text-xs font-bold text-gold-light/60 uppercase tracking-wider">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gold-medium/5">
                                    {filteredOrders.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="py-16 text-center text-gray-500 italic">
                                                {searchQuery ? 'No sales found for this search.' : 'There are no sales without a seller at the moment.'}
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredOrders.map((order) => {
                                            let price = parseFloat(order.total_price_usd || '0');
                                            if (price > 10000) price = price / 100;

                                            return (
                                                <tr key={order.id} className={`hover:bg-gold-medium/5 transition-colors group ${selectedOrderIds.includes(order.id) ? 'bg-gold-medium/10' : ''}`}>
                                                    <td className="py-4 px-6">
                                                        <Checkbox
                                                            checked={selectedOrderIds.includes(order.id)}
                                                            onCheckedChange={() => toggleSelectOrder(order.id)}
                                                            className="border-gold-medium/50 data-[state=checked]:bg-gold-medium data-[state=checked]:text-black"
                                                        />
                                                    </td>
                                                    <td className="py-4 px-6">
                                                        <p className="text-sm font-mono text-white group-hover:text-gold-light transition-colors">{order.order_number}</p>
                                                        <p className="text-[10px] text-gray-500 mt-0.5">{new Date(order.created_at).toLocaleDateString()}</p>
                                                    </td>
                                                    <td className="py-4 px-6">
                                                        <p className="text-sm text-white font-medium">{order.client_name}</p>
                                                        <p className="text-xs text-gray-500 mt-0.5">{order.client_email}</p>
                                                    </td>
                                                    <td className="py-4 px-6">
                                                        <Badge variant="outline" className="border-gold-medium/30 text-[10px] text-gray-400 bg-transparent uppercase mb-1">
                                                            {products[order.product_slug] || order.product_slug}
                                                        </Badge>
                                                        <p className="text-gold-light font-bold">${price.toFixed(2)}</p>
                                                    </td>
                                                    <td className="py-4 px-6">
                                                        <Select
                                                            value={selectedSellerForOrder[order.id]}
                                                            onValueChange={(val) => setSelectedSellerForOrder(prev => ({ ...prev, [order.id]: val }))}
                                                        >
                                                            <SelectTrigger className="w-full md:w-[180px] bg-black/40 border-gold-medium/20 text-white text-xs h-9">
                                                                <SelectValue placeholder="Choose Seller" />
                                                            </SelectTrigger>
                                                            <SelectContent className="bg-zinc-950 border-gold-medium/30 text-white">
                                                                {sellers.map(s => (
                                                                    <SelectItem key={s.seller_id_public} value={s.seller_id_public} className="text-xs">
                                                                        {s.full_name || s.email}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </td>
                                                    <td className="py-4 px-6 text-right">
                                                        <div className="flex items-center justify-end">
                                                            <Button
                                                                size="sm"
                                                                onClick={() => handleSync(order.id)}
                                                                disabled={processingId === order.id || !selectedSellerForOrder[order.id]}
                                                                className="bg-gold-medium hover:bg-gold-light text-black font-bold h-9 gap-2 shadow-lg shadow-gold-medium/10 whitespace-nowrap px-4"
                                                            >
                                                                {processingId === order.id ? (
                                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                                ) : (
                                                                    <UserPlus className="w-4 h-4" />
                                                                )}
                                                                Sync
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                <AlertModal
                    isOpen={alertConfig.isOpen}
                    onClose={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
                    title={alertConfig.title}
                    message={alertConfig.message}
                    variant={alertConfig.variant}
                />

                <ConfirmModal
                    isOpen={confirmIgnore.isOpen}
                    onClose={() => setConfirmIgnore({ isOpen: false, orderIds: [] })}
                    onConfirm={() => handleIgnore(confirmIgnore.orderIds)}
                    title={confirmIgnore.orderIds.length > 1 ? "Mark Multiple as Direct Sale" : "Mark as Direct Sale"}
                    message={confirmIgnore.orderIds.length > 1
                        ? `Are you sure you want to mark ${confirmIgnore.orderIds.length} orders as direct sales? They will be removed from this list.`
                        : "Are you sure you want to mark this as a direct sale? This confirms it was through an administrative link and doesn't require a seller. It will be removed from this list."
                    }
                    confirmText={confirmIgnore.orderIds.length > 1 ? "Yes, Mark All Selected" : "Yes, Mark as Direct"}
                    cancelText="Wait, Go Back"
                    isLoading={processingId === 'bulk' || (confirmIgnore.orderIds.length === 1 && processingId === confirmIgnore.orderIds[0])}
                />

                <AlertModal
                    isOpen={showHelp}
                    onClose={() => setShowHelp(false)}
                    title="What is a Direct Sale?"
                    message="Direct Sale means this order was made through the administrative landing page link. It does not have an associated seller and is not intended to have one assigned. By marking it as 'Direct Sale', it will simply be removed from this synchronization list."
                    variant="info"
                />
            </div>
        </div>
    );
}

interface Order {
    id: string;
    order_number: string;
    client_name: string;
    client_email: string;
    total_price_usd: string;
    product_slug: string;
    created_at: string;
    seller_id: string | null;
    payment_metadata?: any;
}

interface Seller {
    seller_id_public: string;
    full_name: string;
    email: string;
}
