import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft, Calendar, User, DollarSign, ExternalLink, Mail, CheckCircle2, AlertCircle, Copy, Power, History } from 'lucide-react';

interface Installment {
    id: string;
    installment_number: number;
    due_date: string;
    amount_usd: number;
    late_fee_usd: number;
    status: string;
    paid_at: string | null;
    payment_id: string | null;
}

interface ProgramDetail {
    control: {
        id: string;
        activation_date: string;
        recurrence_start_date: string;
        total_installments: number;
        installments_paid: number;
        program_status: string;
    };
    client: {
        id: string;
        full_name: string;
        email: string;
    };
    seller: {
        user_id: string;
        full_name: string;
        seller_id_public: string;
    } | null;
    installments: Installment[];
}

export const EB3RecurringDetail = () => {
    const { id: clientId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [program, setProgram] = useState<ProgramDetail | null>(null);
    const [emailLogs, setEmailLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [sendingEmail, setSendingEmail] = useState<string | null>(null);
    const [processingAction, setProcessingAction] = useState(false);
    const [errorState, setErrorState] = useState<{ message: string, details?: string, code?: string } | null>(null);

    // Dialog States
    const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
    const [statusReason, setStatusReason] = useState("");
    const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
    const [selectedInstallmentId, setSelectedInstallmentId] = useState<string | null>(null);
    const [paymentNotes, setPaymentNotes] = useState("");

    useEffect(() => {
        if (clientId) {
            loadProgramData();
            loadEmailHistory();
        }
    }, [clientId]);

    const loadProgramData = async () => {
        try {
            console.log('[EB3-Debug] Loading data via RPC for client:', clientId);
            setLoading(true);
            setErrorState(null);

            const { data, error } = await supabase
                .rpc('get_eb3_program_detail', { p_client_id: clientId });

            if (error) {
                console.error('[EB3-Debug] RPC Execution Error:', error);
                setErrorState({
                    message: error.message,
                    details: error.details,
                    code: error.code
                });
                throw error;
            }

            if (!data) {
                console.warn('[EB3-Debug] RPC returned null for client_id:', clientId);
                setProgram(null);
                return;
            }

            console.log('[EB3-Debug] Data successfully retrieved via RPC:', data);

            // The RPC already returns the format we need
            setProgram(data as ProgramDetail);

        } catch (error: any) {
            console.error('[EB3-Debug] CATCH Error Payload:', {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code,
                status: error.status
            });

            if (!errorState) {
                setErrorState({
                    message: error.message || 'Unknown Error',
                    details: error.details || error.hint,
                    code: error.code
                });
            }
            // Specific check for RLS/Permission issues
            if (error.code === '42501') {
                console.error('[EB3-Debug] 🔐 Permission denied (RLS). Check your admin privileges.');
            }
        } finally {
            setLoading(false);
        }
    };

    const loadEmailHistory = async () => {
        try {
            const { data, error } = await supabase
                .rpc('get_eb3_email_history', { p_client_id: clientId });

            if (error) {
                console.error('Error loading email history:', error);
                return;
            }
            setEmailLogs(data || []);
        } catch (error) {
            console.error('Error loading email history:', error);
        }
    };

    const handleToggleStatus = async () => {
        if (!program) return;
        try {
            setProcessingAction(true);
            const newStatus = program.control.program_status === 'active' ? 'cancelled' : 'active';

            const { error } = await supabase
                .rpc('toggle_eb3_recurrence_status', {
                    p_control_id: program.control.id,
                    p_status: newStatus,
                    p_reason: statusReason
                });

            if (error) throw error;

            setIsStatusDialogOpen(false);
            setStatusReason("");
            await loadProgramData(); // Reload to reflect changes

        } catch (error: any) {
            console.error('Error toggling status:', error);
            alert(`Failed to update status: ${error.message}`);
        } finally {
            setProcessingAction(false);
        }
    };

    const handleMarkAsPaidManual = async () => {
        if (!selectedInstallmentId) return;
        try {
            setProcessingAction(true);

            const { error } = await supabase
                .rpc('mark_eb3_installment_paid_manual', {
                    p_schedule_id: selectedInstallmentId,
                    p_notes: paymentNotes
                });

            if (error) throw error;

            setIsPaymentDialogOpen(false);
            setPaymentNotes("");
            setSelectedInstallmentId(null);
            await loadProgramData(); // Reload to reflect changes

        } catch (error: any) {
            console.error('Error marking as paid:', error);
            alert(`Failed to mark as paid: ${error.message}`);
        } finally {
            setProcessingAction(false);
        }
    };

    const handleResendLink = async (scheduleId: string) => {
        try {
            setSendingEmail(scheduleId);
            const { error } = await supabase.functions.invoke('send-eb3-installment-email', {
                body: { schedule_id: scheduleId }
            });

            if (error) throw error;
            alert('Email sent successfully!');
        } catch (error) {
            console.error('Error sending email:', error);
            alert('Failed to send email.');
        } finally {
            setSendingEmail(null);
        }
    };

    const handleCopyLink = (scheduleId: string) => {
        const baseUrl = window.location.origin;
        const paymentLink = `${baseUrl}/checkout/visa/eb3-installment-monthly?prefill=${scheduleId}`;

        navigator.clipboard.writeText(paymentLink);
        alert('Payment link copied to clipboard!');
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'paid':
                return <Badge className="bg-green-500/20 text-green-400 border-green-500/50">Paid</Badge>;
            case 'overdue':
                return <Badge className="bg-red-500/20 text-red-400 border-red-500/50">Overdue</Badge>;
            case 'pending':
                return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/50">Pending</Badge>;
            case 'cancelled':
                return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/50">Cancelled</Badge>;
            case 'paused':
                return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/50">Paused</Badge>;
            case 'active':
                return <Badge className="bg-green-500/20 text-green-400 border-green-500/50">Active</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    if (loading) {
        return (
            <div className="min-h-[400px] flex flex-col items-center justify-center text-white p-4">
                <Loader2 className="w-8 h-8 animate-spin text-gold-medium mb-4" />
                <p className="text-gray-400">Loading program details...</p>
            </div>
        );
    }

    if (errorState) {
        return (
            <div className="p-6 text-center max-w-2xl mx-auto">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-white mb-2">Error Loading Program</h2>
                <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-lg text-left mb-6">
                    <p className="text-red-400 font-bold mb-1">{errorState.message}</p>
                    {errorState.code && <p className="text-xs text-red-400/70 mb-2">Error Code: {errorState.code}</p>}
                    {errorState.details && (
                        <pre className="text-[10px] text-gray-400 bg-black/50 p-2 rounded overflow-auto max-h-32">
                            {errorState.details}
                        </pre>
                    )}
                </div>
                <div className="flex gap-4 justify-center">
                    <Button onClick={loadProgramData} variant="outline" className="border-gray-700">
                        <Loader2 className="w-4 h-4 mr-2" /> Try Again
                    </Button>
                    <Button onClick={() => navigate('/dashboard/eb3-recurring')}>
                        Back to Management
                    </Button>
                </div>
            </div>
        );
    }

    if (!program) {
        return (
            <div className="p-6 text-center">
                <AlertCircle className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-white">Program Not Found</h2>
                <p className="text-gray-400 text-sm mb-6">No recurring program entry exists for this client ID.</p>
                <Button onClick={() => navigate('/dashboard/eb3-recurring')} className="mt-4">
                    Back to Management
                </Button>
            </div>
        );
    }

    const progress = Math.min((program.control.installments_paid / program.control.total_installments) * 100, 100);

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-4">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => navigate('/dashboard/eb3-recurring')}
                        className="border-gray-700 bg-transparent hover:bg-white/10 text-white"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold text-white uppercase tracking-tight">Program Details: {program.client.full_name}</h1>
                        <p className="text-gray-400 text-sm">EB-3 Recurring Maintenance Plan</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {getStatusBadge(program.control.program_status)}

                    <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="border-gray-700 gap-2">
                                <Power className="w-4 h-4" />
                                {program.control.program_status === 'active' ? 'Suspend Program' : 'Activate Program'}
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-zinc-900 border-gray-800 text-white">
                            <DialogHeader>
                                <DialogTitle>
                                    {program.control.program_status === 'active' ? 'Suspend Program' : 'Activate Program'}
                                </DialogTitle>
                                <DialogDescription className="text-gray-400">
                                    {program.control.program_status === 'active'
                                        ? 'Are you sure you want to suspend this recurring program? Automated emails and checks will stop.'
                                        : 'Are you sure you want to activate this program? Automated checks will resume immediately.'}
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="reason">Reason for change</Label>
                                    <Input
                                        id="reason"
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
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Client & Program Summary */}
                <div className="lg:col-span-1 space-y-6">
                    <Card className="bg-zinc-900 border-gray-800">
                        <CardHeader>
                            <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                                <User className="w-4 h-4 text-gold-light" />
                                Client Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <p className="text-xs text-gray-500 uppercase font-bold">Full Name</p>
                                <p className="text-white">{program.client.full_name}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 uppercase font-bold">Email Address</p>
                                <p className="text-white">{program.client.email}</p>
                            </div>
                            {program.seller && (
                                <div>
                                    <p className="text-xs text-gray-500 uppercase font-bold">Seller</p>
                                    <p className="text-gold-light">{program.seller.full_name}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="bg-zinc-900 border-gray-800">
                        <CardHeader>
                            <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-gold-light" />
                                Program Timeline
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs text-gray-500 uppercase font-bold">Activation</p>
                                    <p className="text-white text-sm">{new Date(program.control.activation_date).toLocaleDateString()}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 uppercase font-bold">Start Date</p>
                                    <p className="text-white text-sm">{new Date(program.control.recurrence_start_date).toLocaleDateString()}</p>
                                </div>
                            </div>
                            <div className="space-y-2 pt-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Progress</span>
                                    <span className="text-white font-bold">{program.control.installments_paid} / {program.control.total_installments}</span>
                                </div>
                                <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                                    <div
                                        className="bg-gold-medium h-full rounded-full transition-all duration-1000"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Tabs: Schedule & Email History */}
                <div className="lg:col-span-2">
                    <Tabs defaultValue="schedule" className="w-full">
                        <TabsList className="bg-zinc-900 border border-gray-800 w-full justify-start p-1 h-auto mb-4">
                            <TabsTrigger value="schedule" className="data-[state=active]:bg-gold-medium/20 data-[state=active]:text-gold-light gap-2">
                                <DollarSign className="w-4 h-4" />
                                Payment Schedule
                            </TabsTrigger>
                            <TabsTrigger value="emails" className="data-[state=active]:bg-gold-medium/20 data-[state=active]:text-gold-light gap-2">
                                <History className="w-4 h-4" />
                                Email History
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="schedule">
                            <Card className="bg-zinc-900 border-gray-800 h-full">
                                <CardContent className="p-0">
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="text-left text-gray-500 text-xs uppercase border-b border-gray-800">
                                                    <th className="py-3 px-4">#</th>
                                                    <th className="py-3 px-4">Due Date</th>
                                                    <th className="py-3 px-4">Amount</th>
                                                    <th className="py-3 px-4">Status</th>
                                                    <th className="py-3 px-4">Paid At</th>
                                                    <th className="py-3 px-4 text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-800/50">
                                                {program.installments.map((inst) => (
                                                    <tr key={inst.id} className="hover:bg-white/5 transition-colors group">
                                                        <td className="py-4 px-4 text-gray-400 text-sm">{inst.installment_number}</td>
                                                        <td className="py-4 px-4 text-white text-sm font-medium">
                                                            {new Date(inst.due_date).toLocaleDateString()}
                                                        </td>
                                                        <td className="py-4 px-4 text-white text-sm">
                                                            ${Number(inst.amount_usd).toFixed(2)}
                                                            {inst.late_fee_usd > 0 && inst.status !== 'paid' && (
                                                                <span className="text-red-400 text-[10px] block">+ ${inst.late_fee_usd} late fee</span>
                                                            )}
                                                        </td>
                                                        <td className="py-4 px-4">
                                                            {getStatusBadge(inst.status)}
                                                        </td>
                                                        <td className="py-4 px-4 text-gray-400 text-xs">
                                                            {inst.paid_at ? (
                                                                <span className="flex items-center gap-1">
                                                                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                                                                    {new Date(inst.paid_at).toLocaleDateString()}
                                                                </span>
                                                            ) : '-'}
                                                        </td>
                                                        <td className="py-4 px-4 text-right">
                                                            <div className="flex justify-end gap-2">
                                                                {inst.status !== 'paid' && (
                                                                    <>
                                                                        <Button
                                                                            size="sm"
                                                                            variant="ghost"
                                                                            className="h-8 w-8 p-0 text-gray-400 hover:text-green-400"
                                                                            onClick={() => {
                                                                                setSelectedInstallmentId(inst.id);
                                                                                setIsPaymentDialogOpen(true);
                                                                            }}
                                                                            title="Mark as Paid Manually"
                                                                        >
                                                                            <DollarSign className="w-4 h-4" />
                                                                        </Button>
                                                                        <Button
                                                                            size="sm"
                                                                            variant="ghost"
                                                                            className="h-8 w-8 p-0 text-gray-400 hover:text-blue-400"
                                                                            onClick={() => handleCopyLink(inst.id)}
                                                                            title="Copy Payment Link"
                                                                        >
                                                                            <Copy className="w-4 h-4" />
                                                                        </Button>
                                                                        <Button
                                                                            size="sm"
                                                                            variant="ghost"
                                                                            className="h-8 w-8 p-0 text-gray-400 hover:text-white"
                                                                            onClick={() => handleResendLink(inst.id)}
                                                                            disabled={sendingEmail === inst.id}
                                                                            title="Resend Email"
                                                                        >
                                                                            {sendingEmail === inst.id ? (
                                                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                                            ) : (
                                                                                <Mail className="w-4 h-4" />
                                                                            )}
                                                                        </Button>
                                                                    </>
                                                                )}
                                                                {inst.payment_id && (
                                                                    <Button
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        className="text-gray-400 hover:text-white h-8 w-8 p-0"
                                                                        onClick={() => navigate(`/dashboard/visa-orders/${inst.payment_id}`)}
                                                                        title="View Order"
                                                                    >
                                                                        <ExternalLink className="w-4 h-4" />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="emails">
                            <Card className="bg-zinc-900 border-gray-800 h-full">
                                <CardContent className="p-0">
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="text-left text-gray-500 text-xs uppercase border-b border-gray-800">
                                                    <th className="py-3 px-4">Sent At</th>
                                                    <th className="py-3 px-4">Type</th>
                                                    <th className="py-3 px-4">Recipient</th>
                                                    <th className="py-3 px-4">Ref. Installment</th>
                                                    <th className="py-3 px-4">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-800/50">
                                                {emailLogs.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={5} className="py-8 text-center text-gray-500">
                                                            No emails recorded for this client.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    emailLogs.map((log) => (
                                                        <tr key={log.id} className="hover:bg-white/5 transition-colors">
                                                            <td className="py-3 px-4 text-gray-400 text-sm">
                                                                {new Date(log.sent_at).toLocaleString()}
                                                            </td>
                                                            <td className="py-3 px-4">
                                                                <Badge variant="outline" className="capitalize text-xs">
                                                                    {log.email_type}
                                                                </Badge>
                                                            </td>
                                                            <td className="py-3 px-4 text-white text-sm">
                                                                {log.recipient_email}
                                                            </td>
                                                            <td className="py-3 px-4 text-gray-400 text-sm">
                                                                {log.installment_number ? `#${log.installment_number}` : '-'}
                                                            </td>
                                                            <td className="py-3 px-4">
                                                                <div className="flex items-center gap-1 text-green-400 text-xs">
                                                                    <CheckCircle2 className="w-3 h-3" /> Sent
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>

            {/* Manual Payment Dialog */}
            <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
                <DialogContent className="bg-zinc-900 border-gray-800 text-white">
                    <DialogHeader>
                        <DialogTitle>Mark as Paid Manually</DialogTitle>
                        <DialogDescription className="text-gray-400">
                            This will mark the selected installment as paid. Useful for wire transfers or external payments.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="notes">Payment Notes</Label>
                            <Input
                                id="notes"
                                placeholder="E.g. Wire transfer ref #123456"
                                value={paymentNotes}
                                onChange={(e) => setPaymentNotes(e.target.value)}
                                className="bg-zinc-800 border-gray-700"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleMarkAsPaidManual} disabled={processingAction} className="bg-green-600 hover:bg-green-700">
                            {processingAction ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Payment'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
