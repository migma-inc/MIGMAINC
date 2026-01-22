import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PdfModal } from '@/components/ui/pdf-modal';
import { ImageModal } from '@/components/ui/image-modal';
import { ArrowLeft, FileText, XCircle, Shield, Eye, Mail, Globe, Phone } from 'lucide-react';
import { AlertModal } from '@/components/ui/alert-modal';

interface Order {
  id: string;
  order_number: string;
  product_slug: string;
  seller_id: string;
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

export const SellerOrderDetail = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [termsAcceptance, setTermsAcceptance] = useState<TermsAcceptance | null>(null);
  const [identityFiles, setIdentityFiles] = useState<IdentityFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [_seller, setSeller] = useState<any>(null);
  const [showAlert, setShowAlert] = useState(false);
  const [alertData, setAlertData] = useState<{ title: string; message: string; variant: 'success' | 'error' | 'warning' | 'info' } | null>(null);

  // PDF Modal
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [selectedPdfUrl, setSelectedPdfUrl] = useState<string | null>(null);

  const [selectedPdfTitle, setSelectedPdfTitle] = useState<string>('');
  const [showZelleModal, setShowZelleModal] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          navigate('/seller/login');
          return;
        }

        // Get seller info
        const { data: sellerData, error: sellerError } = await supabase
          .from('sellers')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (sellerError || !sellerData) {
          navigate('/seller/login');
          return;
        }

        setSeller(sellerData);

        // Load order
        const { data: orderData, error: orderError } = await supabase
          .from('visa_orders')
          .select('*')
          .eq('id', orderId)
          .eq('seller_id', sellerData.seller_id_public) // Only allow viewing own orders
          .single();

        if (orderError || !orderData) {
          console.error('Order not found or unauthorized:', orderError);
          navigate('/seller/dashboard');
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

          if (!filesError && filesData) {
            setIdentityFiles(filesData);
          }
        }
      } catch (err) {
        console.error('Error loading data:', err);
        navigate('/seller/dashboard');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [orderId, navigate]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500/20 text-green-300 border-green-500/50">Completed</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/50">Pending</Badge>;
      case 'failed':
        return <Badge className="bg-red-500/20 text-red-300 border-red-500/50">Failed</Badge>;
      case 'cancelled':
        return <Badge className="bg-gray-500/20 text-gray-300 border-gray-500/50">Cancelled</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-medium"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-zinc-500">
        <XCircle className="w-12 h-12 mb-4 opacity-20" />
        <p className="text-lg">Order not found</p>
        <Link to="/seller/dashboard/orders" className="mt-4">
          <Button variant="outline" className="border-zinc-800 text-zinc-400 hover:text-white hover:border-gold-medium">
            Back to Orders
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <Link
            to="/seller/dashboard/orders"
            className="text-xs flex items-center text-zinc-500 hover:text-gold-light transition-colors mb-2 group"
          >
            <ArrowLeft className="w-3 h-3 mr-1 group-hover:-translate-x-0.5 transition-transform" />
            Back to Orders
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold migma-gold-text">Order Details</h1>
            {getStatusBadge(order.payment_status)}
          </div>
          <p className="text-zinc-500 font-mono text-sm">#{order.order_number}</p>
        </div>

        <div className="flex gap-2">
          {order.contract_pdf_url && (
            <Button
              variant="outline"
              className="border-zinc-800 bg-zinc-900/50 text-white hover:border-gold-medium hover:bg-gold-light/10"
              onClick={() => {
                setSelectedPdfUrl(order.contract_pdf_url);
                setSelectedPdfTitle(`Contract - ${order.order_number}`);
                setShowPdfModal(true);
              }}
            >
              <FileText className="w-4 h-4 mr-2 text-gold-medium" />
              Contract PDF
            </Button>
          )}
          {order.annex_pdf_url && (
            <Button
              variant="outline"
              className="border-zinc-800 bg-zinc-900/50 text-white hover:border-gold-medium hover:bg-gold-light/10"
              onClick={() => {
                setSelectedPdfUrl(order.annex_pdf_url);
                setSelectedPdfTitle(`Annex I - ${order.order_number}`);
                setShowPdfModal(true);
              }}
            >
              <FileText className="w-4 h-4 mr-2 text-gold-medium" />
              Annex I PDF
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Core Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Client Information */}
          <Card className="bg-zinc-950 border border-zinc-900">
            <CardHeader className="border-b border-zinc-900 bg-zinc-900/10">
              <CardTitle className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Client Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
              <div className="space-y-1">
                <p className="text-xs text-zinc-500">Full Name</p>
                <p className="text-sm font-medium text-white">{order.client_name}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-zinc-500">Email Address</p>
                <div className="flex items-center text-sm font-medium text-white">
                  <Mail className="w-3.5 h-3.5 mr-2 text-zinc-500" />
                  {order.client_email}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-zinc-500">WhatsApp / Phone</p>
                <div className="flex items-center text-sm font-medium text-white">
                  <Phone className="w-3.5 h-3.5 mr-2 text-zinc-500" />
                  {order.client_whatsapp || "N/A"}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-zinc-500">Nationality</p>
                <div className="flex items-center text-sm font-medium text-white">
                  <Globe className="w-3.5 h-3.5 mr-2 text-zinc-500" />
                  {order.client_nationality || "N/A"}
                </div>
              </div>
              {order.client_observations && (
                <div className="md:col-span-2 space-y-1 pt-2 border-t border-zinc-900/50">
                  <p className="text-xs text-zinc-500">Observations</p>
                  <p className="text-sm text-zinc-300 italic">"{order.client_observations}"</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Documents Section */}
          {identityFiles.length > 0 && (
            <Card className="bg-zinc-950 border border-zinc-900 overflow-hidden">
              <CardHeader className="border-b border-zinc-900 bg-zinc-900/10">
                <CardTitle className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Identity Documents</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {identityFiles.map((file) => (
                    <div key={file.id} className="space-y-2 group">
                      <div className="flex justify-between items-center">
                        <p className="text-xs text-zinc-500 capitalize">{file.file_type.replace('_', ' ')}</p>
                      </div>
                      <div className="relative aspect-video rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900 cursor-pointer"
                        onClick={() => window.open(getDocumentUrl(file.file_path), '_blank')}>
                        <img
                          src={getDocumentUrl(file.file_path)}
                          alt={file.file_type}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80 group-hover:opacity-100"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Eye className="w-6 h-6 text-white" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Terms & Acceptance */}
          <Card className="bg-zinc-950 border border-zinc-900">
            <CardHeader className="border-b border-zinc-900 bg-zinc-900/10 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold text-zinc-400 uppercase tracking-wider flex items-center">
                <Shield className="w-4 h-4 mr-2 text-gold-medium" />
                Anti-Chargeback & Terms
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
                <div className="flex justify-between items-center py-1 border-b border-zinc-900">
                  <span className="text-xs text-zinc-500">Accepted Terms</span>
                  {termsAcceptance?.accepted || order.contract_accepted ? (
                    <Badge className="bg-green-500/10 text-green-400 border-green-500/20 text-[10px] uppercase">Verified</Badge>
                  ) : (
                    <Badge variant="outline" className="text-zinc-500 border-zinc-800 text-[10px] uppercase">Not Found</Badge>
                  )}
                </div>
                <div className="flex justify-between items-center py-1 border-b border-zinc-900">
                  <span className="text-xs text-zinc-500">Data Authorization</span>
                  {termsAcceptance?.data_authorization ? (
                    <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[10px] uppercase">Authorized</Badge>
                  ) : (
                    <Badge variant="outline" className="text-zinc-500 border-zinc-800 text-[10px] uppercase">N/A</Badge>
                  )}
                </div>
                <div className="flex justify-between items-center py-1 border-b border-zinc-900">
                  <span className="text-xs text-zinc-500">IP Address</span>
                  <span className="text-xs font-mono text-zinc-300">{termsAcceptance?.accepted_ip || order.ip_address || "N/A"}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-zinc-900">
                  <span className="text-xs text-zinc-500">Signed At</span>
                  <span className="text-xs text-zinc-300">
                    {termsAcceptance?.accepted_at ? new Date(termsAcceptance.accepted_at).toLocaleString()
                      : order.contract_signed_at ? new Date(order.contract_signed_at).toLocaleString()
                        : "N/A"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Financial & Actions */}
        <div className="space-y-6">
          {/* Order Summary */}
          <Card className="bg-zinc-950 border border-zinc-900 overflow-hidden">
            <CardHeader className="border-b border-zinc-900 bg-zinc-900/20">
              <CardTitle className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Product</span>
                  <span className="text-white font-medium">{order.product_slug}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Base Price</span>
                  <span className="text-white font-medium">${parseFloat(order.base_price_usd).toFixed(2)}</span>
                </div>
                {order.extra_units > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">{order.extra_unit_label} (x{order.extra_units})</span>
                    <span className="text-white font-medium">+${(order.extra_units * parseFloat(order.extra_unit_price_usd)).toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-zinc-900 flex justify-between items-end">
                <span className="text-sm font-semibold text-zinc-400 uppercase">Total Amount</span>
                <span className="text-2xl font-bold migma-gold-text">
                  ${parseFloat(order.total_price_usd).toFixed(2)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Payment Status Card */}
          <Card className="bg-zinc-950 border border-zinc-900">
            <CardHeader className="border-b border-zinc-900 bg-zinc-900/10">
              <CardTitle className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Payment Info</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-1">
                <p className="text-xs text-zinc-500">Method</p>
                <p className="text-sm font-medium text-white capitalize">
                  {order.payment_method === 'manual' ? 'Manual by Seller' : order.payment_method.replace('_', ' ')}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-zinc-500">Status</p>
                <div>{getStatusBadge(order.payment_status)}</div>
              </div>

              {order.zelle_proof_url && (
                <Button
                  variant="outline"
                  className="w-full border-zinc-800 bg-zinc-900 text-white hover:border-gold-medium hover:bg-gold-light/10"
                  onClick={() => setShowZelleModal(true)}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Zelle Receipt
                </Button>
              )}

              <div className="pt-2">
                <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">Created At</p>
                <p className="text-xs text-zinc-400">{new Date(order.created_at).toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <PdfModal
        isOpen={showPdfModal}
        onClose={() => setShowPdfModal(false)}
        pdfUrl={selectedPdfUrl || ''}
        title={selectedPdfTitle}
      />

      {order?.zelle_proof_url && (
        <ImageModal
          isOpen={showZelleModal}
          onClose={() => setShowZelleModal(false)}
          imageUrl={order.zelle_proof_url}
          title={`Zelle Receipt - ${order.order_number}`}
        />
      )}

      {alertData && (
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
      )}
    </div>
  );
};





