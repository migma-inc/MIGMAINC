import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ExternalLink, FileText, CheckCircle2, XCircle, Shield } from 'lucide-react';

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
  contract_accepted: boolean | null;
  contract_signed_at: string | null;
  ip_address: string | null;
  payment_metadata: any;
  created_at: string;
  updated_at: string;
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
  const [loading, setLoading] = useState(true);
  const [seller, setSeller] = useState<any>(null);

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
            <Link to="/seller/dashboard">
              <Button variant="outline" className="border-gold-medium/50 bg-black/50 text-white hover:bg-gold-medium/30">
                Back to Dashboard
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
          <Link to="/seller/dashboard" className="inline-flex items-center text-gold-light hover:text-gold-medium transition mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold migma-gold-text">Order Details</h1>
              <p className="text-gray-400 mt-1">Order #{order.order_number}</p>
            </div>
            {getStatusBadge(order.payment_status)}
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
                <span className="text-2xl font-bold text-gold-light">${parseFloat(order.total_price_usd).toFixed(2)}</span>
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
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Information */}
          <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
            <CardHeader>
              <CardTitle className="text-white">Payment Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Payment Method:</span>
                <span className="text-white capitalize">{order.payment_method.replace('_', ' ')}</span>
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
                  <a
                    href={order.zelle_proof_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-gold-light hover:text-gold-medium"
                  >
                    View Receipt <ExternalLink className="w-4 h-4 ml-1" />
                  </a>
                </div>
              )}
              {order.contract_pdf_url && (
                <div className="pt-3 border-t border-gold-medium/30">
                  <p className="text-gray-400 mb-2">Contract PDF:</p>
                  <a
                    href={order.contract_pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-gold-light hover:text-gold-medium"
                  >
                    <FileText className="w-4 h-4 mr-1" />
                    View Contract PDF <ExternalLink className="w-4 h-4 ml-1" />
                  </a>
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
    </div>
  );
};

