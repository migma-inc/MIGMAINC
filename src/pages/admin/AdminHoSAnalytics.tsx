import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Crown, Users } from 'lucide-react';
import { PeriodFilter, type PeriodOption, type CustomDateRange } from '@/components/seller/PeriodFilter';
import type { SellerInfo } from '@/types/seller';

export function AdminHoSAnalytics() {
    const { hosId } = useParams<{ hosId: string }>();
    const [hos, setHos] = useState<SellerInfo | null>(null);
    const [teamMembers, setTeamMembers] = useState<any[]>([]);
    const [orders, setOrders] = useState<any[]>([]);
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
                // 1. Buscar info do HoS
                const { data: hosData } = await supabase
                    .from('sellers')
                    .select('*')
                    .eq('seller_id_public', hosId)
                    .single();

                if (hosData) {
                    setHos(hosData);

                    // 2. Buscar membros da equipe
                    const { data: members } = await supabase
                        .from('sellers')
                        .select('id, full_name, seller_id_public')
                        .eq('head_of_sales_id', hosData.id);

                    setTeamMembers(members || []);

                    // 3. Buscar pedidos da equipe
                    if (members && members.length > 0) {
                        const sellerIds = members.map(m => m.seller_id_public);
                        
                        const { data: ordersData } = await supabase
                            .from('visa_orders')
                            .select('*')
                            .in('seller_id', sellerIds)
                            .eq('payment_status', 'completed');

                        setOrders(ordersData || []);
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

    // Lógica de filtragem e cálculos de faturamento líquido (Net Revenue)
    const filteredOrders = orders.filter(order => {
        const orderDate = new Date(order.created_at);
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
            start = new Date();
            start.setDate(1);
            start.setHours(0, 0, 0, 0);
        } else { // Default or other
            start = new Date();
            start.setDate(start.getDate() - 30);
        }

        return orderDate >= start && orderDate <= end;
    });

    const calculateNetRevenue = (order: any) => {
        return Number(order.base_price_usd || 0) + 
               (Number(order.extra_units || 0) * Number(order.extra_unit_price_usd || 0)) + 
               Number(order.upsell_price_usd || 0) - 
               Number(order.discount_amount || 0);
    };

    const totalNetRevenue = filteredOrders.reduce((acc, order) => acc + calculateNetRevenue(order), 0);
    const avgTicket = filteredOrders.length > 0 ? totalNetRevenue / filteredOrders.length : 0;

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                        <Crown className="w-8 h-8 text-gold-medium" />
                        Analytics de Gestão: {hos?.full_name || hosId}
                    </h1>
                    <p className="text-gray-400 mt-1">Visão administrativa de desempenho da equipe e overrides.</p>
                </div>
                <PeriodFilter 
                    value={periodFilter} 
                    onChange={setPeriodFilter}
                    customDateRange={customDateRange}
                    onCustomDateRangeChange={setCustomDateRange}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="bg-black/40 border-gold-medium/20 backdrop-blur-md">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-400">Faturamento Líquido (Time)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-gold-light">
                            {loading ? '...' : formatCurrency(totalNetRevenue)}
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-black/40 border-gold-medium/20 backdrop-blur-md">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-400">Total de Pedidos</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">
                            {loading ? '...' : filteredOrders.length}
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-black/40 border-gold-medium/20 backdrop-blur-md">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-400">Ticket Médio</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-400">
                            {loading ? '...' : formatCurrency(avgTicket)}
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-black/40 border-gold-medium/20 backdrop-blur-md">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-400">Membros na Equipe</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-purple-400">
                            {loading ? '...' : teamMembers.length}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Performance por Vendedor */}
            <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30 overflow-hidden backdrop-blur-md">
                <CardHeader className="border-b border-gold-medium/10">
                    <CardTitle className="text-lg flex items-center gap-2 text-white">
                        <Users className="w-5 h-5 text-gold-light" />
                        Desempenho por Vendedor
                    </CardTitle>
                </CardHeader>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="text-xs text-gray-500 uppercase bg-black/40 border-gold-medium/10">
                            <tr>
                                <th className="px-6 py-4">Vendedor</th>
                                <th className="px-6 py-4">Vendas</th>
                                <th className="px-6 py-4">Faturamento Bruto</th>
                                <th className="px-6 py-4">Faturamento Líquido</th>
                                <th className="px-6 py-4 text-right">Ação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gold-medium/10">
                            {teamMembers.map(member => {
                                const memberOrders = filteredOrders.filter(o => o.seller_id === member.seller_id_public);
                                const memberNet = memberOrders.reduce((acc, o) => acc + calculateNetRevenue(o), 0);
                                const memberGross = memberOrders.reduce((acc, o) => acc + Number(o.total_price_usd || 0), 0);

                                return (
                                    <tr key={member.id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-white">{member.full_name}</div>
                                            <div className="text-[10px] text-gray-500">{member.seller_id_public}</div>
                                        </td>
                                        <td className="px-6 py-4 text-white">{memberOrders.length}</td>
                                        <td className="px-6 py-4 text-gray-400 line-through decoration-red-500/50">{formatCurrency(memberGross)}</td>
                                        <td className="px-6 py-4 text-gold-light font-bold">{formatCurrency(memberNet)}</td>
                                        <td className="px-6 py-4 text-right">
                                            <Button variant="ghost" size="sm" className="text-gold-light hover:bg-gold-medium/10">
                                                Ver Detalhes
                                            </Button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
