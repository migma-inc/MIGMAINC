import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PdfModal } from '@/components/ui/pdf-modal';
import { ImageModal } from '@/components/ui/image-modal';
import { CheckCircle, XCircle, Clock, Brain, Eye } from 'lucide-react';
import { AlertModal } from '@/components/ui/alert-modal';
import { Skeleton } from '@/components/ui/skeleton';

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

export const ZelleApprovalPage = () => {
  const [zellePayments, setZellePayments] = useState<Record<string, ZellePayment>>({});
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [selectedPdfUrl, setSelectedPdfUrl] = useState<string | null>(null);
  const [selectedPdfTitle, setSelectedPdfTitle] = useState<string>('Contract PDF');
  const [selectedZelleUrl, setSelectedZelleUrl] = useState<string | null>(null);
  const [selectedZelleTitle, setSelectedZelleTitle] = useState<string>('Zelle Receipt');
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingAction, setProcessingAction] = useState<'approve' | 'reject' | null>(null);
  const [alertData, setAlertData] = useState<{ title: string; message: string; variant: 'success' | 'error' } | null>(null);
  const [showAlert, setShowAlert] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const [historyOrders, setHistoryOrders] = useState<ZelleOrder[]>([]);
  const [historyMigma, setHistoryMigma] = useState<MigmaPayment[]>([]);

  const [unifiedApprovals, setUnifiedApprovals] = useState<any[]>([]);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      // 1. Load regular visa_orders
      const { data: ordersData, error: ordersError } = await supabase
        .from('visa_orders')
        .select('*')
        .eq('payment_method', 'zelle')
        .in('payment_status', ['pending', 'completed']) // Fetch both to allow deduplication/unification
        .eq('is_hidden', false)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      // 2. Load zelle_payments for these orders (for confidence data)
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

      // 3. Load pending Migma payments (external receipts)
      const { data: migmaData, error: migmaError } = await supabase
        .from('migma_payments')
        .select('*')
        .in('status', ['pending', 'pending_verification'])
        .order('updated_at', { ascending: false });

      if (migmaError) console.error('Error loading Migma:', migmaError);

      // 4. Enrich Migma with client names and Fetch Processed By names
      let enrichedMigma: MigmaPayment[] = [];
      const adminIds = new Set<string>();

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
            // Pre-calculate search key to be robust
            unification_key: `${email.trim().toLowerCase()}_${p.fee_type_global.trim().toLowerCase()}`
          };
        });
      }

      // Collect admin/seller IDs from history
      const { data: histOrdersData } = await supabase
        .from('visa_orders')
        .select('*')
        .eq('payment_method', 'zelle')
        .in('payment_status', ['completed', 'failed'])
        .eq('is_hidden', false)
        .order('updated_at', { ascending: false })
        .limit(20);

      const { data: histMigmaData } = await supabase
        .from('migma_payments')
        .select('*')
        .in('status', ['approved', 'rejected'])
        .order('updated_at', { ascending: false })
        .limit(20);

      const histMigmaPayments = histMigmaData || [];
      const histOrdersPayments = histOrdersData || [];

      // Find all processed_by_user_id in zelle_payments for regular orders
      let zelleProcessedMap: Record<string, string> = {};
      if (histOrdersPayments.length > 0) {
        const orderIds = histOrdersPayments.map(o => o.id);
        const { data: zpData } = await supabase
          .from('zelle_payments')
          .select('order_id, processed_by_user_id')
          .in('order_id', orderIds);

        zpData?.forEach(zp => {
          if (zp.processed_by_user_id) {
            adminIds.add(zp.processed_by_user_id);
            zelleProcessedMap[zp.order_id] = zp.processed_by_user_id;
          }
        });
      }

      histMigmaPayments.forEach((p: any) => {
        if (p.processed_by_user_id) adminIds.add(p.processed_by_user_id);
      });

      // Fetch names for these IDs
      const adminsMap = new Map<string, string>();
      if (adminIds.size > 0) {
        const { data: adminsData } = await supabase
          .from('sellers')
          .select('user_id, full_name')
          .in('user_id', Array.from(adminIds));

        adminsData?.forEach(a => adminsMap.set(a.user_id, a.full_name));
      }

      // --- UNIFICATION & DEDUPLICATION ---
      const unifiedMap = new Map<string, any>();
      console.log('🔍 [DEBUG] Starting unification. Orders:', ordersData?.length || 0, 'Migma:', enrichedMigma.length);

      // A. Process Visa Orders
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

      // B. Merge Migma Payments (Grouped by email + product)
      enrichedMigma.forEach(migma => {
        const key = migma.unification_key || `${(migma.client_email || '').trim().toLowerCase()}_${(migma.fee_type_global || '').trim().toLowerCase()}`;
        const existing = unifiedMap.get(key);

        console.log(`🔍 [DEBUG] Processing Migma ID ${migma.id}: key=${key}, existing=${!!existing}, db_status=${migma.status}`);

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
            status: migma.status // Store DB status for review
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
      console.log('🔍 [DEBUG] Unified Approvals count (Filtered):', finalPending.length);

      // --- HISTORY UI PREP ---
      const enrichedHistOrders = histOrdersPayments.map(o => ({
        ...o,
        processed_by_name: adminsMap.get(zelleProcessedMap[o.id] || '')
      }));

      if (histMigmaPayments.length > 0) {
        const histUserIds = [...new Set(histMigmaPayments.map((p: any) => p.user_id))];
        const { data: histClientsData } = await supabase
          .from('clients')
          .select('id, full_name, email')
          .in('id', histUserIds);

        const histClientsMap = new Map((histClientsData || []).map((c: any) => [c.id, c]));
        const enrichedHistMigma = histMigmaPayments.map((p: any) => {
          const client = histClientsMap.get(p.user_id);
          return {
            ...p,
            client_name: client?.full_name || `User ${p.user_id?.substring(0, 8)}`,
            client_email: client?.email || 'N/A',
            processed_by_name: adminsMap.get(p.processed_by_user_id || '')
          };
        });
        setHistoryMigma(enrichedHistMigma);
      } else {
        setHistoryMigma([]);
      }
      setHistoryOrders(enrichedHistOrders);
    } catch (err) {
      console.error('Error loadOrders:', err);
      setAlertData({ title: 'Error', message: 'Failed to load approvals', variant: 'error' });
      setShowAlert(true);
    } finally {
      setLoading(false);
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
    setProcessingAction('approve');
    const order = item.original_order;

    try {
      // Update order status to completed
      const { error: updateError } = await supabase
        .from('visa_orders')
        .update({
          payment_status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      if (updateError) throw updateError;

      // Update zelle_payment status if exists
      const zellePayment = zellePayments[order.id];
      if (zellePayment) {
        await supabase
          .from('zelle_payments')
          .update({
            status: 'approved',
            admin_approved_at: new Date().toISOString(),
            admin_notes: 'Approved manually by admin',
            processed_by_user_id: (await supabase.auth.getUser()).data.user?.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', zellePayment.id);
      }

      // VITAL: Update Migma Payment if linked (Unification)
      if (item.migma_id) {
        console.log(`🔗 [DEBUG] Approving linked Migma Payment: ${item.migma_id}`);
        const { error: rpcError } = await supabase
          .rpc('approve_migma_zelle_payment', {
            p_payment_id: item.migma_id,
            p_admin_user_id: (await supabase.auth.getUser()).data.user?.id
          });

        if (rpcError) {
          console.error('❌ [DEBUG] Failed to approve linked Migma payment:', rpcError);
          // Don't throw here to avoid rolling back the order approval, but alert user
          setAlertData({
            title: 'Warning',
            message: 'Order approved, but Migma status update failed. Please check logs.',
            variant: 'error',
          });
        } else {
          console.log('✅ [DEBUG] Linked Migma Payment approved via RPC');
        }
      }

      // Track payment completed in funnel
      if (order.seller_id) {
        try {
          await supabase
            .from('seller_funnel_events')
            .insert({
              seller_id: order.seller_id,
              product_slug: order.product_slug,
              event_type: 'payment_completed',
              session_id: `order_${order.id}`,
              metadata: {
                order_id: order.id,
                order_number: order.order_number,
                payment_method: 'zelle',
                total_amount: order.total_price_usd,
              },
            });
        } catch (trackError) {
          console.error('Error tracking payment completed:', trackError);
        }
      }

      // Trigger operations via workers
      try {
        await supabase.functions.invoke('send-zelle-webhook', {
          body: { order_id: order.id },
        });
      } catch (webhookError) {
        console.error('Error sending webhook after Zelle approval:', webhookError);
      }

      setAlertData({
        title: 'Success',
        message: 'Payment approved successfully!',
        variant: 'success',
      });
      setShowAlert(true);
      await loadOrders();
    } catch (error) {
      console.error('Error approving payment:', error);
      setAlertData({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to approve payment',
        variant: 'error',
      });
      setShowAlert(true);
    } finally {
      setIsProcessing(false);
      setProcessingAction(null);
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
    setProcessingAction('reject');

    try {
      const { data, error } = await supabase.functions.invoke('process-zelle-rejection', {
        body: {
          id: selectedItem.id,
          type: selectedItem.type === 'order' ? 'visa_order' : 'migma_payment',
          rejection_reason: rejectionReason,
          processed_by_user_id: (await supabase.auth.getUser()).data.user?.id
        }
      });

      if (error || !data?.success) {
        throw new Error(data?.error || 'Failed to reject payment');
      }

      // Cleanup duplicates for Migma payments
      if (selectedItem.type === 'migma') {
        const { error: cleanupError } = await supabase
          .from('migma_payments')
          .update({
            status: 'rejected',
            updated_at: new Date().toISOString()
          })
          .eq('user_id', selectedItem.user_id)
          .eq('fee_type_global', selectedItem.product)
          .in('status', ['pending', 'pending_verification']) // Only pending ones
          .neq('id', selectedItem.id); // Don't touch the one we just processed via Edge Function

        if (cleanupError) console.error('Error cleaning up duplicate rejections:', cleanupError);
        else console.log('✅ [DEBUG] Cleaned up duplicate pending payments for rejected item');
      }

      setAlertData({
        title: 'Payment Rejected',
        message: 'Payment has been rejected. Client received an email with instructions.',
        variant: 'success',
      });
      setShowAlert(true);
      await loadOrders();
    } catch (error) {
      console.error('Error rejecting payment:', error);
      setAlertData({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to reject payment',
        variant: 'error',
      });
      setShowAlert(true);
    } finally {
      setIsProcessing(false);
      setSelectedItem(null);
      setRejectionReason('');
    }
  };

  const processMigmaApproval = async (id: string) => {
    setIsProcessing(true);
    setProcessingAction('approve');

    try {
      console.log('🔍 [DEBUG] Starting approval flow for migma payment:', id);
      // 1. Get payment data
      const { data: payment, error: pError } = await supabase
        .from('migma_payments')
        .select('*')
        .eq('id', id)
        .single();

      if (pError || !payment) throw new Error('Payment not found');

      // 2. Get client data
      const { data: client, error: cError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', payment.user_id)
        .single();

      if (cError || !client) throw new Error('Client data not found');

      // 3. Get product data
      const { data: product, error: prodError } = await supabase
        .from('visa_products')
        .select('*')
        .eq('slug', payment.fee_type_global)
        .single();

      if (prodError || !product) throw new Error('Product data not found');

      // 4. Try to find existing visa_order or create one
      let orderId = '';
      let orderNumber = '';

      const { data: existingOrders } = await supabase
        .from('visa_orders')
        .select('id, order_number')
        .ilike('client_email', client.email.trim())
        .eq('product_slug', product.slug)
        .eq('payment_status', 'pending')
        .limit(1);

      if (existingOrders && existingOrders.length > 0) {
        orderId = existingOrders[0].id;
        orderNumber = existingOrders[0].order_number;
        console.log('🔍 [DEBUG] Using existing pending order:', orderNumber);

        // Update existing order
        await supabase
          .from('visa_orders')
          .update({
            payment_status: 'completed',
            zelle_proof_url: payment.image_url,
            zelle_proof_uploaded_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', orderId);
        console.log('✅ [DEBUG] Existing order updated to completed:', orderNumber);
      } else {
        // 3a. Try to find a recent service_request to link data
        let serviceRequestId = null;
        const { data: serviceRequests } = await supabase
          .from('service_requests')
          .select('id')
          .eq('client_id', client.id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (serviceRequests && serviceRequests.length > 0) {
          serviceRequestId = serviceRequests[0].id;
          console.log('✅ [DEBUG] Linked to existing service request:', serviceRequestId);
        }

        // Create new order
        orderNumber = `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
        console.log('🔍 [DEBUG] Creating new order:', orderNumber);

        const { data: newOrder, error: orderCreateError } = await supabase
          .from('visa_orders')
          .insert({
            order_number: orderNumber,
            product_slug: product.slug,
            base_price_usd: product.base_price_usd,
            price_per_dependent_usd: product.price_per_dependent_usd,
            total_price_usd: payment.amount,
            client_name: client.full_name,
            client_email: client.email,
            client_whatsapp: client.phone,
            client_country: client.country,
            client_nationality: client.nationality,
            payment_method: 'zelle',
            payment_status: 'completed',
            zelle_proof_url: payment.image_url,
            zelle_proof_uploaded_at: new Date().toISOString(),
            service_request_id: serviceRequestId
          })
          .select()
          .single();

        if (orderCreateError) throw orderCreateError;
        orderId = newOrder.id;
      }

      console.log(`🔍 [DEBUG] Attempting update for Migma ID: ${id} via RPC`);

      // 1. Update status via Secure RPC (Security Definer)
      const { data: rpcResult, error: rpcError } = await supabase
        .rpc('approve_migma_zelle_payment', {
          p_payment_id: id,
          p_admin_user_id: (await supabase.auth.getUser()).data.user?.id
        });

      if (rpcError) {
        console.error('❌ [DEBUG] RPC Error updating migma_payment:', rpcError);
        throw rpcError;
      }

      if (!rpcResult || !rpcResult.success) {
        console.error('⚠️ [CRITICAL] RPC returned failure:', rpcResult);
        throw new Error(rpcResult?.error || 'Failed to approve payment via RPC');
      }

      console.log('✅ [DEBUG] Payment approved successfully via RPC');

      // Verify update (Double check)
      const { data: verifyData } = await supabase
        .from('migma_payments')
        .select('status')
        .eq('id', id)
        .single();

      console.log(`✅ [DEBUG] Migma payment verification - ID: ${id}, New Status: ${verifyData?.status}`);

      // 6. Trigger non-critical operations
      try {
        await supabase.functions.invoke('send-zelle-webhook', {
          body: { order_id: orderId }
        });
      } catch (webhookError) {
        console.error('❌ [DEBUG] Error triggering webhook worker:', webhookError);
      }

      setAlertData({
        title: 'Success',
        message: 'Payment approved, order created and documents generated!',
        variant: 'success'
      });
      setShowAlert(true);
      console.log('🔄 [DEBUG] Refreshing dashboard after approval...');
      await loadOrders();

    } catch (err) {
      console.error('❌ [DEBUG] Error in migma approval process:', err);
      setAlertData({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to approve payment',
        variant: 'error'
      });
      setShowAlert(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleViewMigmaProof = async (userId: string, clientName?: string) => {
    try {
      // Buscar arquivos do usuário no bucket zelle_comprovantes
      const { data: files, error } = await supabase.storage
        .from('zelle_comprovantes')
        .list(`zelle-payments/${userId}`, {
          sortBy: { column: 'created_at', order: 'desc' }
        });

      if (error) {
        console.error('Error fetching proof from storage:', error);
        alert('Não foi possível carregar o comprovante. Erro: ' + error.message);
        return;
      }

      if (!files || files.length === 0) {
        alert('Nenhum comprovante encontrado para este usuário no bucket zelle_comprovantes.');
        return;
      }

      // Pegar o arquivo mais recente
      const latestFile = files[0];
      const { data } = supabase.storage
        .from('zelle_comprovantes')
        .getPublicUrl(`zelle-payments/${userId}/${latestFile.name}`);

      // Abrir no modal em vez de nova aba
      setSelectedZelleUrl(data.publicUrl);
      setSelectedZelleTitle(`Zelle Proof - ${clientName || userId}`);
    } catch (err) {
      console.error('Exception fetching proof:', err);
      alert('Erro ao buscar comprovante.');
    }
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="space-y-4">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-10 w-32 hidden sm:block" />
        </div>

        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <Skeleton className="w-9 h-9 rounded-lg" />
            <Skeleton className="h-7 w-48" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="bg-zinc-900/40 border-white/5 overflow-hidden">
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-6 w-48" />
                    </div>
                    <Skeleton className="h-8 w-8 rounded-full" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-5 w-24" />
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-5 w-24" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-10 flex-1" />
                    <Skeleton className="h-10 flex-1" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="pt-8 border-t border-white/5 space-y-6">
          <div className="flex items-center gap-3">
            <Skeleton className="w-9 h-9 rounded-lg" />
            <Skeleton className="h-7 w-48" />
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-6 bg-white/[0.02] rounded-xl border border-white/5 flex gap-4">
                <div className="flex-1 space-y-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-6 w-64" />
                </div>
                <div className="w-24 space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-6 w-full" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  const allHistory = (() => {
    const combined = [
      ...historyOrders.map(o => ({ ...o, type: 'order' as const })),
      ...historyMigma.map(p => ({ ...p, type: 'migma' as const }))
    ];

    const dedupedMap = new Map<string, any>();

    // Processar ordens primeiro para que tenham prioridade sobre o migma_payment bruto
    const sortedRaw = [...combined].sort((a, _b) => (a.type === 'order' ? -1 : 1));

    sortedRaw.forEach((item: any) => {
      const email = (item.client_email || item.email || '').trim().toLowerCase();
      const product = (item.product_slug || item.fee_type_global || '').trim().toLowerCase();
      // Chave baseada em email e produto para evitar duplicidade de Ordem vs Pagamento
      const key = `${email}_${product}`;

      if (!dedupedMap.has(key)) {
        dedupedMap.set(key, item);
      } else {
        const existing = dedupedMap.get(key);
        // Se já temos a Ordem mas ela não tem o nome do aprovador, e o registro Migma tem, transferimos o nome.
        if (existing.type === 'order' && !existing.processed_by_name && item.processed_by_name) {
          existing.processed_by_name = item.processed_by_name;
        }
      }
    });

    return Array.from(dedupedMap.values()).sort((a, b) => {
      const dateA = new Date(a.updated_at || 0).getTime();
      const dateB = new Date(b.updated_at || 0).getTime();
      return dateB - dateA;
    });
  })();

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold migma-gold-text mb-2">Zelle Payment Approval</h1>
          <p className="text-gray-400">Review and approve pending Zelle payments</p>
        </div>

        <div className="flex items-center gap-3">
          <Badge className="bg-gold-medium/20 text-gold-medium border-gold-medium/50 px-3 py-1">
            {unifiedApprovals.length} Pendentes
          </Badge>
          <Badge className="bg-white/5 text-gray-400 border-white/10 px-3 py-1">
            {allHistory.length} No Histórico
          </Badge>
        </div>
      </div>

      <div className="space-y-12">
        {/* SECTION: PENDING APPROVALS */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-gold-medium/10 p-2 rounded-lg border border-gold-medium/20">
              <Clock className="w-5 h-5 text-gold-medium animate-pulse" />
            </div>
            <h2 className="text-xl font-bold text-white">Pending Approvals</h2>
          </div>

          {unifiedApprovals.length === 0 ? (
            <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
              <CardContent className="py-12 text-center">
                <Clock className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">No pending Zelle payments</p>
                <p className="text-gray-500 text-sm mt-2">All Zelle payments have been processed</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {unifiedApprovals.map((item) => (
                <Card
                  key={`${item.type}-${item.id}`}
                  className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30 overflow-hidden"
                >
                  <CardHeader className="pb-3 border-b border-white/5">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] text-gray-500 uppercase tracking-widest">
                            {new Date(item.date).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        <CardTitle className="text-base sm:text-lg text-white break-words">
                          {item.order_number}
                        </CardTitle>
                        <p className="text-xs sm:text-sm text-gray-400 mt-0.5 break-words font-medium">
                          {item.client_name} • {item.client_email}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {item.confidence !== undefined && item.confidence !== null ? (
                          <Badge
                            className={`${item.confidence >= 0.7
                              ? 'bg-green-500/20 text-green-300 border-green-500/50'
                              : item.confidence >= 0.4
                                ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50'
                                : 'bg-red-500/20 text-red-300 border-red-500/50'
                              } flex items-center gap-1 py-1 px-2`}
                          >
                            <Brain className="w-3 h-3" />
                            {Math.round(item.confidence * 100)}% Confidence
                          </Badge>
                        ) : (
                          <Badge className="bg-white/5 text-gray-400 border-white/10 uppercase text-[10px] tracking-widest">
                            Awaiting Review
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4 pt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 text-xs sm:text-sm bg-black/20 p-4 rounded-xl border border-white/5">
                      <div>
                        <span className="text-gray-500 block text-[10px] uppercase font-bold tracking-wider mb-1">Service / Product</span>
                        <span className="text-white font-semibold">{item.product}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block text-[10px] uppercase font-bold tracking-wider mb-1">Total Amount</span>
                        <span className="text-gold-medium font-bold text-lg">
                          US$ {parseFloat(item.amount.toString()).toFixed(2)}
                        </span>
                      </div>
                      {item.type === 'order' && item.original_order?.seller_id && (
                        <div>
                          <span className="text-gray-500 block text-[10px] uppercase font-bold tracking-wider mb-1">Affiliate Seller</span>
                          <span className="text-white font-medium">{item.original_order.seller_id}</span>
                        </div>
                      )}
                    </div>

                    {item.n8n_response && (
                      <div className="bg-blue-500/5 p-4 rounded-xl border border-blue-500/10 flex items-start gap-3">
                        <div className="bg-blue-500/20 p-1.5 rounded-lg">
                          <Brain className="w-4 h-4 text-blue-400 shrink-0" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">AI Receipt Analysis</p>
                          <p className="text-xs text-gray-400 leading-relaxed font-medium">{item.n8n_response}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      {/* ACTION BUTTONS */}
                      <Button
                        size="sm"
                        onClick={() => handleApprove(item)}
                        disabled={isProcessing}
                        className="bg-green-600 hover:bg-green-700 text-white font-bold px-5 h-10 shadow-lg shadow-green-900/20"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Approve Payment
                      </Button>

                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleReject(item)}
                        disabled={isProcessing}
                        className="font-bold px-5 h-10"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Reject
                      </Button>

                      <div className="flex-1" />

                      {/* VIEW BUTTONS */}
                      {item.proof_url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (item.type === 'order') {
                              setSelectedZelleUrl(item.proof_url);
                              setSelectedZelleTitle(`Receipt - ${item.order_number}`);
                            } else {
                              handleViewMigmaProof(item.user_id, item.client_name);
                            }
                          }}
                          className="text-gray-400 hover:text-gold-light hover:bg-gold-medium/10 border border-white/5 h-10 px-4"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View Receipt
                        </Button>
                      )}

                      {item.contract_url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedPdfUrl(item.contract_url);
                            setSelectedPdfTitle(`Contract - ${item.order_number}`);
                          }}
                          className="text-gray-400 hover:text-white hover:bg-white/5 border border-white/5 h-10 px-4"
                        >
                          Contract PDF
                        </Button>
                      )}

                      {item.type === 'order' && (
                        <Link to={`/dashboard/visa-orders`}>
                          <Button variant="ghost" size="sm" className="text-[10px] text-gray-500 hover:text-white uppercase font-bold tracking-widest h-10 px-4">
                            Full Details
                          </Button>
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* SECTION: HISTORY */}
        <section className="pt-8 border-t border-white/5">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-white/5 p-2 rounded-lg border border-white/10">
              <Brain className="w-5 h-5 text-gray-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Recent History</h2>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {allHistory.length === 0 ? (
              <Card className="bg-zinc-900/50 border border-white/5">
                <CardContent className="py-16 text-center">
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Brain className="w-8 h-8 text-gray-600" />
                  </div>
                  <h3 className="text-white font-medium mb-1">No history yet</h3>
                  <p className="text-gray-500 text-sm">Processed payments will appear here.</p>
                </CardContent>
              </Card>
            ) : (
              allHistory.map((item: any) => (
                <Card key={item.id} className="bg-zinc-900/40 border border-white/5 hover:border-gold-medium/20 transition-all duration-300 group overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full transition-all duration-300 group-hover:w-1.5 bg-zinc-800" />

                  <CardHeader className="py-4 px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">
                            {item.type === 'order' ? `ORDER #${item.order_number}` : `MIGMA ID ${item.id.substring(0, 8).toUpperCase()}`}
                          </span>
                          <span className="w-1 h-1 rounded-full bg-white/10" />
                          <span className="text-[10px] text-gray-500">
                            {new Date(item.updated_at).toLocaleDateString()}
                          </span>
                        </div>
                        <h3 className="text-white font-semibold text-lg">{item.client_name}</h3>
                        <p className="text-xs text-gray-500">{item.client_email}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge
                          className={`
                          py-1 px-3 rounded-full text-[10px] font-bold tracking-wider
                          ${(item.status === 'approved' || item.payment_status === 'completed')
                              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                              : 'bg-red-500/10 text-red-400 border border-red-500/20'}
                        `}
                        >
                          {(item.status === 'approved' || item.payment_status === 'completed') ? 'APPROVED' : 'REJECTED'}
                        </Badge>
                        {item.processed_by_name && (
                          <div className="flex items-center gap-1.5 mt-1 bg-white/5 px-2 py-0.5 rounded border border-white/5">
                            <span className="text-[8px] text-gray-400 uppercase font-bold tracking-tighter">Approved by</span>
                            <span className="text-[10px] text-gold-light font-semibold whitespace-nowrap">
                              {item.processed_by_name}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="py-4 px-6 bg-white/[0.02] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-white/5">
                    <div className="flex items-center gap-6">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-gray-500 uppercase font-bold tracking-tighter mb-0.5">Service</span>
                        <span className="text-sm text-gray-300">{item.type === 'order' ? item.product_slug : item.fee_type_global}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-gray-500 uppercase font-bold tracking-tighter mb-0.5">Amount</span>
                        <span className="text-sm text-gold-medium font-bold">US$ {item.type === 'order' ? item.total_price_usd : item.amount}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      {item.type === 'migma' ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="flex-1 sm:flex-none h-9 text-xs border border-white/5 hover:border-gold-medium/30 hover:bg-gold-medium/5 text-gray-400 hover:text-gold-light"
                          onClick={() => handleViewMigmaProof(item.user_id, item.client_name)}
                        >
                          <Eye className="w-3.5 h-3.5 mr-2" /> View Proof
                        </Button>
                      ) : (
                        <>
                          {item.zelle_proof_url && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="flex-1 sm:flex-none h-9 text-xs border border-white/5 hover:border-gold-medium/30 hover:bg-gold-medium/5 text-gray-400 hover:text-gold-light"
                              onClick={() => {
                                setSelectedZelleUrl(item.zelle_proof_url);
                                setSelectedZelleTitle(`Receipt ${item.order_number}`);
                              }}
                            >
                              <Eye className="w-3.5 h-3.5 mr-2" /> View Receipt
                            </Button>
                          )}
                          <Link to={`/dashboard/visa-orders`} className="flex-1 sm:flex-none">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="w-full h-9 text-xs text-gray-500 hover:text-white"
                            >
                              Details
                            </Button>
                          </Link>
                        </>
                      )}
                    </div>
                  </CardContent>

                  {item.admin_notes && (
                    <div className="px-6 py-2 bg-black/20 border-t border-white/5 italic">
                      <p className="text-[10px] text-gray-500 truncate">
                        <span className="font-bold mr-1">Admin Notes:</span> {item.admin_notes}
                      </p>
                    </div>
                  )}
                </Card>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Processing Overlay */}
      {
        isProcessing && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md">
            <div className="flex flex-col items-center justify-center space-y-6">
              <div className="loader-gold"></div>
              <p className="text-gold-light text-lg font-semibold tracking-tight">
                {processingAction === 'reject'
                  ? 'Rejecting payment...'
                  : 'Processing payment approval...'}
              </p>
              <p className="text-gray-400 text-sm">
                This may take a moment, please wait
              </p>
            </div>
          </div>
        )
      }

      {/* Confirm Approve Modal */}
      {
        showApproveConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => {
              setShowApproveConfirm(false);
              setSelectedItem(null);
            }}></div>
            <div className="relative w-full max-w-md bg-zinc-900 border border-gold-medium/30 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4 text-gold-medium">
                  <CheckCircle className="w-6 h-6" />
                  <h3 className="text-xl font-bold text-white">Approve Payment</h3>
                </div>

                <p className="text-gray-400 text-sm mb-8">
                  Are you sure you want to approve this payment? This will mark the payment as completed, generate the necessary documents, and notify the client.
                </p>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowApproveConfirm(false);
                      setSelectedItem(null);
                    }}
                    className="flex-1 bg-transparent border-white/10 text-white hover:bg-white/5"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={confirmApprove}
                    className="flex-1 bg-gold-medium hover:bg-gold-dark text-black font-bold"
                  >
                    Confirm Approval
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Confirm Reject Modal */}
      {
        showRejectConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => {
              setShowRejectConfirm(false);
              setSelectedItem(null);
            }}></div>
            <div className="relative w-full max-w-md bg-zinc-900 border border-red-500/30 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4 text-red-500">
                  <XCircle className="w-6 h-6" />
                  <h3 className="text-xl font-bold text-white">Reject Payment</h3>
                </div>

                <p className="text-gray-400 text-sm mb-6">
                  Are you sure you want to reject this payment? The client will receive an email with your notes and a link to resubmit.
                </p>

                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                  Rejection Reason (Sent to client)
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-red-500/50 min-h-[100px] mb-6 resize-none"
                />

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowRejectConfirm(false);
                      setSelectedItem(null);
                    }}
                    className="flex-1 bg-transparent border-white/10 text-white hover:bg-white/5"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={confirmReject}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  >
                    Confirm Rejection
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Alert Modal */}
      {
        alertData && (
          <AlertModal
            isOpen={showAlert}
            onClose={() => {
              setShowAlert(false);
              setAlertData(null);
            }}
            title={alertData?.title || ''}
            message={alertData?.message || ''}
            variant={alertData?.variant || 'success'}
          />
        )
      }

      {/* PDF Modal */}
      {
        selectedPdfUrl && (
          <PdfModal
            isOpen={!!selectedPdfUrl}
            onClose={() => setSelectedPdfUrl(null)}
            pdfUrl={selectedPdfUrl!}
            title={selectedPdfTitle || ''}
          />
        )
      }

      {/* Zelle Receipt Modal */}
      {
        selectedZelleUrl && (
          <ImageModal
            isOpen={!!selectedZelleUrl}
            onClose={() => setSelectedZelleUrl(null)}
            imageUrl={selectedZelleUrl!}
            title={selectedZelleTitle || ''}
          />
        )
      }
    </div >
  );
};




