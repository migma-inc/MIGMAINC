import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Crown, Users, X, Loader2, UserPlus, Search, UserCheck, BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ManageTeamModal } from '@/components/admin/ManageTeamModal';
import { PromoteHosModal } from '@/components/admin/PromoteHosModal';

interface Seller {
    id: string;
    full_name: string;
    email: string;
    seller_id_public: string;
    status: string;
    role: string;
    head_of_sales_id: string | null;
    team_name?: string | null;
    is_test: boolean;
}

export function HeadOfSalesManagement() {
    const [sellers, setSellers] = useState<Seller[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    
    // Modals
    const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
    const [isPromoteModalOpen, setIsPromoteModalOpen] = useState(false);
    const [selectedHos, setSelectedHos] = useState<{ id: string, full_name: string, team_name: string | null } | null>(null);
    const [hosMetrics, setHosMetrics] = useState<Record<string, { netRevenue: number, totalOrders: number, totalOverrides: number }>>({});

    useEffect(() => {
        loadSellers();
    }, []);

    const loadSellers = async () => {
        console.log('[HeadOfSalesManagement] Loading sellers...');
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('sellers')
                .select('id, full_name, email, seller_id_public, status, role, head_of_sales_id, is_test')
                .eq('is_test', false)
                .order('full_name');

            if (error) {
                console.error('[HeadOfSalesManagement] Error loading sellers:', error);
                throw error;
            }
            
            console.log('[HeadOfSalesManagement] Sellers loaded:', data?.length || 0, 'records found.');
            setSellers(data || []);
            
            // Carregar métricas se houver HoS
            const hosList = data?.filter(s => s.role === 'head_of_sales') || [];
            if (hosList.length > 0) {
                loadHosMetrics(hosList, data || []);
            }
        } catch (err) {
            console.error('[HeadOfSalesManagement] Unexpected error:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadHosMetrics = async (hosList: Seller[], allSellers: Seller[]) => {
        try {
            const metrics: Record<string, { netRevenue: number, totalOrders: number, totalOverrides: number }> = {};
            
            for (const hos of hosList) {
                const teamPublicIds = allSellers
                    .filter(s => s.head_of_sales_id === hos.id)
                    .map(s => s.seller_id_public);

                if (teamPublicIds.length > 0) {
                    const { data: teamOrders } = await supabase
                        .from('visa_orders')
                        .select('id, base_price_usd, extra_units, extra_unit_price_usd, upsell_price_usd, discount_amount')
                        .in('seller_id', teamPublicIds)
                        .eq('payment_status', 'completed');

                    const netRevenue = teamOrders?.reduce((acc, order) => {
                        return acc + (Number(order.base_price_usd || 0) + 
                               (Number(order.extra_units || 0) * Number(order.extra_unit_price_usd || 0)) + 
                               Number(order.upsell_price_usd || 0) - 
                               Number(order.discount_amount || 0));
                    }, 0) || 0;

                    // Buscar Overrides
                    let totalOverrides = 0;
                    if (teamOrders && teamOrders.length > 0) {
                        const orderIds = teamOrders.map(o => o.id);
                        const { data: comms } = await supabase
                            .from('seller_commissions')
                            .select('commission_amount_usd')
                            .in('order_id', orderIds);
                        
                        totalOverrides = comms?.reduce((acc, c) => acc + Number(c.commission_amount_usd || 0), 0) || 0;
                    }

                    metrics[hos.id] = {
                        netRevenue,
                        totalOrders: teamOrders?.length || 0,
                        totalOverrides
                    };
                } else {
                    metrics[hos.id] = { netRevenue: 0, totalOrders: 0, totalOverrides: 0 };
                }
            }
            setHosMetrics(metrics);
        } catch (err) {
            console.error('[HeadOfSalesManagement] Error loading metrics:', err);
        }
    };

    const demoteToSeller = async (seller: Seller) => {
        console.log('[HeadOfSalesManagement] Demoting seller:', seller.id);
        setSaving(seller.id);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                console.error('[HeadOfSalesManagement] No active session found.');
                throw new Error('Not authenticated');
            }

            const { error } = await supabase.functions.invoke('admin-update-seller', {
                body: {
                    seller_id: seller.id,
                    full_name: seller.full_name,
                    email: seller.email,
                    phone: '-',
                    seller_id_public: seller.seller_id_public,
                    role: 'seller',
                    head_of_sales_id: null,
                },
            });

            if (error) throw error;
            console.log('[HeadOfSalesManagement] Seller demoted successfully.');
            await loadSellers();
        } catch (err) {
            console.error('[HeadOfSalesManagement] Error demoting seller:', err);
        } finally {
            setSaving(null);
        }
    };

    const headsOfSales = sellers.filter(s => s.role === 'head_of_sales');
    const regularSellers = sellers.filter(s => s.role !== 'head_of_sales');

    const filteredHeadsOfSales = headsOfSales.filter(s => {
        if (!search) return true;
        return (
            s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
            s.email?.toLowerCase().includes(search.toLowerCase()) ||
            s.seller_id_public?.toLowerCase().includes(search.toLowerCase())
        );
    });

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                            <Crown className="w-8 h-8 text-gold-medium" />
                            Head of Sales Management
                        </h1>
                        <p className="text-gray-400 mt-1">
                            Manage managers and structure sales teams.
                        </p>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="bg-black/40 border-purple-500/30">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-gray-400">Heads of Sales</CardTitle>
                            <Crown className="w-4 h-4 text-purple-400" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-purple-300">{headsOfSales.length}</div>
                            <p className="text-xs text-gray-500 mt-1">Active managers</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-black/40 border-gold-medium/20">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-gray-400">Sellers with Manager</CardTitle>
                            <Users className="w-4 h-4 text-gold-medium" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-gold-light">
                                {regularSellers.filter(s => s.head_of_sales_id).length}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Bound to a team</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-black/40 border-gray-700/30">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-gray-400">Without Manager</CardTitle>
                            <UserPlus className="w-4 h-4 text-gray-400" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-gray-300">
                                {regularSellers.filter(s => !s.head_of_sales_id).length}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Awaiting assignment</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Action Section */}
                <div className="flex flex-col items-center justify-center py-6 bg-white/5 border border-white/10 rounded-2xl gap-4">
                    <div className="text-center">
                        <h3 className="text-lg font-bold text-white tracking-tight">Promote Head of Sales</h3>
                        <p className="text-sm text-gray-400 mt-1">Found a seller to lead a team? Promote them here.</p>
                    </div>
                    <Button
                        onClick={() => setIsPromoteModalOpen(true)}
                        className="h-14 px-8 bg-gold-medium hover:bg-gold-dark text-black font-bold text-lg rounded-xl flex items-center gap-3 shadow-xl transition-all hover:scale-105"
                    >
                        <UserCheck className="w-6 h-6" />
                        Promote Manager
                    </Button>
                </div>

                {/* List Section */}
                <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Users className="w-5 h-5 text-gold-medium" />
                            Heads of Sales & Teams
                        </h2>
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search manager..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-black/50 border border-gold-medium/10 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-gold-medium"
                            />
                        </div>
                    </div>

                    <Card className="bg-black/40 border-gold-medium/20">
                        <CardContent className="p-0">
                            {loading ? (
                                <div className="flex items-center justify-center py-16">
                                    <Loader2 className="w-8 h-8 text-gold-medium animate-spin" />
                                </div>
                            ) : filteredHeadsOfSales.length === 0 ? (
                                <div className="text-center py-16">
                                    <p className="text-gray-400">No managers found.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead>
                                            <tr className="border-b border-gold-medium/20 text-xs text-gray-400 uppercase">
                                                <th className="px-6 py-4">Manager</th>
                                                <th className="px-6 py-4">Public ID</th>
                                                <th className="px-6 py-4 text-center">Team</th>
                                                <th className="px-6 py-4 text-center">Faturamento Real</th>
                                                <th className="px-6 py-4 text-center">Overrides Totais</th>
                                                <th className="px-6 py-4 text-center">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredHeadsOfSales.map(seller => {
                                                const isDemoting = saving === seller.id;
                                                const teamSize = regularSellers.filter(s => s.head_of_sales_id === seller.id).length;

                                                return (
                                                    <tr
                                                        key={seller.id}
                                                        className="border-b border-white/5 hover:bg-white/5 transition-colors"
                                                    >
                                                        <td className="px-6 py-4">
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <p className="font-medium text-white">{seller.full_name}</p>
                                                                    {seller.is_test && (
                                                                        <span className="text-[10px] px-1.5 py-0.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded font-bold uppercase tracking-wider">
                                                                            Test
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <p className="text-xs text-gray-500">{seller.email}</p>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-gray-400 font-mono text-xs">
                                                            {seller.seller_id_public}
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-gold-medium/10 text-gold-light border border-gold-medium/20">
                                                                {teamSize} sellers
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <div className="font-bold text-white">
                                                                {formatCurrency(hosMetrics[seller.id]?.netRevenue || 0)}
                                                            </div>
                                                            <div className="text-[10px] text-gray-500">
                                                                {hosMetrics[seller.id]?.totalOrders || 0} orders
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <div className="font-bold text-gold-light">
                                                                {formatCurrency(hosMetrics[seller.id]?.totalOverrides || 0)}
                                                            </div>
                                                            <div className="text-[10px] text-gray-500">
                                                                Management Ganhos
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center justify-center gap-2">
                                                                <Link to={`/dashboard/head-of-sales/${seller.seller_id_public}/analytics`}>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        className="text-xs border-blue-500/40 bg-black text-blue-400 hover:bg-blue-500 hover:text-white transition-all font-semibold"
                                                                    >
                                                                        <BarChart3 className="w-3 h-3 mr-1" />
                                                                        Analytics
                                                                    </Button>
                                                                </Link>
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => {
                                                                        setSelectedHos({
                                                                            id: seller.id,
                                                                            full_name: seller.full_name,
                                                                            team_name: seller.team_name || null
                                                                        });
                                                                        setIsTeamModalOpen(true);
                                                                    }}
                                                                    className="text-xs border-gold-medium/40 bg-black text-gold-medium hover:bg-gold-medium hover:text-black transition-all font-semibold"
                                                                >
                                                                    <Users className="w-3 h-3 mr-1" />
                                                                    Manage
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => demoteToSeller(seller)}
                                                                    disabled={isDemoting}
                                                                    className="text-xs border-red-500/40 bg-black text-red-400 hover:bg-red-500 hover:text-white transition-all font-semibold"
                                                                >
                                                                    {isDemoting ? (
                                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                                    ) : (
                                                                        <>
                                                                            <X className="w-3 h-3 mr-1" />
                                                                            Remove
                                                                        </>
                                                                    )}
                                                                </Button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {selectedHos && (
                <ManageTeamModal
                    isOpen={isTeamModalOpen}
                    hos={selectedHos}
                    onClose={() => {
                        setIsTeamModalOpen(false);
                        setSelectedHos(null);
                    }}
                    onSuccess={loadSellers}
                />
            )}

            <PromoteHosModal 
                isOpen={isPromoteModalOpen}
                onClose={() => setIsPromoteModalOpen(false)}
                onSuccess={loadSellers}
            />
        </div>
    );
}
