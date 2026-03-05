import { useOutletContext } from 'react-router-dom';
import type { SellerInfo } from '@/types/seller';
import { Users, DollarSign, Award } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';

export function HeadOfSalesOverview() {
    const { seller } = useOutletContext<{ seller: SellerInfo }>();
    const [teamSize, setTeamSize] = useState(0);
    const [teamSales, setTeamSales] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadStats() {
            try {
                // Obter tamanho da equipe
                const { count: sellersCount } = await supabase
                    .from('sellers')
                    .select('*', { count: 'exact', head: true })
                    .eq('head_of_sales_id', seller.id);

                setTeamSize(sellersCount || 0);

                // Obter ids dos vendedores da equipe
                const { data: teamMembers } = await supabase
                    .from('sellers')
                    .select('seller_id_public')
                    .eq('head_of_sales_id', seller.id);

                if (teamMembers && teamMembers.length > 0) {
                    const sellerIds = teamMembers.map(m => m.seller_id_public);

                    // Somar vendas da equipe (pedidos aprovados)
                    const { data: orders } = await supabase
                        .from('visa_orders')
                        .select('total_price_usd')
                        .in('seller_id', sellerIds)
                        .eq('payment_status', 'completed');

                    const total = orders?.reduce((acc, order) => acc + (order.total_price_usd || 0), 0) || 0;
                    setTeamSales(total);
                } else {
                    setTeamSales(0);
                }
            } catch (error) {
                console.error('Error loading team stats:', error);
            } finally {
                setLoading(false);
            }
        }

        if (seller.id) {
            loadStats();
        }
    }, [seller.id]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Gestão de Equipe</h1>
                    <p className="text-gray-400 mt-1">Bem-vindo(a), {seller.full_name}. Acompanhe os resultados da sua equipe.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="bg-black/40 border-gold-medium/20 backdrop-blur-md transition-all hover:bg-black/60 hover:border-gold-medium/40">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-400">Tamanho da Equipe</CardTitle>
                        <Users className="w-4 h-4 text-gold-medium" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">
                            {loading ? '...' : teamSize}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Vendedores ativos</p>
                    </CardContent>
                </Card>

                <Card className="bg-black/40 border-gold-medium/20 backdrop-blur-md transition-all hover:bg-black/60 hover:border-gold-medium/40">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-400">Vendas da Equipe</CardTitle>
                        <DollarSign className="w-4 h-4 text-green-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-400">
                            {loading ? '...' : formatCurrency(teamSales)}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Apenas pedidos concluídos</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="bg-black/40 border-gold-medium/20 overflow-hidden">
                <div className="p-8 text-center flex flex-col items-center justify-center">
                    <div className="w-16 h-16 bg-gold-medium/10 rounded-full flex items-center justify-center mb-4">
                        <Award className="w-8 h-8 text-gold-medium" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Painel de Gestão</h3>
                    <p className="text-gray-400 max-w-md mx-auto">
                        Utilize as seções "Minha Equipe" e "Pedidos da Equipe" no menu lateral para visualizar detalhes granulares do desempenho dos seus vendedores.
                    </p>
                </div>
            </Card>
        </div>
    );
}
