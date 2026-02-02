import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'; // Consistent imports
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { Ticket, Plus, Trash2, Power, Search, Loader2, Edit, Eye } from 'lucide-react';
import {
    getCoupons,
    createCoupon,
    toggleCouponStatus,
    deleteCoupon,
    updateCoupon,
    getCouponUsage,
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

    const handleCreateSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
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

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold migma-gold-text flex items-center gap-2">
                        <Ticket className="w-6 h-6 sm:w-8 sm:h-8" />
                        Vouchers & Coupons
                    </h1>
                    <p className="text-gray-400">Manage promotional codes and discounts</p>
                </div>

                <Dialog open={isCreateOpen} onOpenChange={(open) => {
                    setIsCreateOpen(open);
                    if (!open) resetForm();
                }}>
                    <DialogTrigger asChild>
                        <Button className="bg-gold-medium hover:bg-gold-light text-black font-bold">
                            <Plus className="w-4 h-4 mr-2" /> New Coupon
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-zinc-900 border-gold-medium/30 text-white">
                        <DialogHeader>
                            <DialogTitle className="text-gold-light">
                                {editingCouponId ? 'Edit Coupon' : 'Create New Coupon'}
                            </DialogTitle>
                            <DialogDescription className="text-gray-400">
                                {editingCouponId
                                    ? 'Update the details of the discount coupon.'
                                    : 'Fill in the details below to create a new discount coupon.'}
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleCreateSubmit} className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <Label>Coupon Code</Label>
                                <Input
                                    value={formData.code}
                                    onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                    placeholder="EX: SUMMER10"
                                    className="bg-black/50 border-white/10 uppercase"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Description (Optional)</Label>
                                <Input
                                    value={formData.description || ''}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Summer Campaign 2026"
                                    className="bg-black/50 border-white/10"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Discount Type</Label>
                                    <Select
                                        value={formData.discount_type}
                                        onValueChange={(val: 'fixed' | 'percentage') => setFormData({ ...formData, discount_type: val })}
                                    >
                                        <SelectTrigger className="bg-black/50 border-white/10">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="percentage">Percentage (%)</SelectItem>
                                            <SelectItem value="fixed">Fixed Value ($)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Value</Label>
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
                                    <Label>Validity (Start)</Label>
                                    <Input
                                        type="date"
                                        value={formData.valid_from}
                                        onChange={e => setFormData({ ...formData, valid_from: e.target.value })}
                                        className="bg-black/50 border-white/10"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Validity (End)</Label>
                                    <Input
                                        type="date"
                                        value={formData.valid_until || ''}
                                        onChange={e => setFormData({ ...formData, valid_until: e.target.value })}
                                        className="bg-black/50 border-white/10"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Usage Limit (Optional)</Label>
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
                                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (editingCouponId ? 'Save Changes' : 'Create Coupon')}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-white">Active Coupons</CardTitle>
                        <div className="relative w-64">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Search coupon..."
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
                                    <th className="px-6 py-3">Code</th>
                                    <th className="px-6 py-3">Discount</th>
                                    <th className="px-6 py-3">Uses</th>
                                    <th className="px-6 py-3">Validity</th>
                                    <th className="px-6 py-3">Status</th>
                                    <th className="px-6 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={6} className="text-center py-8"><Loader2 className="w-8 h-8 animate-spin mx-auto text-gold-medium" /></td></tr>
                                ) : filteredCoupons.length === 0 ? (
                                    <tr><td colSpan={6} className="text-center py-8 text-gray-500">No coupons found</td></tr>
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
                                                    <div>Start: {formatDate(coupon.valid_from)}</div>
                                                    {coupon.valid_until ? (
                                                        <div className={isExpired(coupon.valid_until) ? "text-red-400" : ""}>
                                                            End: {formatDate(coupon.valid_until)}
                                                        </div>
                                                    ) : <span className="text-green-500/70">Always valid</span>}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <Badge variant={coupon.is_active ? "default" : "destructive"} className={coupon.is_active ? "bg-green-600" : "bg-red-900"}>
                                                    {coupon.is_active ? 'Active' : 'Inactive'}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4 text-right space-x-2">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleViewUsage(coupon)}
                                                    title="View Usage History"
                                                    className="hover:bg-white/10 text-blue-400 hover:text-blue-300"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleEdit(coupon)}
                                                    title="Edit"
                                                    className="hover:bg-white/10 text-gold-light"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleToggleStatus(coupon.id, coupon.is_active)}
                                                    title={coupon.is_active ? "Deactivate" : "Activate"}
                                                    className="hover:bg-white/10"
                                                >
                                                    <Power className={`w-4 h-4 ${coupon.is_active ? "text-green-400" : "text-gray-500"}`} />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleDeleteClick(coupon.id)}
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

            {/* Usage History Modal */}
            <Dialog open={usageModalOpen} onOpenChange={setUsageModalOpen}>
                <DialogContent className="bg-zinc-900 border-gold-medium/30 text-white max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-gold-light flex items-center gap-2">
                            <Ticket className="w-5 h-5" />
                            Coupon Usage History: {selectedCouponCode}
                        </DialogTitle>
                        <DialogDescription className="text-gray-400">
                            List of all orders where this coupon was applied.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="mt-4">
                        {usageLoading ? (
                            <div className="flex justify-center p-8">
                                <Loader2 className="w-8 h-8 animate-spin text-gold-medium" />
                            </div>
                        ) : currentUsage.length === 0 ? (
                            <div className="text-center p-8 text-gray-500 bg-black/20 rounded-lg">
                                No usage history found for this coupon.
                            </div>
                        ) : (
                            <div className="overflow-x-auto rounded-lg border border-white/10">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs uppercase bg-black/40 text-gray-300">
                                        <tr>
                                            <th className="px-4 py-3">Date</th>
                                            <th className="px-4 py-3">Order #</th>
                                            <th className="px-4 py-3">Client</th>
                                            <th className="px-4 py-3">Service</th>
                                            <th className="px-4 py-3 text-right">Discount</th>
                                            <th className="px-4 py-3 text-right">Total Paid</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {currentUsage.map((use) => (
                                            <tr key={use.id} className="hover:bg-white/5">
                                                <td className="px-4 py-3 text-gray-400">{formatDateTime(use.created_at)}</td>
                                                <td className="px-4 py-3 font-mono text-gold-light/80">{use.order_number}</td>
                                                <td className="px-4 py-3">
                                                    <div className="text-white">{use.client_name}</div>
                                                    <div className="text-xs text-gray-500">{use.client_email}</div>
                                                </td>
                                                <td className="px-4 py-3 text-gray-300">{use.product_slug}</td>
                                                <td className="px-4 py-3 text-right text-green-400 font-medium">
                                                    -US$ {use.discount_amount?.toFixed(2)}
                                                </td>
                                                <td className="px-4 py-3 text-right text-white font-bold">
                                                    US$ {
                                                        use.payment_method === 'parcelow' && (use.total_price_usd === 0 || use.total_price_usd === 0.01)
                                                            ? '0.01'
                                                            : use.total_price_usd?.toFixed(2)
                                                    }
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setUsageModalOpen(false)}
                            className="bg-black border-white/10 text-white hover:bg-white/10"
                        >
                            Close
                        </Button>
                    </DialogFooter>
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
        </div>
    );
}
