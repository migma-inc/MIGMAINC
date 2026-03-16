import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
    Crown, Users, TrendingUp, DollarSign, Pencil, Check, X, Loader2, Medal, Trophy
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface HeadOfSalesWithTeam {
    id: string;
    full_name: string;
    email: string;
    seller_id_public: string;
    team_name: string | null;
    team_members: TeamMember[];
    total_revenue: number;
    commission: number;
}

interface TeamMember {
    id: string;
    full_name: string;
    email: string;
    revenue: number;
    commission: number;
}

// Tabela de comissão progressiva (igual à do HoS dashboard)
function calculateHoSCommission(totalRevenue: number): number {
    if (totalRevenue < 20000) return totalRevenue * 0.005;
    if (totalRevenue < 40000) return totalRevenue * 0.01;
    if (totalRevenue < 60000) return totalRevenue * 0.02;
    if (totalRevenue < 80000) return totalRevenue * 0.03;
    if (totalRevenue < 100000) return totalRevenue * 0.04;
    return totalRevenue * 0.05;
}

function calculateSellerCommission(revenue: number): number {
    if (revenue < 10000) return revenue * 0.05;
    if (revenue < 20000) return revenue * 0.07;
    if (revenue < 30000) return revenue * 0.10;
    return revenue * 0.12;
}

function formatUSD(value: number) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function getRankIcon(rank: number) {
    if (rank === 1) return <Trophy className="w-4 h-4 text-yellow-400" />;
    if (rank === 2) return <Medal className="w-4 h-4 text-gray-300" />;
    if (rank === 3) return <Medal className="w-4 h-4 text-amber-600" />;
    return <span className="w-4 h-4 text-gray-500 text-xs font-bold flex items-center justify-center">{rank}</span>;
}

interface AdminTeamsViewProps {
    selectedMonth: string; // YYYY-MM format
}

