import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
    Crown, Users, Loader2, Medal, Trophy
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { isTestEnvironment } from '@/lib/utils';

interface TeamWithPerformance {
    id: string;
    name: string;
    head_of_sales: {
        id: string;
        full_name: string;
        email: string;
    } | null;
    members: TeamMember[];
    total_revenue: number;
    commission_hos: number;
    is_test: boolean;
}

interface TeamMember {
    id: string;
    full_name: string;
    email: string;
    revenue: number;
    commission: number;
    is_former?: boolean;
}

// Tabela de comissão progressiva
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
    const [teams, setTeams] = useState<TeamWithPerformance[]>([]);
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            // 1. Load Teams
            let teamsQuery = supabase.from('teams').select('*');
            if (!isTestEnvironment()) {
                teamsQuery = teamsQuery.eq('is_test', false);
            }
            const { data: teamsData, error: teamsError } = await teamsQuery;
            if (teamsError) throw teamsError;

            // 2. Load all sellers
            let sellersQuery = supabase.from('sellers').select('id, full_name, email, role, team_id, is_test');
            if (!isTestEnvironment()) {
                sellersQuery = sellersQuery.eq('is_test', false);
            }
            const { data: sellersData, error: sellersError } = await sellersQuery;
            if (sellersError) throw sellersError;

            // 3. Build date range
            const [year, month] = selectedMonth.split('-').map(Number);
            const startDate = new Date(year, month - 1, 1).toISOString();
            const endDate = new Date(year, month, 1).toISOString();

            // 4. Fetch orders
            let ordersQuery = supabase
                .from('visa_orders')
                .select('seller_id, team_id, base_price_usd, extra_units, extra_unit_price_usd, upsell_price_usd, discount_amount')
                .eq('payment_status', 'completed');

            if (!isTestEnvironment()) {
                ordersQuery = ordersQuery.eq('is_test', false);
            }

            const { data: orders, error: ordersError } = await ordersQuery
                .gte('created_at', startDate)
                .lt('created_at', endDate);


            if (ordersError) throw ordersError;

            // 5. Calculate Revenue per seller and per team
            const revenueBySeller: Record<string, number> = {};
            const revenueByTeam: Record<string, number> = {};
            
            const publicToUuid: Record<string, string> = {};
            const { data: sellersWithPublic } = await supabase.from('sellers').select('id, seller_id_public');
            sellersWithPublic?.forEach(s => {
                publicToUuid[s.seller_id_public] = s.id;
            });

            for (const order of orders || []) {
                const price = (Number(order.base_price_usd || 0) + 
                              (Number(order.extra_units || 0) * Number(order.extra_unit_price_usd || 0)) + 
                               Number(order.upsell_price_usd || 0) - 
                               Number(order.discount_amount || 0));
                
                // Aggregate by seller
                const sellerUuid = publicToUuid[order.seller_id!];
                if (sellerUuid) {
                    revenueBySeller[sellerUuid] = (revenueBySeller[sellerUuid] || 0) + price;
                }

                // Aggregate by team (The Key Fix)
                if (order.team_id) {
                    revenueByTeam[order.team_id] = (revenueByTeam[order.team_id] || 0) + price;
                }
            }

            // 6. Group by Teams
            const performanceData: TeamWithPerformance[] = (teamsData || []).map(t => {
                // Get current members
                const currentMembers = (sellersData || []).filter(s => s.team_id === t.id && s.role === 'seller');
                
                // Get historical sellers from orders for this team
                const historicalSellerIds = new Set<string>();
                for (const order of orders || []) {
                    if (order.team_id === t.id && order.seller_id) {
                        const sellerUuid = publicToUuid[order.seller_id];
                        if (sellerUuid) historicalSellerIds.add(sellerUuid);
                    }
                }

                // Union of current members and historical sellers
                const allMemberIds = new Set([...currentMembers.map(m => m.id), ...Array.from(historicalSellerIds)]);

                const members = Array.from(allMemberIds).map(id => {
                    const seller = sellersData?.find(s => s.id === id);
                    const rev = revenueBySeller[id] || 0;
                    
                    return {
                        id,
                        full_name: seller?.full_name || 'Vendedor Removido',
                        email: seller?.email || 'N/A',
                        revenue: rev,
                        commission: calculateSellerCommission(rev),
                        is_former: seller?.team_id !== t.id
                    };
                })
                .filter(m => m.revenue > 0 || !m.is_former) // Show if they have revenue OR are current members
                .sort((a,b) => b.revenue - a.revenue);

                const hos = (sellersData || []).find(s => s.team_id === t.id && s.role === 'head_of_sales');
                const totalRevenue = revenueByTeam[t.id] || 0;

                return {
                    id: t.id,
                    name: t.name,
                    head_of_sales: hos ? { id: hos.id, full_name: hos.full_name, email: hos.email } : null,
                    members: members as any[],
                    total_revenue: totalRevenue,
                    commission_hos: calculateHoSCommission(totalRevenue),
                    is_test: t.is_test
                };
            });



            // Sort teams by total revenue
            performanceData.sort((a,b) => b.total_revenue - a.total_revenue);
            setTeams(performanceData);

        } catch (err) {
            console.error('[AdminTeamsView] Error loading data:', err);
        } finally {
            setLoading(false);
        }
    }, [selectedMonth]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="w-8 h-8 text-gold-medium animate-spin" />
            </div>
        );
    }

    if (teams.length === 0) {
        return (
            <div className="py-16 text-center text-gray-500">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>Nenhum time estruturado encontrado.</p>
                <p className="text-xs mt-1">Crie times na aba "Gestão de HoS".</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {teams.map((team, teamIndex) => (
                <Card key={team.id} className="bg-black/40 border-gold-medium/20 overflow-hidden">
                    <CardHeader className="border-b border-white/5 pb-4">
                        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gold-medium/10 border border-gold-medium/30 flex items-center justify-center text-gold-light font-bold text-sm">
                                    {teamIndex + 1}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-lg font-bold text-white tracking-tight">{team.name}</h3>
                                        {team.is_test && (
                                            <Badge variant="outline" className="text-[10px] text-red-400 border-red-500/30 font-bold">TEST</Badge>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Crown className="w-3.5 h-3.5 text-purple-400" />
                                        <span className="text-sm text-purple-300 font-medium">
                                            {team.head_of_sales?.full_name || <span className="italic text-gray-500">Sem líder</span>}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <div className="text-right">
                                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Vendas</p>
                                    <p className="text-green-400 font-bold text-lg">{formatUSD(team.total_revenue)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Comissão HoS</p>
                                    <p className="text-gold-light font-bold text-lg">{formatUSD(team.commission_hos)}</p>
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-500 uppercase border-b border-white/5 bg-black/20">
                                    <tr>
                                        <th className="px-5 py-3">#</th>
                                        <th className="px-5 py-3">Vendedor</th>
                                        <th className="px-5 py-3 text-right">Vendas</th>
                                        <th className="px-5 py-3 text-right">Comissão</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {team.members.map((member, idx) => (
                                        <tr key={member.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                            <td className="px-5 py-3 w-10">{getRankIcon(idx + 1)}</td>
                                            <td className="px-5 py-3 text-sm">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-medium text-white">{member.full_name}</p>
                                                    {member.is_former && (
                                                        <Badge variant="outline" className="text-[10px] text-orange-400 border-orange-500/30 px-1 py-0 h-4 uppercase font-bold">
                                                            Fora do Time
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-[10px] text-gray-500">{member.email}</p>
                                            </td>
                                            <td className="px-5 py-3 text-right">
                                                <span className="font-bold text-green-300">{formatUSD(member.revenue)}</span>
                                            </td>
                                            <td className="px-5 py-3 text-right">
                                                <span className="font-bold text-gold-light">{formatUSD(member.commission)}</span>
                                            </td>
                                        </tr>
                                    ))}
                                    {team.members.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="px-5 py-8 text-center text-gray-600 italic">
                                                Nenhum vendedor atrelado a este time.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
