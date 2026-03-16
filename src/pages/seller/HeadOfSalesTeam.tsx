import { useOutletContext } from 'react-router-dom';
import type { SellerInfo } from '@/types/seller';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, TrendingUp, ShoppingBag, Loader2, LinkIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';

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
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadTeamData() {
            setLoading(true);
            try {
                // 1. Buscar membros da equipe vinculados a este HoS
                const { data: teamData, error: teamError } = await supabase
                    .from('sellers')
                    .select('id, full_name, email, seller_id_public, status')
                    .eq('head_of_sales_id', seller.id)
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
                } else {
                    setMembers([]);
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
    }, [seller.id]);

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                        <Users className="w-8 h-8 text-gold-medium" />
                        Minha Equipe
                    </h1>
                    <p className="text-gray-400 mt-1">Acompanhe o desempenho individual dos seus vendedores.</p>
                </div>
            </div>

            <Card className="bg-black/40 border-gold-medium/20 overflow-hidden">
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-24 gap-4">
                            <Loader2 className="w-10 h-10 text-gold-medium animate-spin" />
                            <p className="text-gray-500 font-medium">Carregando dados da equipe...</p>
                        </div>
                    ) : members.length === 0 ? (
                        <div className="text-center py-20 px-8">
                            <Users className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-white mb-2">Nenhum vendedor encontrado</h3>
                            <p className="text-gray-400 max-w-md mx-auto">
                                Sua equipe parece estar vazia no momento. Entre em contato com o administrador para vincular novos vendedores ao seu perfil.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-gold-medium/20 bg-gold-medium/5">
                                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Vendedor</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Status</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Faturamento (USD)</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Pedidos</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {members.map((member) => (
                                        <tr key={member.id} className="hover:bg-white/5 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div>
                                                    <p className="font-bold text-white group-hover:text-gold-light transition-colors">{member.full_name}</p>
                                                    <p className="text-xs text-gray-500">{member.email}</p>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                                    member.status === 'active' 
                                                    ? 'bg-green-500/10 text-green-500 border-green-500/20' 
                                                    : 'bg-red-500/10 text-red-500 border-red-500/20'
                                                }`}>
                                                    {member.status === 'active' ? 'Ativo' : 'Inativo'}
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
                                            <td className="px-6 py-4 text-right">
                                                <Button 
                                                    variant="outline" 
                                                    size="sm"
                                                    className="border-gold-medium/20 bg-black/40 text-gold-light hover:bg-gold-medium/10 hover:border-gold-medium"
                                                    onClick={() => {
                                                        const url = new URL(window.location.origin + '/seller/dashboard/links');
                                                        url.searchParams.set('sellerId', member.id);
                                                        window.location.href = url.toString();
                                                    }}
                                                >
                                                    <LinkIcon className="w-4 h-4 mr-2" />
                                                    Gerar Link
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

            <div className="bg-gold-medium/5 border border-gold-medium/20 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-black/40 rounded-full flex items-center justify-center border border-gold-medium/20">
                        <Users className="w-6 h-6 text-gold-medium" />
                    </div>
                    <div>
                        <h4 className="font-bold text-white">Gestão Centralizada</h4>
                        <p className="text-sm text-gray-400">A inclusão ou remoção de membros é realizada exclusivamente pela administração.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
