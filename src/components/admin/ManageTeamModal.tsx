import { useState, useEffect } from 'react';
import { X, Search, Loader2, UserPlus, UserMinus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

interface Seller {
    id: string;
    full_name: string;
    email: string;
    seller_id_public: string;
    is_test: boolean;
}

interface ManageTeamModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    hos: {
        id: string;
        full_name: string;
        team_name: string | null;
    };
}

export function ManageTeamModal({ isOpen, onClose, onSuccess, hos }: ManageTeamModalProps) {
    const [teamMembers, setTeamMembers] = useState<Seller[]>([]);
    const [availableSellers, setAvailableSellers] = useState<Seller[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (isOpen) {
            loadData();
        }
    }, [isOpen, hos.id]);

    const loadData = async () => {
        console.log('[ManageTeamModal] Loading team data for HoS:', hos.id);
        setLoading(true);
        try {
            // 1. Members of this HoS
            const { data: members, error: membersError } = await supabase
                .from('sellers')
                .select('id, full_name, email, seller_id_public, is_test')
                .eq('head_of_sales_id', hos.id)
                .order('full_name');

            if (membersError) throw membersError;

            // 2. Sellers without HoS (available to be added)
            const { data: available, error: availableError } = await supabase
                .from('sellers')
                .select('id, full_name, email, seller_id_public, is_test')
                .is('head_of_sales_id', null)
                .eq('role', 'seller')
                .order('full_name');

            if (availableError) throw availableError;

            console.log('[ManageTeamModal] Data loaded. Members:', members?.length, 'Available:', available?.length);
            setTeamMembers(members || []);
            setAvailableSellers(available || []);
        } catch (err) {
            console.error('[ManageTeamModal] Error loading team data:', err);
        } finally {
            setLoading(false);
        }
    };

    const toggleMember = (sellerId: string, isAdding: boolean) => {
        console.log('[ManageTeamModal] Local toggle:', isAdding ? 'Adding' : 'Removing', 'member:', sellerId);
        
        if (isAdding) {
            const seller = availableSellers.find(s => s.id === sellerId);
            if (seller) {
                setTeamMembers(prev => [...prev, seller]);
                setAvailableSellers(prev => prev.filter(s => s.id !== sellerId));
            }
        } else {
            const seller = teamMembers.find(s => s.id === sellerId);
            if (seller) {
                setAvailableSellers(prev => [...prev, seller].sort((a, b) => a.full_name.localeCompare(b.full_name)));
                setTeamMembers(prev => prev.filter(s => s.id !== sellerId));
            }
        }
    };

    const handleSave = async () => {
        console.log('[ManageTeamModal] Saving team changes...');
        setActionLoading('saving');
        try {
            const selected_seller_ids = teamMembers.map(m => m.id);

            const { error } = await supabase.functions.invoke('update-hos-team', {
                body: {
                    hos_id: hos.id,
                    team_name: hos.team_name,
                    selected_seller_ids
                }
            });

            if (error) throw error;
            console.log('[ManageTeamModal] Team saved successfully.');
            onSuccess();
            onClose();
        } catch (err) {
            console.error('[ManageTeamModal] Error saving team:', err);
            alert('Error updating team. Please check logs.');
        } finally {
            setActionLoading(null);
        }
    };

    if (!isOpen) return null;

    const filteredAvailable = availableSellers.filter(s => 
        s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        s.email?.toLowerCase().includes(search.toLowerCase()) ||
        s.seller_id_public?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-zinc-900 w-full max-w-4xl h-[80vh] rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/5">
                    <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-gold-medium" />
                        <h2 className="text-lg font-bold text-white tracking-tight">Manage Team: {hos.full_name}</h2>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors"
                        disabled={actionLoading === 'saving'}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-white/10">
                    
                    {/* Left Side: Current Team */}
                    <div className="flex-1 flex flex-col min-w-0">
                        <div className="p-4 bg-white/5 border-b border-white/5">
                            <h3 className="text-sm font-bold text-gold-light flex items-center gap-2 uppercase tracking-wider">
                                Current Team ({teamMembers.length})
                            </h3>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                            {loading ? (
                                <div className="h-full flex items-center justify-center">
                                    <Loader2 className="w-6 h-6 text-gold-medium animate-spin" />
                                </div>
                            ) : teamMembers.length === 0 ? (
                                <div className="text-center py-12 text-gray-600 italic text-sm">
                                    No members in this team yet.
                                </div>
                            ) : (
                                teamMembers.map(member => (
                                    <div key={member.id} className="flex items-center justify-between p-3 bg-white/5 border border-white/5 rounded-xl group transition-all text-left">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-medium text-white truncate">{member.full_name}</p>
                                                {member.is_test && (
                                                    <span className="text-[10px] px-1.5 py-0.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded font-bold uppercase tracking-wider">
                                                        Test
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-gray-500 font-mono italic">{member.seller_id_public}</p>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => toggleMember(member.id, false)}
                                            disabled={actionLoading === 'saving'}
                                            className="text-red-400 hover:text-red-300 hover:bg-red-400/10 p-2 h-auto"
                                        >
                                            <UserMinus className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Right Side: Available Sellers */}
                    <div className="flex-1 flex flex-col min-w-0 bg-black/20">
                        <div className="p-4 bg-white/5 border-b border-white/5 space-y-4">
                            <h3 className="text-sm font-bold text-gray-400 flex items-center gap-2 uppercase tracking-wider">
                                Add Sellers to Team
                            </h3>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                <input
                                    type="text"
                                    placeholder="Search available sellers..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    disabled={actionLoading === 'saving'}
                                    className="w-full pl-9 pr-4 py-2 bg-black border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-gold-medium transition-colors disabled:opacity-50"
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                            {loading ? (
                                <div className="h-full flex items-center justify-center">
                                    <Loader2 className="w-6 h-6 text-gold-medium animate-spin" />
                                </div>
                            ) : filteredAvailable.length === 0 ? (
                                <div className="text-center py-12 text-gray-600 italic text-sm">
                                    {search ? 'No sellers match your search.' : 'No available sellers found.'}
                                </div>
                            ) : (
                                filteredAvailable.map(seller => (
                                    <div key={seller.id} className="flex items-center justify-between p-3 bg-white/2 border border-white/5 rounded-xl group hover:bg-white/5 transition-all text-left">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">{seller.full_name}</p>
                                                {seller.is_test && (
                                                    <span className="text-[10px] px-1.5 py-0.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded font-bold uppercase tracking-wider">
                                                        Test
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-gray-500 font-mono italic">{seller.email}</p>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => toggleMember(seller.id, true)}
                                            disabled={actionLoading === 'saving'}
                                            className="text-gold-medium hover:text-gold-light hover:bg-gold-medium/10 p-2 h-auto"
                                        >
                                            <UserPlus className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-white/5 flex justify-end gap-3 border-t border-white/5">
                    <Button 
                        onClick={onClose} 
                        disabled={actionLoading === 'saving'}
                        className="bg-white/5 hover:bg-white/10 text-white border border-white/10"
                    >
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleSave} 
                        disabled={actionLoading === 'saving'}
                        className="bg-gold-medium hover:bg-gold-light text-black font-bold min-w-[100px]"
                    >
                        {actionLoading === 'saving' ? (
                            <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...</>
                        ) : (
                            'Save Changes'
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
