import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PdfModal } from '@/components/ui/pdf-modal';
import { ImageModal } from '@/components/ui/image-modal';
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
import { getSecureUrl } from '@/lib/storage';
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
import { Skeleton } from '@/components/ui/skeleton';
import { useOutletContext } from 'react-router-dom';
import type { SellerInfo } from '@/types/seller';
import { useDashboardCache } from '@/contexts/DashboardCacheContext';

interface VisaOrder {
    id: string;
    order_number: string;
    product_slug: string;
    upsell_product_slug?: string | null;
    client_name: string;
    client_email: string;
    seller_id: string;
    contract_pdf_url: string | null;
    annex_pdf_url: string | null;
    upsell_contract_pdf_url?: string | null;
    upsell_annex_pdf_url?: string | null;
    contract_selfie_url: string | null;
    contract_document_url: string | null;
    contract_signed_at: string | null;
    contract_approval_status: string | null;
    annex_approval_status: string | null;
    upsell_contract_approval_status?: string | null;
    upsell_annex_approval_status?: string | null;
    payment_method: string | null;
    payment_status: string | null;
    service_request_id: string | null;
    payment_metadata?: any | null;
    created_at: string;
    seller_name?: string;
}

interface IdentityFile {
    id: string;
    service_request_id: string;
    file_type: string;
    file_path: string;
}

const APPROVAL_STATUS_COLUMN = {
    contract: 'contract_approval_status',
    annex: 'annex_approval_status',
    upsell_contract: 'upsell_contract_approval_status',
    upsell_annex: 'upsell_annex_approval_status',
} as const;

