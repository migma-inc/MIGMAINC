import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PdfModal } from '@/components/ui/pdf-modal';
import { ImageModal } from '@/components/ui/image-modal';
import { CheckCircle, XCircle, Clock, Eye } from 'lucide-react';
import { AlertModal } from '@/components/ui/alert-modal';

interface ZelleOrder {
    id: string;
    order_number: string;
    product_slug: string;
    seller_id: string | null;
    client_name: string;
    client_email: string;
    client_whatsapp: string | null;
    total_price_usd: string;
    payment_status: string;
    zelle_proof_url: string | null;
    contract_pdf_url: string | null;
    created_at: string;
    updated_at: string;
    payment_metadata?: {
        n8n_validation?: {
            response?: string;
            confidence?: number;
            status?: string;
        };
    };
    is_hidden?: boolean;
}

interface ZellePayment {
    id: string;
    payment_id: string;
    order_id: string;
    status: 'pending_verification' | 'approved' | 'rejected';
    n8n_response: any;
    n8n_confidence: number | null;
    n8n_validated_at: string | null;
    admin_notes: string | null;
}

interface MigmaPayment {
    id: string;
    user_id: string;
    fee_type_global: string;
    amount: number;
    confirmation_code: string | null;
    status: string;
    admin_notes: string | null;
    image_url: string | null;
    updated_at?: string;
    client_name?: string;
    client_email?: string;
    unification_key?: string;
}

