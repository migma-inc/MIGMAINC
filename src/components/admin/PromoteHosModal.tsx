import { useState, useEffect } from 'react';
import { X, Search, Loader2, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

interface Seller {
    id: string;
    full_name: string;
    email: string;
    seller_id_public: string;
    role: string;
    is_test: boolean;
}

interface PromoteHosModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export function PromoteHosModal({ isOpen, onClose, onSuccess }: PromoteHosModalProps) {
    const [search, setSearch] = useState('');
    const [sellers, setSellers] = useState<Seller[]>([]);
    const [loading, setLoading] = useState(false);
    const [promoting, setPromoting] = useState<string | null>(null);

    // Load sellers that are NOT heads of sales and NOT test sellers
    const searchSellers = async (term: string) => {
        console.log('[PromoteHosModal] Searching for:', term || 'All eligible sellers');
        setLoading(true);
        try {
            let query = supabase
                .from('sellers')
                .select('id, full_name, email, seller_id_public, role, is_test')
                .neq('role', 'head_of_sales')
                .limit(50); // Increased limit as we are showing "all" (reasonable chunk)

            if (term) {
                query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%,seller_id_public.ilike.%${term}%`);
            }

            const { data, error } = await query.order('full_name');

            if (error) {
                console.error('[PromoteHosModal] Search error:', error);
                throw error;
            }
            console.log('[PromoteHosModal] Loaded:', data?.length || 0);
            setSellers(data || []);
        } catch (err) {
            console.error('[PromoteHosModal] Unexpected loading error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            searchSellers(search);
        }
    }, [isOpen]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (isOpen) searchSellers(search);
        }, 500);
        return () => clearTimeout(timer);
    }, [search]);

    const handlePromote = async (seller: Seller) => {
        console.log('[PromoteHosModal] Promoting seller:', seller.id);
        setPromoting(seller.id);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                console.error('[PromoteHosModal] No active session.');
                throw new Error('Not authenticated');
            }

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

            if (error) {
                console.error('[PromoteHosModal] Promotion error:', error);
                throw error;
            }

            console.log('[PromoteHosModal] Promotion successful.');
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('[PromoteHosModal] Unexpected promotion error:', err);
            alert('Error promoting seller. Please check terminal/console logs.');
        } finally {
            setPromoting(null);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-zinc-900 w-full max-w-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/5">
                    <div className="flex items-center gap-2 text-gold-medium">
                        <Crown className="w-5 h-5 font-bold" />
                        <h2 className="text-lg font-bold text-white tracking-tight">Promote Head of Sales</h2>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    <p className="text-sm text-gray-400">
                        Search for a seller to promote them to the role of **Head of Sales**. 
                        They will be able to manage their own team and view their sellers' metrics.
                    </p>

                    {/* Search Input */}
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                        <input
                            autoFocus
                            type="text"
                            placeholder="Type name, email or public ID..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 bg-black border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-gold-medium transition-colors"
                        />
                        {loading && (
                            <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                <Loader2 className="w-5 h-5 text-gold-medium animate-spin" />
                            </div>
                        )}
                    </div>

                    {/* Results List */}
                    <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                        {loading && sellers.length === 0 ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-8 h-8 text-gold-medium animate-spin" />
                            </div>
                        ) : sellers.length === 0 ? (
                            <div className="text-center py-12 text-gray-500 bg-white/5 rounded-xl border border-dashed border-white/5">
                                {search ? (
                                    <>
                                        <p className="text-sm italic">No sellers found for "{search}"</p>
                                        <p className="text-xs mt-1">Remember: Heads of Sales won't appear here.</p>
                                    </>
                                ) : (
                                    <p className="text-sm italic">No eligible sellers available for promotion.</p>
                                )}
                            </div>
                        ) : (
                            sellers.map((seller) => (
                                <div 
                                    key={seller.id}
                                    className="flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl transition-all group"
                                >
                                    <div className="space-y-0.5">
                                        <div className="flex items-center gap-2">
                                            <p className="font-semibold text-white group-hover:text-gold-light transition-colors">
                                                {seller.full_name}
                                            </p>
                                            {seller.is_test && (
                                                <span className="text-[10px] px-1.5 py-0.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded font-bold uppercase tracking-wider">
                                                    Test
                                                </span>
                                            )}
                                            <span className="text-[10px] px-1.5 py-0.5 bg-zinc-800 text-gray-400 rounded uppercase font-bold tracking-wider">
                                                {seller.role}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500 font-mono italic">
                                            {seller.email} • {seller.seller_id_public}
                                        </p>
                                    </div>
                                    <Button
                                        size="sm"
                                        disabled={!!promoting}
                                        onClick={() => handlePromote(seller)}
                                        className="bg-gold-medium hover:bg-gold-dark text-black font-bold h-9 px-4 rounded-lg shadow-lg group-hover:scale-105 transition-transform"
                                    >
                                        {promoting === seller.id ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            'Promote'
                                        )}
                                    </Button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-white/5 flex justify-end gap-3 border-top border-white/5">
                    <Button variant="ghost" onClick={onClose} className="text-gray-400 hover:text-white">
                        Cancel
                    </Button>
                </div>
            </div>
        </div>
    );
}

// Add these styles to your index.css if not already present
// .custom-scrollbar::-webkit-scrollbar { width: 4px; }
// .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
// .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 10px; }
// .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.2); }
