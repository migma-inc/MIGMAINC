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
    };
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export function EditSellerModal({ seller, isOpen, onClose, onSuccess }: EditSellerModalProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showSellerIdWarning, setShowSellerIdWarning] = useState(false);

    const [formData, setFormData] = useState({
        full_name: seller.full_name,
        email: seller.email,
        phone: seller.phone || '',
        seller_id_public: seller.seller_id_public,
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
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-[#1a1a1a] border border-gold-medium/30 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gold-medium/30">
                    <h2 className="text-xl font-bold text-gold-light">Editar Vendedor</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gold-light transition-colors"
                        disabled={loading}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Error Message */}
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-red-400">{error}</p>
                        </div>
                    )}

                    {/* Success Message */}
                    {success && (
                        <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-4">
                            <p className="text-sm text-green-400">{success}</p>
                        </div>
                    )}

                    {/* Full Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Nome Completo
                        </label>
                        <input
                            type="text"
                            name="full_name"
                            value={formData.full_name}
                            onChange={handleInputChange}
                            required
                            className="w-full px-4 py-2 bg-black/50 border border-gold-medium/30 rounded-lg text-white focus:outline-none focus:border-gold-medium"
                            disabled={loading}
                        />
                    </div>

                    {/* Email */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            E-mail
                        </label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleInputChange}
                            required
                            className="w-full px-4 py-2 bg-black/50 border border-gold-medium/30 rounded-lg text-white focus:outline-none focus:border-gold-medium"
                            disabled={loading}
                        />
                        {formData.email !== seller.email && (
                            <p className="text-xs text-yellow-400 mt-1">
                                ⚠️ Um e-mail de confirmação será enviado para o novo endereço.
                            </p>
                        )}
                    </div>

                    {/* Phone */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Telefone
                        </label>
                        <input
                            type="tel"
                            name="phone"
                            value={formData.phone}
                            onChange={handleInputChange}
                            required
                            className="w-full px-4 py-2 bg-black/50 border border-gold-medium/30 rounded-lg text-white focus:outline-none focus:border-gold-medium"
                            disabled={loading}
                        />
                    </div>

                    {/* Seller ID Public */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Seller ID (Público)
                        </label>
                        <input
                            type="text"
                            name="seller_id_public"
                            value={formData.seller_id_public}
                            onChange={handleInputChange}
                            required
                            className="w-full px-4 py-2 bg-black/50 border border-gold-medium/30 rounded-lg text-white focus:outline-none focus:border-gold-medium"
                            disabled={loading}
                        />
                        {showSellerIdWarning && (
                            <div className="mt-2 bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-3">
                                <p className="text-xs text-yellow-400">
                                    ⚠️ <strong>Atenção:</strong> Alterar o Seller ID quebrará todos os links antigos que usam o ID atual.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Divider */}
                    <div className="border-t border-gold-medium/30 pt-6">
                        <h3 className="text-lg font-semibold text-gold-light mb-4">Redefinir Senha (Opcional)</h3>
                    </div>

                    {/* New Password */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Nova Senha
                        </label>
                        <input
                            type="password"
                            name="new_password"
                            value={formData.new_password}
                            onChange={handleInputChange}
                            placeholder="Deixe em branco para não alterar"
                            className="w-full px-4 py-2 bg-black/50 border border-gold-medium/30 rounded-lg text-white focus:outline-none focus:border-gold-medium"
                            disabled={loading}
                        />
                        <p className="text-xs text-gray-400 mt-1">Mínimo de 6 caracteres</p>
                    </div>

                    {/* Confirm Password */}
                    {formData.new_password && (
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Confirmar Nova Senha
                            </label>
                            <input
                                type="password"
                                name="confirm_password"
                                value={formData.confirm_password}
                                onChange={handleInputChange}
                                required
                                className="w-full px-4 py-2 bg-black/50 border border-gold-medium/30 rounded-lg text-white focus:outline-none focus:border-gold-medium"
                                disabled={loading}
                            />
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-4">
                        <Button
                            type="button"
                            onClick={onClose}
                            variant="outline"
                            className="flex-1 border-gold-medium/50 text-gray-300 hover:bg-gold-medium/10"
                            disabled={loading}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            className="flex-1 bg-gold-medium hover:bg-gold-dark text-black font-semibold"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Salvando...
                                </>
                            ) : (
                                'Salvar Alterações'
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