export const SellerZelleApprovalPage = () => {
    const [sellerId, setSellerId] = useState<string | null>(null);
    const [zellePayments, setZellePayments] = useState<Record<string, ZellePayment>>({});
    const [loading, setLoading] = useState(true);
    const [selectedItem, setSelectedItem] = useState<any | null>(null);
    const [selectedPdfUrl, setSelectedPdfUrl] = useState<string | null>(null);
    const [selectedZelleUrl, setSelectedZelleUrl] = useState<string | null>(null);
    const [selectedZelleTitle, setSelectedZelleTitle] = useState<string>('Zelle Receipt');
    const [showApproveConfirm, setShowApproveConfirm] = useState(false);
    const [showRejectConfirm, setShowRejectConfirm] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [alertData, setAlertData] = useState<{ title: string; message: string; variant: 'success' | 'error' | 'warning' | 'info' } | null>(null);
    const [showAlert, setShowAlert] = useState(false);

    const [historyOrders, setHistoryOrders] = useState<ZelleOrder[]>([]);
    const [historyMigma, setHistoryMigma] = useState<MigmaPayment[]>([]);

    const [unifiedApprovals, setUnifiedApprovals] = useState<any[]>([]);

    useEffect(() => {
        fetchSellerAndLoadOrders();
    }, []);

    const fetchSellerAndLoadOrders = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: sellerData, error: sellerError } = await supabase
                .from('sellers')
                .select('seller_id_public')
                .eq('user_id', user.id)
                .single();

            if (sellerError || !sellerData) {
                console.error('Error fetching seller info:', sellerError);
                return;
            }

            setSellerId(sellerData.seller_id_public);
            await loadOrders(sellerData.seller_id_public);
        } catch (err) {
            console.error('Error in initialization:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleViewMigmaProof = async (userId: string, clientName?: string) => {
        try {
            const { data: files, error } = await supabase.storage
                .from('zelle_comprovantes')
                .list(`zelle-payments/${userId}`, {
                    sortBy: { column: 'created_at', order: 'desc' }
                });

            if (error || !files || files.length === 0) {
                alert('Nenhum comprovante encontrado.');
                return;
            }

            const latestFile = files[0];
            const { data } = supabase.storage
                .from('zelle_comprovantes')
                .getPublicUrl(`zelle-payments/${userId}/${latestFile.name}`);

            setSelectedZelleUrl(data.publicUrl);
            setSelectedZelleTitle(`Zelle Proof - ${clientName || userId}`);
        } catch (err) {
            console.error(err);
        }
    };

    const loadOrders = async (currentSellerId: string) => {
        try {
            const { data: ordersData, error: ordersError } = await supabase
                .from('visa_orders')
                .select('*')
                .eq('payment_method', 'zelle')
                .in('payment_status', ['pending', 'completed']) // Fetch both to allow deduplication/unification
                .eq('seller_id', currentSellerId)
                .eq('is_hidden', false)
                .order('created_at', { ascending: false });

            if (ordersError) throw ordersError;

            const paymentsMap: Record<string, ZellePayment> = {};
            if (ordersData && ordersData.length > 0) {
                const orderIds = ordersData.map(o => o.id);
                const { data: paymentsData } = await supabase
                    .from('zelle_payments')
                    .select('*')
                    .in('order_id', orderIds);

                if (paymentsData) {
                    paymentsData.forEach((payment: any) => {
                        paymentsMap[payment.order_id] = payment;
                    });
                    setZellePayments(paymentsMap);
                }
            }

            const { data: sellerRequests } = await supabase
                .from('service_requests')
                .select('client_id')
                .eq('seller_id', currentSellerId);

            const sellerClientIds = sellerRequests?.map(r => r.client_id) || [];

            let enrichedMigma: MigmaPayment[] = [];
            if (sellerClientIds.length > 0) {
                const { data: migmaData, error: migmaError } = await supabase
                    .from('migma_payments')
                    .select('*')
                    .in('user_id', sellerClientIds)
                    .in('status', ['pending', 'pending_verification'])
                    .order('updated_at', { ascending: false });

                if (migmaError) console.error('Error loading Migma:', migmaError);

                if (migmaData && migmaData.length > 0) {
                    const userIds = [...new Set(migmaData.map(p => p.user_id))];
                    const { data: clientsData } = await supabase
                        .from('clients')
                        .select('id, full_name, email')
                        .in('id', userIds);

                    const clientsMap = new Map((clientsData || []).map(c => [c.id, c]));
                    enrichedMigma = migmaData.map(p => {
                        const client = clientsMap.get(p.user_id);
                        const email = client?.email || '';
                        return {
                            ...p,
                            client_name: client?.full_name || `User ${p.user_id.substring(0, 8)}`,
                            client_email: email,
                            unification_key: `${email.trim().toLowerCase()}_${p.fee_type_global.trim().toLowerCase()}`
                        };
                    });
                }
            }

            const unifiedMap = new Map<string, any>();
            (ordersData || []).forEach(order => {
                const key = `${(order.client_email || '').trim().toLowerCase()}_${(order.product_slug || '').trim().toLowerCase()}`;
                unifiedMap.set(key, {
                    id: order.id,
                    type: 'order',
                    order_number: order.order_number,
                    client_name: order.client_name,
                    client_email: order.client_email,
                    product: order.product_slug,
                    amount: order.total_price_usd,
                    date: order.created_at,
                    proof_url: order.zelle_proof_url,
                    contract_url: order.contract_pdf_url,
                    original_order: order,
                    confidence: paymentsMap[order.id]?.n8n_confidence ?? order.payment_metadata?.n8n_validation?.confidence,
                    n8n_response: paymentsMap[order.id]?.n8n_response ?? order.payment_metadata?.n8n_validation?.response
                });
            });

            enrichedMigma.forEach(migma => {
                const key = migma.unification_key || `${(migma.client_email || '').trim().toLowerCase()}_${(migma.fee_type_global || '').trim().toLowerCase()}`;
                const existing = unifiedMap.get(key);

                if (existing) {
                    existing.migma_id = migma.id;
                    if (!existing.proof_url) existing.proof_url = migma.image_url;
                } else {
                    unifiedMap.set(key, {
                        id: migma.id,
                        type: 'migma',
                        order_number: `MIG-${migma.id.substring(0, 8).toUpperCase()}`,
                        client_name: migma.client_name,
                        client_email: migma.client_email,
                        product: migma.fee_type_global,
                        amount: migma.amount,
                        date: migma.updated_at,
                        proof_url: migma.image_url,
                        migma_id: migma.id,
                        user_id: migma.user_id,
                        status: migma.status
                    });
                }
            });

            // Filter out items that are already completed in the unified map
            const finalPending = Array.from(unifiedMap.values()).filter(item => {
                // If it has migma status, check it
                if (item.type === 'migma' && (item.status === 'approved' || item.status === 'rejected')) return false;

                // If it's an order or unified, check payment_status
                const status = item.original_order?.payment_status || item.status;
                return status === 'pending' || status === 'pending_verification';
            });

            setUnifiedApprovals(finalPending);

            const { data: histOrdersData } = await supabase
                .from('visa_orders')
                .select('*')
                .eq('payment_method', 'zelle')
                .eq('seller_id', currentSellerId)
                .in('payment_status', ['completed', 'failed'])
                .eq('is_hidden', false)
                .order('updated_at', { ascending: false })
                .limit(20);
            setHistoryOrders(histOrdersData || []);

            if (sellerClientIds.length > 0) {
                const { data: histMigmaData } = await supabase
                    .from('migma_payments')
                    .select('*')
                    .in('user_id', sellerClientIds)
                    .in('status', ['approved', 'rejected'])
                    .order('updated_at', { ascending: false })
                    .limit(20);

                if (histMigmaData && histMigmaData.length > 0) {
                    const histUserIds = [...new Set(histMigmaData.map((p: any) => p.user_id))];
                    const { data: histClientsData } = await supabase
                        .from('clients')
                        .select('id, full_name, email')
                        .in('id', histUserIds);

                    const histClientsMap = new Map((histClientsData || []).map((c: any) => [c.id, c]));
                    const enrichedHistMigma = histMigmaData.map((p: any) => {
                        const client = histClientsMap.get(p.user_id);
                        return {
                            ...p,
                            client_name: client?.full_name || `User ${p.user_id?.substring(0, 8)}`,
                            client_email: client?.email || 'N/A'
                        };
                    });
                    setHistoryMigma(enrichedHistMigma);
                } else {
                    setHistoryMigma([]);
                }
            } else {
                setHistoryMigma([]);
            }
        } catch (err) {
            console.error('Error loadOrders:', err);
        }
    };

    const handleApprove = (item: any) => {
        setSelectedItem(item);
        setShowApproveConfirm(true);
    };

    const confirmApprove = async () => {
        if (!selectedItem) return;
        setShowApproveConfirm(false);

        if (selectedItem.type === 'order') {
            await processOrderApproval(selectedItem);
        } else {
            await processMigmaApproval(selectedItem.id);
        }
        setSelectedItem(null);
    };

    const processOrderApproval = async (item: any) => {
        setIsProcessing(true);
        const order = item.original_order;
        try {
            const { error: updateError } = await supabase
                .from('visa_orders')
                .update({
                    payment_status: 'completed',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', order.id);

            if (updateError) throw updateError;

            const zellePayment = zellePayments[order.id];
            if (zellePayment) {
                await supabase
                    .from('zelle_payments')
                    .update({
                        status: 'approved',
                        admin_approved_at: new Date().toISOString(),
                        admin_notes: 'Approved manually by seller',
                        processed_by_user_id: (await supabase.auth.getUser()).data.user?.id,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', zellePayment.id);
            }

            if (item.migma_id) {
                await supabase.rpc('approve_migma_zelle_payment', {
                    p_payment_id: item.migma_id,
                    p_admin_user_id: (await supabase.auth.getUser()).data.user?.id
                });
            }

            if (order.seller_id) {
                await supabase.from('seller_funnel_events').insert({
                    seller_id: order.seller_id,
                    product_slug: order.product_slug,
                    event_type: 'payment_completed',
                    session_id: `order_${order.id}`,
                    metadata: { order_id: order.id, approved_by: 'seller' },
                });
            }

            try {
                await supabase.functions.invoke('send-zelle-webhook', { body: { order_id: order.id } });
            } catch (e) { console.error(e); }

            setAlertData({ title: 'Success', message: 'Payment approved successfully!', variant: 'success' });
            setShowAlert(true);
            if (sellerId) await loadOrders(sellerId);
        } catch (error) {
            console.error('Error approving payment:', error);
            setAlertData({ title: 'Error', message: 'Failed to approve payment', variant: 'error' });
            setShowAlert(true);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReject = (item: any) => {
        setSelectedItem(item);
        setShowRejectConfirm(true);
    };

    const confirmReject = async () => {
        if (!selectedItem) return;
        setShowRejectConfirm(false);
        setIsProcessing(true);

        try {
            const { data, error } = await supabase.functions.invoke('process-zelle-rejection', {
                body: {
                    id: selectedItem.id,
                    type: selectedItem.type === 'order' ? 'visa_order' : 'migma_payment',
                    rejection_reason: rejectionReason,
                    processed_by_user_id: (await supabase.auth.getUser()).data.user?.id
                }
            });
            if (error || !data?.success) throw new Error(data?.error || 'Failed to reject payment');

            setAlertData({ title: 'Payment Rejected', message: 'Payment has been rejected. Client notified.', variant: 'success' });
            setShowAlert(true);
            if (sellerId) await loadOrders(sellerId);
        } catch (error) {
            console.error('Error rejecting payment:', error);
            setAlertData({ title: 'Error', message: 'Failed to reject payment', variant: 'error' });
            setShowAlert(true);
        } finally {
            setIsProcessing(false);
            setSelectedItem(null);
            setRejectionReason('');
        }
    };

    const processMigmaApproval = async (id: string) => {
        setIsProcessing(true);
        try {
            const { data: payment } = await supabase.from('migma_payments').select('*').eq('id', id).single();
            if (!payment) throw new Error('Payment not found');

            const { data: client } = await supabase.from('clients').select('*').eq('id', payment.user_id).single();
            if (!client) throw new Error('Client not found');

            const { data: product } = await supabase.from('visa_products').select('*').eq('slug', payment.fee_type_global).single();
            if (!product) throw new Error('Product not found');

            let orderId = '';
            const { data: existingOrders } = await supabase
                .from('visa_orders')
                .select('id')
                .ilike('client_email', client.email.trim())
                .eq('product_slug', product.slug)
                .eq('payment_status', 'pending')
                .limit(1);

            if (existingOrders && existingOrders.length > 0) {
                orderId = existingOrders[0].id;
                await supabase.from('visa_orders').update({
                    payment_status: 'completed',
                    zelle_proof_url: payment.image_url,
                    updated_at: new Date().toISOString()
                }).eq('id', orderId);
            } else {
                const orderNumber = `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
                const { data: newOrder } = await supabase.from('visa_orders').insert({
                    order_number: orderNumber,
                    product_slug: product.slug,
                    total_price_usd: payment.amount,
                    client_name: client.full_name,
                    client_email: client.email,
                    payment_method: 'zelle',
                    payment_status: 'completed',
                    zelle_proof_url: payment.image_url,
                    seller_id: sellerId
                }).select().single();
                orderId = newOrder?.id || '';
            }

            await supabase.rpc('approve_migma_zelle_payment', {
                p_payment_id: id,
                p_admin_user_id: (await supabase.auth.getUser()).data.user?.id
            });

            try {
                await supabase.functions.invoke('send-zelle-webhook', { body: { order_id: orderId } });
            } catch (e) { console.error(e); }

            setAlertData({ title: 'Success', message: 'Payment approved successfully!', variant: 'success' });
            setShowAlert(true);
            if (sellerId) await loadOrders(sellerId);
        } catch (err) {
            console.error(err);
            setAlertData({ title: 'Error', message: 'Failed to approve payment', variant: 'error' });
            setShowAlert(true);
        } finally {
            setIsProcessing(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-medium" />
            </div>
        );
    }

    const allHistory = (() => {
        const combined = [
            ...historyOrders.map(o => ({ ...o, type: 'order' as const })),
            ...historyMigma.map(p => ({ ...p, type: 'migma' as const }))
        ];

        const deduped: any[] = [];
        const seenKeys = new Set<string>();

        // Processar ordens primeiro
        const sortedRaw = [...combined].sort((a, b) => (a.type === 'order' ? -1 : 1));

        sortedRaw.forEach((item: any) => {
            const email = (item.client_email || item.email || '').trim().toLowerCase();
            const product = (item.product_slug || item.fee_type_global || '').trim().toLowerCase();
            // Chave baseada em email e produto para evitar duplicidade
            const key = `${email}_${product}`;

            if (!seenKeys.has(key)) {
                deduped.push(item);
                seenKeys.add(key);
            }
        });

        return deduped.sort((a, b) => {
            const timeA = new Date(a.updated_at || a.created_at || 0).getTime();
            const timeB = new Date(b.updated_at || b.created_at || 0).getTime();
            return timeB - timeA;
        });
    })();

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <h1 className="text-2xl font-bold migma-gold-text mb-6">Zelle Payment Approval</h1>

            <div className="space-y-12">
                <section>
                    <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <Clock className="w-5 h-5 text-gold-medium" />
                            Pending Approvals
                        </div>
                        {unifiedApprovals.length > 0 && (
                            <span className="flex items-center justify-center px-2 py-0.5 text-xs font-bold bg-gold-medium text-black rounded-full">
                                {unifiedApprovals.length}
                            </span>
                        )}
                    </h2>
                    {unifiedApprovals.length === 0 ? (
                        <p className="text-gray-400">No pending payments.</p>
                    ) : (
                        <div className="space-y-4">
                            {unifiedApprovals.map((item) => (
                                <Card key={`${item.type}-${item.id}`} className="bg-black/40 border-gold-medium/30 overflow-hidden">
                                    <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                        <div className="min-w-0">
                                            <CardTitle className="text-lg text-white truncate">{item.client_name}</CardTitle>
                                            <p className="text-sm text-gray-400 truncate">{item.client_email}</p>
                                        </div>
                                        {item.confidence && (
                                            <Badge className="bg-blue-500/20 text-blue-300 w-fit shrink-0">
                                                AI: {Math.round(item.confidence * 100)}%
                                            </Badge>
                                        )}
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
                                            <div className="flex justify-between sm:justify-start items-center sm:items-end gap-6 border-b sm:border-b-0 border-white/5 pb-4 sm:pb-0">
                                                <div className="min-w-0">
                                                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Service / Product</p>
                                                    <p className="text-sm text-gray-300 font-medium truncate uppercase">{item.product}</p>
                                                </div>
                                                <div className="text-right sm:text-left shrink-0">
                                                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Total Amount</p>
                                                    <p className="text-xl font-bold text-gold-medium leading-none">US$ {(item.amount || 0).toFixed(2)}</p>
                                                </div>
                                            </div>

                                            <div className="flex flex-row gap-2 w-full sm:w-auto">
                                                <Button
                                                    onClick={() => handleApprove(item)}
                                                    disabled={isProcessing}
                                                    className="flex-1 sm:flex-none sm:w-32 bg-green-600 hover:bg-green-700 text-xs sm:text-sm h-9 sm:h-10"
                                                >
                                                    <CheckCircle className="w-4 h-4 mr-1 sm:mr-2 shrink-0" /> Approve
                                                </Button>
                                                <Button
                                                    variant="destructive"
                                                    onClick={() => handleReject(item)}
                                                    disabled={isProcessing}
                                                    className="flex-1 sm:flex-none sm:w-32 text-xs sm:text-sm h-9 sm:h-10"
                                                >
                                                    <XCircle className="w-4 h-4 mr-1 sm:mr-2 shrink-0" /> Reject
                                                </Button>
                                                {item.proof_url && (
                                                    <Button
                                                        variant="ghost"
                                                        onClick={() => { setSelectedZelleUrl(item.proof_url); setSelectedZelleTitle(`Proof - ${item.client_name}`); }}
                                                        className="flex-1 sm:flex-none sm:w-32 text-xs sm:text-sm h-9 sm:h-10 border border-gold-medium/20 text-gold-medium hover:bg-gold-medium/10 transition-colors"
                                                    >
                                                        <Eye className="w-4 h-4 mr-1 sm:mr-2 shrink-0 text-gold-medium" /> Proof
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </section>

                <section>
                    <h2 className="text-xl font-bold text-white/60 mb-6 flex items-center gap-2"><CheckCircle className="w-5 h-5" /> Recent History</h2>
                    <div className="space-y-2">
                        {allHistory.map((item: any) => (
                            <div key={`${item.type}-${item.id}`} className="p-4 bg-white/5 rounded-xl border border-white/10 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                                <div className="min-w-0">
                                    <p className="font-bold text-white text-sm truncate">{item.client_name || 'N/A'}</p>
                                    <p className="text-xs text-gray-400 truncate uppercase mt-0.5">{item.product_slug || item.fee_type_global}</p>
                                </div>
                                <div className="flex justify-between sm:text-right items-center gap-4 border-t sm:border-t-0 border-white/5 pt-3 sm:pt-0">
                                    <div>
                                        <p className="font-bold migma-gold-text">US$ {(item.total_price_usd || item.amount || 0).toFixed(2)}</p>
                                        <p className="text-[10px] text-gray-600 mt-0.5">{new Date(item.updated_at || item.created_at).toLocaleDateString('pt-BR')}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge
                                            variant="outline"
                                            className={`shrink-0 text-[10px] px-2 py-0.5 ${(item.payment_status === 'completed' || item.status === 'approved') ? 'border-green-500/30 text-green-400 bg-green-500/5' : 'border-red-500/30 text-red-400 bg-red-500/5'}`}
                                        >
                                            {(item.payment_status === 'completed' || item.status === 'approved') ? 'APPROVED' : 'REJECTED'}
                                        </Badge>

                                        {(item.zelle_proof_url || item.image_url) ? (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    const url = item.zelle_proof_url || item.image_url;
                                                    if (url) {
                                                        setSelectedZelleUrl(url);
                                                        setSelectedZelleTitle(`Proof - ${item.client_name}`);
                                                    }
                                                }}
                                                className="h-8 w-8 p-0 border border-white/10 hover:bg-white/10"
                                            >
                                                <Eye className="w-4 h-4 text-gray-400" />
                                            </Button>
                                        ) : item.type === 'migma' && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleViewMigmaProof(item.user_id, item.client_name)}
                                                className="h-8 w-8 p-0 border border-white/10 hover:bg-white/10"
                                            >
                                                <Eye className="w-4 h-4 text-gray-400" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            <PdfModal isOpen={!!selectedPdfUrl} onClose={() => setSelectedPdfUrl(null)} pdfUrl={selectedPdfUrl || ''} title="Contract PDF" />
            <ImageModal isOpen={!!selectedZelleUrl} onClose={() => setSelectedZelleUrl(null)} imageUrl={selectedZelleUrl || ''} title={selectedZelleTitle} />

            <AlertModal
                isOpen={showApproveConfirm}
                onClose={() => setShowApproveConfirm(false)}
                onConfirm={confirmApprove}
                title="Confirm Approval"
                message="Are you sure you want to approve this Zelle payment?"
                variant="success"
            />

            <AlertModal
                isOpen={showRejectConfirm}
                onClose={() => setShowRejectConfirm(false)}
                onConfirm={confirmReject}
                title="Confirm Rejection"
                message="Please explain the reason for rejection (sent to client):"
                variant="error"
            >
                <textarea
                    className="w-full mt-2 bg-black/40 border border-white/10 rounded-lg p-3 text-white text-sm outline-none focus:border-gold-medium transition-colors"
                    rows={4}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Describe why the payment was rejected..."
                />
            </AlertModal>

            <AlertModal
                isOpen={showAlert}
                onClose={() => setShowAlert(false)}
                title={alertData?.title || ''}
                message={alertData?.message || ''}
                variant={alertData?.variant || 'info'}
            />
        </div>
    );
};
