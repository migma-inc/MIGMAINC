import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'; // Consistent imports
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { Ticket, Plus, Trash2, Power, Search, Loader2, Edit, Eye, Users, Award } from 'lucide-react';
import {
    getCoupons,
    createCoupon,
    toggleCouponStatus,
    deleteCoupon,
    updateCoupon,
    getCouponUsage,
    removeCouponFromOrder,
    type Coupon,
    type CouponFormData,
    type CouponUsage
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
    const [editingCouponId, setEditingCouponId] = useState<string | null>(null);

    // Usage History State
    const [usageModalOpen, setUsageModalOpen] = useState(false);
    const [currentUsage, setCurrentUsage] = useState<CouponUsage[]>([]);
    const [usageLoading, setUsageLoading] = useState(false);
    const [selectedCouponCode, setSelectedCouponCode] = useState<string>('');
    const [usageToDelete, setUsageToDelete] = useState<CouponUsage | null>(null);
    const [isDeletingUsage, setIsDeletingUsage] = useState(false);
    const [removeUsageModalOpen, setRemoveUsageModalOpen] = useState(false);

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

    const handleViewUsage = async (coupon: Coupon) => {
        setSelectedCouponCode(coupon.code);
        setUsageLoading(true);
        setUsageModalOpen(true);
        try {
            const usageData = await getCouponUsage(coupon.code);
            setCurrentUsage(usageData);
        } catch (err) {
            console.error('Failed to load coupon usage', err);
        } finally {
            setUsageLoading(false);
        }
    };

    const handleRemoveUsage = (usage: CouponUsage) => {
        setUsageToDelete(usage);
        setRemoveUsageModalOpen(true);
    };

    const confirmRemoveUsage = async () => {
        if (!usageToDelete) return;

        setIsDeletingUsage(true);
        try {
            await removeCouponFromOrder(usageToDelete.id, selectedCouponCode);

            // Update local state for usage history
            setCurrentUsage(prev => prev.filter(u => u.id !== usageToDelete.id));

            // Update coupons list to show decremented uses
            setCoupons(prev => prev.map(c =>
                c.code === selectedCouponCode
                    ? { ...c, current_uses: Math.max(0, c.current_uses - 1) }
                    : c
            ));

            // If it was the last usage, we can stay in the modal, otherwise it's fine
            if (currentUsage.length <= 1) {
                setUsageModalOpen(false);
            }
        } catch (err) {
            console.error('Failed to remove usage', err);
        } finally {
            setIsDeletingUsage(false);
            setUsageToDelete(null);
            setRemoveUsageModalOpen(false);
        }
    };

    const handleCreateSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation: Prevent past years
        const currentYear = new Date().getFullYear();
        const fromYear = parseInt(formData.valid_from.split('-')[0]);

        if (fromYear < currentYear) {
            alert(`Cannot set validity for past years. Please use ${currentYear} or later.`);
            return;
        }

        if (formData.valid_until) {
            const untilYear = parseInt(formData.valid_until.split('-')[0]);
            if (untilYear < currentYear) {
                alert(`Cannot set expiration date for past years.`);
                return;
            }

            if (formData.valid_until <= formData.valid_from) {
                alert('The expiration date must be strictly after the start date.');
                return;
            }
        }

        setIsSubmitting(true);
        try {
            if (editingCouponId) {
                await updateCoupon(editingCouponId, {
                    ...formData,
                    valid_until: formData.valid_until || undefined,
                });
            } else {
                await createCoupon({
                    ...formData,
                    valid_until: formData.valid_until || undefined,
                });
            }
            await loadCoupons();
            setIsCreateOpen(false);
            resetForm();
        } catch (err) {
            console.error('Error saving coupon', err);
            alert('Failed to save coupon');
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormData({
            code: '',
            description: '',
            discount_type: 'percentage',
            discount_value: 0,
            is_active: true,
            valid_from: new Date().toISOString().split('T')[0],
            valid_until: '',
        });
        setEditingCouponId(null);
    };

    const handleEdit = (coupon: Coupon) => {
        setFormData({
            code: coupon.code,
            description: coupon.description || '',
            discount_type: coupon.discount_type,
            discount_value: coupon.discount_value,
            is_active: coupon.is_active,
            valid_from: coupon.valid_from.split('T')[0],
            valid_until: coupon.valid_until ? coupon.valid_until.split('T')[0] : '',
            max_uses: coupon.max_uses || undefined,
        });
        setEditingCouponId(coupon.id);
        setIsCreateOpen(true);
    };

    const handleToggleStatus = async (id: string, currentStatus: boolean) => {
        try {
            await toggleCouponStatus(id, !currentStatus);
            setCoupons(coupons.map(c => c.id === id ? { ...c, is_active: !currentStatus } : c));
        } catch (err) {
            console.error('Error toggling status', err);
        }
    };

    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [couponToDelete, setCouponToDelete] = useState<string | null>(null);

    const handleDeleteClick = (id: string) => {
        setCouponToDelete(id);
        setDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!couponToDelete) return;
        try {
            await deleteCoupon(couponToDelete);
            setCoupons(coupons.filter(c => c.id !== couponToDelete));
        } catch (err) {
            console.error('Error deleting coupon', err);
        } finally {
            setDeleteModalOpen(false);
            setCouponToDelete(null);
        }
    };

    const filteredCoupons = coupons.filter(c =>
        c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        const [year, month, day] = dateString.split('T')[0].split('-').map(Number);
        return new Date(year, month - 1, day).toLocaleDateString();
    };

    const formatDateTime = (dateString: string) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleString();
    };

    const isExpired = (dateString: string) => {
        if (!dateString) return false;
        const [year, month, day] = dateString.split('T')[0].split('-').map(Number);
        const date = new Date(year, month - 1, day);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return date < today;
    };

    const activeCouponsCount = coupons.filter(c => c.is_active && !isExpired(c.valid_until || '')).length;
    const totalGlobalUses = coupons.reduce((sum, c) => sum + (c.current_uses || 0), 0);
    const topCoupon = coupons.length > 0 ? [...coupons].sort((a, b) => (b.current_uses || 0) - (a.current_uses || 0))[0] : null;

    return (
        <div className="p-2 sm:p-6 lg:p-8 space-y-4 md:space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div className="flex items-center gap-2 md:gap-3">
                    <div className="p-2 bg-gold-medium/10 rounded-xl border border-gold-medium/20 hidden md:block">
                      <Ticket className="w-6 h-6 sm:w-8 sm:h-8 text-gold-medium" />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-3xl font-black migma-gold-text uppercase tracking-widest flex items-center gap-2">
                            <Ticket className="w-5 h-5 md:hidden" />
                            Vouchers & Coupons
                        </h1>
                        <p className="text-[10px] md:text-sm text-gray-500 font-bold uppercase tracking-widest opacity-70">Gerencie códigos promocionais e descontos</p>
                    </div>
                </div>

                <Dialog open={isCreateOpen} onOpenChange={(open) => {
                    setIsCreateOpen(open);
                    if (!open) resetForm();
                }}>
                    <DialogTrigger asChild>
                        <Button className="w-full md:w-auto bg-gold-medium hover:bg-gold-light text-black font-black uppercase tracking-widest text-[11px] h-9 md:h-11 px-6 shadow-lg shadow-gold-medium/10">
                            <Plus className="w-4 h-4 mr-2" /> New Coupon
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-zinc-900 border-gold-medium/30 text-white p-4 md:p-6 w-[95vw] sm:max-w-md rounded-2xl">
                        <DialogHeader>
                            <DialogTitle className="text-gold-light font-black uppercase tracking-widest">
                                {editingCouponId ? 'Edit Coupon' : 'Create New Coupon'}
                            </DialogTitle>
                            <DialogDescription className="text-gray-500 text-xs font-medium">
                                {editingCouponId
                                    ? 'Atualize os detalhes do cupom de desconto.'
                                    : 'Preencha os detalhes abaixo para criar um novo cupom.'}
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleCreateSubmit} className="space-y-4 pt-4">
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Cupom Code</Label>
                                <Input
                                    value={formData.code}
                                    onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                    placeholder="EX: SUMMER10"
                                    className="bg-black/50 border-white/10 uppercase font-mono font-bold text-sm h-10"
                                    required
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Descrição (Opcional)</Label>
                                <Input
                                    value={formData.description || ''}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Ex: Campanha de Verão"
                                    className="bg-black/50 border-white/10 text-sm h-10"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Tipo</Label>
                                    <Select
                                        value={formData.discount_type}
                                        onValueChange={(val: 'fixed' | 'percentage') => setFormData({ ...formData, discount_type: val })}
                                    >
                                        <SelectTrigger className="bg-black/50 border-white/10 h-10">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-zinc-900 border-white/10">
                                            <SelectItem value="percentage">Porcentagem (%)</SelectItem>
                                            <SelectItem value="fixed">Valor Fixo ($)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Valor</Label>
                                    <Input
                                        type="number"
                                        value={formData.discount_value || ''}
                                        onChange={e => setFormData({ ...formData, discount_value: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                                        className="bg-black/50 border-white/10 h-10 font-bold"
                                        required
                                        min="0"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Início</Label>
                                    <Input
                                        type="date"
                                        value={formData.valid_from}
                                        onChange={e => setFormData({ ...formData, valid_from: e.target.value })}
                                        className="bg-black/50 border-white/10 h-10 text-[11px]"
                                        required
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Expiração</Label>
                                    <Input
                                        type="date"
                                        value={formData.valid_until || ''}
                                        onChange={e => setFormData({ ...formData, valid_until: e.target.value })}
                                        className="bg-black/50 border-white/10 h-10 text-[11px]"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Limite de Usos</Label>
                                <Input
                                    type="number"
                                    placeholder="Ex: 100"
                                    value={formData.max_uses || ''}
                                    onChange={e => setFormData({ ...formData, max_uses: e.target.value ? parseInt(e.target.value) : undefined })}
                                    className="bg-black/50 border-white/10 h-10 font-bold"
                                    required
                                    min="1"
                                />
                            </div>

                            <DialogFooter className="gap-2 pt-2">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => {
                                      setIsCreateOpen(false);
                                      resetForm();
                                    }}
                                    className="text-gray-500 hover:text-white border border-white/5 uppercase text-[10px] font-black tracking-widest"
                                >
                                    Cancelar
                                </Button>
                                <Button type="submit" className="bg-gold-medium text-black hover:bg-gold-light uppercase text-[10px] font-black tracking-widest" disabled={isSubmitting}>
                                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (editingCouponId ? 'Salvar' : 'Criar Cupom')}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Quick Metrics Dashboard */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-4">
                <div className="bg-black/40 border border-gold-medium/10 rounded-xl p-3 md:p-5 flex items-center justify-between group hover:border-gold-medium/30 transition-all">
                    <div>
                        <p className="text-[9px] md:text-xs font-black text-gray-500 uppercase tracking-widest mb-1 opacity-70">Active Coupons</p>
                        <h3 className="text-xl md:text-3xl font-black text-white leading-none">{activeCouponsCount}</h3>
                    </div>
                    <div className="p-2 md:p-3 bg-green-500/10 rounded-lg group-hover:bg-green-500/20 transition-all">
                      <Power className="w-4 h-4 md:w-6 md:h-6 text-green-400" />
                    </div>
                </div>

                <div className="bg-black/40 border border-gold-medium/10 rounded-xl p-3 md:p-5 flex items-center justify-between group hover:border-gold-medium/30 transition-all">
                    <div>
                        <p className="text-[9px] md:text-xs font-black text-gray-500 uppercase tracking-widest mb-1 opacity-70">Total Usages</p>
                        <h3 className="text-xl md:text-3xl font-black text-white leading-none">{totalGlobalUses}</h3>
                    </div>
                    <div className="p-2 md:p-3 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-all">
                      <Users className="w-4 h-4 md:w-6 md:h-6 text-blue-400" />
                    </div>
                </div>

                <div className="hidden md:flex bg-black/40 border border-gold-medium/10 rounded-xl p-5 items-center justify-between group hover:border-gold-medium/30 transition-all overflow-hidden relative">
                    <div className="relative z-10">
                        <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-1 opacity-70">Global Performance</p>
                        <h3 className="text-2xl font-black text-gold-light leading-none truncate max-w-[150px]">
                          {topCoupon ? topCoupon.code : 'N/A'}
                        </h3>
                        <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">RANK #1 CODE</p>
                    </div>
                    <div className="p-3 bg-gold-medium/10 rounded-lg group-hover:bg-gold-medium/20 transition-all">
                      <Award className="w-6 h-6 text-gold-medium" />
                    </div>
                </div>
            </div>

            <Card className="bg-zinc-900/40 border-gold-medium/20 overflow-hidden">
                <CardHeader className="p-3 md:p-6 pb-2 md:pb-4">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                        <CardTitle className="text-white text-base md:text-xl font-black uppercase tracking-widest px-1">Active Coupons</CardTitle>
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                            <Input
                                placeholder="Search coupon..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 bg-black/50 border-gold-medium/30 text-white h-10 md:h-11 font-medium"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-2 md:p-6 pt-0">
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-400">
                            <thead className="text-xs uppercase bg-black/40 text-gold-light">
                                <tr>
                                    <th className="px-6 py-3 font-black tracking-widest">Code</th>
                                    <th className="px-6 py-3 font-black tracking-widest">Discount</th>
                                    <th className="px-6 py-3 font-black tracking-widest">Uses</th>
                                    <th className="px-6 py-3 font-black tracking-widest">Validity</th>
                                    <th className="px-6 py-3 font-black tracking-widest">Status</th>
                                    <th className="px-6 py-3 text-right font-black tracking-widest">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {loading ? (
                                    <tr><td colSpan={6} className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto text-gold-medium" /></td></tr>
                                ) : filteredCoupons.length === 0 ? (
                                    <tr><td colSpan={6} className="text-center py-12 text-gray-500 italic">No coupons found</td></tr>
                                ) : (
                                    filteredCoupons.map((coupon) => (
                                        <tr key={coupon.id} className="hover:bg-white/5 transition-colors group">
                                            <td className="px-6 py-4 font-mono font-black text-gold-light/90 tracking-widest text-base">{coupon.code}</td>
                                            <td className="px-6 py-4">
                                                {coupon.discount_type === 'percentage' ? (
                                                    <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/50 font-black px-2 py-0.5">{coupon.discount_value}% OFF</Badge>
                                                ) : (
                                                    <Badge className="bg-green-500/20 text-green-300 border-green-500/50 font-black px-2 py-0.5">${coupon.discount_value} OFF</Badge>
                                                )}
                                                {coupon.description && <div className="text-[10px] text-gray-500 mt-1 uppercase font-bold opacity-60">{coupon.description}</div>}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1.5">
                                                  <span className="text-white font-black text-lg">{coupon.current_uses}</span>
                                                  {coupon.max_uses && <span className="text-gray-600 font-bold">/ {coupon.max_uses}</span>}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-[11px] font-bold uppercase tracking-tighter space-y-0.5">
                                                    <div className="text-gray-500">From: <span className="text-gray-300">{formatDate(coupon.valid_from)}</span></div>
                                                    {coupon.valid_until ? (
                                                        <div className={isExpired(coupon.valid_until) ? "text-red-500" : "text-gray-500"}>
                                                            Until: <span className={isExpired(coupon.valid_until) ? "text-red-400" : "text-gray-300"}>{formatDate(coupon.valid_until)}</span>
                                                        </div>
                                                    ) : <div className="text-green-500/50">Always valid</div>}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <Badge variant={coupon.is_active ? "default" : "destructive"} className={`${coupon.is_active ? "bg-green-600" : "bg-red-900"} font-black uppercase tracking-widest text-[10px] px-2 py-0.5`}>
                                                    {coupon.is_active ? 'Active' : 'Inactive'}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                              <div className="flex items-center justify-end gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleViewUsage(coupon)}
                                                    className="h-8 w-8 p-0 text-blue-400 hover:bg-blue-500/10 border border-blue-500/10"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleEdit(coupon)}
                                                    className="h-8 w-8 p-0 text-gold-light hover:bg-gold-medium/10 border border-gold-medium/10"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleToggleStatus(coupon.id, coupon.is_active)}
                                                    className="h-8 w-8 p-0 hover:bg-white/10 border border-white/5"
                                                >
                                                    <Power className={`w-4 h-4 ${coupon.is_active ? "text-green-400" : "text-gray-500"}`} />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleDeleteClick(coupon.id)}
                                                    className="h-8 w-8 p-0 text-red-500 hover:bg-red-500/10 border border-red-500/10"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                              </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card Layout */}
                    <div className="md:hidden space-y-3">
                        {loading ? (
                            <div className="flex justify-center py-12"><Loader2 className="w-10 h-10 animate-spin text-gold-medium" /></div>
                        ) : filteredCoupons.length === 0 ? (
                            <div className="text-center py-12 text-gray-500 italic">No coupons found</div>
                        ) : (
                            filteredCoupons.map((coupon) => (
                                <div key={coupon.id} className="bg-black/20 border border-gold-medium/10 rounded-2xl p-3.5 space-y-4">
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="min-w-0">
                                            <h4 className="text-lg font-black text-gold-light font-mono tracking-widest leading-none mb-1 uppercase">{coupon.code}</h4>
                                            {coupon.description && <p className="text-[10px] text-gray-500 font-bold uppercase truncate opacity-70 leading-none">{coupon.description}</p>}
                                        </div>
                                        <Badge variant={coupon.is_active ? "default" : "destructive"} className={`${coupon.is_active ? "bg-green-600/20 text-green-400 border-green-500/50" : "bg-red-900/20 text-red-400 border-red-500/50"} font-black uppercase tracking-widest text-[8px] h-4.5 px-1.5 flex items-center`}>
                                            {coupon.is_active ? 'Active' : 'Inactive'}
                                        </Badge>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 py-3 border-y border-white/5">
                                        <div className="space-y-1">
                                            <p className="text-[8px] text-gray-500 font-black uppercase tracking-widest opacity-60">Discount</p>
                                            <div className="flex">
                                              {coupon.discount_type === 'percentage' ? (
                                                  <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/50 font-black text-[10px] uppercase">{coupon.discount_value}% OFF</Badge>
                                              ) : (
                                                  <Badge className="bg-green-500/20 text-green-300 border-green-500/50 font-black text-[10px] uppercase">${coupon.discount_value} OFF</Badge>
                                              )}
                                            </div>
                                        </div>
                                        <div className="space-y-1 text-right">
                                            <p className="text-[8px] text-gray-500 font-black uppercase tracking-widest opacity-60">Uses</p>
                                            <p className="text-white font-black text-sm leading-none">
                                              {coupon.current_uses} <span className="text-gray-600 font-bold text-[10px]">/ {coupon.max_uses || '∞'}</span>
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between gap-4">
                                        <div className="space-y-0.5">
                                            <p className="text-[8px] text-gray-500 font-black uppercase tracking-widest opacity-60">Validity</p>
                                            <p className={`text-[9px] font-bold uppercase ${isExpired(coupon.valid_until || '') ? 'text-red-400' : 'text-gray-300'}`}>
                                              {formatDate(coupon.valid_from)} - {coupon.valid_until ? formatDate(coupon.valid_until) : 'FOREVER'}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                          <Button
                                              size="sm"
                                              variant="ghost"
                                              onClick={() => handleViewUsage(coupon)}
                                              className="h-8 w-8 p-0 text-blue-400 bg-blue-500/5 border border-blue-500/10"
                                          >
                                              <Eye className="w-3.5 h-3.5" />
                                          </Button>
                                          <Button
                                              size="sm"
                                              variant="ghost"
                                              onClick={() => handleEdit(coupon)}
                                              className="h-8 w-8 p-0 text-gold-light bg-gold-medium/5 border border-gold-medium/10"
                                          >
                                              <Edit className="w-3.5 h-3.5" />
                                          </Button>
                                          <Button
                                              size="sm"
                                              variant="ghost"
                                              onClick={() => handleToggleStatus(coupon.id, coupon.is_active)}
                                              className="h-8 w-8 p-0 bg-white/5 border border-white/5"
                                          >
                                              <Power className={`w-3.5 h-3.5 ${coupon.is_active ? "text-green-400" : "text-gray-500"}`} />
                                          </Button>
                                          <Button
                                              size="sm"
                                              variant="ghost"
                                              onClick={() => handleDeleteClick(coupon.id)}
                                              className="h-8 w-8 p-0 text-red-500 bg-red-500/5 border border-red-500/10"
                                          >
                                              <Trash2 className="w-3.5 h-3.5" />
                                          </Button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Usage History Modal */}
            {/* Usage History Modal */}
            <Dialog open={usageModalOpen} onOpenChange={setUsageModalOpen}>
                <DialogContent className="bg-zinc-900 border-gold-medium/30 text-white w-[98vw] md:max-w-6xl h-[92vh] md:h-auto md:max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-2xl md:rounded-3xl shadow-2xl">
                    <DialogHeader className="p-4 md:p-8 bg-black/40 border-b border-white/5 relative shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2 md:p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
                                <Ticket className="w-5 h-5 md:w-6 md:h-6 text-blue-400" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl md:text-2xl font-black uppercase tracking-widest text-white leading-tight">
                                    Usage History - <span className="text-gold-light font-mono italic">{selectedCouponCode}</span>
                                </DialogTitle>
                                <DialogDescription className="text-[10px] md:text-sm text-gray-500 font-bold uppercase tracking-widest opacity-80">
                                    List of all orders that applied this discount code
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-2 md:p-6 custom-scrollbar min-h-0">
                        {usageLoading ? (
                            <div className="flex justify-center py-20">
                                <Loader2 className="w-10 h-10 animate-spin text-gold-medium" />
                            </div>
                        ) : currentUsage.length === 0 ? (
                            <div className="text-center py-20 text-gray-500 italic font-medium bg-black/10 rounded-2xl mx-2">
                                This coupon hasn't been used yet.
                            </div>
                        ) : (
                            <>
                                {/* Desktop Table */}
                                <div className="hidden md:block overflow-x-auto rounded-xl border border-white/5">
                                    <table className="w-full text-sm text-left text-gray-400">
                                        <thead className="text-xs uppercase bg-black/40 text-gold-light">
                                            <tr>
                                                <th className="px-6 py-4 font-black tracking-widest">Order / Date</th>
                                                <th className="px-6 py-4 font-black tracking-widest">Client</th>
                                                <th className="px-6 py-4 font-black tracking-widest">Service</th>
                                                <th className="px-6 py-4 font-black tracking-widest">Discount</th>
                                                <th className="px-6 py-4 font-black tracking-widest">Total</th>
                                                <th className="px-6 py-4 font-black tracking-widest">Status</th>
                                                <th className="px-6 py-4 text-right font-black tracking-widest">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {currentUsage.map((use) => (
                                                <tr key={use.id} className="hover:bg-white/5 transition-colors group">
                                                    <td className="px-6 py-4">
                                                        <div className="font-mono font-black text-white text-sm">{use.order_number}</div>
                                                        <div className="text-[10px] text-gray-500 font-bold uppercase">{formatDateTime(use.created_at)}</div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="text-white font-bold text-sm truncate max-w-[150px]">{use.client_name}</div>
                                                        <div className="text-[10px] text-gray-500 font-medium truncate max-w-[150px]">{use.client_email}</div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                      <div className="text-gray-300 font-bold text-xs uppercase">{use.product_slug}</div>
                                                    </td>
                                                    <td className="px-6 py-4 text-green-400 font-black">
                                                        -US$ {use.discount_amount?.toFixed(2)}
                                                    </td>
                                                    <td className="px-6 py-4 font-black text-white">
                                                        US$ {use.total_price_usd?.toFixed(2)}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <Badge className={`${use.payment_status === 'completed' ? 'bg-green-600' : 'bg-yellow-600'} font-black text-[9px] uppercase tracking-widest px-2 py-0.5`}>
                                                            {use.payment_status === 'completed' ? 'PAID' : use.payment_status}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => handleRemoveUsage(use)}
                                                            disabled={isDeletingUsage}
                                                            className="h-8 w-8 p-0 text-red-500 hover:bg-red-500/10 border border-red-500/10 opacity-30 group-hover:opacity-100 transition-opacity"
                                                        >
                                                            {isDeletingUsage && usageToDelete?.id === use.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile Cards */}
                                <div className="md:hidden space-y-2 pb-4">
                                    {currentUsage.map((use) => (
                                        <div key={use.id} className="bg-black/40 border border-white/5 rounded-xl p-3 space-y-3">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="text-white font-mono font-black text-xs uppercase tracking-widest leading-none">{use.order_number}</div>
                                                    <div className="text-[9px] text-gray-500 font-bold uppercase mt-1">{formatDateTime(use.created_at)}</div>
                                                </div>
                                                <Badge className={`${use.payment_status === 'completed' ? 'bg-green-600/20 text-green-400 border border-green-500/30' : 'bg-yellow-600/20 text-yellow-400 border border-yellow-500/30'} font-black text-[8px] uppercase tracking-widest px-1.5 py-0`}>
                                                    {use.payment_status === 'completed' ? 'PAID' : use.payment_status}
                                                </Badge>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 py-2 border-y border-white/5">
                                                <div>
                                                    <p className="text-[8px] text-gray-500 font-black uppercase tracking-widest opacity-60">Client</p>
                                                    <p className="text-[10px] text-white font-bold truncate leading-none mt-1">{use.client_name}</p>
                                                    <p className="text-[8px] text-gray-600 truncate leading-none">{use.client_email}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[8px] text-gray-500 font-black uppercase tracking-widest opacity-60">Discount</p>
                                                    <p className="text-green-400 font-black text-xs leading-none mt-1">-US$ {use.discount_amount?.toFixed(2)}</p>
                                                </div>
                                            </div>

                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <p className="text-[8px] text-gray-500 font-black uppercase tracking-widest opacity-60 leading-none">Service</p>
                                                    <p className="text-[10px] text-gray-300 font-bold uppercase leading-none mt-1 truncate max-w-[150px]">{use.product_slug}</p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                  <div className="text-right">
                                                      <p className="text-[8px] text-gray-500 font-black uppercase tracking-widest opacity-60 leading-none">Total</p>
                                                      <p className="text-white font-black text-xs leading-none mt-1">US$ {use.total_price_usd?.toFixed(2)}</p>
                                                  </div>
                                                  <Button
                                                      size="sm"
                                                      variant="ghost"
                                                      onClick={() => handleRemoveUsage(use)}
                                                      disabled={isDeletingUsage}
                                                      className="h-8 w-8 p-0 text-red-500 bg-red-500/5 border border-red-500/10"
                                                  >
                                                      {isDeletingUsage && usageToDelete?.id === use.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                                  </Button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                    
                    <DialogFooter className="p-4 bg-black/20 border-t border-white/5 md:hidden">
                        <Button
                            variant="ghost"
                            onClick={() => setUsageModalOpen(false)}
                            className="w-full text-gray-500 hover:text-white uppercase text-[10px] font-black tracking-widest h-10"
                        >
                            Fechar Histórico
                        </Button>
                    </DialogFooter>

                    {/* Moved inside here to ensure it appears on top of this modal */}
                    <ConfirmModal
                        isOpen={removeUsageModalOpen}
                        onClose={() => setRemoveUsageModalOpen(false)}
                        onConfirm={confirmRemoveUsage}
                        title="Remove Coupon Usage"
                        message={`Are you sure you want to remove the coupon from order ${usageToDelete?.order_number}? This will decrement the coupon usage count and update the order.`}
                        confirmText="Remove Usage"
                        variant="danger"
                    />
                </DialogContent>
            </Dialog>

            <ConfirmModal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={confirmDelete}
                title="Delete Coupon"
                message="Are you sure you want to delete this coupon? This action cannot be undone."
                confirmText="Delete"
                variant="danger"
            />
        </div >
    );
}
