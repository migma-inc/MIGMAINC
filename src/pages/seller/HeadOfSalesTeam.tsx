import { useOutletContext } from 'react-router-dom';
import type { SellerInfo } from '@/types/seller';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, TrendingUp, ShoppingBag, LinkIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import { useDashboardCache } from '@/contexts/DashboardCacheContext';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AdminSellerAnalytics } from '@/pages/admin/AdminSellerAnalytics';
import { BarChart3 } from 'lucide-react';

interface TeamMember {
    id: string;
    full_name: string;
    email: string;
    seller_id_public: string;
    status: string;
    revenue: number;
    orderCount: number;
}

export function HeadOfSalesTeam() {
    const { seller } = useOutletContext<{ seller: SellerInfo }>();
    const { cache, setCacheValue } = useDashboardCache();
    const [members, setMembers] = useState<TeamMember[]>(cache.team || []);
    const [loading, setLoading] = useState(!cache.team);
    const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);
    const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = useState(false);

    useEffect(() => {
        async function loadTeamData() {
            if (!seller.team_id) {
                setLoading(false);
                return;
            }
            
            setLoading(true);
            try {
                // 1. Buscar membros da equipe vinculados ao MESMO TIME que este HoS
                const { data: teamData, error: teamError } = await supabase
                    .from('sellers')
                    .select('id, full_name, email, seller_id_public, status')
                    .eq('team_id', seller.team_id)
                    .eq('role', 'seller') // Apenas vendedores, não o próprio HoS
                    .order('full_name');

                if (teamError) throw teamError;

                if (teamData && teamData.length > 0) {
                    const sellerIds = teamData.map(m => m.seller_id_public);

                    // 2. Buscar pedidos de todos esses vendedores
                    const { data: orders, error: ordersError } = await supabase
                        .from('visa_orders')
                        .select('seller_id, total_price_usd, base_price_usd, extra_units, extra_unit_price_usd, discount_amount, upsell_price_usd')
                        .in('seller_id', sellerIds)
                        .eq('payment_status', 'completed');

                    if (ordersError) throw ordersError;

                    // 3. Processar os dados para associar faturamento aos membros
                    const processedMembers = teamData.map(member => {
                        const memberOrders = orders?.filter(o => o.seller_id === member.seller_id_public) || [];
                        const revenue = memberOrders.reduce((acc, order) => {
                            const base = Number(order.base_price_usd) || 0;
                            const extras = (Number(order.extra_units) || 0) * (Number(order.extra_unit_price_usd) || 0);
                            const upsell = Number(order.upsell_price_usd) || 0;
                            const discount = Number(order.discount_amount) || 0;
                            return acc + (base + extras + upsell - discount);
                        }, 0);
                        
                        return {
                            ...member,
                            revenue,
                            orderCount: memberOrders.length
                        };
                    }).sort((a, b) => b.revenue - a.revenue);

                    setMembers(processedMembers);
                    setCacheValue('team', processedMembers);
                } else {
                    setMembers([]);
                    setCacheValue('team', []);
                }
            } catch (error) {
                console.error('[HeadOfSalesTeam] Error loading team data:', error);
            } finally {
                setLoading(false);
            }
        }

        if (seller.id) {
            loadTeamData();
        }
    }, [seller.id, seller.team_id]);

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                        <Users className="w-8 h-8 text-gold-medium" />
                        My Team
                    </h1>
                    <p className="text-gray-400 mt-1">Monitor the individual performance of your sellers.</p>
                </div>
            </div>

            <Card className="bg-black/40 border-gold-medium/20 overflow-hidden">
                <CardContent className="p-0">
                    {loading && members.length === 0 ? (
                        <div className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="border-b border-gold-medium/20 bg-gold-medium/5">
                                        <tr>
                                            {Array(5).fill(0).map((_, i) => (
                                                <th key={i} className="px-6 py-4">
                                                    <Skeleton className="h-4 w-24 bg-gold-medium/10" />
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Array(5).fill(0).map((_, i) => (
                                            <tr key={i} className="border-b border-white/5">
                                                <td className="px-6 py-4">
                                                    <div className="space-y-2">
                                                        <Skeleton className="h-4 w-32" />
                                                        <Skeleton className="h-3 w-48 opacity-50" />
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4"><Skeleton className="h-6 w-16 mx-auto rounded-full" /></td>
                                                <td className="px-6 py-4"><Skeleton className="h-4 w-20 mx-auto" /></td>
                                                <td className="px-6 py-4"><Skeleton className="h-4 w-12 mx-auto" /></td>
                                                <td className="px-6 py-4"><Skeleton className="h-8 w-24 ml-auto" /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : members.length === 0 ? (
                        <div className="text-center py-20 px-8">
                            <Users className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-white mb-2">No sellers found in the team</h3>
                            <p className="text-gray-400 max-w-md mx-auto">
                                Your team appears to be empty right now. Contact the administrator to link new sellers to your team.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-gold-medium/20 bg-gold-medium/5">
                                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Seller</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Status</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Revenue (USD)</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Orders</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {members.map((member) => (
                                        <tr key={member.id} className="hover:bg-white/5 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div 
                                                    className="cursor-pointer group/name"
                                                    onClick={() => {
                                                        setSelectedSellerId(member.seller_id_public);
                                                        setIsAnalyticsModalOpen(true);
                                                    }}
                                                >
                                                    <p className="font-bold text-white group-hover/name:text-gold-light transition-colors">{member.full_name}</p>
                                                    <p className="text-xs text-gray-500">{member.email}</p>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                                    member.status === 'active' 
                                                    ? 'bg-green-500/10 text-green-500 border-green-500/20' 
                                                    : 'bg-red-500/10 text-red-500 border-red-500/20'
                                                }`}>
                                                    {member.status === 'active' ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <TrendingUp className="w-3 h-3 text-green-500" />
                                                    <span className="text-sm font-mono font-bold text-white">
                                                        {formatCurrency(member.revenue)}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <ShoppingBag className="w-3 h-3 text-gold-medium" />
                                                    <span className="text-sm font-bold text-gray-300">
                                                        {member.orderCount}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                                                <Button 
                                                    variant="outline" 
                                                    size="sm"
                                                    className="border-gold-medium/20 bg-black/40 text-gold-light hover:bg-gold-medium/10 hover:border-gold-medium h-8"
                                                    onClick={() => {
                                                        setSelectedSellerId(member.seller_id_public);
                                                        setIsAnalyticsModalOpen(true);
                                                    }}
                                                    title="View Analytics"
                                                >
                                                    <BarChart3 className="w-4 h-4 mr-0 sm:mr-2" />
                                                    <span className="hidden sm:inline">Analytics</span>
                                                </Button>

                                                <Button 
                                                    variant="outline" 
                                                    size="sm"
                                                    className="border-blue-500/20 bg-black/40 text-blue-400 hover:bg-blue-500/10 hover:border-blue-500 h-8"
                                                    onClick={() => {
                                                        const url = new URL(window.location.origin + '/seller/dashboard/links');
                                                        url.searchParams.set('sellerId', member.id);
                                                        window.location.href = url.toString();
                                                    }}
                                                    title="Generate Link"
                                                >
                                                    <LinkIcon className="w-4 h-4 mr-0 sm:mr-2" />
                                                    <span className="hidden sm:inline">Generate Link</span>
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={isAnalyticsModalOpen} onOpenChange={setIsAnalyticsModalOpen}>
                <DialogContent className="max-w-[95vw] w-full max-h-[90vh] overflow-y-auto custom-scrollbar bg-black border-gold-medium/30 p-0 sm:p-2">
                    <DialogHeader className="p-4 sm:p-6 pb-0">
                        <DialogTitle className="text-xl sm:text-2xl font-bold migma-gold-text">
                            Seller Analytics
                        </DialogTitle>
                    </DialogHeader>
                    <div className="p-2 sm:p-4">
                        {selectedSellerId && (
                            <AdminSellerAnalytics sellerId={selectedSellerId} isModal={true} />
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
