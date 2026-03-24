import { useState, useEffect } from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

interface EditSellerModalProps {
    seller: {
        id: string;
        user_id: string;
        seller_id_public: string;
        full_name: string;
        email: string;
        phone: string | null;
        status: string;
        role?: string;
        head_of_sales_id?: string | null;
    };
    headsOfSales?: { id: string; full_name: string; email: string }[];
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export function EditSellerModal({ seller, headsOfSales = [], isOpen, onClose, onSuccess }: EditSellerModalProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showSellerIdWarning, setShowSellerIdWarning] = useState(false);

    const [formData, setFormData] = useState({
        full_name: seller.full_name,
        email: seller.email,
        phone: seller.phone || '',
        seller_id_public: seller.seller_id_public,
        role: seller.role || 'seller',
        head_of_sales_id: seller.head_of_sales_id || '',
        new_password: '',
        confirm_password: '',
    });

    // Reset form when seller changes
    useEffect(() => {
        setFormData({
            full_name: seller.full_name,
            email: seller.email,
            phone: seller.phone || '',
            seller_id_public: seller.seller_id_public,
            role: seller.role || 'seller',
            head_of_sales_id: seller.head_of_sales_id || '',
            new_password: '',
            confirm_password: '',
        });
        setError('');
        setSuccess('');
        setShowSellerIdWarning(false);
    }, [seller]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        setError('');
        setSuccess('');

        // Show warning if seller_id_public is being changed
        if (name === 'seller_id_public' && value !== seller.seller_id_public) {
            setShowSellerIdWarning(true);
        } else if (name === 'seller_id_public' && value === seller.seller_id_public) {
            setShowSellerIdWarning(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        try {
            // Validate password if provided
            if (formData.new_password) {
                if (formData.new_password.length < 6) {
                    setError('A senha deve ter pelo menos 6 caracteres.');
                    setLoading(false);
                    return;
                }
                if (formData.new_password !== formData.confirm_password) {
                    setError('As senhas não coincidem.');
                    setLoading(false);
                    return;
                }
            }

            // Validate seller_id format
            const sellerIdRegex = /^[a-zA-Z0-9_-]+$/;
            if (!sellerIdRegex.test(formData.seller_id_public)) {
                setError('O Seller ID deve conter apenas letras, números, hífens e underscores.');
                setLoading(false);
                return;
            }

            // Call the admin-update-seller Edge Function
            const { data, error: functionError } = await supabase.functions.invoke('admin-update-seller', {
                body: {
                    seller_id: seller.id,
                    full_name: formData.full_name.trim(),
                    email: formData.email.trim(),
                    phone: formData.phone.trim(),
                    seller_id_public: formData.seller_id_public.trim(),
                    role: formData.role,
                    head_of_sales_id: formData.role === 'seller' ? formData.head_of_sales_id : null,
                    new_password: formData.new_password || undefined,
                },
            });

            if (functionError) {
                console.error('[EditSellerModal] Function error:', functionError);
                setError(functionError.message || 'Erro ao atualizar vendedor.');
                setLoading(false);
                return;
            }

            if (data?.error) {
                console.error('[EditSellerModal] Server error:', data.error);
                setError(data.error);
                setLoading(false);
                return;
            }

            setSuccess('Vendedor atualizado com sucesso!');

            // If email was changed, show additional message
            if (formData.email !== seller.email) {
                setSuccess('Vendedor atualizado! Um e-mail de confirmação foi enviado para o novo endereço.');
            }

            // Wait a bit to show success message, then close and refresh
            setTimeout(() => {
                onSuccess();
                onClose();
            }, 2000);
        } catch (err) {
            console.error('[EditSellerModal] Unexpected error:', err);
            setError('Erro inesperado ao atualizar vendedor.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4 animate-in fade-in duration-200">
            <div className="bg-[#1a1a1a] border border-gold-medium/30 rounded-2xl w-full max-w-2xl max-h-[95vh] flex flex-col shadow-2xl shadow-gold-medium/10">
                {/* Header */}
                <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gold-medium/10 bg-black/20">
                    <div className="flex flex-col">
                        <h2 className="text-base sm:text-lg font-black uppercase tracking-widest text-gold-light">Editar Vendedor</h2>
                        <p className="text-[10px] text-gray-500 font-mono">ID: {seller.seller_id_public}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-all p-1.5 hover:bg-white/5 rounded-full"
                        disabled={loading}
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Form */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-3.5 sm:p-5">
                    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
                    {/* Error Message */}
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-3.5 flex items-start gap-3 animate-in slide-in-from-top-2 duration-300">
                            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                            <p className="text-[11px] sm:text-xs text-red-400 leading-relaxed font-medium">{error}</p>
                        </div>
                    )}

                    {/* Success Message */}
                    {success && (
                        <div className="bg-green-500/10 border border-green-500/50 rounded-xl p-3.5 animate-in slide-in-from-top-2 duration-300">
                            <p className="text-[11px] sm:text-xs text-green-400 font-medium">{success}</p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Full Name */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">
                                Nome Completo
                            </label>
                            <input
                                type="text"
                                name="full_name"
                                value={formData.full_name}
                                onChange={handleInputChange}
                                required
                                className="w-full h-10 px-3.5 bg-black/40 border border-gold-medium/20 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-gold-medium/60 focus:ring-1 focus:ring-gold-medium/20 transition-all placeholder:text-gray-600"
                                disabled={loading}
                            />
                        </div>

                        {/* Email */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">
                                E-mail
                            </label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleInputChange}
                                required
                                className="w-full h-10 px-3.5 bg-black/40 border border-gold-medium/20 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-gold-medium/60 focus:ring-1 focus:ring-gold-medium/20 transition-all placeholder:text-gray-600"
                                disabled={loading}
                            />
                            {formData.email !== seller.email && (
                                <p className="text-[9px] text-yellow-400/80 font-medium ml-1">
                                    ⚠️ Confirmação necessária após alteração.
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Phone */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">
                                Telefone
                            </label>
                            <input
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleInputChange}
                                required
                                className="w-full h-10 px-3.5 bg-black/40 border border-gold-medium/20 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-gold-medium/60 focus:ring-1 focus:ring-gold-medium/20 transition-all placeholder:text-gray-600"
                                disabled={loading}
                            />
                        </div>

                        {/* Seller ID Public */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">
                                Seller ID (Público)
                            </label>
                            <input
                                type="text"
                                name="seller_id_public"
                                value={formData.seller_id_public}
                                onChange={handleInputChange}
                                required
                                className="w-full h-10 px-3.5 bg-black/40 border border-gold-medium/20 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-gold-medium/60 focus:ring-1 focus:ring-gold-medium/20 transition-all placeholder:text-gray-600"
                                disabled={loading}
                            />
                            {showSellerIdWarning && (
                                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2.5">
                                    <p className="text-[9px] text-yellow-400/90 leading-tight">
                                        ⚠️ <strong>Atenção:</strong> Alterar o ID quebrará links antigos.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Role Selection */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">
                                Tipo de Conta
                            </label>
                            <select
                                name="role"
                                value={formData.role}
                                onChange={(e) => {
                                    handleInputChange(e as any);
                                    if (e.target.value === 'head_of_sales') {
                                        setFormData(prev => ({ ...prev, head_of_sales_id: '' }));
                                    }
                                }}
                                className="w-full h-10 px-3 bg-black/40 border border-gold-medium/20 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-gold-medium/60 focus:ring-1 focus:ring-gold-medium/20 transition-all appearance-none"
                                disabled={loading}
                            >
                                <option value="seller" className="bg-zinc-900">Vendedor</option>
                                <option value="head_of_sales" className="bg-zinc-900">Gestor (Head of Sales)</option>
                            </select>
                        </div>

                        {/* Manager Selection (only if role is seller) */}
                        {formData.role === 'seller' && (
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">
                                    Gestor (Opcional)
                                </label>
                                <select
                                    name="head_of_sales_id"
                                    value={formData.head_of_sales_id || ''}
                                    onChange={handleInputChange as any}
                                    className="w-full h-10 px-3 bg-black/40 border border-gold-medium/20 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-gold-medium/60 focus:ring-1 focus:ring-gold-medium/20 transition-all appearance-none"
                                    disabled={loading}
                                >
                                    <option value="" className="bg-zinc-900">Sem Gestor</option>
                                    {headsOfSales.map((manager) => (
                                        <option key={manager.id} value={manager.id} className="bg-zinc-900">
                                            {manager.full_name || manager.email}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Divider */}
                    <div className="pt-2">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="flex-1 h-[1px] bg-gold-medium/10"></div>
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-gold-light/60">Redefinir Senha</h3>
                            <div className="flex-1 h-[1px] bg-gold-medium/10"></div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* New Password */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">
                                    Nova Senha
                                </label>
                                <input
                                    type="password"
                                    name="new_password"
                                    value={formData.new_password}
                                    onChange={handleInputChange}
                                    placeholder="Deixe em branco para manter"
                                    className="w-full h-10 px-3.5 bg-black/40 border border-gold-medium/20 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-gold-medium/60 focus:ring-1 focus:ring-gold-medium/20 transition-all placeholder:text-gray-600"
                                    disabled={loading}
                                />
                            </div>

                            {/* Confirm Password */}
                            {formData.new_password && (
                                <div className="space-y-1.5 animate-in slide-in-from-left-2 duration-300">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">
                                        Confirmar Senha
                                    </label>
                                    <input
                                        type="password"
                                        name="confirm_password"
                                        value={formData.confirm_password}
                                        onChange={handleInputChange}
                                        required
                                        className="w-full h-10 px-3.5 bg-black/40 border border-gold-medium/20 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-gold-medium/60 focus:ring-1 focus:ring-gold-medium/20 transition-all"
                                        disabled={loading}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gold-medium/10 mt-2">
                        <Button
                            type="button"
                            onClick={onClose}
                            variant="outline"
                            className="w-full sm:flex-1 h-11 border-gold-medium/30 text-xs font-black uppercase tracking-widest text-gray-400 hover:bg-white/5 hover:text-white rounded-xl transition-all"
                            disabled={loading}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            className="w-full sm:flex-1 h-11 bg-gold-medium hover:bg-gold-dark text-black font-black uppercase text-[10px] tracking-widest rounded-xl shadow-lg shadow-gold-medium/10 transition-all"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Processando...
                                </>
                            ) : (
                                'Salvar Alterações'
                            )}
                        </Button>
                    </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
