import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { PdfModal } from '@/components/ui/pdf-modal';
import { ImageModal } from '@/components/ui/image-modal';
import { ArrowLeft, FileText, CheckCircle2, XCircle, Shield, CheckCircle, X, Eye, Loader2, AlertCircle, Users, Package, RefreshCcw } from 'lucide-react';
import { approveVisaContract, rejectVisaContract } from '@/lib/visa-contracts';
import { regenerateVisaDocuments } from '@/lib/visa-utils';
import { getSecureUrl } from '@/lib/storage';
import { PromptModal } from '@/components/ui/prompt-modal';
import { AlertModal } from '@/components/ui/alert-modal';

interface Order {
  id: string;
  order_number: string;
  product_slug: string;
  seller_id: string | null;
  service_request_id: string | null;
  client_name: string;
  client_email: string;
  client_whatsapp: string | null;
  client_country: string | null;
  client_nationality: string | null;
  client_observations: string | null;
  base_price_usd: string;
  extra_units: number;
  extra_unit_label: string;
  extra_unit_price_usd: string;
  calculation_type: string;
  total_price_usd: string;
  payment_method: string;
  payment_status: string;
  zelle_proof_url: string | null;
  stripe_session_id: string | null;
  contract_pdf_url: string | null;
  annex_pdf_url: string | null;
  contract_accepted: boolean | null;
  contract_signed_at: string | null;
  ip_address: string | null;
  payment_metadata: any;
  created_at: string;
  updated_at: string;
  contract_approval_status?: string | null;
  contract_approval_reviewed_by?: string | null;
  contract_approval_reviewed_at?: string | null;
  contract_rejection_reason?: string | null;
  annex_approval_status?: string | null;
  annex_approval_reviewed_by?: string | null;
  annex_approval_reviewed_at?: string | null;
  annex_rejection_reason?: string | null;
  coupon_code?: string | null;
  discount_amount?: number | null;
  // New fields
  dependent_names: string[] | null;
  upsell_product_slug: string | null;
  upsell_price_usd: string | null;
  upsell_contract_pdf_url: string | null;
  upsell_annex_pdf_url: string | null;
  service_requests?: { client_id: string } | null;
  client_id?: string; // Standardized for our logic
}

interface Schedule {
  id: string;
  status: string;
  total_installments: number;
  installments_paid: number;
  amount_per_installment: number;
  next_billing_date: string;
  installments?: Installment[];
}

interface Installment {
  id: string;
  installment_number: number;
  amount: number;
  due_date: string;
  status: string;
  notified_at: string | null;
}

interface IdentityFile {
  id: string;
  file_type: string;
  file_path: string;
  file_name: string;
}

interface TermsAcceptance {
  id: string;
  service_request_id: string;
  accepted: boolean;
  accepted_at: string | null;
  terms_version: string | null;
  accepted_ip: string | null;
  user_agent: string | null;
  data_authorization: boolean | null;
}

