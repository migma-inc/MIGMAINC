import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Crown, Users, X, Loader2, UserPlus, Search, UserCheck, BarChart3, Plus, ArrowDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCurrency, isTestEnvironment } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ManageTeamModal } from '@/components/admin/ManageTeamModal';
import { PromoteHosModal } from '@/components/admin/PromoteHosModal';
import { CreateTeamModal } from '@/components/admin/CreateTeamModal';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from '@/components/ui/dialog';

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
    const [teamMetrics, setTeamMetrics] = useState<Record<string, { netRevenue: number, totalOrders: number, totalOverrides: number }>>({});


    // Action Modal State para Delete Team, Demote HoS e Erros
    const [actionModal, setActionModal] = useState<{
        isOpen: boolean;
        type: 'delete_team' | 'demote_hos' | 'alert' | null;
        title: string;
        message: string;
        targetId: string | null;
        isError?: boolean;
    }>({
        isOpen: false,
        type: null,
        title: '',
        message: '',
        targetId: null,
        isError: false
    });

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
            
            // Carregar métricas para todos os times
            if (teamsData && teamsData.length > 0) {
                loadTeamMetrics(teamsData, sellersData || []);
            }


        } catch (err) {
            console.error('[HeadOfSalesManagement] Unexpected error:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadTeamMetrics = async (teamsList: Team[], sellersList: Seller[]) => {
        try {
            const metrics: Record<string, { netRevenue: number, totalOrders: number, totalOverrides: number }> = {};
            
            for (const team of teamsList) {
                // 1. Fetch orders by team_id
                let ordersQuery = supabase
                    .from('visa_orders')
                    .select('id, base_price_usd, extra_units, extra_unit_price_usd, upsell_price_usd, discount_amount')
                    .eq('team_id', team.id)
                    .eq('payment_status', 'completed');

                if (!isTestEnvironment()) {
                    ordersQuery = ordersQuery.eq('is_test', false);
                }

                const { data: teamOrders } = await ordersQuery;

                const netRevenue = teamOrders?.reduce((acc, order) => {
                    return acc + (Number(order.base_price_usd || 0) + 
                           (Number(order.extra_units || 0) * Number(order.extra_unit_price_usd || 0)) + 
                            Number(order.upsell_price_usd || 0) - 
                            Number(order.discount_amount || 0));
                }, 0) || 0;

                let totalOverrides = 0;
                const hos = sellersList.find(s => s.team_id === team.id && s.role === 'head_of_sales');
                
                if (hos && teamOrders && teamOrders.length > 0) {
                    const orderIds = teamOrders.map(o => o.id);
                    // 2. Fetch all commissions for THIS HoS (personal + team overrides)
                    const { data: comms } = await supabase
                        .from('seller_commissions')
                        .select('commission_amount_usd')
                        .in('order_id', orderIds)
                        .eq('seller_id', hos.seller_id_public);
                    
                    totalOverrides = comms?.reduce((acc, c) => acc + Number(c.commission_amount_usd || 0), 0) || 0;
                }

                metrics[team.id] = { netRevenue, totalOrders: teamOrders?.length || 0, totalOverrides };
            }
            setTeamMetrics(metrics);
        } catch (err) {
            console.error('[HeadOfSalesManagement] Error loading metrics:', err);
        }
    };



    const triggerDeleteTeam = (teamId: string, teamName: string) => {
        setActionModal({
            isOpen: true,
            type: 'delete_team',
            title: 'Delete Team',
            message: `Are you sure you want to delete the team "${teamName}"? Current members will be unlinked and left without a team.`,
            targetId: teamId
        });
    };

    const confirmDeleteTeam = async () => {
        const teamId = actionModal.targetId;
        if (!teamId) return;
        setActionModal(prev => ({ ...prev, isOpen: false }));
        setSaving(teamId);
        try {
            await supabase.from('sellers').update({ team_id: null }).eq('team_id', teamId);
            const { error } = await supabase.from('teams').delete().eq('id', teamId);
            if (error) throw error;
            await loadData();
        } catch (err) {
            console.error('[HeadOfSalesManagement] Error deleting team:', err);
            setActionModal({
                isOpen: true,
                type: 'alert',
                title: 'Deletion Error',
                message: 'Could not delete the team. Please check the console logs.',
                targetId: null,
                isError: true
            });
        } finally {
            setSaving(null);
        }
    };

    const triggerDemoteToSeller = (hosId: string) => {
        setActionModal({
            isOpen: true,
            type: 'demote_hos',
            title: 'Demote Head of Sales',
            message: 'Are you sure you want to demote this Head of Sales to a regular Seller? Their current team members will be left without a leader until reassigned.',
            targetId: hosId
        });
    };

    const confirmDemoteToSeller = async () => {
        const hosId = actionModal.targetId;
        if (!hosId) return;
        setActionModal(prev => ({ ...prev, isOpen: false }));
        setSaving(hosId);
        try {
            await supabase.from('sellers').update({ head_of_sales_id: null }).eq('head_of_sales_id', hosId);
            const { error } = await supabase.from('sellers').update({ role: 'seller', team_id: null }).eq('id', hosId);
            if (error) throw error;
            await loadData();
        } catch (err) {
            console.error('[HeadOfSalesManagement] Error demoting HoS:', err);
            setActionModal({
                isOpen: true,
                type: 'alert',
                title: 'Demotion Error',
                message: 'Could not perform the demotion in the database.',
                targetId: null,
                isError: true
            });
        } finally {
            setSaving(null);
        }
    };

    const filteredTeams = teams.filter(t => {
        if (!search) return true;
        return t.name.toLowerCase().includes(search.toLowerCase());
    });

    const sellersWithoutTeam = sellers.filter(s => !s.team_id);
    const hosWithoutTeam = sellers.filter(s => !s.team_id && s.role === 'head_of_sales');

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-2 sm:gap-3">
                            <Crown className="w-6 h-6 sm:w-8 sm:h-8 text-gold-medium" />
                            Team Management & Leadership
                        </h1>
                        <p className="text-gray-400 mt-1 text-sm sm:base">
                            Structure your sales teams and manage your Heads of Sales.
                        </p>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Card className="bg-black/40 border-purple-500/30">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-gray-400">Active Teams</CardTitle>
                            <Users className="w-4 h-4 text-purple-400" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-xl sm:text-2xl font-bold text-purple-300">{teams.length}</div>
                            <p className="text-xs text-gray-500 mt-1">Sales structures</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-black/40 border-gold-medium/20">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-gray-400">Heads of Sales</CardTitle>
                            <Crown className="w-4 h-4 text-gold-medium" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-xl sm:text-2xl font-bold text-gold-light">
                                {sellers.filter(s => s.role === 'head_of_sales').length}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Team leaders</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-black/40 border-gray-700/30 sm:col-span-2 lg:col-span-1">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-gray-400">No Team</CardTitle>
                            <UserPlus className="w-4 h-4 text-gray-400" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-xl sm:text-2xl font-bold text-gray-300">
                                {sellersWithoutTeam.length}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Awaiting assignment</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Action Section */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col items-center justify-center py-6 bg-white/5 border border-white/10 rounded-2xl gap-4 text-center px-4">
                        <div>
                            <h3 className="text-lg font-bold text-white tracking-tight">Create New Team</h3>
                            <p className="text-sm text-gray-400 mt-1">Setup a new independent structure.</p>
                        </div>
                        <Button
                            onClick={() => setIsCreateTeamModalOpen(true)}
                            className="w-full sm:w-auto h-12 sm:h-14 px-8 bg-purple-600 hover:bg-purple-700 text-white font-bold text-base sm:text-lg rounded-xl flex items-center justify-center gap-3 shadow-xl transition-all hover:scale-105"
                        >
                            <Plus className="w-5 h-5 sm:w-6 sm:h-6" />
                            New Team
                        </Button>
                    </div>

                    <div className="flex flex-col items-center justify-center py-6 bg-white/5 border border-white/10 rounded-2xl gap-4 text-center px-4">
                        <div>
                            <h3 className="text-lg font-bold text-white tracking-tight">Promote Head of Sales</h3>
                            <p className="text-sm text-gray-400 mt-1">Promote a seller to lead a team.</p>
                        </div>
                        <Button
                            onClick={() => setIsPromoteModalOpen(true)}
                            className="w-full sm:w-auto h-12 sm:h-14 px-8 bg-gold-medium hover:bg-gold-dark text-black font-bold text-base sm:text-lg rounded-xl flex items-center justify-center gap-3 shadow-xl transition-all hover:scale-105"
                        >
                            <UserCheck className="w-5 h-5 sm:w-6 sm:h-6" />
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
                                    {/* Desktop Table */}
                                    <table className="w-full text-sm text-left hidden md:table">
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
                                                const metrics = teamMetrics[team.id];

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
                                                                    <>
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
                                                                        <Button
                                                                            size="sm"
                                                                            variant="outline"
                                                                            disabled={saving === teamHos.id}
                                                                            onClick={() => triggerDemoteToSeller(teamHos.id)}
                                                                            className="h-8 text-[10px] border-orange-500/40 bg-black text-orange-400 hover:bg-orange-500 hover:text-white transition-all font-semibold"
                                                                        >
                                                                            <ArrowDown className="w-3 h-3 mr-1" />
                                                                             Demote
                                                                        </Button>
                                                                    </>
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
                                                                    onClick={() => triggerDeleteTeam(team.id, team.name)}
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

                                    {/* Mobile Cards */}
                                    <div className="md:hidden divide-y divide-gold-medium/10">
                                        {filteredTeams.map(team => {
                                             const teamHos = sellers.find(s => s.team_id === team.id && s.role === 'head_of_sales');
                                             const teamMembers = sellers.filter(s => s.team_id === team.id && s.role === 'seller');
                                             const metrics = teamMetrics[team.id];

                                             return (
                                                 <div key={team.id} className="p-4 space-y-4">
                                                     <div className="flex justify-between items-start">
                                                         <div>
                                                             <div className="flex items-center gap-2">
                                                                 <p className="font-bold text-white text-lg">{team.name}</p>
                                                                 {team.is_test && (
                                                                     <span className="text-[10px] px-1.5 py-0.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded font-bold uppercase">Test</span>
                                                                 )}
                                                             </div>
                                                             <p className="text-[10px] text-gray-500">ID: {team.id}</p>
                                                         </div>
                                                         <div className="text-right">
                                                             <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-gold-medium/10 text-gold-light border border-gold-medium/20">
                                                                 {teamMembers.length} sellers
                                                             </span>
                                                         </div>
                                                     </div>

                                                     <div className="grid grid-cols-2 gap-4 py-3 border-y border-white/5">
                                                         <div>
                                                             <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Leader (HoS)</p>
                                                             {teamHos ? (
                                                                 <div className="min-w-0">
                                                                     <p className="text-sm font-medium text-purple-300 truncate">{teamHos.full_name}</p>
                                                                     <p className="text-[10px] text-gray-500 truncate">{teamHos.email}</p>
                                                                 </div>
                                                             ) : (
                                                                 <p className="text-sm text-gray-600 italic">No leader</p>
                                                             )}
                                                         </div>
                                                         <div>
                                                             <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Revenue</p>
                                                             {metrics ? (
                                                                 <div>
                                                                     <p className="text-sm font-bold text-white">{formatCurrency(metrics.netRevenue)}</p>
                                                                     <p className="text-[10px] text-gold-light">{formatCurrency(metrics.totalOverrides)} overrides</p>
                                                                 </div>
                                                             ) : (
                                                                 <p className="text-sm text-gray-600">-</p>
                                                             )}
                                                         </div>
                                                     </div>

                                                     <div className="grid grid-cols-2 gap-2">
                                                         {teamHos ? (
                                                             <>
                                                                 <Link to={`/dashboard/head-of-sales/${teamHos.seller_id_public}/analytics`}>
                                                                     <Button variant="outline" className="w-full h-9 text-[10px] border-blue-500/40 bg-black text-blue-400">
                                                                         <BarChart3 className="w-3 h-3 mr-1" /> Analytics
                                                                     </Button>
                                                                 </Link>
                                                                 <Button 
                                                                     variant="outline" 
                                                                     disabled={saving === teamHos.id}
                                                                     onClick={() => triggerDemoteToSeller(teamHos.id)}
                                                                     className="w-full h-9 text-[10px] border-orange-500/40 bg-black text-orange-400"
                                                                 >
                                                                     <ArrowDown className="w-3 h-3 mr-1" /> Demote
                                                                 </Button>
                                                             </>
                                                         ) : (
                                                             <Button variant="outline" disabled className="col-span-2 h-9 text-[10px] border-white/10 opacity-50">No leader actions</Button>
                                                         )}
                                                         <Button
                                                             variant="outline"
                                                             onClick={() => {
                                                                 setSelectedTeam({ id: team.id, name: team.name });
                                                                 setIsTeamModalOpen(true);
                                                             }}
                                                             className="w-full h-9 text-[10px] border-gold-medium/40 bg-black text-gold-medium"
                                                         >
                                                             <Users className="w-3 h-3 mr-1" /> Manage Members
                                                         </Button>
                                                         <Button
                                                             variant="outline"
                                                             onClick={() => triggerDeleteTeam(team.id, team.name)}
                                                             disabled={saving === team.id}
                                                             className="w-full h-9 text-[10px] border-red-500/40 bg-black text-red-400"
                                                         >
                                                             <X className="w-3 h-3 mr-1" /> Delete Team
                                                         </Button>
                                                     </div>
                                                 </div>
                                             );
                                        })}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Orphaned HoS Section */}
                {hosWithoutTeam.length > 0 && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500 delay-150">
                        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Crown className="w-5 h-5 text-gold-medium" />
                                Heads of Sales (No Team Assigned)
                            </h2>
                        </div>
                        <Card className="bg-black/40 border-gold-medium/20">
                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                    {/* Desktop Table */}
                                    <table className="w-full text-sm text-left hidden md:table">
                                        <thead>
                                            <tr className="border-b border-gold-medium/20 text-xs text-gray-400 uppercase">
                                                <th className="px-6 py-4">Leader Name</th>
                                                <th className="px-6 py-4 text-center">Status</th>
                                                <th className="px-6 py-4 text-center">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {hosWithoutTeam.map(hos => (
                                                <tr key={hos.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div>
                                                            <p className="font-medium text-purple-300 flex items-center gap-1">
                                                                <Crown className="w-3 h-3" />
                                                                {hos.full_name}
                                                            </p>
                                                            <p className="text-[10px] text-gray-500">{hos.email}</p>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20 uppercase">
                                                            Awaiting Team
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                disabled={saving === hos.id}
                                                                onClick={() => triggerDemoteToSeller(hos.id)}
                                                                className="h-8 text-[10px] border-orange-500/40 bg-black text-orange-400 hover:bg-orange-500 hover:text-white transition-all font-semibold"
                                                            >
                                                                <ArrowDown className="w-3 h-3 mr-1" />
                                                                Demote HoS
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>

                                    {/* Mobile Cards */}
                                    <div className="md:hidden divide-y divide-gold-medium/10">
                                        {hosWithoutTeam.map(hos => (
                                            <div key={hos.id} className="p-4 space-y-3">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <p className="font-medium text-purple-300 flex items-center gap-1">
                                                            <Crown className="w-3 h-3" />
                                                            {hos.full_name}
                                                        </p>
                                                        <p className="text-[10px] text-gray-500">{hos.email}</p>
                                                    </div>
                                                    <span className="px-2 py-0.5 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded text-[10px] font-bold uppercase">Awaiting Team</span>
                                                </div>
                                                <Button
                                                    variant="outline"
                                                    disabled={saving === hos.id}
                                                    onClick={() => triggerDemoteToSeller(hos.id)}
                                                    className="w-full h-9 text-[10px] border-orange-500/40 bg-black text-orange-400"
                                                >
                                                    <ArrowDown className="w-3 h-3 mr-1" /> Demote to Seller
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
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

            {/* Action Confirmation Modal */}
            <Dialog open={actionModal.isOpen} onOpenChange={(open) => !open && setActionModal(prev => ({ ...prev, isOpen: false }))}>
                <DialogContent className="bg-black border border-gold-medium/50 text-white shadow-2xl max-w-md">
                    <DialogHeader>
                        <div className="flex items-center gap-3 mb-2">
                            {actionModal.isError ? (
                                <div className="bg-red-500/20 p-2 rounded-full border border-red-500/30">
                                    <X className="w-6 h-6 text-red-500" />
                                </div>
                            ) : actionModal.type === 'delete_team' ? (
                                <div className="bg-gold-medium/20 p-2 rounded-full border border-gold-medium/30">
                                    <X className="w-6 h-6 text-gold-medium" />
                                </div>
                            ) : (
                                <div className="bg-gold-medium/20 p-2 rounded-full border border-gold-medium/30">
                                    <ArrowDown className="w-6 h-6 text-gold-medium" />
                                </div>
                            )}
                            <DialogTitle className="text-xl font-bold">{actionModal.title}</DialogTitle>
                        </div>
                        <DialogDescription className="text-gray-300 text-base leading-relaxed">
                            {actionModal.message}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-4 gap-2">
                        {actionModal.type === 'alert' ? (
                            <Button onClick={() => setActionModal(prev => ({ ...prev, isOpen: false }))} className="bg-gray-700 hover:bg-gray-600 text-white font-bold px-6">
                                Close
                            </Button>
                        ) : (
                            <>
                                <Button variant="ghost" className="text-gray-400 hover:text-white" onClick={() => setActionModal(prev => ({ ...prev, isOpen: false }))}>Cancel</Button>
                                <Button 
                                    onClick={actionModal.type === 'delete_team' ? confirmDeleteTeam : confirmDemoteToSeller} 
                                    className="bg-gold-medium hover:bg-gold-dark text-black font-bold px-6 border border-gold-medium/50 uppercase tracking-wide text-xs transition-colors"
                                >
                                    Confirm
                                </Button>
                            </>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
