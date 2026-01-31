import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'; // Consistent imports
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Ticket, Plus, Trash2, Power, Search, Loader2 } from 'lucide-react';
import {
    getCoupons,
    createCoupon,
    toggleCouponStatus,
    deleteCoupon,
    type Coupon,
    type CouponFormData
} from '@/lib/coupon-service';

export function CouponManagement() {
    const [coupons, setCoupons] = useState<Coupon[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState<CouponFormData>({
        code: '',
        description: '',
        discount_type: 'percentage',
        discount_value: 0,
        is_active: true,
        valid_from: new Date().toISOString().split('T')[0],
        valid_until: '',
    });

    useEffect(() => {
        loadCoupons();
    }, []);

    const loadCoupons = async () => {
        setLoading(true);
        try {
            const data = await getCoupons();
            setCoupons(data);
        } catch (err) {
            console.error('Failed to load coupons', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await createCoupon({
                ...formData,
                valid_until: formData.valid_until || undefined, // Send undefined if empty string
            });
            await loadCoupons();
            setIsCreateOpen(false);
            setFormData({
                code: '',
                description: '',
                discount_type: 'percentage',
                discount_value: 0,
                is_active: true,
                valid_from: new Date().toISOString().split('T')[0],
                valid_until: '',
            });
            // toast({ title: "Success", description: "Coupon created successfully" });
        } catch (err) {
            console.error('Error creating coupon', err);
            alert('Failed to create coupon');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleToggleStatus = async (id: string, currentStatus: boolean) => {
        try {
            await toggleCouponStatus(id, !currentStatus);
            setCoupons(coupons.map(c => c.id === id ? { ...c, is_active: !currentStatus } : c));
        } catch (err) {
            console.error('Error toggling status', err);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this coupon?')) return;
        try {
            await deleteCoupon(id);
            setCoupons(coupons.filter(c => c.id !== id));
        } catch (err) {
            console.error('Error deleting coupon', err);
        }
    };

    const filteredCoupons = coupons.filter(c =>
        c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold migma-gold-text flex items-center gap-2">
                        <Ticket className="w-6 h-6 sm:w-8 sm:h-8" />
                        Vochers & Cupons
                    </h1>
                    <p className="text-gray-400">Gerencie códigos promocionais e descontos</p>
                </div>

                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-gold-medium hover:bg-gold-light text-black font-bold">
                            <Plus className="w-4 h-4 mr-2" /> Novo Cupom
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-zinc-900 border-gold-medium/30 text-white">
                        <DialogHeader>
                            <DialogTitle className="text-gold-light">Criar Novo Cupom</DialogTitle>
                            <DialogDescription className="text-gray-400">
                                Preencha os detalhes abaixo para criar um novo cupom de desconto.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleCreateSubmit} className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <Label>Código do Cupom</Label>
                                <Input
                                    value={formData.code}
                                    onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                    placeholder="EX: SUMMER10"
                                    className="bg-black/50 border-white/10 uppercase"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Descrição (Opcional)</Label>
                                <Input
                                    value={formData.description || ''}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Campanha de Verão 2026"
                                    className="bg-black/50 border-white/10"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Tipo de Desconto</Label>
                                    <Select
                                        value={formData.discount_type}
                                        onValueChange={(val: 'fixed' | 'percentage') => setFormData({ ...formData, discount_type: val })}
                                    >
                                        <SelectTrigger className="bg-black/50 border-white/10">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="percentage">Porcentagem (%)</SelectItem>
                                            <SelectItem value="fixed">Valor Fixo ($)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Valor</Label>
                                    <Input
                                        type="number"
                                        value={formData.discount_value || ''}
                                        onChange={e => setFormData({ ...formData, discount_value: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                                        className="bg-black/50 border-white/10"
                                        required
                                        min="0"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Validade (Início)</Label>
                                    <Input
                                        type="date"
                                        value={formData.valid_from}
                                        onChange={e => setFormData({ ...formData, valid_from: e.target.value })}
                                        className="bg-black/50 border-white/10"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Validade (Fim)</Label>
                                    <Input
                                        type="date"
                                        value={formData.valid_until || ''}
                                        onChange={e => setFormData({ ...formData, valid_until: e.target.value })}
                                        className="bg-black/50 border-white/10"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Limite de Usos (Opcional)</Label>
                                <Input
                                    type="number"
                                    placeholder="Ex: 100"
                                    value={formData.max_uses || ''}
                                    onChange={e => setFormData({ ...formData, max_uses: e.target.value ? parseInt(e.target.value) : undefined })}
                                    className="bg-black/50 border-white/10"
                                />
                            </div>

                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} className="border-white/10 text-gray-400 hover:text-white">Cancel</Button>
                                <Button type="submit" className="bg-gold-medium text-black hover:bg-gold-light" disabled={isSubmitting}>
                                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar Cupom'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-white">Cupons Ativos</CardTitle>
                        <div className="relative w-64">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Buscar cupom..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-8 bg-black/50 border-gold-medium/30 text-white"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-400">
                            <thead className="text-xs uppercase bg-black/40 text-gold-light">
                                <tr>
                                    <th className="px-6 py-3">Código</th>
                                    <th className="px-6 py-3">Desconto</th>
                                    <th className="px-6 py-3">Usos</th>
                                    <th className="px-6 py-3">Validade</th>
                                    <th className="px-6 py-3">Status</th>
                                    <th className="px-6 py-3 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={6} className="text-center py-8"><Loader2 className="w-8 h-8 animate-spin mx-auto text-gold-medium" /></td></tr>
                                ) : filteredCoupons.length === 0 ? (
                                    <tr><td colSpan={6} className="text-center py-8 text-gray-500">Nenhum cupom encontrado</td></tr>
                                ) : (
                                    filteredCoupons.map((coupon) => (
                                        <tr key={coupon.id} className="border-b border-gray-800 hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4 font-mono font-bold text-white tracking-wider">{coupon.code}</td>
                                            <td className="px-6 py-4">
                                                {coupon.discount_type === 'percentage' ? (
                                                    <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/50">{coupon.discount_value}% OFF</Badge>
                                                ) : (
                                                    <Badge className="bg-green-500/20 text-green-300 border-green-500/50">${coupon.discount_value} OFF</Badge>
                                                )}
                                                {coupon.description && <div className="text-xs text-gray-500 mt-1">{coupon.description}</div>}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-white font-bold">{coupon.current_uses}</span>
                                                {coupon.max_uses && <span className="text-gray-600"> / {coupon.max_uses}</span>}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-xs">
                                                    <div>Inicio: {new Date(coupon.valid_from).toLocaleDateString()}</div>
                                                    {coupon.valid_until ? (
                                                        <div className={new Date(coupon.valid_until) < new Date() ? "text-red-400" : ""}>
                                                            Fim: {new Date(coupon.valid_until).toLocaleDateString()}
                                                        </div>
                                                    ) : <span className="text-green-500/70">Sempre válido</span>}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <Badge variant={coupon.is_active ? "default" : "destructive"} className={coupon.is_active ? "bg-green-600" : "bg-red-900"}>
                                                    {coupon.is_active ? 'Ativo' : 'Inativo'}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4 text-right space-x-2">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleToggleStatus(coupon.id, coupon.is_active)}
                                                    title={coupon.is_active ? "Desativar" : "Ativar"}
                                                    className="hover:bg-white/10"
                                                >
                                                    <Power className={`w-4 h-4 ${coupon.is_active ? "text-green-400" : "text-gray-500"}`} />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleDelete(coupon.id)}
                                                    className="hover:bg-red-500/20 text-red-400 hover:text-red-300"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
