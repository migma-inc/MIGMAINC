import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PdfModal } from '@/components/ui/pdf-modal';
import { ImageModal } from '@/components/ui/image-modal';
import { ArrowLeft, FileText, CheckCircle2, XCircle, Shield, CheckCircle, X, Eye, Loader2, AlertCircle } from 'lucide-react';
import { approveVisaContract, rejectVisaContract } from '@/lib/visa-contracts';
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
  const [termsAcceptance, setTermsAcceptance] = useState<TermsAcceptance | null>(null);
  const [identityFiles, setIdentityFiles] = useState<IdentityFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [selectedPdfUrl, setSelectedPdfUrl] = useState<string | null>(null);
  const [selectedPdfTitle, setSelectedPdfTitle] = useState<string>('');
  const [showZelleModal, setShowZelleModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingContractType, setRejectingContractType] = useState<'annex' | 'contract'>('contract');
  const [rejectionReason, setRejectionReason] = useState('');
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showAlert, setShowAlert] = useState(false);
  const [alertData, setAlertData] = useState<{ title: string; message: string; variant: 'success' | 'error' | 'warning' | 'info' } | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setCurrentUserId(user.id);
        }

        // Load order
        const { data: orderData, error: orderError } = await supabase
          .from('visa_orders')
          .select('*')
          .eq('id', id)
          .single();

        if (orderError || !orderData) {
          console.error('Order not found:', orderError);
          return;
        }

        setOrder(orderData);

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
          const { data: filesData, error: filesError } = await supabase
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
        setRejectionReason('');
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
          {/* Product Information */}
          <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
            <CardHeader>
              <CardTitle className="text-white">Product Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Product:</span>
                <span className="text-white font-semibold">{order.product_slug}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Base Price:</span>
                <span className="text-white">${parseFloat(order.base_price_usd).toFixed(2)}</span>
              </div>
              {order.extra_units > 0 && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-400">{order.extra_unit_label}:</span>
                    <span className="text-white">{order.extra_units}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Price per unit:</span>
                    <span className="text-white">${parseFloat(order.extra_unit_price_usd).toFixed(2)}</span>
                  </div>
                </>
              )}
              <div className="border-t border-gold-medium/30 pt-3 mt-3 flex justify-between">
                <span className="text-white font-bold">Total:</span>
                <span className="text-xl sm:text-2xl font-bold text-gold-light">${parseFloat(order.total_price_usd).toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Client Information */}
          <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
            <CardHeader>
              <CardTitle className="text-white">Client Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Name:</span>
                <span className="text-white">{order.client_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Email:</span>
                <span className="text-white">{order.client_email}</span>
              </div>
              {order.client_whatsapp && (
                <div className="flex justify-between">
                  <span className="text-gray-400">WhatsApp:</span>
                  <span className="text-white">{order.client_whatsapp}</span>
                </div>
              )}
              {order.client_country && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Country:</span>
                  <span className="text-white">{order.client_country}</span>
                </div>
              )}
              {order.client_nationality && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Nationality:</span>
                  <span className="text-white">{order.client_nationality}</span>
                </div>
              )}
              {order.client_observations && (
                <div className="pt-3 border-t border-gold-medium/30">
                  <p className="text-gray-400 mb-2">Observations:</p>
                  <p className="text-white">{order.client_observations}</p>
                </div>
              )}
            </CardContent>
          </Card>

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
                        <p className="text-white text-xs font-mono break-all">{termsAcceptance.user_agent}</p>
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
                  <p className="text-yellow-300 text-sm italic">
                    Note: Terms acceptance record not found. This order may have been created before the new system was implemented.
                  </p>
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
                    <div key={file.id} className="space-y-2">
                      <p className="text-sm text-gray-400 capitalize">
                        {file.file_type.replace('_', ' ')}
                      </p>
                      <div className="relative group">
                        <img
                          src={getDocumentUrl(file.file_path)}
                          alt={file.file_type}
                          className="w-full h-48 object-cover rounded-lg border border-gold-medium/30 cursor-pointer hover:opacity-80 transition"
                          onClick={() => window.open(getDocumentUrl(file.file_path), '_blank')}
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                          <Eye className="w-6 h-6 text-white" />
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 truncate">{file.file_name}</p>
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
          </div>

          {/* Payment Information */}
          <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
            <CardHeader>
              <CardTitle className="text-white">Payment Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Payment Method:</span>
                <span className="text-white capitalize">
                  {order.payment_method === 'manual' ? 'Manual by Seller' : order.payment_method.replace('_', ' ')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Payment Status:</span>
                {getStatusBadge(order.payment_status)}
              </div>
              {order.stripe_session_id && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Stripe Session:</span>
                  <span className="text-white font-mono text-xs">{order.stripe_session_id.substring(0, 20)}...</span>
                </div>
              )}
              {order.zelle_proof_url && (
                <div className="pt-3 border-t border-gold-medium/30">
                  <p className="text-gray-400 mb-2">Zelle Receipt:</p>
                  <Button
                    variant="outline"
                    onClick={() => setShowZelleModal(true)}
                    className="border-gold-medium/50 bg-black/50 text-gold-light hover:bg-black hover:border-gold-medium hover:text-gold-medium"
                  >
                    View Receipt
                  </Button>
                </div>
              )}
              {(order.annex_pdf_url || order.contract_pdf_url) && (
                <div className="pt-3 border-t border-gold-medium/30">
                  <p className="text-gray-400 mb-2">Contracts:</p>
                  <div className="flex flex-wrap gap-2">
                    {order.annex_pdf_url && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedPdfUrl(order.annex_pdf_url);
                          setSelectedPdfTitle(`ANNEX I - ${order.order_number}`);
                          setShowPdfModal(true);
                        }}
                        className="border-gold-medium/50 bg-black/50 text-gold-light hover:bg-black hover:border-gold-medium hover:text-gold-medium"
                      >
                        <FileText className="w-4 h-4 mr-1" />
                        View ANNEX I
                      </Button>
                    )}
                    {order.contract_pdf_url && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedPdfUrl(order.contract_pdf_url);
                          setSelectedPdfTitle(`Contract - ${order.order_number}`);
                          setShowPdfModal(true);
                        }}
                        className="border-gold-medium/50 bg-black/50 text-gold-light hover:bg-black hover:border-gold-medium hover:text-gold-medium"
                      >
                        <FileText className="w-4 h-4 mr-1" />
                        View Contract
                      </Button>
                    )}
                    {(order.payment_metadata as any)?.invoice_pdf_url && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedPdfUrl((order.payment_metadata as any).invoice_pdf_url);
                          setSelectedPdfTitle(`Invoice - ${order.order_number}`);
                          setShowPdfModal(true);
                        }}
                        className="border-gold-medium/50 bg-black/50 text-gold-light hover:bg-black hover:border-gold-medium hover:text-gold-medium"
                      >
                        <FileText className="w-4 h-4 mr-1" />
                        View Invoice
                      </Button>
                    )}
                  </div>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Order Date:</span>
                <span className="text-white">{new Date(order.created_at).toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* PDF Modal */}
      {
        selectedPdfUrl && (
          <PdfModal
            isOpen={showPdfModal}
            onClose={() => {
              setShowPdfModal(false);
              setSelectedPdfUrl(null);
              setSelectedPdfTitle('');
            }}
            pdfUrl={selectedPdfUrl}
            title={selectedPdfTitle}
          />
        )
      }

      {/* Zelle Receipt Modal */}
      {
        order?.zelle_proof_url && (
          <ImageModal
            isOpen={showZelleModal}
            onClose={() => setShowZelleModal(false)}
            imageUrl={order.zelle_proof_url}
            title={`Zelle Receipt - ${order.order_number}`}
          />
        )
      }

      {/* Reject Contract Modal */}
      <PromptModal
        isOpen={showRejectModal}
        onClose={() => {
          setShowRejectModal(false);
          setRejectionReason('');
        }}
        onConfirm={(reason) => {
          setRejectionReason(reason);
          handleReject(rejectingContractType, reason);
        }}
        title={`Reject ${rejectingContractType === 'annex' ? 'ANNEX I' : 'Contract'}`}
        message={`Are you sure you want to reject this ${rejectingContractType === 'annex' ? 'ANNEX I' : 'Contract'}? An email will be sent to the client with instructions to resubmit documents.`}
        placeholder="e.g., Document photos are unclear, missing information, etc."
        confirmText={`Reject ${rejectingContractType === 'annex' ? 'ANNEX I' : 'Contract'}`}
        cancelText="Cancel"
        variant="danger"
        isLoading={!!processingAction && processingAction.startsWith('reject-')}
        defaultValue={rejectionReason}
      />

      {/* Alert Modal */}
      {
        alertData && (
          <AlertModal
            isOpen={showAlert}
            onClose={() => {
              setShowAlert(false);
              setAlertData(null);
            }}
            title={alertData.title}
            message={alertData.message}
            variant={alertData.variant}
          />
        )
      }
    </div >
  );
};



