import { useState } from 'react';
import { X, Loader2, Users, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

interface CreateTeamModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export function CreateTeamModal({ isOpen, onClose, onSuccess }: CreateTeamModalProps) {
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setLoading(true);
        setError(null);

        try {
            const { error: insertError } = await supabase
                .from('teams')
                .insert({
                    name: name.trim(),
                    is_test: false // Default to false
                });

            if (insertError) throw insertError;

            setName('');
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('[CreateTeamModal] Error creating team:', err);
            setError(err.message || 'Error creating team');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-zinc-900 w-full max-w-md rounded-2xl border border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/5">
                    <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-gold-medium" />
                        <h2 className="text-lg font-bold text-white tracking-tight">Create New Team</h2>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors"
                        disabled={loading}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleCreate}>
                    <div className="p-6 space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-400">Team Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                autoFocus
                                required
                                className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-gold-medium transition-all"
                            />
                        </div>

                        {error && (
                            <p className="text-xs text-red-500 bg-red-500/10 border border-red-500/20 p-3 rounded-lg">
                                {error}
                            </p>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 bg-white/5 flex justify-end gap-3 border-t border-white/5">
                        <Button 
                            type="button"
                            onClick={onClose} 
                            variant="ghost"
                            disabled={loading}
                            className="hover:bg-white/5 text-gray-400"
                        >
                            Cancel
                        </Button>
                        <Button 
                            type="submit"
                            disabled={loading || !name.trim()}
                            className="bg-gold-medium hover:bg-gold-light text-black font-bold min-w-[120px]"
                        >
                            {loading ? (
                                <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Creating...</>
                            ) : (
                                <><Save className="w-4 h-4 mr-2" /> Create Team</>
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
