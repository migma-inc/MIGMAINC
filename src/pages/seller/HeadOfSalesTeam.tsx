import { useOutletContext } from 'react-router-dom';
import type { SellerInfo } from '@/types/seller';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';

export function HeadOfSalesTeam() {
    const { seller } = useOutletContext<{ seller: SellerInfo }>();
    const [teamMembers, setTeamMembers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadTeam() {
            try {
                const { data } = await supabase
                    .from('sellers')
                    .select('*')
                    .eq('head_of_sales_id', seller.id)
                    .order('full_name');

                setTeamMembers(data || []);
            } catch (error) {
                console.error('Error loading team members:', error);
            } finally {
                setLoading(false);
            }
        }

        if (seller.id) {
            loadTeam();
        }
    }, [seller.id]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Minha Equipe</h1>
                    <p className="text-gray-400 mt-1">Vendedores diretamente sob sua gestão.</p>
                </div>
            </div>

            <Card className="bg-black/40 border-gold-medium/20">
                <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                        <Users className="w-5 h-5 text-gold-light" />
                        Integrantes
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <p className="text-gray-400">Carregando...</p>
                    ) : teamMembers.length === 0 ? (
                        <p className="text-gray-400 text-center py-6">Nenhum vendedor encontrado sob sua gestão.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-gray-300">
                                <thead className="text-xs text-gray-400 uppercase bg-white/5 border-b border-white/10">
                                    <tr>
                                        <th className="px-6 py-3">Nome</th>
                                        <th className="px-6 py-3">ID Vendedor</th>
                                        <th className="px-6 py-3">Email</th>
                                        <th className="px-6 py-3">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {teamMembers.map(member => (
                                        <tr key={member.id} className="border-b border-white/10 hover:bg-white/5">
                                            <td className="px-6 py-4 font-medium text-white">{member.full_name}</td>
                                            <td className="px-6 py-4">{member.seller_id_public}</td>
                                            <td className="px-6 py-4">{member.email}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded text-xs ${member.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                    {member.status}
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
        </div>
    );
}
