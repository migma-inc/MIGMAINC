import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PdfModal } from '@/components/ui/pdf-modal';
import {
    FileText,
    Check,
    X,
    User,
    Calendar,
    Image as ImageIcon,
    ExternalLink,
    FileCheck
} from 'lucide-react';
import { approveVisaContract, rejectVisaContract } from '@/lib/visa-contracts';
import { getCurrentUser } from '@/lib/auth';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

interface VisaOrder {
    id: string;
    order_number: string;
    product_slug: string;
    client_name: string;
    client_email: string;
    contract_pdf_url: string | null;
    annex_pdf_url: string | null;
    contract_selfie_url: string | null;
    contract_document_url: string | null;
    contract_signed_at: string | null;
    contract_approval_status: string | null;
    annex_approval_status: string | null;
    payment_method: string | null;
    payment_status: string | null;
    service_request_id: string | null;
    created_at: string;
}

interface IdentityFile {
    id: string;
    service_request_id: string;
    file_type: string;
    file_path: string;
}

export function VisaContractApprovalPage() {
    const [orders, setOrders] = useState<VisaOrder[]>([]);
    const [idFiles, setIdFiles] = useState<Record<string, IdentityFile[]>>({});
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
    const [selectedPdfUrl, setSelectedPdfUrl] = useState<string | null>(null);
    const [selectedPdfTitle, setSelectedPdfTitle] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState(false);

    // Modais de aprovação/rejeição
    const [showApproveConfirm, setShowApproveConfirm] = useState(false);
    const [showRejectPrompt, setShowRejectPrompt] = useState(false);
    const [pendingItem, setPendingItem] = useState<{ id: string, type: 'contract' | 'annex' } | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');

    const loadOrders = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('visa_orders')
                .select('*')
                .or('contract_pdf_url.not.is.null,annex_pdf_url.not.is.null')
                .order('created_at', { ascending: false });

            if (error) throw error;

            const relevantOrders = (data || []).filter(order => {
                if (order.payment_method === 'zelle') {
                    return order.payment_status === 'completed';
                }
                return true;
            });

            setOrders(relevantOrders);

            // Fetch identity files for these orders
            const srIds = relevantOrders.map(o => o.service_request_id).filter(Boolean) as string[];
            if (srIds.length > 0) {
                const { data: filesData, error: filesError } = await supabase
                    .from('identity_files')
                    .select('*')
                    .in('service_request_id', srIds);

                if (!filesError && filesData) {
                    const filesMap: Record<string, IdentityFile[]> = {};
                    filesData.forEach(file => {
                        if (!filesMap[file.service_request_id]) filesMap[file.service_request_id] = [];
                        filesMap[file.service_request_id].push(file);
                    });
                    setIdFiles(filesMap);
                }
            }
        } catch (err) {
            console.error('Error loading visa contracts:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadOrders();
    }, []);

    const filteredOrders = orders.filter(order => {
        if (statusFilter === 'all') return true;

        const contractStatus = order.contract_approval_status || 'pending';
        const annexStatus = order.annex_approval_status || 'pending';

        if (statusFilter === 'pending') {
            return (order.contract_pdf_url && contractStatus === 'pending') ||
                (order.annex_pdf_url && annexStatus === 'pending');
        }

        return contractStatus === statusFilter || annexStatus === statusFilter;
    });

    const handleApprove = (id: string, type: 'contract' | 'annex') => {
        setPendingItem({ id, type });
        setShowApproveConfirm(true);
    };

    const handleReject = (id: string, type: 'contract' | 'annex') => {
        setPendingItem({ id, type });
        setRejectionReason('');
        setShowRejectPrompt(true);
    };

    const confirmApprove = async () => {
        if (!pendingItem) return;
        setIsProcessing(true);
        try {
            const user = await getCurrentUser();
            const reviewer = user?.email || user?.id || 'admin';

            const result = await approveVisaContract(pendingItem.id, reviewer, pendingItem.type);
            if (result.success) {
                await loadOrders();
                setShowApproveConfirm(false);
            } else {
                alert('Error: ' + result.error);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsProcessing(false);
        }
    };

    const confirmReject = async () => {
        if (!pendingItem) return;
        setIsProcessing(true);
        try {
            const user = await getCurrentUser();
            const reviewer = user?.email || user?.id || 'admin';

            const result = await rejectVisaContract(pendingItem.id, reviewer, rejectionReason, pendingItem.type);
            if (result.success) {
                await loadOrders();
                setShowRejectPrompt(false);
            } else {
                alert('Error: ' + result.error);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsProcessing(false);
        }
    };

    const StatusBadge = ({ status }: { status: string | null }) => {
        const s = status || 'pending';
        switch (s) {
            case 'approved':
                return <Badge className="bg-green-500/20 text-green-300 border-green-500/50">Approved</Badge>;
            case 'rejected':
                return <Badge className="bg-red-500/20 text-red-300 border-red-500/50">Rejected</Badge>;
            default:
                return <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/50">Pending</Badge>;
        }
    };

    const DocumentActionBlock = ({
        title,
        pdfUrl,
        status,
        orderId,
        type,
        clientName
    }: {
        title: string,
        pdfUrl: string | null,
        status: string | null,
        orderId: string,
        type: 'contract' | 'annex',
        clientName: string
    }) => {
        if (!pdfUrl) return null;

        const isPending = !status || status === 'pending';

        return (
            <div className="p-4 rounded-xl border border-gold-medium/20 bg-black/20 space-y-4">
                <div className="flex justify-between items-center">
                    <h4 className="text-sm font-semibold text-gold-light flex items-center gap-2">
                        <FileCheck className="w-4 h-4" />
                        {title}
                    </h4>
                    <StatusBadge status={status} />
                </div>

                <Button
                    variant="outline"
                    className="w-full justify-start gap-2 border-gold-medium/30 bg-black/30 hover:bg-gold-medium/10 text-gray-200"
                    onClick={() => {
                        setSelectedPdfUrl(pdfUrl);
                        setSelectedPdfTitle(`${title} - ${clientName}`);
                    }}
                >
                    <FileText className="w-4 h-4 text-gold-medium" />
                    View Document
                    <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
                </Button>

                {isPending && (
                    <div className="grid grid-cols-2 gap-2 pt-2">
                        <Button
                            size="sm"
                            onClick={() => handleApprove(orderId, type)}
                            className="bg-green-600 hover:bg-green-700 text-white text-xs gap-1"
                            disabled={isProcessing}
                        >
                            <Check className="w-3 h-3" />
                            Approve
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReject(orderId, type)}
                            className="border-red-500/50 text-red-400 hover:bg-red-500/10 text-xs gap-1"
                            disabled={isProcessing}
                        >
                            <X className="w-3 h-3" />
                            Reject
                        </Button>
                    </div>
                )}
            </div>
        );
    };

    const getDocumentUrl = (filePath: string): string => {
        if (filePath.startsWith('http')) return filePath;
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const bucketName = 'identity-photos';
        return `${supabaseUrl}/storage/v1/object/public/${bucketName}/${filePath}`;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="loader-gold"></div>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <div className="mb-8">
                <h1 className="text-2xl sm:text-3xl font-bold migma-gold-text mb-2">Visa Contract Approvals</h1>
                <p className="text-gray-400">Independently review and approve main contracts and service annexes.</p>
            </div>

            <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)} className="mb-6">
                <TabsList className="bg-black/50 border border-gold-medium/30">
                    <TabsTrigger value="pending" className="data-[state=active]:bg-gold-medium data-[state=active]:text-black">Pending Review</TabsTrigger>
                    <TabsTrigger value="approved" className="data-[state=active]:bg-gold-medium data-[state=active]:text-black">Approved</TabsTrigger>
                    <TabsTrigger value="rejected" className="data-[state=active]:bg-gold-medium data-[state=active]:text-black">Rejected</TabsTrigger>
                    <TabsTrigger value="all" className="data-[state=active]:bg-gold-medium data-[state=active]:text-black">All Orders</TabsTrigger>
                </TabsList>

                <div className="mt-6 space-y-6">
                    {filteredOrders.length === 0 ? (
                        <Card className="bg-black/40 border-gold-medium/20 py-12 text-center">
                            <p className="text-gray-500">No pending document reviews found.</p>
                        </Card>
                    ) : (
                        filteredOrders.map(order => (
                            <Card key={order.id} className="bg-gradient-to-br from-gold-light/5 to-gold-dark/10 border-gold-medium/30 overflow-hidden">
                                <CardHeader className="border-b border-gold-medium/10">
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                        <div>
                                            <CardTitle className="text-white text-lg flex items-center gap-2">
                                                <User className="w-5 h-5 text-gold-medium" />
                                                {order.client_name}
                                                <span className="text-sm font-mono text-gray-400 ml-2">#{order.order_number}</span>
                                            </CardTitle>
                                            <p className="text-sm text-gray-400 mt-1">{order.product_slug}</p>
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className="capitalize border-gold-medium/30 text-gold-light text-[10px]">
                                                    {order.payment_method || 'N/A'}
                                                </Badge>
                                                <div className="flex items-center gap-1 text-xs text-gray-500">
                                                    <Calendar className="w-3 h-3" />
                                                    {order.contract_signed_at ? new Date(order.contract_signed_at).toLocaleString() : 'N/A'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                        {/* Identification Records */}
                                        <div className="space-y-4">
                                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Identification</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {order.service_request_id && idFiles[order.service_request_id] ? (
                                                    idFiles[order.service_request_id].map(file => (
                                                        <a
                                                            key={file.id}
                                                            href={getDocumentUrl(file.file_path)}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="group relative w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden border border-gold-medium/30 bg-black/50 hover:border-gold-medium transition-colors"
                                                        >
                                                            <img src={getDocumentUrl(file.file_path)} alt={file.file_type} className="w-full h-full object-cover" />
                                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                                <ImageIcon className="w-6 h-6 text-white" />
                                                            </div>
                                                            <span className="absolute bottom-0 inset-x-0 bg-black/80 text-[10px] text-center text-white py-0.5 capitalize">
                                                                {file.file_type === 'document_front' ? 'Doc Front' :
                                                                    file.file_type === 'document_back' ? 'Doc Back' :
                                                                        file.file_type === 'selfie_doc' ? 'Selfie' :
                                                                            file.file_type.replace('_', ' ')}
                                                            </span>
                                                        </a>
                                                    ))
                                                ) : (
                                                    <p className="text-xs text-gray-500 italic">No photos found.</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Main Contract Action */}
                                        <div className="lg:col-span-1">
                                            <DocumentActionBlock
                                                title="Main Contract"
                                                pdfUrl={order.contract_pdf_url}
                                                status={order.contract_approval_status}
                                                orderId={order.id}
                                                type="contract"
                                                clientName={order.client_name}
                                            />
                                        </div>

                                        {/* Annex I Action */}
                                        <div className="lg:col-span-1">
                                            <DocumentActionBlock
                                                title="Annex I"
                                                pdfUrl={order.annex_pdf_url}
                                                status={order.annex_approval_status}
                                                orderId={order.id}
                                                type="annex"
                                                clientName={order.client_name}
                                            />
                                        </div>

                                        {/* Placeholder if only one exists to keep grid balanced */}
                                        {(!order.contract_pdf_url || !order.annex_pdf_url) && (
                                            <div className="hidden lg:block"></div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </Tabs>

            {/* Approve Confirm Dialog */}
            <Dialog open={showApproveConfirm} onOpenChange={setShowApproveConfirm}>
                <DialogContent className="bg-black border border-gold-medium/50 text-white shadow-2xl max-w-md">
                    <DialogHeader>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="bg-green-500/20 p-2 rounded-full">
                                <Check className="w-6 h-6 text-green-400" />
                            </div>
                            <DialogTitle className="text-xl font-bold">Approve {pendingItem?.type === 'annex' ? 'Annex I' : 'Main Contract'}</DialogTitle>
                        </div>
                        <DialogDescription className="text-gray-300 text-base leading-relaxed">
                            Confirm that this document is correctly signed and valid. The client will be notified immediately.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-4 gap-2 sm:gap-0">
                        <Button
                            variant="ghost"
                            onClick={() => setShowApproveConfirm(false)}
                            disabled={isProcessing}
                            className="text-gray-400 hover:text-white hover:bg-white/10"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={confirmApprove}
                            className="bg-green-600 hover:bg-green-700 text-white font-bold px-6 shadow-[0_0_15px_rgba(22,163,74,0.4)]"
                            disabled={isProcessing}
                        >
                            {isProcessing ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Processing...
                                </div>
                            ) : 'Yes, Approve'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reject Prompt Dialog */}
            <Dialog open={showRejectPrompt} onOpenChange={setShowRejectPrompt}>
                <DialogContent className="bg-black border border-gold-medium/50 text-white shadow-2xl max-w-md">
                    <DialogHeader>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="bg-red-500/20 p-2 rounded-full">
                                <X className="w-6 h-6 text-red-400" />
                            </div>
                            <DialogTitle className="text-xl font-bold">Reject {pendingItem?.type === 'annex' ? 'Annex I' : 'Main Contract'}</DialogTitle>
                        </div>
                        <DialogDescription className="text-gray-300 text-base">
                            The client will receive an email with instructions to resubmit.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="my-4">
                        <label className="text-sm font-semibold text-gray-400 mb-2 block uppercase tracking-wider text-[10px]">Reason for Rejection</label>
                        <Textarea
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            placeholder="Ex: Signature is missing on page 3..."
                            className="bg-white/5 border-white/10 focus:border-gold-medium/50 text-white min-h-[100px] resize-none"
                        />
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            variant="ghost"
                            onClick={() => setShowRejectPrompt(false)}
                            disabled={isProcessing}
                            className="text-gray-400 hover:text-white hover:bg-white/10"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={confirmReject}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold px-6 shadow-[0_0_15px_rgba(220,38,38,0.4)]"
                            disabled={isProcessing || !rejectionReason.trim()}
                        >
                            {isProcessing ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Processing...
                                </div>
                            ) : 'Reject Document'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* PDF View Modal */}
            {selectedPdfUrl && (
                <PdfModal
                    isOpen={!!selectedPdfUrl}
                    onClose={() => setSelectedPdfUrl(null)}
                    pdfUrl={selectedPdfUrl}
                    title={selectedPdfTitle}
                />
            )}
        </div>
    );
}