export function AdminTeamsView({ selectedMonth }: AdminTeamsViewProps) {
    const [teams, setTeams] = useState<HeadOfSalesWithTeam[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');
    const [saving, setSaving] = useState<string | null>(null);

    const loadTeams = useCallback(async () => {
        setLoading(true);
        try {
            // 1. Load all sellers with their roles
            const { data: allSellers, error: sellerError } = await supabase
                .from('sellers')
                .select('id, full_name, email, seller_id_public, role, head_of_sales_id, team_name')
                .eq('is_test', false);

            if (sellerError) throw sellerError;

            const heads = (allSellers || []).filter(s => s.role === 'head_of_sales');
            const regularSellers = (allSellers || []).filter(s => s.role !== 'head_of_sales');

            // 2. Build date range for selected month
            const [year, month] = selectedMonth.split('-').map(Number);
            const startDate = new Date(year, month - 1, 1).toISOString();
            const endDate = new Date(year, month, 1).toISOString();

            // 3. Fetch completed orders for this month (non-test)
            const { data: orders, error: ordersError } = await supabase
                .from('visa_orders')
                .select('seller_id, total_price_usd')
                .eq('payment_status', 'completed')
                .eq('is_test', false)
                .gte('created_at', startDate)
                .lt('created_at', endDate);

            if (ordersError) throw ordersError;

            // 4. Map revenue per seller
            const revenueBySellerStr: Record<string, number> = {};
            for (const order of orders || []) {
                const sid = order.seller_id;
                if (!sid) continue;
                revenueBySellerStr[sid] = (revenueBySellerStr[sid] || 0) + parseFloat(order.total_price_usd || '0');
            }

            // 5. Build teams data
            const teamsData: HeadOfSalesWithTeam[] = heads.map(hos => {
                const members = regularSellers
                    .filter(s => s.head_of_sales_id === hos.id)
                    .map(s => {
                        const revenue = revenueBySellerStr[s.id] || 0;
                        return {
                            id: s.id,
                            full_name: s.full_name,
                            email: s.email,
                            revenue,
                            commission: calculateSellerCommission(revenue),
                        };
                    })
                    .sort((a, b) => b.revenue - a.revenue);

                const totalRevenue = members.reduce((sum, m) => sum + m.revenue, 0);

                return {
                    id: hos.id,
                    full_name: hos.full_name,
                    email: hos.email,
                    seller_id_public: hos.seller_id_public,
                    team_name: hos.team_name,
                    team_members: members,
                    total_revenue: totalRevenue,
                    commission: calculateHoSCommission(totalRevenue),
                };
            });

            // Sort teams by total revenue descending
            teamsData.sort((a, b) => b.total_revenue - a.total_revenue);
            setTeams(teamsData);
        } catch (err) {
            console.error('[AdminTeamsView] Error loading teams:', err);
        } finally {
            setLoading(false);
        }
    }, [selectedMonth]);

    useEffect(() => {
        loadTeams();
    }, [loadTeams]);

    const startEditing = (hos: HeadOfSalesWithTeam) => {
        setEditingId(hos.id);
        setEditValue(hos.team_name || '');
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditValue('');
    };

    const saveTeamName = async (hosId: string) => {
        setSaving(hosId);
        try {
            const { error } = await supabase
                .from('sellers')
                .update({ team_name: editValue.trim() || null })
                .eq('id', hosId);

            if (error) throw error;

            setTeams(prev =>
                prev.map(t => t.id === hosId ? { ...t, team_name: editValue.trim() || null } : t)
            );
            setEditingId(null);
        } catch (err) {
            console.error('[AdminTeamsView] Error saving team name:', err);
        } finally {
            setSaving(null);
        }
    };

    if (loading) {
        return (
            <div className="p-4 sm:p-6 lg:p-8 flex items-center justify-center py-24">
                <Loader2 className="w-8 h-8 text-gold-medium animate-spin" />
            </div>
        );
    }

    if (teams.length === 0) {
        return (
            <div className="p-4 sm:p-6 lg:p-8 py-16 text-center text-gray-500">
                <Crown className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>Nenhum Head of Sales encontrado.</p>
                <p className="text-xs mt-1">Promova vendedores na aba "Pessoas".</p>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto space-y-6">
            {teams.map((team, teamIndex) => (
                <Card
                    key={team.id}
                    className="bg-black/40 border-gold-medium/20 overflow-hidden"
                >
                    {/* Team Header */}
                    <CardHeader className="border-b border-white/5 pb-4">
                        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                            <div className="flex items-center gap-3 min-w-0">
                                {/* Team Rank Badge */}
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gold-medium/10 border border-gold-medium/30 flex items-center justify-center text-gold-light font-bold text-sm">
                                    {teamIndex + 1}
                                </div>

                                {/* Team Name (editable) */}
                                <div className="min-w-0">
                                    {editingId === team.id ? (
                                        <div className="flex items-center gap-2">
                                            <input
                                                value={editValue}
                                                onChange={e => setEditValue(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') saveTeamName(team.id);
                                                    if (e.key === 'Escape') cancelEditing();
                                                }}
                                                placeholder="Nome do time..."
                                                autoFocus
                                                className="bg-black/60 border border-gold-medium/50 rounded-lg px-3 py-1.5 text-white text-sm w-48 focus:outline-none focus:border-gold-medium"
                                            />
                                            <button
                                                onClick={() => saveTeamName(team.id)}
                                                disabled={saving === team.id}
                                                className="p-1.5 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
                                            >
                                                {saving === team.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                            </button>
                                            <button
                                                onClick={cancelEditing}
                                                className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => startEditing(team)}
                                            className="group flex items-center gap-2 text-left"
                                        >
                                            <span className="text-lg font-bold text-white group-hover:text-gold-light transition-colors">
                                                {team.team_name || <span className="text-gray-500 italic text-base">Sem nome — clique para nomear</span>}
                                            </span>
                                            <Pencil className="w-3.5 h-3.5 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                        </button>
                                    )}

                                    {/* HoS info */}
                                    <div className="flex items-center gap-2 mt-1">
                                        <Crown className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                                        <span className="text-sm text-purple-300 font-medium truncate">{team.full_name}</span>
                                        <span className="text-xs text-gray-500 truncate hidden sm:inline">{team.email}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Team Stats — Summary */}
                            <div className="flex flex-wrap gap-3 sm:gap-4">
                                <div className="text-center">
                                    <p className="text-xs text-gray-500">Equipe</p>
                                    <div className="flex items-center gap-1 justify-center">
                                        <Users className="w-3.5 h-3.5 text-gray-400" />
                                        <span className="text-white font-semibold text-sm">{team.team_members.length}</span>
                                    </div>
                                </div>
                                <div className="text-center">
                                    <p className="text-xs text-gray-500">Vendas no mês</p>
                                    <div className="flex items-center gap-1 justify-center">
                                        <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                                        <span className="text-green-300 font-semibold text-sm">{formatUSD(team.total_revenue)}</span>
                                    </div>
                                </div>
                                <div className="text-center">
                                    <p className="text-xs text-gray-500">Comissão HoS</p>
                                    <div className="flex items-center gap-1 justify-center">
                                        <DollarSign className="w-3.5 h-3.5 text-gold-medium" />
                                        <span className="text-gold-light font-bold text-sm">{formatUSD(team.commission)}</span>
                                    </div>
                                </div>
                                {/* Commission tier badge */}
                                <div className="text-center">
                                    <p className="text-xs text-gray-500">Faixa</p>
                                    <Badge className={`text-xs font-semibold ${team.total_revenue >= 100000 ? 'bg-gold-medium/30 text-gold-light border-gold-medium/50' :
                                        team.total_revenue >= 80000 ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' :
                                            team.total_revenue >= 60000 ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' :
                                                team.total_revenue >= 40000 ? 'bg-green-500/20 text-green-300 border-green-500/40' :
                                                    team.total_revenue >= 20000 ? 'bg-teal-500/20 text-teal-300 border-teal-500/40' :
                                                        'bg-gray-500/20 text-gray-300 border-gray-500/40'
                                        }`}>
                                        {team.total_revenue >= 100000 ? '5%' :
                                            team.total_revenue >= 80000 ? '4%' :
                                                team.total_revenue >= 60000 ? '3%' :
                                                    team.total_revenue >= 40000 ? '2%' :
                                                        team.total_revenue >= 20000 ? '1%' : '0.5%'}
                                    </Badge>
                                </div>
                            </div>
                        </div>
                    </CardHeader>

                    {/* Seller Ranking */}
                    <CardContent className="p-0">
                        {team.team_members.length === 0 ? (
                            <p className="text-gray-500 text-sm text-center py-6 italic">
                                Nenhum vendedor vinculado a este time.
                            </p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-xs text-gray-500 uppercase border-b border-white/5">
                                            <th className="px-5 py-3 text-left">#</th>
                                            <th className="px-5 py-3 text-left">Vendedor</th>
                                            <th className="px-5 py-3 text-right">Vendas no Mês</th>
                                            <th className="px-5 py-3 text-right">Comissão</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {team.team_members.map((member, idx) => (
                                            <tr
                                                key={member.id}
                                                className={`border-b border-white/5 transition-colors ${idx === 0 ? 'bg-yellow-400/5' :
                                                    idx === 1 ? 'bg-white/3' :
                                                        idx === 2 ? 'bg-amber-600/5' : ''
                                                    } hover:bg-white/5`}
                                            >
                                                <td className="px-5 py-3">
                                                    <div className="flex items-center justify-center w-6">
                                                        {getRankIcon(idx + 1)}
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3">
                                                    <p className="font-medium text-white">{member.full_name}</p>
                                                    <p className="text-xs text-gray-500">{member.email}</p>
                                                </td>
                                                <td className="px-5 py-3 text-right">
                                                    <span className={`font-semibold ${member.revenue > 0 ? 'text-green-300' : 'text-gray-500'}`}>
                                                        {formatUSD(member.revenue)}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3 text-right">
                                                    <span className={`font-semibold ${member.commission > 0 ? 'text-gold-light' : 'text-gray-500'}`}>
                                                        {formatUSD(member.commission)}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            ))}
            </div>
        </div>
    );
}
