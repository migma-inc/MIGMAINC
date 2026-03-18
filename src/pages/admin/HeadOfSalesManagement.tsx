import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Crown, Users, X, Loader2, UserPlus, Search, UserCheck, BarChart3, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCurrency, isTestEnvironment } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ManageTeamModal } from '@/components/admin/ManageTeamModal';
import { PromoteHosModal } from '@/components/admin/PromoteHosModal';
import { CreateTeamModal } from '@/components/admin/CreateTeamModal';

interface Seller {
    id: string;
    full_name: string;
    email: string;
    seller_id_public: string;
    status: string;
    role: string;
    head_of_sales_id: string | null;
    team_id: string | null;
    is_test: boolean;
}

interface Team {
    id: string;
    name: string;
    is_test: boolean;
}

export function HeadOfSalesManagement() {
    const [sellers, setSellers] = useState<Seller[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    
    // Modals
    const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
    const [isCreateTeamModalOpen, setIsCreateTeamModalOpen] = useState(false);
    const [isPromoteModalOpen, setIsPromoteModalOpen] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState<{ id: string, name: string } | null>(null);
    const [hosMetrics, setHosMetrics] = useState<Record<string, { netRevenue: number, totalOrders: number, totalOverrides: number }>>({});

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        console.log('[HeadOfSalesManagement] Loading data...');
        setLoading(true);
        try {
            // 1. Fetch Sellers
            let sellersQuery = supabase
                .from('sellers')
                .select('id, full_name, email, seller_id_public, status, role, head_of_sales_id, team_id, is_test');

            if (!isTestEnvironment()) {
                sellersQuery = sellersQuery.eq('is_test', false);
            }

            const { data: sellersData, error: sellersError } = await sellersQuery.order('full_name');
            if (sellersError) throw sellersError;
            
            // 2. Fetch Teams
            let teamsQuery = supabase
                .from('teams')
                .select('id, name, is_test');

            if (!isTestEnvironment()) {
                teamsQuery = teamsQuery.eq('is_test', false);
            }

            const { data: teamsData, error: teamsError } = await teamsQuery.order('name');
            if (teamsError) throw teamsError;

            console.log('[HeadOfSalesManagement] Data loaded:', sellersData?.length, 'sellers and', teamsData?.length, 'teams.');
            setSellers(sellersData || []);
            setTeams(teamsData || []);
            
            // Carregar métricas para os HoS
            const hosList = sellersData?.filter(s => s.role === 'head_of_sales') || [];
            if (hosList.length > 0) {
                loadHosMetrics(hosList, sellersData || []);
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
                // Métricas baseadas no time ao qual o HoS pertence
                const teamPublicIds = allSellers
                    .filter(s => s.team_id === hos.team_id && s.role === 'seller')
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

                    let totalOverrides = 0;
                    if (teamOrders && teamOrders.length > 0) {
                        const orderIds = teamOrders.map(o => o.id);
                        const { data: comms } = await supabase
                            .from('seller_commissions')
                            .select('commission_amount_usd')
                            .in('order_id', orderIds);
                        
                        totalOverrides = comms?.reduce((acc, c) => acc + Number(c.commission_amount_usd || 0), 0) || 0;
                    }

                    metrics[hos.id] = { netRevenue, totalOrders: teamOrders?.length || 0, totalOverrides };
                } else {
                    metrics[hos.id] = { netRevenue: 0, totalOrders: 0, totalOverrides: 0 };
                }
            }
            setHosMetrics(metrics);
        } catch (err) {
            console.error('[HeadOfSalesManagement] Error loading metrics:', err);
        }
    };

    const _demoteToSeller = async (seller: Seller) => {
        console.log('[HeadOfSalesManagement] Demoting seller:', seller.id);
        setSaving(seller.id);
        try {
            const { error } = await supabase.functions.invoke('admin-update-seller', {
                body: {
                    seller_id: seller.id,
                    full_name: seller.full_name,
                    email: seller.email,
                    phone: '-',
                    seller_id_public: seller.seller_id_public,
                    role: 'seller',
                    head_of_sales_id: null,
                    team_id: seller.team_id
                },
            });

            if (error) throw error;
            await loadData();
        } catch (err) {
            console.error('[HeadOfSalesManagement] Error demoting seller:', err);
        } finally {
            setSaving(null);
        }
    };    const deleteTeam = async (teamId: string) => {
        if (!confirm('Are you sure you want to delete this team? Members will be unlinked.')) return;
        setSaving(teamId);
        try {
            // First clear team_id from sellers
            await supabase.from('sellers').update({ team_id: null }).eq('team_id', teamId);
            // Then delete team
            const { error } = await supabase.from('teams').delete().eq('id', teamId);
            if (error) throw error;
            await loadData();
        } catch (err) {
            console.error('[HeadOfSalesManagement] Error deleting team:', err);
        } finally {
            setSaving(null);
        }
    };

    const filteredTeams = teams.filter(t => {
        if (!search) return true;
        return t.name.toLowerCase().includes(search.toLowerCase());
    });

    const sellersWithoutTeam = sellers.filter(s => !s.team_id);

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                            <Crown className="w-8 h-8 text-gold-medium" />
                            Team Management & Leadership
                        </h1>
                        <p className="text-gray-400 mt-1">
                            Structure your sales teams and manage your Heads of Sales.
                        </p>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="bg-black/40 border-purple-500/30">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-gray-400">Active Teams</CardTitle>
                            <Users className="w-4 h-4 text-purple-400" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-purple-300">{teams.length}</div>
                            <p className="text-xs text-gray-500 mt-1">Sales structures</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-black/40 border-gold-medium/20">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-gray-400">Heads of Sales</CardTitle>
                            <Crown className="w-4 h-4 text-gold-medium" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-gold-light">
                                {sellers.filter(s => s.role === 'head_of_sales').length}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Team leaders</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-black/40 border-gray-700/30">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-gray-400">No Team</CardTitle>
                            <UserPlus className="w-4 h-4 text-gray-400" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-gray-300">
                                {sellersWithoutTeam.length}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Awaiting assignment</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Action Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col items-center justify-center py-6 bg-white/5 border border-white/10 rounded-2xl gap-4">
                        <div className="text-center">
                            <h3 className="text-lg font-bold text-white tracking-tight">Create New Team</h3>
                            <p className="text-sm text-gray-400 mt-1">Setup a new independent structure.</p>
                        </div>
                        <Button
                            onClick={() => setIsCreateTeamModalOpen(true)}
                            className="h-14 px-8 bg-purple-600 hover:bg-purple-700 text-white font-bold text-lg rounded-xl flex items-center gap-3 shadow-xl transition-all hover:scale-105"
                        >
                            <Plus className="w-6 h-6" />
                            New Team
                        </Button>
                    </div>

                    <div className="flex flex-col items-center justify-center py-6 bg-white/5 border border-white/10 rounded-2xl gap-4">
                        <div className="text-center">
                            <h3 className="text-lg font-bold text-white tracking-tight">Promote Head of Sales</h3>
                            <p className="text-sm text-gray-400 mt-1">Promote a seller to lead a team.</p>
                        </div>
                        <Button
                            onClick={() => setIsPromoteModalOpen(true)}
                            className="h-14 px-8 bg-gold-medium hover:bg-gold-dark text-black font-bold text-lg rounded-xl flex items-center gap-3 shadow-xl transition-all hover:scale-105"
                        >
                            <UserCheck className="w-6 h-6" />
                            Promote Leader
                        </Button>
                    </div>
                </div>

                {/* List Section */}
                <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Users className="w-5 h-5 text-gold-medium" />
                            Sales Teams
                        </h2>
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search team..."
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
                            ) : filteredTeams.length === 0 ? (
                                <div className="text-center py-16">
                                    <p className="text-gray-400">No teams found.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead>
                                            <tr className="border-b border-gold-medium/20 text-xs text-gray-400 uppercase">
                                                <th className="px-6 py-4">Team</th>
                                                <th className="px-6 py-4">Leader (HoS)</th>
                                                <th className="px-6 py-4 text-center">Members</th>
                                                <th className="px-6 py-4 text-center">Revenue</th>
                                                <th className="px-6 py-4 text-center">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredTeams.map(team => {
                                                const teamHos = sellers.find(s => s.team_id === team.id && s.role === 'head_of_sales');
                                                const teamMembers = sellers.filter(s => s.team_id === team.id && s.role === 'seller');
                                                const metrics = teamHos ? hosMetrics[teamHos.id] : null;

                                                return (
                                                    <tr
                                                        key={team.id}
                                                        className="border-b border-white/5 hover:bg-white/5 transition-colors"
                                                    >
                                                        <td className="px-6 py-4">
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <p className="font-bold text-white text-lg">{team.name}</p>
                                                                    {team.is_test && (
                                                                        <span className="text-[10px] px-1.5 py-0.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded font-bold uppercase tracking-wider">
                                                                            Test
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <p className="text-xs text-gray-500 italic">ID: {team.id.split('-')[0]}...</p>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            {teamHos ? (
                                                                <div>
                                                                    <p className="font-medium text-purple-300 flex items-center gap-1">
                                                                        <Crown className="w-3 h-3" />
                                                                        {teamHos.full_name}
                                                                    </p>
                                                                    <p className="text-[10px] text-gray-500">{teamHos.email}</p>
                                                                </div>
                                                            ) : (
                                                                <span className="text-gray-600 text-xs italic">No leader</span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-gold-medium/10 text-gold-light border border-gold-medium/20">
                                                                {teamMembers.length} sellers
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            {metrics ? (
                                                                <div>
                                                                    <div className="font-bold text-white">
                                                                        {formatCurrency(metrics.netRevenue)}
                                                                    </div>
                                                                    <div className="text-[10px] text-gold-light">
                                                                        {formatCurrency(metrics.totalOverrides)} overrides
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <span className="text-gray-600">-</span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center justify-center gap-2">
                                                                {teamHos && (
                                                                    <Link to={`/dashboard/head-of-sales/${teamHos.seller_id_public}/analytics`}>
                                                                        <Button
                                                                            size="sm"
                                                                            variant="outline"
                                                                            className="h-8 text-[10px] border-blue-500/40 bg-black text-blue-400 hover:bg-blue-500 hover:text-white transition-all font-semibold"
                                                                        >
                                                                            <BarChart3 className="w-3 h-3 mr-1" />
                                                                            Analytics
                                                                        </Button>
                                                                    </Link>
                                                                )}
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => {
                                                                        setSelectedTeam({ id: team.id, name: team.name });
                                                                        setIsTeamModalOpen(true);
                                                                    }}
                                                                    className="h-8 text-[10px] border-gold-medium/40 bg-black text-gold-medium hover:bg-gold-medium hover:text-black transition-all font-semibold"
                                                                >
                                                                    <Users className="w-3 h-3 mr-1" />
                                                                    Manage
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => deleteTeam(team.id)}
                                                                    disabled={saving === team.id}
                                                                    className="h-8 text-[10px] border-red-500/40 bg-black text-red-400 hover:bg-red-500 hover:text-white transition-all font-semibold"
                                                                >
                                                                    <X className="w-3 h-3 mr-1" />
                                                                    Delete
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

            {selectedTeam && (
                <ManageTeamModal
                    isOpen={isTeamModalOpen}
                    team={selectedTeam}
                    onClose={() => {
                        setIsTeamModalOpen(false);
                        setSelectedTeam(null);
                    }}
                    onSuccess={loadData}
                />
            )}

            <CreateTeamModal
                isOpen={isCreateTeamModalOpen}
                onClose={() => {
                    setIsCreateTeamModalOpen(false);
                    loadData();
                }}
                onSuccess={loadData}
            />

            <PromoteHosModal 
                isOpen={isPromoteModalOpen}
                onClose={() => setIsPromoteModalOpen(false)}
                onSuccess={loadData}
            />
        </div>
    );
}