export function HosVisaContractApprovalPage() {
    const { seller } = useOutletContext<{ seller: SellerInfo }>();
    const { cache, setCacheValue } = useDashboardCache();
    const [orders, setOrders] = useState<VisaOrder[]>(cache.approvals || []);
    const [idFiles, setIdFiles] = useState<Record<string, IdentityFile[]>>({});
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(!cache.approvals);
    const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
    const [selectedPdfUrl, setSelectedPdfUrl] = useState<string | null>(null);
    const [selectedPdfTitle, setSelectedPdfTitle] = useState<string>('');
    const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
    const [selectedImageTitle, setSelectedImageTitle] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState(false);

    // Modais de aprovação/rejeição
    const [showApproveConfirm, setShowApproveConfirm] = useState(false);
    const [showRejectPrompt, setShowRejectPrompt] = useState(false);
    const [pendingItem, setPendingItem] = useState<{ id: string, type: 'contract' | 'annex' | 'upsell_contract' | 'upsell_annex' } | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');

    const applyLocalStatusUpdate = (
        orderId: string,
        type: 'contract' | 'annex' | 'upsell_contract' | 'upsell_annex',
        nextStatus: 'approved' | 'rejected',
    ) => {
        setOrders(prev => prev.map(order => {
            if (order.id !== orderId) return order;

            switch (type) {
                case 'annex':
                    return { ...order, annex_approval_status: nextStatus };
                case 'upsell_contract':
                    return { ...order, upsell_contract_approval_status: nextStatus };
                case 'upsell_annex':
                    return { ...order, upsell_annex_approval_status: nextStatus };
                default:
                    return { ...order, contract_approval_status: nextStatus };
            }
        }));
    };

    const waitForPersistedStatus = async (
        orderId: string,
        type: 'contract' | 'annex' | 'upsell_contract' | 'upsell_annex',
        expectedStatus: 'approved' | 'rejected',
        timeoutMs = 12000,
    ) => {
        const statusColumn = APPROVAL_STATUS_COLUMN[type];
        const startTime = Date.now();

        while (Date.now() - startTime < timeoutMs) {
            const { data, error } = await supabase
                .from('visa_orders')
                .select(statusColumn)
                .eq('id', orderId)
                .single();

            const statusValue = (data as Record<string, string | null> | null)?.[statusColumn];
            if (!error && statusValue === expectedStatus) {
                return true;
            }

            await new Promise(resolve => setTimeout(resolve, 800));
        }

        return false;
    };

    const loadOrders = async () => {
        try {
            setLoading(true);
            
            // 1. Buscar membros do time para obter seus seller_id_public
            const { data: teamMembers } = await supabase
                .from('sellers')
                .select('seller_id_public, full_name')
                .eq('head_of_sales_id', seller.id);

            if (!teamMembers || teamMembers.length === 0) {
                setOrders([]);
                setLoading(false);
                return;
            }

            const sellerMap = teamMembers.reduce((acc, current) => {
                acc[current.seller_id_public] = current.full_name;
                return acc;
            }, {} as Record<string, string>);

            // 1.5 Incluir os vendedores liderados + Ele Próprio (O próprio gerente)
            const sellerPublicIds = teamMembers.map(m => m.seller_id_public);
            if (seller.seller_id_public) {
                sellerPublicIds.push(seller.seller_id_public);
                sellerMap[seller.seller_id_public] = seller.full_name || 'Own Sale (You)';
            }

            // 2. Buscar pedidos vinculados a esses vendedores
            let query = supabase
                .from('visa_orders')
                .select('*')
                .in('seller_id', sellerPublicIds)
                .or('contract_pdf_url.not.is.null,annex_pdf_url.not.is.null,upsell_contract_pdf_url.not.is.null,upsell_annex_pdf_url.not.is.null')
                .order('created_at', { ascending: false });

            // Removido o filtro de ambiente de teste para permitir validações em homologação/prod
            // if (!isTestEnvironment()) {
            //     query = query.eq('is_test', false);
            // }

            const { data, error } = await query;

            if (error) throw error;

            const relevantOrders = (data || []).filter(order => {
                if (order.payment_method === 'zelle') {
                    return order.payment_status === 'completed';
                }
                return true;
            }).map(order => ({
                ...order,
                seller_name: sellerMap[order.seller_id] || order.seller_id
            }));

            setOrders(relevantOrders);
            setCacheValue('approvals', relevantOrders);

            // Fetch products for names
            const { data: productsData } = await supabase
                .from('visa_products')
                .select('slug, name');
            setProducts(productsData || []);

            // Fetch identity files for these orders
            const srIds = relevantOrders.map(o => o.service_request_id).filter(Boolean) as string[];
            if (srIds.length > 0) {
                const { data: filesData } = await supabase
                    .from('identity_files')
                    .select('*')
                    .in('service_request_id', srIds);

                if (filesData) {
                    const filesMap: Record<string, IdentityFile[]> = {};
                    filesData.forEach(file => {
                        if (!filesMap[file.service_request_id]) filesMap[file.service_request_id] = [];
                        filesMap[file.service_request_id].push(file);
                    });
                    setIdFiles(filesMap);
                }
            }
        } catch (err) {
            console.error('Error loading team visa contracts:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (seller?.id) {
            loadOrders();
        }
    }, [seller?.id]);

    const filteredOrders = orders.filter(order => {
        if (statusFilter === 'all') return true;

        const contractStatus = order.contract_approval_status || 'pending';
        const annexStatus = order.annex_approval_status || 'pending';
        const upsellContractStatus = order.upsell_contract_approval_status || 'pending';
        const upsellAnnexStatus = order.upsell_annex_approval_status || 'pending';

        if (statusFilter === 'pending') {
            return (order.contract_pdf_url && contractStatus === 'pending') ||
                (order.annex_pdf_url && annexStatus === 'pending') ||
                (order.upsell_contract_pdf_url && upsellContractStatus === 'pending') ||
                (order.upsell_annex_pdf_url && upsellAnnexStatus === 'pending');
        }

        return contractStatus === statusFilter ||
            annexStatus === statusFilter ||
            upsellContractStatus === statusFilter ||
            upsellAnnexStatus === statusFilter;
    });

    const handleApprove = (id: string, type: 'contract' | 'annex' | 'upsell_contract' | 'upsell_annex') => {
        setPendingItem({ id, type });
        setShowApproveConfirm(true);
    };

    const handleReject = (id: string, type: 'contract' | 'annex' | 'upsell_contract' | 'upsell_annex') => {
        setPendingItem({ id, type });
        setRejectionReason('');
        setShowRejectPrompt(true);
    };

    const getProductName = (slug: string) => {
        return products.find(p => p.slug === slug)?.name || slug;
    };

    const confirmApprove = async () => {
        if (!pendingItem) return;
        setIsProcessing(true);
        try {
            const user = await getCurrentUser();
            const reviewer = user?.email || user?.id || 'hos';
            const request = approveVisaContract(pendingItem.id, reviewer, pendingItem.type);
            const persisted = await waitForPersistedStatus(pendingItem.id, pendingItem.type, 'approved');
            const result = await request;

            if (result.success || persisted) {
                applyLocalStatusUpdate(pendingItem.id, pendingItem.type, 'approved');
                setShowApproveConfirm(false);
                setPendingItem(null);
                void loadOrders();
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
            const reviewer = user?.email || user?.id || 'hos';
            const request = rejectVisaContract(pendingItem.id, reviewer, rejectionReason, pendingItem.type);
            const persisted = await waitForPersistedStatus(pendingItem.id, pendingItem.type, 'rejected');
            const result = await request;

            if (result.success || persisted) {
                applyLocalStatusUpdate(pendingItem.id, pendingItem.type, 'rejected');
                setShowRejectPrompt(false);
                setPendingItem(null);
                setRejectionReason('');
                void loadOrders();
            } else {
                alert('Error: ' + result.error);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsProcessing(false);
        }
    };

    const ImageWithSkeleton = ({ src, alt, className }: { src: string, alt: string, className: string }) => {
        const [isLoaded, setIsLoaded] = useState(false);
        const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);

        useEffect(() => {
            const resolve = async () => {
                const url = await getSecureUrl(src);
                setResolvedUrl(url);
            };
            resolve();
        }, [src]);

        if (!resolvedUrl) {
            return <Skeleton className={cn("w-full h-full", className)} />;
        }

        return (
            <div className={cn("relative overflow-hidden", className)}>
                {!isLoaded && (
                    <Skeleton className="absolute inset-0 w-full h-full" />
                )}
                <img
                    src={resolvedUrl}
                    alt={alt}
                    className={cn(
                        "w-full h-full object-cover transition-opacity duration-500",
                        isLoaded ? "opacity-100" : "opacity-0"
                    )}
                    onLoad={() => setIsLoaded(true)}
                />
            </div>
        );
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
        type: 'contract' | 'annex' | 'upsell_contract' | 'upsell_annex',
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

    const getDocumentUrl = (file: IdentityFile): string => {
        if (file.file_path.startsWith('http')) return file.file_path;
        return `identity-photos/${file.file_path}`;
    };

    const SkeletonCard = () => (
        <Card className="bg-black/40 border-gold-medium/20 overflow-hidden">
            <CardHeader className="border-b border-gold-medium/10">
                <div className="flex justify-between items-center">
                    <div className="space-y-2">
                        <Skeleton className="h-6 w-48" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                    <Skeleton className="h-10 w-24" />
                </div>
            </CardHeader>
            <CardContent className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    <div className="lg:col-span-1 border-r border-gold-medium/10 pr-6 space-y-4">
                        <Skeleton className="h-4 w-20" />
                        <div className="grid grid-cols-2 gap-2">
                            <Skeleton className="aspect-square w-full rounded-lg" />
                            <Skeleton className="aspect-square w-full rounded-lg" />
                        </div>
                    </div>
                    <div className="lg:col-span-3 space-y-4">
                        <Skeleton className="h-4 w-24" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Skeleton className="h-32 w-full rounded-xl" />
                            <Skeleton className="h-32 w-full rounded-xl" />
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                        <FileCheck className="w-8 h-8 text-gold-medium" />
                        Contract Approval (Team)
                    </h1>
                    <p className="text-gray-400 mt-1">
                        Review and approve the contracts signed by your sellers' clients.
                    </p>
                </div>
            </div>

            <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)} className="w-full">
                <TabsList className="bg-black/50 border border-gold-medium/30">
                    <TabsTrigger value="pending" className="data-[state=active]:bg-gold-medium data-[state=active]:text-black">Pending</TabsTrigger>
                    <TabsTrigger value="approved" className="data-[state=active]:bg-gold-medium data-[state=active]:text-black">Approved</TabsTrigger>
                    <TabsTrigger value="rejected" className="data-[state=active]:bg-gold-medium data-[state=active]:text-black">Rejected</TabsTrigger>
                    <TabsTrigger value="all" className="data-[state=active]:bg-gold-medium data-[state=active]:text-black">All</TabsTrigger>
                </TabsList>

                <div className="mt-6 space-y-6">
                    {loading && orders.length === 0 ? (
                        Array(3).fill(0).map((_, i) => <SkeletonCard key={i} />)
                    ) : filteredOrders.length === 0 ? (
                        <Card className="bg-black/40 border-gold-medium/20 py-12 text-center">
                            <p className="text-gray-500">
                                {statusFilter === 'pending' ? 'No contracts pending approval.' : 
                                 statusFilter === 'approved' ? 'No approved contracts found.' :
                                 statusFilter === 'rejected' ? 'No rejected contracts found.' :
                                 'No contracts found.'}
                            </p>
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
                                            <div className="flex items-center gap-3 mt-1">
                                                <p className="text-sm text-gray-400">{getProductName(order.product_slug)}</p>
                                                <span className="text-gray-600">•</span>
                                                <p className="text-sm text-purple-300 font-medium">Seller: {order.seller_name}</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-2 text-right">
                                            <Badge variant="outline" className="capitalize border-gold-medium/30 text-gold-light">
                                                {order.payment_method || 'N/A'}
                                            </Badge>
                                            <div className="flex items-center gap-1 text-xs text-gray-500">
                                                <Calendar className="w-3 h-3" />
                                                {order.contract_signed_at ? new Date(order.contract_signed_at).toLocaleString() : 'N/A'}
                                            </div>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-6">
                                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                                        {/* Fotos de Identidade */}
                                        <div className="lg:col-span-1 border-r border-gold-medium/10 pr-6">
                                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">Identification</h4>
                                            <div className="grid grid-cols-2 gap-2">
                                                {order.service_request_id && idFiles[order.service_request_id] ? (
                                                    idFiles[order.service_request_id].map(file => (
                                                        <div
                                                            key={file.id}
                                                            onClick={async () => {
                                                                const secureUrl = await getSecureUrl(getDocumentUrl(file));
                                                                setSelectedImageUrl(secureUrl);
                                                                setSelectedImageTitle(`${file.file_type.replace('_', ' ').toUpperCase()} - ${order.client_name}`);
                                                            }}
                                                            className="group relative cursor-pointer aspect-square rounded-lg overflow-hidden border border-gold-medium/30 bg-black/50 hover:border-gold-medium transition-all shadow-lg"
                                                        >
                                                            <ImageWithSkeleton
                                                                src={getDocumentUrl(file)}
                                                                alt={file.file_type}
                                                                className="w-full h-full"
                                                            />
                                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                                <ImageIcon className="w-6 h-6 text-white" />
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <p className="text-xs text-gray-500 italic">No photos sent.</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Ações de Documentos */}
                                        <div className="lg:col-span-3">
                                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">Documents</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {/* Contrato Principal */}
                                                {order.product_slug !== 'consultation-common' && (
                                                    <DocumentActionBlock
                                                        title="Main Contract"
                                                        pdfUrl={order.contract_pdf_url}
                                                        status={order.contract_approval_status}
                                                        orderId={order.id}
                                                        type="contract"
                                                        clientName={order.client_name}
                                                    />
                                                )}

                                                {/* Anexo I */}
                                                <DocumentActionBlock
                                                    title="Annex I"
                                                    pdfUrl={order.annex_pdf_url}
                                                    status={order.annex_approval_status}
                                                    orderId={order.id}
                                                    type="annex"
                                                    clientName={order.client_name}
                                                />

                                                {/* Contrato Upsell */}
                                                <DocumentActionBlock
                                                    title={`Contract (${order.upsell_product_slug || 'Upsell'})`}
                                                    pdfUrl={order.upsell_contract_pdf_url || null}
                                                    status={order.upsell_contract_approval_status || null}
                                                    orderId={order.id}
                                                    type="upsell_contract"
                                                    clientName={order.client_name}
                                                />

                                                {/* Anexo Upsell */}
                                                <DocumentActionBlock
                                                    title={`Annex I (${order.upsell_product_slug || 'Upsell'})`}
                                                    pdfUrl={order.upsell_annex_pdf_url || null}
                                                    status={order.upsell_annex_approval_status || null}
                                                    orderId={order.id}
                                                    type="upsell_annex"
                                                    clientName={order.client_name}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </Tabs>

            {/* Modais (Aprovação, Rejeição, PDF, Imagem) */}
            <Dialog open={showApproveConfirm} onOpenChange={setShowApproveConfirm}>
                <DialogContent className="bg-black border border-gold-medium/50 text-white shadow-2xl max-w-md">
                    <DialogHeader>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="bg-green-500/20 p-2 rounded-full">
                                <Check className="w-6 h-6 text-green-400" />
                            </div>
                            <DialogTitle className="text-xl font-bold">Approve Document</DialogTitle>
                        </div>
                        <DialogDescription className="text-gray-300 text-base leading-relaxed">
                            Confirm that the document is properly signed. The client will be notified of the approval.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-4 gap-2">
                        <Button variant="ghost" onClick={() => setShowApproveConfirm(false)} disabled={isProcessing}>Cancel</Button>
                        <Button onClick={confirmApprove} className="bg-green-600 hover:bg-green-700 text-white font-bold px-6" disabled={isProcessing}>
                            {isProcessing ? 'Processing...' : 'Confirm Approval'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={showRejectPrompt} onOpenChange={setShowRejectPrompt}>
                <DialogContent className="bg-black border border-gold-medium/50 text-white shadow-2xl max-w-md">
                    <DialogHeader>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="bg-red-500/20 p-2 rounded-full">
                                <X className="w-6 h-6 text-red-400" />
                            </div>
                            <DialogTitle className="text-xl font-bold">Reject Document</DialogTitle>
                        </div>
                        <DialogDescription className="text-gray-300 text-base">
                            The client will receive an email with the reason and instructions to resubmit.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="my-4">
                        <Textarea
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            placeholder="Reason for rejection (will be sent to the client)..."
                            className="bg-white/5 border-white/10 text-white min-h-[100px]"
                        />
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="ghost" onClick={() => setShowRejectPrompt(false)} disabled={isProcessing}>Cancel</Button>
                        <Button onClick={confirmReject} className="bg-red-600 hover:bg-red-700 text-white font-bold px-6" disabled={isProcessing || !rejectionReason.trim()}>
                            {isProcessing ? 'Processing...' : 'Confirm Rejection'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {selectedPdfUrl && (
                <PdfModal
                    isOpen={!!selectedPdfUrl}
                    onClose={() => setSelectedPdfUrl(null)}
                    pdfUrl={selectedPdfUrl}
                    title={selectedPdfTitle}
                />
            )}

            {selectedImageUrl && (
                <ImageModal
                    isOpen={!!selectedImageUrl}
                    onClose={() => {
                        setSelectedImageUrl(null);
                        setSelectedImageTitle('');
                    }}
                    imageUrl={selectedImageUrl}
                    title={selectedImageTitle}
                />
            )}
        </div>
    );
}
