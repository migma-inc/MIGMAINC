/**
 * Scholarship Recurring Management Page
 * Admin dashboard for managing Scholarship monthly maintenance installments
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, DollarSign, TrendingUp, Users, Loader2, AlertCircle, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const CustomSwitch = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => {
    return (
        <div onClick={(e) => { e.stopPropagation(); onChange(); }} className="inline-block cursor-pointer">
            <div className={`
                flex items-center relative w-[50px] h-[30px] rounded-[20px] transition-all duration-200
                ${checked ? 'bg-[#FFD700]' : 'bg-[rgb(82,82,82)]'}
             `}>
                <div className={`
                    absolute left-[5px] h-[20px] w-[20px] rounded-full transition-all duration-200
                    shadow-[5px_2px_7px_rgba(8,8,8,0.26)] border-[5px] border-white
                    ${checked ? 'translate-x-[20px] bg-white' : 'bg-transparent'}
                 `} />
            </div>
        </div>
    );
};

interface ScholarshipProgramSummary {
    control_id: string;
    client_id: string;
    client_name: string;
    client_email: string;
    seller_name: string | null;
    program_status: string;
    installments_paid: number;
    total_installments: number;
    next_due_date: string | null;
    next_amount: number | null;
    next_status: string | null;
    next_installment_number: number | null;
}

export const ScholarshipRecurringManagement = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        total_due_this_month: 0,
        total_overdue: 0,
        paid_today: 0,
        active_programs: 0,
    });
    const [programs, setPrograms] = useState<ScholarshipProgramSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('all');

    // Quick Status Toggle States
    const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
    const [selectedProgramForStatus, setSelectedProgramForStatus] = useState<ScholarshipProgramSummary | null>(null);
    const [statusReason, setStatusReason] = useState("");
    const [processingAction, setProcessingAction] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);

            // Load dashboard statistics
            const { data: statsData, error: statsError } = await supabase
                .rpc('get_scholarship_dashboard_stats');

            if (statsError) throw statsError;
            setStats(statsData || {
                total_due_this_month: 0,
                total_overdue: 0,
                paid_today: 0,
                active_programs: 0
            });

            // Load all programs using the optimized RPC
            const { data: controlData, error: controlError } = await supabase
                .rpc('get_scholarship_program_summaries');

            if (controlError) {
                console.error('[Scholarship Dashboard] Error loading programs:', controlError);
                throw controlError;
            }

            setPrograms(controlData || []);

        } catch (error) {
            console.error('Error loading Scholarship data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleStatus = async () => {
        if (!selectedProgramForStatus) return;
        try {
            setProcessingAction(true);
            const newStatus = selectedProgramForStatus.program_status === 'active' ? 'cancelled' : 'active';

            const { error } = await supabase
                .rpc('toggle_scholarship_recurrence_status', {
                    p_control_id: selectedProgramForStatus.control_id,
                    p_status: newStatus,
                    p_reason: statusReason
                });

            if (error) throw error;

            setIsStatusDialogOpen(false);
            setStatusReason("");
            setSelectedProgramForStatus(null);
            await loadData(); // Reload to reflect changes

        } catch (error: any) {
            console.error('Error toggling status:', error);
            alert(`Failed to update status: ${error.message}`);
        } finally {
            setProcessingAction(false);
        }
    };

    const getStatusBadge = (status: string) => {
        const variants: Record<string, { label: string; className: string }> = {
            pending: { label: 'On Track', className: 'bg-blue-500/20 text-blue-400 border-blue-500/50' },
            overdue: { label: 'Overdue', className: 'bg-red-500/20 text-red-400 border-red-500/50' },
            completed: { label: 'Completed', className: 'bg-green-500/20 text-green-400 border-green-500/50' },
            active: { label: 'Active', className: 'bg-green-500/20 text-green-400 border-green-500/50' },
            cancelled: { label: 'Cancelled', className: 'bg-gray-500/20 text-gray-400 border-gray-500/50' },
        };
        return variants[status] || variants.pending;
    };

    const filteredPrograms = programs.filter(p => {
        if (filterStatus === 'all') return true;
        if (filterStatus === 'overdue') return p.next_status === 'overdue';
        if (filterStatus === 'on-track') return p.next_status === 'pending';
        if (filterStatus === 'completed') return p.program_status === 'completed';
        return true;
    });

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2 uppercase tracking-tight">Scholarship Recurring Management</h1>
                    <p className="text-gray-400 text-sm sm:text-base">Manage monthly maintenance installments for Scholarship clients</p>
                </div>
                <Button
                    onClick={() => loadData()}
                    variant="outline"
                    className="gap-2 w-full sm:w-auto border-gray-700 bg-transparent hover:bg-white/10 text-white"
                    disabled={loading}
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refresh Data'}
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
                <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/30">
                    <CardHeader className="pb-1.5 p-3 sm:p-6 sm:pb-2">
                        <CardTitle className="text-[10px] sm:text-sm font-medium text-gray-400 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 sm:w-4 h-4" />
                            Due This Month
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                        <div className="text-lg sm:text-2xl font-bold text-white">
                            ${stats.total_due_this_month.toLocaleString()}
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/30">
                    <CardHeader className="pb-1.5 p-3 sm:p-6 sm:pb-2">
                        <CardTitle className="text-[10px] sm:text-sm font-medium text-gray-400 flex items-center gap-1.5">
                            <TrendingUp className="w-3.5 h-3.5 sm:w-4 h-4" />
                            Overdue
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                        <div className="text-lg sm:text-2xl font-bold text-white">
                            ${stats.total_overdue.toLocaleString()}
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/30">
                    <CardHeader className="pb-1.5 p-3 sm:p-6 sm:pb-2">
                        <CardTitle className="text-[10px] sm:text-sm font-medium text-gray-400 flex items-center gap-1.5">
                            <DollarSign className="w-3.5 h-3.5 sm:w-4 h-4" />
                            Paid Today
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                        <div className="text-lg sm:text-2xl font-bold text-white">
                            ${stats.paid_today.toLocaleString()}
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-gold-light/10 to-gold-dark/5 border-gold-medium/30">
                    <CardHeader className="pb-1.5 p-3 sm:p-6 sm:pb-2">
                        <CardTitle className="text-[10px] sm:text-sm font-medium text-gray-400 flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 sm:w-4 h-4" />
                            Programs
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                        <div className="text-lg sm:text-2xl font-bold text-white">
                            {stats.active_programs}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
                <Button
                    variant={filterStatus === 'all' ? 'default' : 'outline'}
                    onClick={() => setFilterStatus('all')}
                    className={cn(
                        "text-xs sm:text-sm whitespace-nowrap px-4",
                        filterStatus === 'all' ? "bg-gold-medium hover:bg-gold-dark text-black" : "border-gray-700 text-gray-400"
                    )}
                >
                    All
                </Button>
                <Button
                    variant={filterStatus === 'on-track' ? 'default' : 'outline'}
                    onClick={() => setFilterStatus('on-track')}
                    className={cn(
                        "text-xs sm:text-sm whitespace-nowrap px-4",
                        filterStatus === 'on-track' ? "bg-gold-medium hover:bg-gold-dark text-black" : "border-gray-700 text-gray-400"
                    )}
                >
                    On Track
                </Button>
                <Button
                    variant={filterStatus === 'overdue' ? 'default' : 'outline'}
                    onClick={() => setFilterStatus('overdue')}
                    className={cn(
                        "text-xs sm:text-sm whitespace-nowrap px-4",
                        filterStatus === 'overdue' ? "bg-gold-medium hover:bg-gold-dark text-black" : "border-gray-700 text-gray-400"
                    )}
                >
                    Overdue
                </Button>
            </div>

            {/* Programs Table */}
            <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
                <CardHeader>
                    <CardTitle className="text-white">Active Programs ({filteredPrograms.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center items-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-gold-medium" />
                        </div>
                    ) : filteredPrograms.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                            <AlertCircle className="w-12 h-12 mb-4 opacity-20" />
                            <p className="text-lg font-medium">No programs found</p>
                            <p className="text-sm text-gray-500">Try adjusting your filters or check back later.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Desktop Table View */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="text-left text-white border-b border-gray-700">
                                            <th className="pb-3 font-medium px-4 w-[70px]">Active?</th>
                                            <th className="pb-3 font-medium px-4">Client</th>
                                            <th className="pb-3 font-medium px-4">Installments Paid</th>
                                            <th className="pb-3 font-medium px-4">Next Payment</th>
                                            <th className="pb-3 font-medium px-4">Amount</th>
                                            <th className="pb-3 font-medium px-4">Status</th>
                                            <th className="pb-3 font-medium px-4">Seller</th>
                                            <th className="pb-3 font-medium px-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredPrograms.map((program) => {
                                            const statusInfo = getStatusBadge(program.next_status || program.program_status);
                                            return (
                                                <tr key={program.control_id} className="border-b border-gray-800 hover:bg-white/5 transition-colors">
                                                    <td className="py-4 px-4">
                                                        <CustomSwitch
                                                            checked={program.program_status === 'active'}
                                                            onChange={() => {
                                                                setSelectedProgramForStatus(program);
                                                                setIsStatusDialogOpen(true);
                                                            }}
                                                        />
                                                    </td>
                                                    <td className="py-4 px-4">
                                                        <div className="font-medium text-white line-clamp-1">{program.client_name}</div>
                                                        <div className="text-sm text-gray-400 truncate max-w-[200px]">{program.client_email}</div>
                                                    </td>
                                                    <td className="py-4 px-4">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-white font-medium text-sm">
                                                                {program.installments_paid}
                                                            </span>
                                                            <span className="text-xs text-gray-500">paid</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-4 text-white">
                                                        {program.next_due_date ? (
                                                            <div>
                                                                <div className="font-medium">{new Date(program.next_due_date).toLocaleDateString()}</div>
                                                                {program.next_installment_number && (
                                                                    <div className="text-xs text-gray-500">Installment #{program.next_installment_number}</div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-500">-</span>
                                                        )}
                                                    </td>
                                                    <td className="py-4 px-4 text-white font-medium">
                                                        {program.next_amount !== null
                                                            ? `$${program.next_amount.toFixed(2)}`
                                                            : '-'}
                                                    </td>
                                                    <td className="py-4 px-4">
                                                        <Badge className={statusInfo.className}>{statusInfo.label}</Badge>
                                                    </td>
                                                    <td className="py-4 px-4 text-gray-400 text-sm">
                                                        {program.seller_name || '-'}
                                                    </td>
                                                    <td className="py-4 px-4 text-right">
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-8 w-8 p-0"
                                                            onClick={() => navigate(`/dashboard/scholarship-recurring/${program.client_id}`)}
                                                            title="View Program Details"
                                                        >
                                                            <Eye className="w-4 h-4 text-gray-400 hover:text-white" />
                                                        </Button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Card List View */}
                            <div className="md:hidden space-y-3.5">
                                {filteredPrograms.map((program) => {
                                    const statusInfo = getStatusBadge(program.next_status || program.program_status);
                                    return (
                                        <div key={program.control_id} className="bg-zinc-900 border border-gray-800 rounded-xl p-3.5 space-y-3.5 shadow-lg shadow-black/20">
                                            <div className="flex justify-between items-start gap-4">
                                                <div className="space-y-0.5 min-w-0 flex-1">
                                                    <div className="font-bold text-white text-base truncate">{program.client_name}</div>
                                                    <div className="text-[10px] text-gray-500 truncate opacity-70">{program.client_email}</div>
                                                </div>
                                                <Badge className={cn("shrink-0 py-0.5 text-[9px] uppercase tracking-wider font-bold", statusInfo.className)}>
                                                    {statusInfo.label}
                                                </Badge>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-800/50">
                                                <div className="min-w-0">
                                                    <p className="text-[9px] text-gray-500 uppercase font-bold tracking-tight mb-1">Installments</p>
                                                    <p className="text-xs text-white font-bold">{program.installments_paid} paid</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[9px] text-gray-500 uppercase font-bold tracking-tight mb-1">Seller</p>
                                                    <p className="text-xs text-gray-300 font-medium truncate">{program.seller_name || '-'}</p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <p className="text-[9px] text-gray-500 uppercase font-bold tracking-tight mb-1">Next Due</p>
                                                    <p className="text-xs text-white font-medium">{program.next_due_date ? new Date(program.next_due_date).toLocaleDateString() : '-'}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[9px] text-gray-500 uppercase font-bold tracking-tight mb-1">Amount</p>
                                                    <p className="text-sm text-gold-light font-black tracking-tight">
                                                        {program.next_amount !== null ? `$${program.next_amount.toFixed(2)}` : '-'}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between pt-3 border-t border-gray-800/50 gap-3">
                                                <div className="flex items-center gap-2.5">
                                                    <span className="text-[9px] text-gray-500 uppercase font-black uppercase tracking-widest">Status</span>
                                                    <CustomSwitch
                                                        checked={program.program_status === 'active'}
                                                        onChange={() => {
                                                            setSelectedProgramForStatus(program);
                                                            setIsStatusDialogOpen(true);
                                                        }}
                                                    />
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="flex-1 max-w-[140px] h-8.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold text-[10px] uppercase tracking-widest gap-2 rounded-lg"
                                                    onClick={() => navigate(`/dashboard/scholarship-recurring/${program.client_id}`)}
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                    View
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
                <DialogContent className="bg-zinc-900 border-gray-800 text-white">
                    <DialogHeader>
                        <DialogTitle>
                            {selectedProgramForStatus?.program_status === 'active' ? 'Suspend Program' : 'Activate Program'}
                        </DialogTitle>
                        <DialogDescription className="text-gray-400">
                            {selectedProgramForStatus?.program_status === 'active'
                                ? `Are you sure you want to suspend the Scholarship recurring program for ${selectedProgramForStatus.client_name}?`
                                : `Are you sure you want to activate the Scholarship recurring program for ${selectedProgramForStatus?.client_name}?`}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="list-reason">Reason for change</Label>
                            <Input
                                id="list-reason"
                                placeholder="E.g. Customer request, payment failure..."
                                value={statusReason}
                                onChange={(e) => setStatusReason(e.target.value)}
                                className="bg-zinc-800 border-gray-700"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsStatusDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleToggleStatus} disabled={processingAction}>
                            {processingAction ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Change'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
