import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Crown, Users, X, Loader2, UserPlus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Seller {
    id: string;
    full_name: string;
    email: string;
    seller_id_public: string;
    status: string;
    role: string;
    head_of_sales_id: string | null;
}

export function HeadOfSalesManagement() {
    const [sellers, setSellers] = useState<Seller[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [filterRole, setFilterRole] = useState<'all' | 'head_of_sales' | 'seller'>('all');

    useEffect(() => {
        loadSellers();
    }, []);

    const loadSellers = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('sellers')
                .select('id, full_name, email, seller_id_public, status, role, head_of_sales_id')
                .order('full_name');

            if (error) throw error;
            setSellers(data || []);
        } catch (err) {
            console.error('[HeadOfSalesManagement] Error loading sellers:', err);
        } finally {
            setLoading(false);
        }
    };

    const promoteToHeadOfSales = async (seller: Seller) => {
        setSaving(seller.id);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Not authenticated');

            const { error } = await supabase.functions.invoke('admin-update-seller', {
                body: {
                    seller_id: seller.id,
                    full_name: seller.full_name,
                    email: seller.email,
                    phone: '-',
                    seller_id_public: seller.seller_id_public,
                    role: 'head_of_sales',
                    head_of_sales_id: null,
                },
            });

            if (error) throw error;
            await loadSellers();
        } catch (err) {
            console.error('[HeadOfSalesManagement] Error promoting seller:', err);
        } finally {
            setSaving(null);
        }
    };

    const demoteToSeller = async (seller: Seller) => {
        setSaving(seller.id);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Not authenticated');

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
            await loadSellers();
        } catch (err) {
            console.error('[HeadOfSalesManagement] Error demoting seller:', err);
        } finally {
            setSaving(null);
        }
    };

    const assignManager = async (sellerId: string, seller: Seller, managerId: string) => {
        setSaving(sellerId);
        try {
            const { error } = await supabase.functions.invoke('admin-update-seller', {
                body: {
                    seller_id: seller.id,
                    full_name: seller.full_name,
                    email: seller.email,
                    phone: '-',
                    seller_id_public: seller.seller_id_public,
                    role: 'seller',
                    head_of_sales_id: managerId || null,
                },
            });

            if (error) throw error;
            await loadSellers();
        } catch (err) {
            console.error('[HeadOfSalesManagement] Error assigning manager:', err);
        } finally {
            setSaving(null);
        }
    };

    const headsOfSales = sellers.filter(s => s.role === 'head_of_sales');
    const regularSellers = sellers.filter(s => s.role !== 'head_of_sales');

    const filteredSellers = sellers.filter(s => {
        const matchesSearch =
            s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
            s.email?.toLowerCase().includes(search.toLowerCase()) ||
            s.seller_id_public?.toLowerCase().includes(search.toLowerCase());
        const matchesRole = filterRole === 'all' || s.role === filterRole;
        return matchesSearch && matchesRole;
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                    <Crown className="w-8 h-8 text-gold-medium" />
                    Gestão de Head of Sales
                </h1>
                <p className="text-gray-400 mt-1">
                    Promova vendedores a gestores e atribua equipes diretamente por aqui.
                </p>
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
                        <p className="text-xs text-gray-500 mt-1">Gestores ativos</p>
                    </CardContent>
                </Card>

                <Card className="bg-black/40 border-gold-medium/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-400">Vendedores com Gestor</CardTitle>
                        <Users className="w-4 h-4 text-gold-medium" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-gold-light">
                            {regularSellers.filter(s => s.head_of_sales_id).length}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Vinculados a uma equipe</p>
                    </CardContent>
                </Card>

                <Card className="bg-black/40 border-gray-700/30">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-400">Sem Gestor</CardTitle>
                        <UserPlus className="w-4 h-4 text-gray-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-gray-300">
                            {regularSellers.filter(s => !s.head_of_sales_id).length}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Aguardando vinculação</p>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar por nome, email ou ID..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-black/50 border border-gold-medium/30 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-gold-medium"
                    />
                </div>
                <div className="flex gap-2">
                    {(['all', 'head_of_sales', 'seller'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilterRole(f)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filterRole === f
                                ? 'bg-gold-medium text-black'
                                : 'bg-black/40 text-gray-400 border border-gold-medium/20 hover:text-gold-light'
                                }`}
                        >
                            {f === 'all' ? 'Todos' : f === 'head_of_sales' ? 'Gestores' : 'Vendedores'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <Card className="bg-black/40 border-gold-medium/20">
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="w-8 h-8 text-gold-medium animate-spin" />
                        </div>
                    ) : filteredSellers.length === 0 ? (
                        <p className="text-gray-400 text-center py-12">Nenhum vendedor encontrado.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead>
                                    <tr className="border-b border-gold-medium/20 text-xs text-gray-400 uppercase">
                                        <th className="px-6 py-4">Vendedor</th>
                                        <th className="px-6 py-4">ID Público</th>
                                        <th className="px-6 py-4">Papel atual</th>
                                        <th className="px-6 py-4">Gestor vinculado</th>
                                        <th className="px-6 py-4">Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredSellers.map(seller => {
                                        const isHos = seller.role === 'head_of_sales';
                                        const isSaving = saving === seller.id;

                                        return (
                                            <tr
                                                key={seller.id}
                                                className="border-b border-white/5 hover:bg-white/5 transition-colors"
                                            >
                                                <td className="px-6 py-4">
                                                    <div>
                                                        <p className="font-medium text-white">{seller.full_name}</p>
                                                        <p className="text-xs text-gray-500">{seller.email}</p>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-gray-400 font-mono text-xs">
                                                    {seller.seller_id_public}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {isHos ? (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                                                            <Crown className="w-3 h-3" />
                                                            Head of Sales
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-white/5 text-gray-400 border border-white/10">
                                                            Vendedor
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {isHos ? (
                                                        <span className="text-xs text-gray-600 italic">— (é um gestor)</span>
                                                    ) : (
                                                        <select
                                                            value={seller.head_of_sales_id || ''}
                                                            onChange={e => assignManager(seller.id, seller, e.target.value)}
                                                            disabled={isSaving}
                                                            className="bg-black/60 border border-gold-medium/20 text-gray-300 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-gold-medium disabled:opacity-50"
                                                        >
                                                            <option value="">Sem gestor</option>
                                                            {headsOfSales.map(hos => (
                                                                <option key={hos.id} value={hos.id}>
                                                                    {hos.full_name || hos.email}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {isSaving ? (
                                                        <Loader2 className="w-4 h-4 animate-spin text-gold-medium" />
                                                    ) : isHos ? (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => demoteToSeller(seller)}
                                                            className="text-xs border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                                                        >
                                                            <X className="w-3 h-3 mr-1" />
                                                            Remover cargo
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => promoteToHeadOfSales(seller)}
                                                            className="text-xs border-purple-500/40 text-purple-400 hover:bg-purple-500/10 hover:text-purple-300"
                                                        >
                                                            <Crown className="w-3 h-3 mr-1" />
                                                            Promover
                                                        </Button>
                                                    )}
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
    );
}
