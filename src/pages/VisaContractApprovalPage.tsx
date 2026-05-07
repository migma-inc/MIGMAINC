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
    FileCheck,
    Search
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
import { Input } from '@/components/ui/input';

const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

interface VisaOrder {
    id: string;
    order_number: string;
    seller_id: string | null;
    product_slug: string;
    upsell_product_slug?: string | null;
    client_name: string;
    client_email: string;
    contract_pdf_url: string | null;
    annex_pdf_url: string | null;
    upsell_contract_pdf_url?: string | null;
    upsell_annex_pdf_url?: string | null;
    contract_selfie_url: string | null;
    contract_document_url: string | null;
    contract_document_back_url?: string | null;
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
    // Approval details
    contract_approval_reviewed_by?: string | null;
    contract_approval_reviewed_at?: string | null;
    annex_approval_reviewed_by?: string | null;
    annex_approval_reviewed_at?: string | null;
    upsell_contract_approval_reviewed_by?: string | null;
    upsell_contract_approval_reviewed_at?: string | null;
    upsell_annex_approval_reviewed_by?: string | null;
    upsell_annex_approval_reviewed_at?: string | null;
}

interface IdentityFile {
    id: string;
    service_request_id: string;
    file_type: string;
    file_path: string;
    file_size?: number | null;
}

const APPROVAL_STATUS_COLUMN = {
    contract: 'contract_approval_status',
    annex: 'annex_approval_status',
    upsell_contract: 'upsell_contract_approval_status',
    upsell_annex: 'upsell_annex_approval_status',
} as const;

