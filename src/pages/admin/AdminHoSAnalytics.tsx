import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, BarChart3, TrendingUp, DollarSign, Wallet } from 'lucide-react';
import { PeriodFilter, type PeriodOption, type CustomDateRange } from '@/components/seller/PeriodFilter';
import type { SellerInfo } from '@/types/seller';

export function AdminHoSAnalytics() {
    const { hosId } = useParams<{ hosId: string }>();
    const [hos, setHos] = useState<SellerInfo | null>(null);
    const [teamMembers, setTeamMembers] = useState<any[]>([]);
    const [orders, setOrders] = useState<any[]>([]);
    const [commissions, setCommissions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [periodFilter, setPeriodFilter] = useState<PeriodOption>('thismonth');
    const [customDateRange, setCustomDateRange] = useState<CustomDateRange>({
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        async function loadData() {
            if (!hosId) return;
            setLoading(true);
            try {
                // 1. Fetch HoS info
                const { data: hosData } = await supabase
                    .from('sellers')
                    .select('*')
                    .eq('seller_id_public', hosId)
                    .single();

                if (hosData) {
                    setHos(hosData);

                    // 2. Fetch all orders for this team directly by team_id
                    const { data: teamOrders } = await supabase
                        .from('visa_orders')
                        .select('*')
                        .eq('team_id', hosData.team_id)
                        .eq('payment_status', 'completed');
                    
                    const ordersList = teamOrders || [];
                    setOrders(ordersList);

                    // 3. Identify all sellers from orders
                    const historicalSellerIds = [...new Set(ordersList.map(o => o.seller_id))].filter(Boolean) as string[];

                    // 4. Fetch CURRENT members and HISTORICAL sellers in parallel
                    const [currentMembersRes, historicalSellersRes] = await Promise.all([
                        supabase.from('sellers').select('id, full_name, seller_id_public, team_id, role').eq('team_id', hosData.team_id),
                        supabase.from('sellers').select('id, full_name, seller_id_public, team_id, role').in('seller_id_public', historicalSellerIds)
                    ]);
                    
                    // Union based on seller_id_public
                    const allSellers = [...(currentMembersRes.data || [])];
                    (historicalSellersRes.data || []).forEach(h => {
                        if (!allSellers.some(s => s.seller_id_public === h.seller_id_public)) {
                            allSellers.push(h);
                        }
                    });

                    const processedMembers = allSellers.map(m => ({
                        ...m,
                        is_hos: m.seller_id_public === hosId,
                        is_former: m.seller_id_public !== hosId && m.team_id !== hosData.team_id
                    }));

                    setTeamMembers(processedMembers);


                    if (ordersList.length > 0) {

                        const orderIds = ordersList.map(o => o.id);
                        
                        // 5. Fetch all commissions related to these orders
                        // This includes both individual commissions and HoS overrides
                        const { data: teamCommissions } = await supabase
                            .from('seller_commissions')
                            .select('*')
                            .in('order_id', orderIds);

                        setCommissions(teamCommissions || []);
                    }
                }

            } catch (error) {
                console.error('Error loading HoS analytics:', error);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [hosId]);

    // Filtering logic for the selected period
    const getFilteredData = () => {
        const now = new Date();
        let start: Date;
        let end: Date = new Date();
        end.setHours(23, 59, 59, 999);

        if (periodFilter === 'custom') {
            start = new Date(customDateRange.start);
            end = new Date(customDateRange.end);
            end.setHours(23, 59, 59, 999);
        } else if (periodFilter === 'today') {
            start = new Date();
            start.setHours(0, 0, 0, 0);
        } else if (periodFilter === 'thismonth') {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            start.setHours(0, 0, 0, 0);
        } else if (periodFilter === 'lastmonth') {
            start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            start.setHours(0, 0, 0, 0);
            end = new Date(now.getFullYear(), now.getMonth(), 0);
            end.setHours(23, 59, 59, 999);
        } else { // default last 30 days
            start = new Date();
            start.setDate(start.getDate() - 30);
            start.setHours(0, 0, 0, 0);
        }

        const filteredOrders = orders.filter(order => {
            const date = new Date(order.created_at);
            return date >= start && date <= end;
        });

        const filteredCommissions = commissions.filter(comm => {
            const date = new Date(comm.created_at);
            return date >= start && date <= end;
        });

        return { filteredOrders, filteredCommissions };
    };

    const { filteredOrders, filteredCommissions } = getFilteredData();

    const calculateNetRevenue = (order: any) => {
        return Number(order.base_price_usd || 0) + 
               (Number(order.extra_units || 0) * Number(order.extra_unit_price_usd || 0)) + 
               Number(order.upsell_price_usd || 0) - 
               Number(order.discount_amount || 0);
    };

    const totalNetRevenue = filteredOrders.reduce((acc, order) => acc + calculateNetRevenue(order), 0);
    
    // Calculate the HoS specific earnings (their own sales + their overrides on team sales)
    const hosCommissions = filteredCommissions
        .filter(c => c.seller_id === hos?.seller_id_public)
        .reduce((acc, comm) => acc + Number(comm.commission_amount_usd || 0), 0);
    
    // Total distributed across the entire team (including HoS)
    // const totalTeamCommissions = filteredCommissions.reduce((acc, comm) => acc + Number(comm.commission_amount_usd || 0), 0);
    
    const avgTicket = filteredOrders.length > 0 ? totalNetRevenue / filteredOrders.length : 0;

    return (
        <div className="max-w-7xl mx-auto space-y-8 p-4 sm:p-6">
            {/* Header section with standardized style */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 border-b border-gold-medium/10 pb-6 sm:pb-8">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-gold-medium/10 rounded-lg shrink-0">
                            <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-gold-medium" />
                        </div>
                        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white tracking-tight break-words">
                            Analytics do Time: {hos?.full_name || hosId} (V3.1)
                        </h1>

                    </div>
                    <p className="text-gray-400 max-w-2xl text-xs sm:text-sm">
                        Visão detalhada de faturamento, comissão e performance dos vendedores do time.
                    </p>
                </div>
                
                <div className="bg-black/20 p-2 rounded-xl border border-gold-medium/10 w-full sm:w-auto">
                    <PeriodFilter 
                        value={periodFilter} 
                        onChange={setPeriodFilter}
                        customDateRange={customDateRange}
                        onCustomDateRangeChange={setCustomDateRange}
                    />
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                <Card className="bg-black/40 border-gold-medium/20 relative overflow-hidden group">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                            <DollarSign className="w-3.5 h-3.5 text-gold-medium" />
                            Faturamento Líquido (Time)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-white tabular-nums">
                            {loading ? '---' : formatCurrency(totalNetRevenue)}
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30 relative overflow-hidden group">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-bold text-gold-medium uppercase tracking-wider flex items-center gap-2">
                            <Wallet className="w-3.5 h-3.5" />
                            Comissão
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-gold-light tabular-nums">
                            {loading ? '---' : formatCurrency(hosCommissions)}
                        </div>
                        <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <DollarSign className="w-24 h-24 text-gold-medium" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-black/40 border-blue-500/20 relative overflow-hidden group">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2">
                            <TrendingUp className="w-3.5 h-3.5" />
                            Ticket Médio
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white tabular-nums">
                            {loading ? '---' : formatCurrency(avgTicket)}
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-black/40 border-gray-500/20 relative overflow-hidden group">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                            <Users className="w-3.5 h-3.5" />
                            Vendedores no Time
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">
                            {loading ? '---' : teamMembers.length}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Sellers Performance Table */}
            <Card className="bg-black/40 border border-gold-medium/20 overflow-hidden backdrop-blur-md">
                <CardHeader className="border-b border-gold-medium/10 bg-white/[0.02] flex flex-row items-center justify-between py-5">
                    <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                        <Users className="w-5 h-5 text-gold-light" />
                        Performance dos Vendedores
                    </CardTitle>
                    <div className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">
                        {filteredOrders.length} Vendas no Período
                    </div>
                </CardHeader>
                <div className="overflow-x-auto">
                    {/* Desktop Table */}
                    <table className="w-full text-left text-sm hidden md:table">
                        <thead className="text-[10px] text-gray-500 uppercase font-bold tracking-widest bg-black/60">
                            <tr>
                                <th className="px-6 py-5">Vendedor</th>
                                <th className="px-6 py-5 text-center">Vendas</th>
                                <th className="px-6 py-5">Faturamento Líquido</th>
                                <th className="px-6 py-5">Comissão Individual</th>
                                <th className="px-6 py-5 text-right">Ação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gold-medium/10">
                            {loading ? (
                                [1, 2, 3].map(i => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={5} className="px-6 py-8 h-16 bg-white/[0.01]"></td>
                                    </tr>
                                ))
                            ) : teamMembers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500 italic">
                                        Nenhum membro encontrado neste time.
                                    </td>
                                </tr>
                            ) : (
                                teamMembers
                                    .map(member => {
                                        const memberOrders = filteredOrders.filter(o => o.seller_id === member.seller_id_public);
                                        const memberComms = filteredCommissions.filter(c => c.seller_id === member.seller_id_public);
                                        
                                        const memberNet = memberOrders.reduce((acc, o) => acc + calculateNetRevenue(o), 0);
                                        const memberCommAmount = memberComms.reduce((acc, c) => acc + Number(c.commission_amount_usd || 0), 0);

                                        return {
                                            ...member,
                                            memberOrders,
                                            memberNet,
                                            memberCommAmount
                                        };
                                    })
                                    .sort((a, b) => b.memberOrders.length - a.memberOrders.length)
                                    .map(member => {
                                        return (
                                            <tr key={member.id} className="hover:bg-white/[0.04] transition-all group">

                                            <td className="px-6 py-5">
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-white text-base group-hover:text-gold-light transition-colors">{member.full_name}</span>
                                                        {member.is_hos && (
                                                            <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded font-bold uppercase tracking-wider">
                                                                Líder
                                                            </span>
                                                        )}
                                                        {member.is_former && (
                                                            <span className="text-[10px] px-1.5 py-0.5 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded font-bold uppercase tracking-wider">
                                                                Fora do Time
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-[10px] text-gray-500 font-mono tracking-tighter uppercase mt-0.5">{member.seller_id_public}</span>
                                                </div>
                                            </td>


                                            <td className="px-6 py-5 text-center">
                                                <span className="px-3 py-1 bg-white/5 rounded-full text-xs font-bold text-white border border-white/10 group-hover:border-gold-medium/30 transition-all">
                                                    {member.memberOrders.length}
                                                </span>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex flex-col">
                                                    <span className="text-white font-bold text-base">{formatCurrency(member.memberNet)}</span>
                                                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">Faturamento</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex flex-col">
                                                    <span className="text-purple-400 font-bold text-base">{formatCurrency(member.memberCommAmount)}</span>
                                                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">Comissão Individual</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-right">
                                                <Link to={`/dashboard/sellers/${member.seller_id_public}/analytics`}>
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm" 
                                                        className="bg-black border-gold-medium/30 text-gold-light hover:bg-gold-medium/20 hover:border-gold-medium hover:text-white transition-all font-bold text-[10px] uppercase tracking-wider px-4"
                                                    >
                                                        Ver Analítico
                                                    </Button>
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })

                            )}

                        </tbody>
                    </table>

                    {/* Mobile Cards */}
                    <div className="md:hidden divide-y divide-gold-medium/10">
                        {loading ? (
                            [1, 2, 3].map(i => (
                                <div key={i} className="p-4 space-y-4 animate-pulse">
                                    <div className="h-4 bg-white/10 rounded w-1/2"></div>
                                    <div className="h-4 bg-white/10 rounded w-1/3"></div>
                                    <div className="h-10 bg-white/5 rounded"></div>
                                </div>
                            ))
                        ) : teamMembers.length === 0 ? (
                            <div className="p-12 text-center text-gray-500 italic">
                                Nenhum membro encontrado neste time.
                            </div>
                        ) : (
                            teamMembers
                                .map(member => {
                                    const memberOrders = filteredOrders.filter(o => o.seller_id === member.seller_id_public);
                                    const memberComms = filteredCommissions.filter(c => c.seller_id === member.seller_id_public);
                                    
                                    const memberNet = memberOrders.reduce((acc, o) => acc + calculateNetRevenue(o), 0);
                                    const memberCommAmount = memberComms.reduce((acc, c) => acc + Number(c.commission_amount_usd || 0), 0);

                                    return {
                                        ...member,
                                        memberOrders,
                                        memberNet,
                                        memberCommAmount
                                    };
                                })
                                .sort((a, b) => b.memberOrders.length - a.memberOrders.length)
                                .map(member => {
                                    return (
                                        <div key={member.id} className="p-4 space-y-4">

                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-white text-base block">{member.full_name}</span>
                                                    {member.is_hos && (
                                                        <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded font-bold uppercase tracking-wider">
                                                            Líder
                                                        </span>
                                                    )}
                                                    {member.is_former && (
                                                        <span className="text-[10px] px-1.5 py-0.5 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded font-bold uppercase tracking-wider">
                                                            Fora
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-[10px] text-gray-500 font-mono uppercase">{member.seller_id_public}</span>
                                            </div>


                                            <span className="px-3 py-1 bg-white/5 rounded-full text-xs font-bold text-white border border-white/10">
                                                {member.memberOrders.length} vendas
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                                            <div>
                                                <span className="text-[10px] text-gray-500 font-bold uppercase block mb-0.5">Faturamento</span>
                                                <span className="text-white font-bold text-sm block">{formatCurrency(member.memberNet)}</span>
                                            </div>
                                            <div>
                                                <span className="text-[10px] text-gray-500 font-bold uppercase block mb-0.5">Comissão</span>
                                                <span className="text-purple-400 font-bold text-sm block">{formatCurrency(member.memberCommAmount)}</span>
                                            </div>
                                        </div>

                                        <Link to={`/dashboard/sellers/${member.seller_id_public}/analytics`} className="block w-full">
                                            <Button 
                                                variant="outline" 
                                                className="w-full bg-black border-gold-medium/30 text-gold-light font-bold text-[10px] uppercase tracking-wider h-10"
                                            >
                                                Ver Analítico Completo
                                            </Button>
                                        </Link>
                                    </div>
                                );
                            })

                        )}
                    </div>

                </div>
            </Card>
        </div>
    );
}
