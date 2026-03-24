import { useState, useEffect } from 'react';
import { X, Search, Loader2, UserPlus, UserMinus, Users, Crown, Pencil, Check } from 'lucide-react';
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

interface ManageTeamModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    team: {
        id: string;
        name: string;
    };
}

export function ManageTeamModal({ isOpen, onClose, onSuccess, team }: ManageTeamModalProps) {
    const [teamMembers, setTeamMembers] = useState<Seller[]>([]);
    const [availableSellers, setAvailableSellers] = useState<Seller[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    
    // Edit Team Name State
    const [isEditingName, setIsEditingName] = useState(false);
    const [teamName, setTeamName] = useState(team.name);
    const [savingName, setSavingName] = useState(false);
    const [promotionError, setPromotionError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            loadData();
            setTeamName(team.name);
            setIsEditingName(false);
        }
    }, [isOpen, team.id]);

    const handleUpdateName = async () => {
        if (!teamName.trim() || teamName === team.name) {
            setIsEditingName(false);
            return;
        }

        setSavingName(true);
        try {
            const { error } = await supabase
                .from('teams')
                .update({ name: teamName.trim() })
                .eq('id', team.id);

            if (error) throw error;
            setIsEditingName(false);
            onSuccess(); // Refresh parent to show new name in list
        } catch (err) {
            console.error('[ManageTeamModal] Error updating team name:', err);
        } finally {
            setSavingName(false);
        }
    };

    const loadData = async () => {
        console.log('[ManageTeamModal] Loading data for team:', team.id);
        setLoading(true);
        try {
            // 1. Members of this team (Sellers and HoS)
            const { data: members, error: membersError } = await supabase
                .from('sellers')
                .select('id, full_name, email, seller_id_public, role, is_test')
                .eq('team_id', team.id)
                .order('full_name');

            if (membersError) throw membersError;

            // 2. Available Sellers (not in any team)
            const { data: available, error: availableError } = await supabase
                .from('sellers')
                .select('id, full_name, email, seller_id_public, role, is_test')
                .is('team_id', null)
                .order('full_name');

            if (availableError) throw availableError;

            setTeamMembers(members || []);
            setAvailableSellers(available || []);
        } catch (err) {
            console.error('[ManageTeamModal] Error loading data:', err);
        } finally {
            setLoading(false);
        }
    };

    const toggleMember = async (seller: Seller, isAdding: boolean) => {
        setActionLoading(seller.id);
        try {
            const { error } = await supabase
                .from('sellers')
                .update({ 
                    team_id: isAdding ? team.id : null,
                })
                .eq('id', seller.id);

            if (error) throw error;
            
            if (isAdding) {
                setTeamMembers(prev => [...prev, seller].sort((a,b) => a.full_name.localeCompare(b.full_name)));
                setAvailableSellers(prev => prev.filter(s => s.id !== seller.id));
            } else {
                setAvailableSellers(prev => [...prev, seller].sort((a,b) => a.full_name.localeCompare(b.full_name)));
                setTeamMembers(prev => prev.filter(s => s.id !== seller.id));
            }
        } catch (err) {
            console.error('[ManageTeamModal] Error toggling member:', err);
        } finally {
            setActionLoading(null);
        }
    };

    const promoteToHos = async (seller: Seller) => {
        setActionLoading(seller.id);
        setPromotionError(null);
        try {
            // Check if there's already a HoS in this team
            const existingHos = teamMembers.find(m => m.role === 'head_of_sales');
            if (existingHos) {
                setPromotionError(`There is already a Head of Sales (${existingHos.full_name}) in this team. Remove or demote them first.`);
                return;
            }

            const { error } = await supabase.functions.invoke('admin-update-seller', {
                body: {
                    seller_id: seller.id,
                    full_name: seller.full_name,
                    email: seller.email,
                    phone: '-',
                    seller_id_public: seller.seller_id_public,
                    role: 'head_of_sales',
                    team_id: team.id
                },
            });

            if (error) throw error;
            await loadData();
        } catch (err) {
            console.error('[ManageTeamModal] Error promoting:', err);
        } finally {
            setActionLoading(null);
        }
    };

    if (!isOpen) return null;

    const filteredAvailable = availableSellers.filter(s => 
        s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        s.email?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-zinc-900 w-full max-w-5xl h-[95vh] sm:h-[85vh] rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="px-4 sm:px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/5 group/header gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Users className="w-5 h-5 text-gold-medium shrink-0" />
                        {isEditingName ? (
                            <div className="flex items-center gap-2 flex-1 max-w-md">
                                <input
                                    type="text"
                                    value={teamName}
                                    onChange={e => setTeamName(e.target.value)}
                                    autoFocus
                                    onKeyDown={e => e.key === 'Enter' && handleUpdateName()}
                                    className="bg-black/40 border border-gold-medium/30 rounded-lg px-2 sm:px-3 py-1.5 text-white font-bold text-xs sm:text-sm w-full focus:outline-none focus:border-gold-medium transition-all"
                                />
                                <div className="flex items-center gap-1">
                                    <Button 
                                        size="sm" 
                                        onClick={handleUpdateName}
                                        disabled={savingName}
                                        className="bg-gold-medium hover:bg-gold-light text-black font-bold h-8 sm:h-9 px-2 sm:px-3 shrink-0"
                                    >
                                        {savingName ? <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" /> : <Check className="w-3 h-3 sm:w-4 sm:h-4" />}
                                    </Button>
                                    <Button 
                                        size="sm" 
                                        variant="ghost" 
                                        onClick={() => { setTeamName(team.name); setIsEditingName(false); }}
                                        className="text-gray-400 hover:text-white hover:bg-white/10 h-8 sm:h-9 w-8 sm:w-9 p-0 shrink-0"
                                    >
                                        <X className="w-3 h-3 sm:w-4 sm:h-4" />
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div 
                                className="flex items-center gap-2 cursor-pointer group/title hover:opacity-80 transition-all min-w-0" 
                                onClick={() => setIsEditingName(true)}
                                title="Click to edit team name"
                            >
                                <h2 className="text-sm sm:text-lg font-bold text-white tracking-tight truncate">Manage Team: {teamName}</h2>
                                <Pencil className="w-3 h-3 sm:w-4 sm:h-4 text-gold-medium/60 group-hover/title:text-gold-medium transition-all" />
                            </div>
                        )}
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Conflict Warning Banner */}
                {promotionError && (
                    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 sm:px-6 py-2 sm:py-3 flex items-center justify-between animate-in slide-in-from-top duration-300">
                        <div className="flex items-center gap-3">
                            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                                <Crown className="w-3 h-3 sm:w-4 sm:h-4 text-amber-500" />
                            </div>
                            <p className="text-[10px] sm:text-sm font-medium text-amber-200/90">{promotionError}</p>
                        </div>
                        <button 
                            onClick={() => setPromotionError(null)}
                            className="p-1.5 hover:bg-amber-500/10 rounded-lg text-amber-500/60 hover:text-amber-500 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-hidden flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-white/10">
                    
                    {/* Left Side: Current Team */}
                    <div className="flex-1 flex flex-col min-w-0">
                        <div className="p-4 bg-white/5 border-b border-white/5">
                            <h3 className="text-sm font-bold text-gold-light flex items-center gap-2 uppercase tracking-wider">
                                Team Members ({teamMembers.length})
                            </h3>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                            {loading ? (
                                <div className="h-full flex items-center justify-center">
                                    <Loader2 className="w-6 h-6 text-gold-medium animate-spin" />
                                </div>
                            ) : teamMembers.length === 0 ? (
                                <div className="text-center py-12 text-gray-600 italic text-sm">No members in this team.</div>
                            ) : (
                                teamMembers.map(member => (
                                    <div key={member.id} className="flex items-center justify-between p-3 bg-white/5 border border-white/5 rounded-xl group transition-all">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-medium text-white truncate">{member.full_name}</p>
                                                {member.role === 'head_of_sales' && (
                                                    <span className="text-[10px] px-1.5 py-0.5 bg-gold-medium/10 text-gold-light border border-gold-medium/20 rounded font-bold uppercase flex items-center gap-1">
                                                        <Crown className="w-2 h-2" /> HoS
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-gray-500 font-mono italic">{member.email}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {member.role === 'seller' && (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => promoteToHos(member)}
                                                    disabled={!!actionLoading}
                                                    className="text-gold-medium hover:text-gold-light hover:bg-gold-medium/10 text-[10px] h-7 px-2"
                                                >
                                                    Make HoS
                                                </Button>
                                            )}
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => toggleMember(member, false)}
                                                disabled={!!actionLoading}
                                                className="text-red-400 hover:text-red-300 hover:bg-red-400/10 p-2 h-auto"
                                            >
                                                {actionLoading === member.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserMinus className="w-4 h-4" />}
                                            </Button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Right Side: Available Sellers */}
                    <div className="flex-1 flex flex-col min-w-0 bg-black/20">
                        <div className="p-4 bg-white/5 border-b border-white/5 space-y-4">
                            <h3 className="text-sm font-bold text-gray-400 flex items-center gap-2 uppercase tracking-wider">
                                Available Sellers
                            </h3>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                <input
                                    type="text"
                                    placeholder="Search sellers..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-black border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-gold-medium transition-colors"
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                            {loading ? (
                                <div className="h-full flex items-center justify-center">
                                    <Loader2 className="w-6 h-6 text-gold-medium animate-spin" />
                                </div>
                            ) : filteredAvailable.length === 0 ? (
                                <div className="text-center py-12 text-gray-600 italic text-sm">No sellers available.</div>
                            ) : (
                                filteredAvailable.map(seller => (
                                    <div key={seller.id} className="flex items-center justify-between p-3 bg-white/2 border border-white/5 rounded-xl group hover:bg-white/5 transition-all">
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">{seller.full_name}</p>
                                            <p className="text-[10px] text-gray-500">{seller.email}</p>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => toggleMember(seller, true)}
                                            disabled={!!actionLoading}
                                            className="text-gold-medium hover:text-gold-light hover:bg-gold-medium/10 p-2 h-auto"
                                        >
                                            {actionLoading === seller.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                                        </Button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-white/5 flex justify-end gap-3 border-t border-white/5">
                    <Button onClick={() => { onSuccess(); onClose(); }} className="bg-gold-medium hover:bg-gold-light text-black font-bold">
                        Finish
                    </Button>
                </div>
            </div>
        </div>
    );
}