export function VisaContractApprovalPage() {
    const [orders, setOrders] = useState<VisaOrder[]>([]);
    const [idFiles, setIdFiles] = useState<Record<string, IdentityFile[]>>({});
    const [products, setProducts] = useState<any[]>([]);
    const [sellers, setSellers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
    const [searchTerm, setSearchTerm] = useState('');
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
        reviewer?: string,
    ) => {
        const reviewedAt = new Date().toISOString();

        setOrders(prev => prev.map(order => {
            if (order.id !== orderId) return order;

            switch (type) {
                case 'annex':
                    return {
                        ...order,
                        annex_approval_status: nextStatus,
                        annex_approval_reviewed_by: reviewer || order.annex_approval_reviewed_by,
                        annex_approval_reviewed_at: reviewedAt,
                    };
                case 'upsell_contract':
                    return {
                        ...order,
                        upsell_contract_approval_status: nextStatus,
                        upsell_contract_approval_reviewed_by: reviewer || order.upsell_contract_approval_reviewed_by,
                        upsell_contract_approval_reviewed_at: reviewedAt,
                    };
                case 'upsell_annex':
                    return {
                        ...order,
                        upsell_annex_approval_status: nextStatus,
                        upsell_annex_approval_reviewed_by: reviewer || order.upsell_annex_approval_reviewed_by,
                        upsell_annex_approval_reviewed_at: reviewedAt,
                    };
                default:
                    return {
                        ...order,
                        contract_approval_status: nextStatus,
                        contract_approval_reviewed_by: reviewer || order.contract_approval_reviewed_by,
                        contract_approval_reviewed_at: reviewedAt,
                    };
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
            const loadQuery = supabase
                .from('visa_orders')
                .select('*')
                .or('contract_pdf_url.not.is.null,annex_pdf_url.not.is.null,upsell_contract_pdf_url.not.is.null,upsell_annex_pdf_url.not.is.null')
                .order('created_at', { ascending: false });

            // In production, filter out test orders
            const { data, error } = await (isLocal ? loadQuery : loadQuery.eq('is_test', false));

            if (error) throw error;

            const relevantOrders = (data || []).filter(order => {
                if (order.payment_method === 'zelle') {
                    return order.payment_status === 'completed';
                }
                return true;
            });

            setOrders(relevantOrders);

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

            // Fetch sellers to map names and Heads of Sales
            const { data: sellersData } = await supabase
                .from('sellers')
                .select('id, full_name, seller_id_public, head_of_sales_id, email');
            setSellers(sellersData || []);
        } catch (err) {
            console.error('Error loading visa contracts:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadOrders();
    }, []);

    const getProductName = (slug: string) => {
        return products.find(p => p.slug === slug)?.name || slug;
    };

    const normalizedSearch = searchTerm.trim().toLowerCase();

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
    }).filter(order => {
        if (!normalizedSearch) return true;

        const sellerName = sellers.find(s => s.seller_id_public === order.seller_id)?.full_name || '';
        const productName = getProductName(order.product_slug);
        const upsellProductName = order.upsell_product_slug ? getProductName(order.upsell_product_slug) : '';

        const haystack = [
            order.client_name,
            order.client_email,
            order.order_number,
            order.product_slug,
            productName,
            order.upsell_product_slug || '',
            upsellProductName,
            order.seller_id || '',
            sellerName,
        ].join(' ').toLowerCase();

        return haystack.includes(normalizedSearch);
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

    const confirmApprove = async () => {
        if (!pendingItem) return;
        setIsProcessing(true);
        try {
            const user = await getCurrentUser();
            const reviewer = user?.email || user?.id || 'admin';
            const request = approveVisaContract(pendingItem.id, reviewer, pendingItem.type);
            const persisted = await waitForPersistedStatus(pendingItem.id, pendingItem.type, 'approved');
            const result = await request;

            if (result.success || persisted) {
                applyLocalStatusUpdate(pendingItem.id, pendingItem.type, 'approved', reviewer);
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

    const ImageWithSkeleton = ({ src, alt, className }: { src: string, alt: string, className: string }) => {
        const [isLoaded, setIsLoaded] = useState(false);
        const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
        const [hasError, setHasError] = useState(false);

        useEffect(() => {
            const resolve = async () => {
                setHasError(false);
                setIsLoaded(false);
                const url = await getSecureUrl(src);
                setResolvedUrl(url);
            };
            resolve();
        }, [src]);

        if (!resolvedUrl) {
            return <Skeleton className={cn("w-full h-full", className)} />;
        }

        if (hasError) {
            return (
                <div className={cn("flex h-full w-full items-center justify-center bg-black/70 p-2 text-center text-[11px] text-red-300", className)}>
                    Failed to load image
                </div>
            );
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
                    onError={() => setHasError(true)}
                />
            </div>
        );
    };

    const confirmReject = async () => {
        if (!pendingItem) return;
        setIsProcessing(true);
        try {
            const user = await getCurrentUser();
            const reviewer = user?.email || user?.id || 'admin';
            const request = rejectVisaContract(pendingItem.id, reviewer, rejectionReason, pendingItem.type);
            const persisted = await waitForPersistedStatus(pendingItem.id, pendingItem.type, 'rejected');
            const result = await request;

            if (result.success || persisted) {
                applyLocalStatusUpdate(pendingItem.id, pendingItem.type, 'rejected', reviewer);
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
        clientName,
        reviewedBy,
        reviewedAt
    }: {
        title: string,
        pdfUrl: string | null,
        status: string | null,
        orderId: string,
        type: 'contract' | 'annex' | 'upsell_contract' | 'upsell_annex',
        clientName: string,
        reviewedBy?: string | null,
        reviewedAt?: string | null
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

                {status === 'approved' && reviewedBy && (
                    <div className="pt-1 flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-[10px] text-green-400 font-medium bg-green-500/5 p-1.5 rounded-lg border border-green-500/10">
                            <Check className="w-3 h-3" />
                            <span>Aprovado por: <span className="text-white">
                                {sellers.find(s => s.email === reviewedBy)?.full_name || reviewedBy}
                            </span></span>
                        </div>
                        {reviewedAt && (
                            <span className="text-[9px] text-gray-500 ml-4.5 italic">
                                em {new Date(reviewedAt).toLocaleString('pt-BR')}
                            </span>
                        )}
                    </div>
                )}

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
        // Se já for uma URL completa, retorna
        if (file.file_path.startsWith('http')) return file.file_path;

        // Caso contrário, retorna o caminho relativo que o getSecureUrl entende
        // O getSecureUrl do storage.ts já tem lógica para identificar buckets se passarmos "bucket/path"
        // ou se passarmos apenas o path (ele tenta adivinhar).
        // Aqui os arquivos de identidade costumam estar no bucket 'identity-photos'
        return `identity-photos/${file.file_path}`;
    };

    const isRenderableIdentityFile = (file: IdentityFile) => {
        return !!file.file_path && (file.file_size == null || file.file_size > 0);
    };

    if (loading) {
        return (
            <div className="p-4 sm:p-6 lg:p-8 space-y-8 animate-in fade-in duration-500">
                <div className="space-y-4">
                    <Skeleton className="h-10 w-64" />
                    <Skeleton className="h-4 w-96" />
                </div>

                <div className="flex gap-2">
                    <Skeleton className="h-10 w-32" />
                    <Skeleton className="h-10 w-32" />
                    <Skeleton className="h-10 w-32" />
                </div>

                <div className="space-y-6">
                    {[1, 2, 3].map((i) => (
                        <Card key={i} className="bg-zinc-900/40 border-white/5 overflow-hidden">
                            <CardHeader className="border-b border-white/5 pb-4">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Skeleton className="h-5 w-5 rounded-full" />
                                            <Skeleton className="h-6 w-48" />
                                        </div>
                                        <Skeleton className="h-4 w-32" />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Skeleton className="h-5 w-16 px-2" />
                                        <Skeleton className="h-5 w-32" />
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                    <div className="space-y-4">
                                        <Skeleton className="h-3 w-24" />
                                        <div className="flex gap-2">
                                            <Skeleton className="w-20 h-20 rounded-lg" />
                                            <Skeleton className="w-20 h-20 rounded-lg" />
                                            <Skeleton className="w-20 h-20 rounded-lg" />
                                        </div>
                                    </div>
                                    {[1, 2].map((j) => (
                                        <div key={j} className="p-4 rounded-xl border border-white/5 bg-white/5 space-y-4">
                                            <div className="flex justify-between items-center">
                                                <Skeleton className="h-4 w-24" />
                                                <Skeleton className="h-5 w-16" />
                                            </div>
                                            <Skeleton className="h-10 w-full" />
                                            <div className="grid grid-cols-2 gap-2 pt-2">
                                                <Skeleton className="h-8 w-full" />
                                                <Skeleton className="h-8 w-full" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold migma-gold-text mb-2">Visa Contract Approvals</h1>
                    <p className="text-gray-400">Independently review and approve main contracts and service annexes.</p>
                </div>
                <div className="relative w-full lg:max-w-sm">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                    <Input
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar cliente, e-mail, pedido, vendedor..."
                        className="border-gold-medium/30 bg-black/40 pl-10 text-white placeholder:text-gray-500"
                    />
                </div>
            </div>

            <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)} className="mb-6">
                <TabsList className="bg-black/50 border border-gold-medium/30">
                    <TabsTrigger value="pending" className="data-[state=active]:bg-gold-medium data-[state=active]:text-black">Pendentes</TabsTrigger>
                    <TabsTrigger value="approved" className="data-[state=active]:bg-gold-medium data-[state=active]:text-black">Aprovados</TabsTrigger>
                    <TabsTrigger value="rejected" className="data-[state=active]:bg-gold-medium data-[state=active]:text-black">Rejeitados</TabsTrigger>
                    <TabsTrigger value="all" className="data-[state=active]:bg-gold-medium data-[state=active]:text-black">Todos</TabsTrigger>
                </TabsList>

                <div className="mt-6 space-y-6">
                    {filteredOrders.length === 0 ? (
                        <Card className="bg-black/40 border-gold-medium/20 py-12 text-center">
                            <p className="text-gray-500">
                                {statusFilter === 'pending' ? 'Nenhum contrato pendente de aprovação.' : 
                                 statusFilter === 'approved' ? 'Nenhum contrato aprovado encontrado.' :
                                 statusFilter === 'rejected' ? 'Nenhum contrato rejeitado encontrado.' :
                                 'Nenhum contrato encontrado.'}
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
                                            <p className="text-sm text-gray-400 mt-1">{getProductName(order.product_slug)}</p>
                                            
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3">
                                                {/* Seller Name */}
                                                <div className="flex items-center gap-1.5 text-xs text-gray-300">
                                                    <span className="text-gray-500 uppercase text-[9px] font-bold">Vendedor:</span>
                                                    <span className="font-semibold text-white">
                                                        {sellers.find(s => s.seller_id_public === order.seller_id)?.full_name || order.seller_id || 'N/A'}
                                                    </span>
                                                </div>

                                                {/* Head of Sales Name */}
                                                {(() => {
                                                    const sellerData = sellers.find(s => s.seller_id_public === order.seller_id);
                                                    if (sellerData?.head_of_sales_id) {
                                                        const hos = sellers.find(h => h.id === sellerData.head_of_sales_id);
                                                        return (
                                                            <div className="flex items-center gap-1.5 text-xs text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
                                                                <span className="text-[9px] font-bold uppercase">Head of Sales:</span>
                                                                <span className="font-bold">
                                                                    {hos?.full_name || 'Desconhecido'}
                                                                </span>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                })()}
                                            </div>
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
                                                {(() => {
                                                    const idFileList = order.service_request_id ? (idFiles[order.service_request_id] || []) : [];
                                                    const validIdFiles = idFileList.filter(isRenderableIdentityFile);
                                                    const invalidIdFiles = idFileList.filter(file => !isRenderableIdentityFile(file));
                                                    // Fallback: usar contract_document_url e contract_selfie_url direto do order (MigmaCheckout)
                                                    const fallbackPhotos: Array<{ url: string; label: string }> = [];
                                                    if (validIdFiles.length === 0) {
                                                        if (order.contract_document_url) fallbackPhotos.push({ url: order.contract_document_url, label: 'Doc Front' });
                                                        if (order.contract_document_back_url) fallbackPhotos.push({ url: order.contract_document_back_url, label: 'Doc Back' });
                                                        if (order.contract_selfie_url) fallbackPhotos.push({ url: order.contract_selfie_url, label: 'Selfie' });
                                                    }

                                                    if (validIdFiles.length > 0 || invalidIdFiles.length > 0) {
                                                        return [...validIdFiles, ...invalidIdFiles].map(file => (
                                                            <div
                                                                key={file.id}
                                                                onClick={async () => {
                                                                    if (!isRenderableIdentityFile(file)) return;
                                                                    const secureUrl = await getSecureUrl(getDocumentUrl(file));
                                                                    setSelectedImageUrl(secureUrl);
                                                                    setSelectedImageTitle(`${file.file_type.replace('_', ' ').toUpperCase()} - ${order.client_name}`);
                                                                }}
                                                                className="group relative cursor-pointer w-28 h-28 sm:w-32 sm:h-32 rounded-lg overflow-hidden border border-gold-medium/30 bg-black/50 hover:border-gold-medium transition-all hover:scale-105 duration-300 shadow-lg shadow-black/50"
                                                            >
                                                                {isRenderableIdentityFile(file) ? (
                                                                    <ImageWithSkeleton src={getDocumentUrl(file)} alt={file.file_type} className="w-full h-full" />
                                                                ) : (
                                                                    <div className="flex h-full w-full items-center justify-center bg-black/80 p-2 text-center text-[11px] text-red-300">
                                                                        Invalid file
                                                                    </div>
                                                                )}
                                                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                                    <ImageIcon className="w-6 h-6 text-white" />
                                                                </div>
                                                                <span className="absolute bottom-0 inset-x-0 bg-black/80 text-[10px] text-center text-white py-0.5 capitalize z-10">
                                                                    {file.file_type === 'document_front' ? 'Doc Front' : file.file_type === 'document_back' ? 'Doc Back' : file.file_type === 'selfie_doc' ? 'Selfie' : file.file_type.replace('_', ' ')}
                                                                </span>
                                                            </div>
                                                        ));
                                                    } else if (fallbackPhotos.length > 0) {
                                                        return fallbackPhotos.map((photo, i) => (
                                                            <div
                                                                key={i}
                                                                onClick={async () => {
                                                                    const secureUrl = await getSecureUrl(photo.url);
                                                                    setSelectedImageUrl(secureUrl);
                                                                    setSelectedImageTitle(`${photo.label} - ${order.client_name}`);
                                                                }}
                                                                className="group relative cursor-pointer w-28 h-28 sm:w-32 sm:h-32 rounded-lg overflow-hidden border border-gold-medium/30 bg-black/50 hover:border-gold-medium transition-all hover:scale-105 duration-300 shadow-lg shadow-black/50"
                                                            >
                                                                <ImageWithSkeleton src={photo.url} alt={photo.label} className="w-full h-full" />
                                                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                                    <ImageIcon className="w-6 h-6 text-white" />
                                                                </div>
                                                                <span className="absolute bottom-0 inset-x-0 bg-black/80 text-[10px] text-center text-white py-0.5 capitalize z-10">{photo.label}</span>
                                                            </div>
                                                        ));
                                                    } else {
                                                        return <p className="text-xs text-gray-500 italic">No photos found.</p>;
                                                    }
                                                })()}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:col-span-3">
                                            {/* Main Contract Action */}
                                            {order.product_slug !== 'consultation-common' && (
                                                <DocumentActionBlock
                                                    title="Main Contract"
                                                    pdfUrl={order.contract_pdf_url}
                                                    status={order.contract_approval_status}
                                                    orderId={order.id}
                                                    type="contract"
                                                    clientName={order.client_name}
                                                    reviewedBy={order.contract_approval_reviewed_by}
                                                    reviewedAt={order.contract_approval_reviewed_at}
                                                />
                                            )}

                                            {/* Annex I Action */}
                                            <DocumentActionBlock
                                                title="Annex I"
                                                pdfUrl={order.annex_pdf_url}
                                                status={order.annex_approval_status}
                                                orderId={order.id}
                                                type="annex"
                                                clientName={order.client_name}
                                                reviewedBy={order.annex_approval_reviewed_by}
                                                reviewedAt={order.annex_approval_reviewed_at}
                                            />


                                            {/* Upsell Contract Action */}
                                            <DocumentActionBlock
                                                title={`Contract (${order.upsell_product_slug || 'Upsell'})`}
                                                pdfUrl={order.upsell_contract_pdf_url || null}
                                                status={order.upsell_contract_approval_status || null}
                                                orderId={order.id}
                                                type="upsell_contract"
                                                clientName={order.client_name}
                                                reviewedBy={order.upsell_contract_approval_reviewed_by}
                                                reviewedAt={order.upsell_contract_approval_reviewed_at}
                                            />

                                            {/* Upsell Annex Action */}
                                            <DocumentActionBlock
                                                title={`Annex I (${order.upsell_product_slug || 'Upsell'})`}
                                                pdfUrl={order.upsell_annex_pdf_url || null}
                                                status={order.upsell_annex_approval_status || null}
                                                orderId={order.id}
                                                type="upsell_annex"
                                                clientName={order.client_name}
                                                reviewedBy={order.upsell_annex_approval_reviewed_by}
                                                reviewedAt={order.upsell_annex_approval_reviewed_at}
                                            />
                                        </div>
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
                            <DialogTitle className="text-xl font-bold">Approve {pendingItem?.type.replace('_', ' ').toUpperCase()}</DialogTitle>
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
                            <DialogTitle className="text-xl font-bold">Reject {pendingItem?.type.replace('_', ' ').toUpperCase()}</DialogTitle>
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

            {/* Image View Modal */}
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
