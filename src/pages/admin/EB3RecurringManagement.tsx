/**
 * EB-3 Recurring Management Page
 * Admin dashboard for managing EB-3 monthly maintenance installments
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { Calendar, DollarSign, TrendingUp, Users } from 'lucide-react';

interface EB3Control {
    id: string;
    client_id: string;
    client_name: string;
    client_email: string;
    activation_date: string;
    recurrence_start_date: string;
    total_installments: number;
    installments_paid: number;
    program_status: string;
    seller_id: string | null;
    seller_name: string | null;
    seller_commission_percent: number | null;
    next_due_date: string | null;
    next_installment_number: number | null;
    next_amount: number | null;
    next_status: string | null;
}

export const EB3RecurringManagement = () => {
    const [stats, setStats] = useState({
        total_due_this_month: 0,
        total_overdue: 0,
        paid_today: 0,
        active_programs: 0,
    });
    const [programs, setPrograms] = useState<EB3Control[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('all');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);

            // Load dashboard statistics
            const { data: statsData, error: statsError } = await supabase
                .rpc('get_eb3_dashboard_stats');

            if (statsError) throw statsError;
            setStats(statsData || {
                total_due_this_month: 0,
                total_overdue: 0,
                paid_today: 0,
                active_programs: 0
            });

            // Load all programs with client and seller info (usando JOIN para evitar RLS)
            const { data: controlData, error: controlError } = await supabase
                .from('eb3_recurrence_control')
                .select(`
                    *,
                    clients!eb3_recurrence_control_client_id_fkey(id, full_name, email),
                    sellers!eb3_recurrence_control_seller_id_fkey(user_id, full_name)
                `)
                .order('created_at', { ascending: false });

            if (controlError) {
                console.error('[EB-3 Dashboard] Error loading programs:', controlError);
                throw controlError;
            }

            console.log('[EB-3 Dashboard] Loaded programs:', controlData);

            // Mapear dados para formato esperado
            const clientsMap = new Map();
            const sellersMap = new Map();

            controlData?.forEach(p => {
                if (p.clients) {
                    clientsMap.set(p.client_id, p.clients);
                }
                if (p.seller_id && p.sellers) {
                    sellersMap.set(p.seller_id, p.sellers);
                }
            });

            // Get next pending installment for each program
            const enrichedPrograms = await Promise.all(
                controlData.map(async (program) => {
                    const { data: nextInstallment } = await supabase
                        .from('eb3_recurrence_schedules')
                        .select('installment_number, due_date, amount_usd, late_fee_usd, status')
                        .eq('client_id', program.client_id)
                        .in('status', ['pending', 'overdue'])
                        .order('installment_number', { ascending: true })
                        .limit(1)
                        .single();

                    const client = clientsMap.get(program.client_id);
                    const seller = sellersMap.get(program.seller_id || '');

                    return {
                        ...program,
                        client_name: client?.full_name || 'Unknown Client',
                        client_email: client?.email || '',
                        seller_name: seller?.full_name || null,
                        next_due_date: nextInstallment?.due_date || null,
                        next_installment_number: nextInstallment?.installment_number || null,
                        next_amount: nextInstallment?.status === 'overdue'
                            ? (parseFloat(nextInstallment.amount_usd) + parseFloat(nextInstallment.late_fee_usd))
                            : parseFloat(nextInstallment?.amount_usd || 0),
                        next_status: nextInstallment?.status || 'completed',
                    };
                })
            );

            setPrograms(enrichedPrograms);
        } catch (error) {
            console.error('Error loading EB-3 data:', error);
        } finally {
            setLoading(false);
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
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-white mb-2">EB-3 Recurring Management</h1>
                <p className="text-gray-400">Manage monthly maintenance installments for EB-3 visa clients</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/30">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            Due This Month
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">
                            ${stats.total_due_this_month.toLocaleString()}
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/30">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" />
                            Overdue
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">
                            ${stats.total_overdue.toLocaleString()}
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/30">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                            <DollarSign className="w-4 h-4" />
                            Paid Today
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">
                            ${stats.paid_today.toLocaleString()}
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-gold-light/10 to-gold-dark/5 border-gold-medium/30">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            Active Programs
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">
                            {stats.active_programs}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <div className="flex gap-2 mb-4">
                <Button
                    variant={filterStatus === 'all' ? 'default' : 'outline'}
                    onClick={() => setFilterStatus('all')}
                    className="text-sm"
                >
                    All
                </Button>
                <Button
                    variant={filterStatus === 'on-track' ? 'default' : 'outline'}
                    onClick={() => setFilterStatus('on-track')}
                    className="text-sm"
                >
                    On Track
                </Button>
                <Button
                    variant={filterStatus === 'overdue' ? 'default' : 'outline'}
                    onClick={() => setFilterStatus('overdue')}
                    className="text-sm"
                >
                    Overdue
                </Button>
                <Button
                    variant={filterStatus === 'completed' ? 'default' : 'outline'}
                    onClick={() => setFilterStatus('completed')}
                    className="text-sm"
                >
                    Completed
                </Button>
            </div>

            {/* Programs Table */}
            <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
                <CardHeader>
                    <CardTitle className="text-white">Active Programs ({filteredPrograms.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-8 text-gray-400">Loading...</div>
                    ) : filteredPrograms.length === 0 ? (
                        <div className="text-center py-8 text-gray-400">No programs found</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="text-left text-gray-400 border-b border-gray-700">
                                        <th className="pb-3 font-medium">Client</th>
                                        <th className="pb-3 font-medium">Progress</th>
                                        <th className="pb-3 font-medium">Next Due</th>
                                        <th className="pb-3 font-medium">Amount</th>
                                        <th className="pb-3 font-medium">Status</th>
                                        <th className="pb-3 font-medium">Seller</th>
                                        <th className="pb-3 font-medium">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredPrograms.map((program) => {
                                        const statusInfo = getStatusBadge(program.next_status || program.program_status);
                                        return (
                                            <tr key={program.id} className="border-b border-gray-800 hover:bg-white/5">
                                                <td className="py-4">
                                                    <div className="font-medium text-white">{program.client_name}</div>
                                                    <div className="text-sm text-gray-400">{program.client_email}</div>
                                                </td>
                                                <td className="py-4">
                                                    <div className="text-white font-medium">
                                                        {program.installments_paid}/{program.total_installments}
                                                    </div>
                                                    <div className="w-full bg-gray-700 rounded-full h-2 mt-1">
                                                        <div
                                                            className="bg-gold-light h-2 rounded-full transition-all"
                                                            style={{
                                                                width: `${(program.installments_paid / program.total_installments) * 100}%`,
                                                            }}
                                                        />
                                                    </div>
                                                </td>
                                                <td className="py-4 text-white">
                                                    {program.next_due_date
                                                        ? new Date(program.next_due_date).toLocaleDateString()
                                                        : 'N/A'}
                                                </td>
                                                <td className="py-4 text-white font-medium">
                                                    ${program.next_amount?.toFixed(2) || '0.00'}
                                                </td>
                                                <td className="py-4">
                                                    <Badge className={statusInfo.className}>{statusInfo.label}</Badge>
                                                </td>
                                                <td className="py-4 text-gray-400">{program.seller_name || 'N/A'}</td>
                                                <td className="py-4">
                                                    <Button size="sm" variant="outline" className="text-sm">
                                                        View Details
                                                    </Button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};