export const VisaOrderDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [termsAcceptance, setTermsAcceptance] = useState<TermsAcceptance | null>(null);
  const [identityFiles, setIdentityFiles] = useState<IdentityFile[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [eb2Program, setEb2Program] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [selectedPdfUrl, setSelectedPdfUrl] = useState<string | null>(null);
  const [selectedPdfTitle, setSelectedPdfTitle] = useState<string>('');
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [selectedImageTitle, setSelectedImageTitle] = useState<string>('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingContractType, setRejectingContractType] = useState<'annex' | 'contract'>('contract');
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  const [generatingSchedule, setGeneratingSchedule] = useState(false);
  const [generatingEb2Schedule, setGeneratingEb2Schedule] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertData, setAlertData] = useState<{ title: string; message: string; variant: 'success' | 'error' | 'warning' | 'info' } | null>(null);

  const handleRegenerate = async () => {
    if (!order || isRegenerating) return;
    setIsRegenerating(true);
    try {
      const result = await regenerateVisaDocuments(order.id);
      if (result.success) {
        setAlertData({
          title: 'Regeneration Started',
          message: 'Document generation has been requested. It may take a few moments to appear.',
          variant: 'success'
        });
        
        // Refresh order data
        const { data } = await supabase.from('visa_orders').select('*').eq('id', order.id).single();
        if (data) setOrder(data);
      } else {
        setAlertData({
          title: 'Error',
          message: result.error || 'Failed to regenerate documents',
          variant: 'error'
        });
      }
    } catch (err: any) {
      setAlertData({
        title: 'Error',
        message: err.message || 'An unexpected error occurred',
        variant: 'error'
      });
    } finally {
      setIsRegenerating(false);
      setShowAlert(true);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setCurrentUserId(user.id);
        }

        // Load order
        const { data: orderRaw, error: orderError } = await supabase
          .from('visa_orders')
          .select('*, service_requests(client_id)')
          .eq('id', id)
          .single();
        if (orderError || !orderRaw) {
          console.error('Order not found:', orderError);
          return;
        }

        const orderData = { 
          ...orderRaw, 
          client_id: (orderRaw.service_requests as any)?.client_id 
        };

        setOrder(orderData);

        // Load Products for names
        const { data: productsData } = await supabase
          .from('visa_products')
          .select('slug, name');
        setProducts(productsData || []);

        // Load terms acceptance if service_request_id exists
        if (orderData.service_request_id) {
          const { data: termsData, error: termsError } = await supabase
            .from('terms_acceptance')
            .select('*')
            .eq('service_request_id', orderData.service_request_id)
            .single();

          if (!termsError && termsData) {
            setTermsAcceptance(termsData);
          }

          // Load identity files
          const { data: filesData } = await supabase
            .from('identity_files')
            .select('id, file_type, file_path, file_name')
            .eq('service_request_id', orderData.service_request_id);

          if (filesData) {
            // Resolver URLs seguras para thumbnails
            const resolvedFiles = await Promise.all(filesData.map(async file => {
              // Usar path relativo diretamente (já foi migrado no banco)
              const securePath = await getSecureUrl(file.file_path);
              return { ...file, file_path: securePath || file.file_path };
            }));
            setIdentityFiles(resolvedFiles);
          }
        }

        // Resolver Zelle Proof URL (se existir e não for nulo)
        if (orderData.zelle_proof_url) {
          const secureZelleUrl = await getSecureUrl(orderData.zelle_proof_url);
          if (secureZelleUrl) {
            setOrder(prev => prev ? { ...prev, zelle_proof_url: secureZelleUrl } : null);
          }
        }

        // Load recurring billing schedule if it exists
        const { data: scheduleData } = await supabase
          .from('recurring_billing_schedules')
          .select('*, installments:billing_installments(*)')
          .eq('order_id', id)
          .maybeSingle();

        if (scheduleData) {
          // Sort installments by number
          if (scheduleData.installments) {
            scheduleData.installments.sort((a: any, b: any) => a.installment_number - b.installment_number);
          }
          setSchedule(scheduleData);
        }

        // Load EB-2 recurrence if it exists
        const { data: eb2Data } = await supabase
          .from('eb2_recurrence_control')
          .select('*, installments:eb2_recurrence_schedules(*)')
          .eq('client_id', orderData.client_id)
          .maybeSingle();

        if (eb2Data) {
          if (eb2Data.installments) {
            eb2Data.installments.sort((a: any, b: any) => a.installment_number - b.installment_number);
          }
          setEb2Program(eb2Data);
        }
      } catch (err) {
        console.error('Error loading data:', err);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      loadData();
    }
  }, [id]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500/20 text-green-300 border-green-500/50">Completed</Badge>;
      case 'paid':
        return <Badge className="bg-green-500/20 text-green-300 border-green-500/50">Paid</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/50">Pending</Badge>;
      case 'manual_pending':
        return (
          <Badge className="bg-amber-500/20 text-amber-200 border-amber-500/50 animate-pulse whitespace-nowrap">
            Awaiting Approval
          </Badge>
        );
      case 'failed':
        return <Badge className="bg-red-500/20 text-red-300 border-red-500/50">Failed</Badge>;
      case 'cancelled':
        return <Badge className="bg-gray-500/20 text-gray-300 border-gray-500/50">Cancelled</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getApprovalStatusBadge = (status: string | null | undefined) => {
    if (!status) return null;
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500/20 text-green-300 border-green-500/50">Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500/20 text-red-300 border-red-500/50">Rejected</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/50">Pending Review</Badge>;
      default:
        return null;
    }
  };

  const handleApprove = async (contractType: 'annex' | 'contract') => {
    if (!order || !currentUserId) return;

    setProcessingAction(`approve-${contractType}`);
    try {
      const result = await approveVisaContract(order.id, currentUserId, contractType);
      if (result.success) {
        // Reload order data
        const { data: orderData } = await supabase
          .from('visa_orders')
          .select('*')
          .eq('id', order.id)
          .single();
        if (orderData) {
          setOrder(orderData);
        }
        setAlertData({
          title: 'Success',
          message: `${contractType === 'annex' ? 'ANNEX I' : 'Contract'} approved successfully!`,
          variant: 'success',
        });
        setShowAlert(true);
      } else {
        setAlertData({
          title: 'Error',
          message: `Failed to approve ${contractType === 'annex' ? 'ANNEX I' : 'Contract'}: ` + (result.error || 'Unknown error'),
          variant: 'error',
        });
        setShowAlert(true);
      }
    } catch (err) {
      console.error(`Error approving ${contractType}:`, err);
      setAlertData({
        title: 'Error',
        message: `An error occurred while approving the ${contractType === 'annex' ? 'ANNEX I' : 'Contract'}`,
        variant: 'error',
      });
      setShowAlert(true);
    } finally {
      setProcessingAction(null);
    }
  };

  const handleReject = async (contractType: 'annex' | 'contract', reason?: string) => {
    if (!order || !currentUserId) return;

    setProcessingAction(`reject-${contractType}`);
    try {
      const result = await rejectVisaContract(order.id, currentUserId, reason || undefined, contractType);
      if (result.success) {
        // Reload order data
        const { data: orderData } = await supabase
          .from('visa_orders')
          .select('*')
          .eq('id', order.id)
          .single();
        if (orderData) {
          setOrder(orderData);
        }
        setShowRejectModal(false);
        setAlertData({
          title: `${contractType === 'annex' ? 'ANNEX I' : 'Contract'} Rejected`,
          message: `${contractType === 'annex' ? 'ANNEX I' : 'Contract'} rejected. An email has been sent to the client with instructions to resubmit documents.`,
          variant: 'success',
        });
        setShowAlert(true);
      } else {
        setAlertData({
          title: 'Error',
          message: `Failed to reject ${contractType === 'annex' ? 'ANNEX I' : 'Contract'}: ` + (result.error || 'Unknown error'),
          variant: 'error',
        });
        setShowAlert(true);
      }
    } catch (err) {
      console.error(`Error rejecting ${contractType}:`, err);
      setAlertData({
        title: 'Error',
        message: `An error occurred while rejecting the ${contractType === 'annex' ? 'ANNEX I' : 'Contract'}`,
        variant: 'error',
      });
      setShowAlert(true);
    } finally {
      setProcessingAction(null);
    }
  };

  const handleGenerateSchedule = async () => {
    if (!id || !order) return;
    setGeneratingSchedule(true);
    try {
      const { error } = await supabase.functions.invoke('setup-recurring-billing', {
        body: { 
          order_id: id,
          client_id: order.client_id 
        }
      });

      if (error) throw error;

      setAlertData({
        title: 'Success',
        message: 'Recurring billing schedule generated successfully!',
        variant: 'success'
      });
      setShowAlert(true);

      // Reload schedule
      const { data: scheduleData } = await supabase
        .from('recurring_billing_schedules')
        .select('*, installments:billing_installments(*)')
        .eq('order_id', id)
        .maybeSingle();

      if (scheduleData) {
        if (scheduleData.installments) {
          scheduleData.installments.sort((a: any, b: any) => a.installment_number - b.installment_number);
        }
        setSchedule(scheduleData);
      }
    } catch (err: any) {
      console.error('Error generating schedule:', err);
      setAlertData({
        title: 'Error',
        message: 'Failed to generate schedule: ' + (err.message || 'Unknown error'),
        variant: 'error'
      });
      setShowAlert(true);
    } finally {
      setGeneratingSchedule(false);
    }
  };

  const handleGenerateEb2Schedule = async () => {
    if (!id || !order) return;
    setGeneratingEb2Schedule(true);
    try {
      const { error } = await supabase.functions.invoke('setup-eb2-recurring-billing', {
        body: { 
          order_id: id,
          client_id: order.client_id
        }
      });

      if (error) throw error;

      setAlertData({
        title: 'Success',
        message: 'EB-2 Recurring plan (20 installments) generated successfully!',
        variant: 'success'
      });
      setShowAlert(true);

      // Reload EB-2 data
      const { data: eb2Data } = await supabase
        .from('eb2_recurrence_control')
        .select('*, installments:eb2_recurrence_schedules(*)')
        .eq('client_id', order.client_id)
        .maybeSingle();

      if (eb2Data) {
        if (eb2Data.installments) {
          eb2Data.installments.sort((a: any, b: any) => a.installment_number - b.installment_number);
        }
        setEb2Program(eb2Data);
      }
    } catch (err: any) {
      console.error('Error generating EB-2 schedule:', err);
      setAlertData({
        title: 'Error',
        message: 'Failed to generate EB-2 plan: ' + (err.message || 'Unknown error'),
        variant: 'error'
      });
      setShowAlert(true);
    } finally {
      setGeneratingEb2Schedule(false);
    }
  };

  const getProductName = (slug: string) => {
    return products.find(p => p.slug === slug)?.name || slug;
  };

  const getDocumentUrl = (filePath: string): string => {
    return filePath; // As URLs já são resolvidas no carregamento
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-medium mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
          <CardContent className="p-6 text-center">
            <p className="text-red-300 mb-4">Order not found</p>
            <Link to="/dashboard/visa-orders">
              <Button variant="outline" className="border-gold-medium/50 bg-black/50 text-white hover:bg-gold-medium/30">
                Back to Orders
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link to="/dashboard/visa-orders" className="inline-flex items-center text-gold-light hover:text-gold-medium transition mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Orders
          </Link>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold migma-gold-text">Order Details</h1>
              <p className="text-gray-400 mt-1">Order #{order.order_number}</p>
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              {getStatusBadge(order.payment_status)}
              {order.annex_pdf_url && getApprovalStatusBadge(order.annex_approval_status)}
              {order.contract_pdf_url && getApprovalStatusBadge(order.contract_approval_status)}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Action Card: Generate EB-3 Schedule */}
          {!schedule && getProductName(order?.product_slug || '') === 'INITIAL Application - Full Process Payment' && order?.payment_status === 'paid' && (
            <Card className="bg-gold-medium/10 border border-gold-medium/50 overflow-hidden">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="flex items-start gap-4">
                    <div className="bg-gold-medium/20 p-3 rounded-full hidden sm:block">
                      <AlertCircle className="w-6 h-6 text-gold-light" />
                    </div>
                    <div>
                      <h3 className="text-gold-light font-bold flex items-center gap-2">
                        EB-3 Recurring Billing Not Found
                      </h3>
                      <p className="text-gray-400 text-sm max-w-md">This EB-3 order does not have a recurring schedule yet. You can manually generate it here.</p>
                    </div>
                  </div>
                  <Button
                    onClick={handleGenerateSchedule}
                    disabled={generatingSchedule}
                    className="bg-gold-medium hover:bg-gold-dark text-black font-bold whitespace-nowrap"
                  >
                    {generatingSchedule ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <FileText className="w-4 h-4 mr-2" />}
                    Generate EB-3 Schedule
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Card: Generate EB-2 Schedule */}
          {!eb2Program && order?.product_slug === 'eb2-visa' && order?.payment_status === 'paid' && (
            <Card className="bg-blue-500/10 border border-blue-500/50 overflow-hidden">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="flex items-start gap-4">
                    <div className="bg-blue-500/20 p-3 rounded-full hidden sm:block">
                      <AlertCircle className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-blue-400 font-bold flex items-center gap-2">
                        EB-2 Recurring Plan Not Found
                      </h3>
                      <p className="text-gray-400 text-sm max-w-md">This EB-2 order is eligible for the 20-installment maintenance plan ($999/mo). Activate it now.</p>
                    </div>
                  </div>
                  <Button
                    onClick={handleGenerateEb2Schedule}
                    disabled={generatingEb2Schedule}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold whitespace-nowrap"
                  >
                    {generatingEb2Schedule ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <RefreshCcw className="w-4 h-4 mr-2" />}
                    Activate EB-2 Plan (20x)
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Product & Financial Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30 col-span-1 md:col-span-2">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Package className="w-5 h-5 text-gold-light" />
                  Product & Financial Details
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Main Product */}
                <div className="space-y-3">
                  <h4 className="text-gold-light font-semibold mb-2 border-b border-gold-medium/20 pb-1">Primary Product</h4>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Product:</span>
                    <span className="text-white font-semibold uppercase">{getProductName(order.product_slug)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Base Price:</span>
                    <span className="text-white">${parseFloat(order.base_price_usd).toFixed(2)}</span>
                  </div>
                  {order.extra_units > 0 && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-400">{order.extra_unit_label}:</span>
                        <span className="text-white font-bold">{order.extra_units}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Price per unit:</span>
                        <span className="text-white px-2 py-0.5 bg-white/5 rounded text-xs">${parseFloat(order.extra_unit_price_usd).toFixed(2)}</span>
                      </div>

                      {/* Dependents list */}
                      {order.dependent_names && order.dependent_names.length > 0 && (
                        <div className="mt-2 bg-black/20 p-3 rounded border border-white/5">
                          <span className="text-gray-500 text-xs block mb-2 uppercase tracking-wider">Dependents</span>
                          <ul className="space-y-1">
                            {order.dependent_names.map((name, idx) => (
                              <li key={idx} className="text-gray-300 text-sm flex items-center gap-2">
                                <Users className="w-3 h-3 text-gold-medium" />
                                {name}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Upsell / Bundle Information */}
                <div className="space-y-3">
                  {order.upsell_product_slug ? (
                    <>
                      <h4 className="text-gold-light font-semibold mb-2 border-b border-gold-medium/20 pb-1">Bundle / Add-ons</h4>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Bundle:</span>
                        <Badge className="bg-gold-medium/20 text-gold-light border-gold-medium/50 uppercase">
                          + {getProductName(order.upsell_product_slug)}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Bundle Price:</span>
                        <span className="text-white">${parseFloat(order.upsell_price_usd || '0').toFixed(2)}</span>
                      </div>
                      {order.upsell_contract_pdf_url && (
                        <div className="mt-3">
                          <p className="text-gray-400 text-xs mb-1">Bundle Contract:</p>
                          <a
                            target="_blank"
                            rel="noopener noreferrer"
                            href={order.upsell_contract_pdf_url}
                            className="text-blue-400 text-sm hover:underline flex items-center gap-1"
                          >
                            <FileText className="w-3 h-3" /> View Contract
                          </a>
                        </div>
                      )}
                      {order.upsell_annex_pdf_url && (
                        <div className="mt-2">
                          <p className="text-gray-400 text-xs mb-1">Bundle Annex I:</p>
                          <a
                            target="_blank"
                            rel="noopener noreferrer"
                            href={order.upsell_annex_pdf_url}
                            className="text-blue-400 text-sm hover:underline flex items-center gap-1"
                          >
                            <FileText className="w-3 h-3" /> View Annex I
                          </a>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="h-full flex items-center justify-center opacity-30">
                      <div className="text-center">
                        <Package className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">No add-ons or bundles</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>

              <div className="border-t border-gold-medium/30 p-6 bg-black/20">
                <div className="flex flex-col gap-2">
                  {order.coupon_code && (
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-green-400">Discount Applied:</span>
                        <Badge variant="secondary" className="bg-green-500/20 text-green-300 hover:bg-green-500/30 font-mono text-xs border border-green-500/30">
                          {order.coupon_code}
                        </Badge>
                      </div>
                      <span className="text-green-400 font-bold">-${parseFloat(String(order.discount_amount || 0)).toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-end mt-2">
                    <span className="text-xl text-white font-bold">Total Order Value:</span>
                    <div className="text-right">
                      <span className="text-3xl font-bold text-gold-light">${parseFloat(order.total_price_usd).toFixed(2)}</span>
                      <p className="text-xs text-gray-500 mt-1">Includes Base + Dependents + Bundle</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Generated Documents Section */}
            <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30 col-span-1 md:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-gold-light" />
                  Generated Documents
                </CardTitle>
                {(order.payment_status === 'paid' || order.payment_status === 'completed') && order.payment_method !== 'manual' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRegenerate}
                    disabled={isRegenerating}
                    className="border-gold-medium/30 bg-gold-medium/10 text-gold-light hover:bg-gold-medium/20 text-xs"
                  >
                    <RefreshCcw className={`w-3 h-3 mr-2 ${isRegenerating ? 'animate-spin' : ''}`} />
                    {isRegenerating ? 'Regenerating...' : 'Regenerate All'}
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Annex I */}
                  <div className="p-4 bg-black/20 rounded-lg border border-white/5 flex flex-col items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gold-medium/10 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-gold-light" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-white">Annex I</p>
                      <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">Service Components</p>
                    </div>
                    {order.annex_pdf_url ? (
                      <Button
                        variant="link"
                        onClick={() => {
                          setSelectedPdfUrl(order.annex_pdf_url);
                          setSelectedPdfTitle(`Annex I - ${order.client_name}`);
                          setShowPdfModal(true);
                        }}
                        className="text-gold-light text-xs hover:text-gold-medium"
                      >
                        <Eye className="w-3 h-3 mr-1" /> View Document
                      </Button>
                    ) : (
                      <span className="text-[10px] text-amber-500/50 italic">Not generated yet</span>
                    )}
                  </div>

                  {/* Contract */}
                  <div className="p-4 bg-black/20 rounded-lg border border-white/5 flex flex-col items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gold-medium/10 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-gold-light" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-white">Contract</p>
                      <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">Legal Terms</p>
                    </div>
                    {order.contract_pdf_url ? (
                      <Button
                        variant="link"
                        onClick={() => {
                          setSelectedPdfUrl(order.contract_pdf_url);
                          setSelectedPdfTitle(`Contract - ${order.client_name}`);
                          setShowPdfModal(true);
                        }}
                        className="text-gold-light text-xs hover:text-gold-medium"
                      >
                        <Eye className="w-3 h-3 mr-1" /> View Document
                      </Button>
                    ) : (
                      <span className="text-[10px] text-amber-500/50 italic">Not generated yet</span>
                    )}
                  </div>

                  {/* Invoice */}
                  <div className="p-4 bg-black/20 rounded-lg border border-white/5 flex flex-col items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gold-medium/10 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-gold-light" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-white">Invoice</p>
                      <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider">Financial Record</p>
                    </div>
                    {order.payment_metadata?.invoice_pdf_url ? (
                      <Button
                        variant="link"
                        onClick={() => {
                          setSelectedPdfUrl(order.payment_metadata.invoice_pdf_url);
                          setSelectedPdfTitle(`Invoice - ${order.client_name}`);
                          setShowPdfModal(true);
                        }}
                        className="text-gold-light text-xs hover:text-gold-medium"
                      >
                        <Eye className="w-3 h-3 mr-1" /> View Document
                      </Button>
                    ) : (
                      <span className="text-[10px] text-amber-500/50 italic">Not generated yet</span>
                    )}
                  </div>
                </div>

                {(!order.annex_pdf_url || !order.contract_pdf_url || !order.payment_metadata?.invoice_pdf_url) && 
                  (order.payment_status === 'paid' || order.payment_status === 'completed') && (
                  <div className="mt-4 p-3 bg-amber-500/5 border border-amber-500/20 rounded flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                    <p className="text-[11px] text-amber-200/80 leading-relaxed">
                      Oops! It seems some documents are missing. This usually happens due to connection timeouts during payment processing. 
                      Click the <strong className="text-amber-500">"Regenerate All"</strong> button above to trigger manual document creation.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Client Information */}
          <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
            <CardHeader>
              <CardTitle className="text-white">Client Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex justify-between p-3 bg-white/5 rounded">
                  <span className="text-gray-400">Name:</span>
                  <span className="text-white font-medium">{order.client_name}</span>
                </div>
                <div className="flex justify-between p-3 bg-white/5 rounded">
                  <span className="text-gray-400">Email:</span>
                  <span className="text-white font-medium">{order.client_email}</span>
                </div>
                {order.client_whatsapp && (
                  <div className="flex justify-between p-3 bg-white/5 rounded">
                    <span className="text-gray-400">WhatsApp:</span>
                    <span className="text-white">{order.client_whatsapp}</span>
                  </div>
                )}
                {order.client_country && (
                  <div className="flex justify-between p-3 bg-white/5 rounded">
                    <span className="text-gray-400">Country:</span>
                    <span className="text-white">{order.client_country}</span>
                  </div>
                )}
                {order.client_nationality && (
                  <div className="flex justify-between p-3 bg-white/5 rounded">
                    <span className="text-gray-400">Nationality:</span>
                    <span className="text-white">{order.client_nationality}</span>
                  </div>
                )}
              </div>
              {order.client_observations && (
                <div className="pt-3 border-t border-gold-medium/30 mt-4">
                  <p className="text-gray-400 mb-2 text-sm font-semibold">Client Observations:</p>
                  <div className="bg-black/30 p-4 rounded text-gray-300 text-sm border border-white/10">
                    {order.client_observations}
                  </div>
                </div>
              )}
              {order.payment_metadata?.admin_note && (
                <div className="pt-3 border-t border-gold-medium/30 mt-4">
                  <p className="text-gold-light mb-2 text-sm font-semibold flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Internal Admin Notes:
                  </p>
                  <div className="bg-gold-medium/10 p-4 rounded text-gold-light/90 text-sm border border-gold-medium/20">
                    {order.payment_metadata.admin_note}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payer Information (Third-Party) */}
          {order.payment_metadata?.payer_info && order.payment_metadata.payer_info.name && (
            <Card className="bg-gradient-to-br from-blue-500/10 via-blue-800/5 to-blue-900/10 border border-blue-500/30">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  < Shield className="w-5 h-5 text-blue-400" />
                  Third-Party Payer Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex justify-between p-3 bg-white/5 rounded">
                    <span className="text-gray-400">Payer Name:</span>
                    <span className="text-white font-medium">{order.payment_metadata.payer_info.name}</span>
                  </div>
                  {order.payment_metadata.payer_info.cpf && (
                    <div className="flex justify-between p-3 bg-white/5 rounded">
                      <span className="text-gray-400">Payer CPF:</span>
                      <span className="text-white font-medium">{order.payment_metadata.payer_info.cpf}</span>
                    </div>
                  )}
                  {order.payment_metadata.payer_info.email && (
                    <div className="flex justify-between p-3 bg-white/5 rounded">
                      <span className="text-gray-400">Payer Email:</span>
                      <span className="text-white">{order.payment_metadata.payer_info.email}</span>
                    </div>
                  )}
                  {order.payment_metadata.payer_info.phone && (
                    <div className="flex justify-between p-3 bg-white/5 rounded">
                      <span className="text-gray-400">Payer Phone:</span>
                      <span className="text-white">{order.payment_metadata.payer_info.phone}</span>
                    </div>
                  )}
                </div>
                <div className="mt-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded">
                  <p className="text-blue-300 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3" />
                    Transaction authorized by a third party. Payer information recorded for security.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Anti-Chargeback & Terms Acceptance */}
          <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-gold-light" />
                Anti-Chargeback & Terms Acceptance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {termsAcceptance ? (
                <>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Terms Accepted:</span>
                      {termsAcceptance.accepted ? (
                        <div className="flex items-center gap-2 text-green-300">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Yes</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-red-300">
                          <XCircle className="w-4 h-4" />
                          <span>No</span>
                        </div>
                      )}
                    </div>
                    {termsAcceptance.terms_version && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Terms Version:</span>
                        <span className="text-white font-mono text-sm">{termsAcceptance.terms_version}</span>
                      </div>
                    )}
                    {termsAcceptance.accepted_at && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Accepted At:</span>
                        <span className="text-white">{new Date(termsAcceptance.accepted_at).toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Data Authorization:</span>
                      {termsAcceptance.data_authorization ? (
                        <div className="flex items-center gap-2 text-green-300">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Authorized</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-red-300">
                          <XCircle className="w-4 h-4" />
                          <span>Not Authorized</span>
                        </div>
                      )}
                    </div>
                    {termsAcceptance.accepted_ip && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">IP Address:</span>
                        <span className="text-white font-mono text-sm">{termsAcceptance.accepted_ip}</span>
                      </div>
                    )}
                    {termsAcceptance.user_agent && (
                      <div className="pt-3 border-t border-gold-medium/30">
                        <p className="text-gray-400 mb-1 text-sm">User Agent:</p>
                        <p className="text-white text-xs font-mono break-all bg-black/30 p-2 rounded border border-white/5">{termsAcceptance.user_agent}</p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Contract Accepted:</span>
                    {order.contract_accepted ? (
                      <div className="flex items-center gap-2 text-green-300">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Yes</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-yellow-300">
                        <XCircle className="w-4 h-4" />
                        <span>Not recorded</span>
                      </div>
                    )}
                  </div>
                  {order.contract_signed_at && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Contract Signed At:</span>
                      <span className="text-white">{new Date(order.contract_signed_at).toLocaleString()}</span>
                    </div>
                  )}
                  {order.ip_address && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">IP Address:</span>
                      <span className="text-white font-mono text-sm">{order.ip_address}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded">
                    <AlertCircle className="w-4 h-4 text-yellow-400" />
                    <p className="text-yellow-200 text-xs">
                      Note: Detailed terms acceptance log not found. This order may predate the latest tracking system.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Documents Section */}
          {identityFiles.length > 0 && (
            <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
              <CardHeader>
                <CardTitle className="text-white">Identity Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {identityFiles.map((file) => (
                    <div key={file.id} className="space-y-2 group">
                      <p className="text-sm text-gray-400 capitalize flex items-center gap-2">
                        <FileText className="w-3 h-3 text-gold-medium" />
                        {file.file_type.replace('_', ' ')}
                      </p>
                      <div className="relative overflow-hidden rounded-lg border border-gold-medium/30 bg-black/40">
                        <img
                          src={getDocumentUrl(file.file_path)}
                          alt={file.file_type}
                          className="w-full h-48 object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                          onClick={() => {
                            setSelectedImageUrl(getDocumentUrl(file.file_path));
                            setSelectedImageTitle(`${file.file_type.replace('_', ' ').toUpperCase()} - ${order?.client_name}`);
                            setShowImageModal(true);
                          }}
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                          <Badge className="bg-black/70 hover:bg-black/90 text-white border-white/20">
                            <Eye className="w-3 h-3 mr-1" /> View Image
                          </Badge>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 truncate font-mono">{file.file_name}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Contract Approval Actions */}
          <div className="space-y-4">
            {/* ANNEX I Approval */}
            {order.annex_pdf_url && order.annex_approval_status !== 'approved' && (
              <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
                <CardHeader>
                  <CardTitle className="text-white">ANNEX I Approval</CardTitle>
                </CardHeader>
                <CardContent>
                  {order.annex_approval_status === 'rejected' ? (
                    <div className="space-y-4">
                      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <h4 className="text-yellow-300 font-semibold mb-1">Awaiting Document Resubmission</h4>
                            <p className="text-gray-300 text-sm">
                              ANNEX I was rejected and a resubmission link has been sent to the client.
                              The document will return to pending status once the client resubmits.
                            </p>
                            {order.annex_rejection_reason && (
                              <div className="mt-3 pt-3 border-t border-yellow-500/20">
                                <p className="text-xs text-gray-400 mb-1">Rejection Reason:</p>
                                <p className="text-yellow-200 text-sm">{order.annex_rejection_reason}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      {order.annex_approval_reviewed_at && (
                        <p className="text-xs text-gray-400">
                          Rejected on: {new Date(order.annex_approval_reviewed_at).toLocaleString()}
                          {order.annex_approval_reviewed_by && (
                            <span className="ml-2">by {order.annex_approval_reviewed_by}</span>
                          )}
                        </p>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-4">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setSelectedPdfUrl(order.annex_pdf_url);
                            setSelectedPdfTitle(`ANNEX I - ${order.order_number}`);
                            setShowPdfModal(true);
                          }}
                          className="border-gold-medium/50 bg-black/50 text-gold-light hover:bg-black hover:border-gold-medium hover:text-gold-medium"
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          View Document
                        </Button>
                        <Button
                          onClick={() => handleApprove('annex')}
                          disabled={!!processingAction}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        >
                          {processingAction === 'approve-annex' ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Approve ANNEX I
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={() => {
                            setRejectingContractType('annex');
                            setShowRejectModal(true);
                          }}
                          disabled={!!processingAction}
                          variant="destructive"
                          className="flex-1 bg-red-600 hover:bg-red-700"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Reject ANNEX I
                        </Button>
                      </div>
                      {order.annex_approval_reviewed_at && (
                        <p className="text-xs text-gray-400 mt-4">
                          Last reviewed: {new Date(order.annex_approval_reviewed_at).toLocaleString()}
                        </p>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Contract Approval */}
            {order.contract_pdf_url && order.contract_approval_status !== 'approved' && (
              <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
                <CardHeader>
                  <CardTitle className="text-white">Contract Approval</CardTitle>
                </CardHeader>
                <CardContent>
                  {order.contract_approval_status === 'rejected' ? (
                    <div className="space-y-4">
                      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <h4 className="text-yellow-300 font-semibold mb-1">Awaiting Document Resubmission</h4>
                            <p className="text-gray-300 text-sm">
                              This contract was rejected and a resubmission link has been sent to the client.
                              The contract will return to pending status once the client resubmits their documents.
                            </p>
                            {order.contract_rejection_reason && (
                              <div className="mt-3 pt-3 border-t border-yellow-500/20">
                                <p className="text-xs text-gray-400 mb-1">Rejection Reason:</p>
                                <p className="text-yellow-200 text-sm">{order.contract_rejection_reason}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      {order.contract_approval_reviewed_at && (
                        <p className="text-xs text-gray-400">
                          Rejected on: {new Date(order.contract_approval_reviewed_at).toLocaleString()}
                          {order.contract_approval_reviewed_by && (
                            <span className="ml-2">by {order.contract_approval_reviewed_by}</span>
                          )}
                        </p>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-4">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setSelectedPdfUrl(order.contract_pdf_url);
                            setSelectedPdfTitle(`Contract - ${order.order_number}`);
                            setShowPdfModal(true);
                          }}
                          className="border-gold-medium/50 bg-black/50 text-gold-light hover:bg-black hover:border-gold-medium hover:text-gold-medium"
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          View Document
                        </Button>
                        <Button
                          onClick={() => handleApprove('contract')}
                          disabled={!!processingAction}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        >
                          {processingAction === 'approve-contract' ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Approve Contract
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={() => {
                            setRejectingContractType('contract');
                            setShowRejectModal(true);
                          }}
                          disabled={!!processingAction}
                          variant="destructive"
                          className="flex-1 bg-red-600 hover:bg-red-700"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Reject Contract
                        </Button>
                      </div>
                      {order.contract_approval_reviewed_at && (
                        <p className="text-xs text-gray-400 mt-4">
                          Last reviewed: {new Date(order.contract_approval_reviewed_at).toLocaleString()}
                        </p>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* EB-2 Plan Status Display */}
            {eb2Program && (
              <Card className="bg-gradient-to-br from-blue-500/10 via-blue-800/5 to-blue-900/10 border border-blue-500/30">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-white flex items-center gap-2">
                    <RefreshCcw className="w-5 h-5 text-blue-400" />
                    EB-2 Recurring Maintenance
                  </CardTitle>
                  <Link to={`/dashboard/eb2-recurring/${eb2Program.client_id}`}>
                    <Button variant="outline" size="sm" className="border-blue-500/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 text-xs">
                      View Full Schedule
                    </Button>
                  </Link>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="p-3 bg-black/40 rounded border border-blue-500/20">
                      <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-1">Status</p>
                      <Badge className={cn(
                        "font-bold uppercase",
                        eb2Program.program_status === 'active' ? "bg-green-500/20 text-green-300 border-green-500/50" : "bg-red-500/20 text-red-300 border-red-500/50"
                      )}>
                        {eb2Program.program_status}
                      </Badge>
                    </div>
                    <div className="p-3 bg-black/40 rounded border border-blue-500/20">
                      <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-1">Progress</p>
                      <p className="text-white font-bold">{eb2Program.installments_paid} / {eb2Program.total_installments} Paid</p>
                    </div>
                    <div className="p-3 bg-black/40 rounded border border-blue-500/20">
                      <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-1">Price/Mo</p>
                      <p className="text-blue-300 font-bold">$999.00</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs text-gray-400 font-medium">Recent Installments:</p>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {eb2Program.installments?.slice(0, 5).map((inst: any) => (
                        <div key={inst.id} className="p-2 bg-black/20 rounded border border-white/5 text-center">
                          <p className="text-[10px] text-gray-500 mb-1">#{inst.installment_number}</p>
                          <Badge className={cn(
                            "text-[9px] px-1 py-0",
                            inst.status === 'paid' ? "bg-green-500/20 text-green-400" : 
                            inst.status === 'overdue' ? "bg-red-500/20 text-red-400" :
                            "bg-gray-500/20 text-gray-400"
                          )}>
                            {inst.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Contract PDF Modal */}
      <PdfModal
        isOpen={showPdfModal}
        onClose={() => setShowPdfModal(false)}
        pdfUrl={selectedPdfUrl || ''}
        title={selectedPdfTitle}
      />

      {/* Image Modal for Documents */}
      <ImageModal
        isOpen={showImageModal}
        onClose={() => setShowImageModal(false)}
        imageUrl={selectedImageUrl || ''}
        title={selectedImageTitle}
      />

      {/* Rejection Modal */}
      <PromptModal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        onConfirm={(reason) => handleReject(rejectingContractType, reason)}
        title={`Reject ${rejectingContractType === 'annex' ? 'ANNEX I' : 'Contract'}`}
        message={`Please provide a reason for rejecting this ${rejectingContractType === 'annex' ? 'ANNEX I' : 'contract'}. The client will be notified via email.`}
        confirmText="Reject Contract"
        cancelText="Cancel"
        placeholder="Enter rejection reason..."
        variant="danger"
      />

      {/* Alerts */}
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
