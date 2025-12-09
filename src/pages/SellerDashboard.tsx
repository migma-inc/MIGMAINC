import { useState, useEffect } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PdfModal } from '@/components/ui/pdf-modal';
import { LogOut, Copy, CheckCircle, Clock, DollarSign, Users, ShoppingCart, Link as LinkIcon, FileText, TrendingUp, MousePointerClick, FileEdit, CreditCard } from 'lucide-react';

interface SellerInfo {
  id: string;
  seller_id_public: string;
  full_name: string;
  email: string;
  status: string;
}

interface VisaProduct {
  slug: string;
  name: string;
  base_price_usd: string;
  extra_unit_price: string;
}

interface Order {
  id: string;
  order_number: string;
  product_slug: string;
  client_name: string;
  client_email: string;
  total_price_usd: string;
  payment_status: string;
  payment_method: string;
  extra_units: number;
  contract_pdf_url: string | null;
  created_at: string;
}

export const SellerDashboard = () => {
  const navigate = useNavigate();
  const [seller, setSeller] = useState<SellerInfo | null>(null);
  const [products, setProducts] = useState<VisaProduct[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [selectedPdfUrl, setSelectedPdfUrl] = useState<string | null>(null);
  const [selectedPdfTitle, setSelectedPdfTitle] = useState<string>('Contract PDF');

  // Stats
  const [stats, setStats] = useState({
    totalSales: 0,
    completedSales: 0,
    pendingSales: 0,
    totalRevenue: 0,
  });

  // Funnel stats
  const [funnelStats, setFunnelStats] = useState({
    linkClicks: 0,
    formStarted: 0,
    formCompleted: 0,
    paymentStarted: 0,
    paymentCompleted: 0,
    conversionRate: 0,
  });

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
          console.error('Not a seller:', sellerError);
          navigate('/seller/login');
          return;
        }

        setSeller(sellerData);

        // Load products
        const { data: productsData } = await supabase
          .from('visa_products')
          .select('slug, name, base_price_usd, extra_unit_price')
          .eq('is_active', true)
          .order('name');

        if (productsData) {
          setProducts(productsData);
        }

        // Load orders for this seller
        const { data: ordersData } = await supabase
          .from('visa_orders')
          .select('*')
          .eq('seller_id', sellerData.seller_id_public)
          .order('created_at', { ascending: false });

        if (ordersData) {
          setOrders(ordersData);

          // Calculate stats
          const completed = ordersData.filter(o => o.payment_status === 'completed');
          const pending = ordersData.filter(o => o.payment_status === 'pending');
          const revenue = completed.reduce((sum, o) => sum + parseFloat(o.total_price_usd), 0);

          setStats({
            totalSales: ordersData.length,
            completedSales: completed.length,
            pendingSales: pending.length,
            totalRevenue: revenue,
          });
        }

        // Load funnel stats
        const { data: funnelData } = await supabase
          .from('seller_funnel_events')
          .select('event_type')
          .eq('seller_id', sellerData.seller_id_public);

        if (funnelData) {
          const linkClicks = funnelData.filter(e => e.event_type === 'link_click').length;
          const formStarted = funnelData.filter(e => e.event_type === 'form_started').length;
          const formCompleted = funnelData.filter(e => e.event_type === 'form_completed').length;
          const paymentStarted = funnelData.filter(e => e.event_type === 'payment_started').length;
          const paymentCompleted = funnelData.filter(e => e.event_type === 'payment_completed').length;
          
          const conversionRate = linkClicks > 0 
            ? ((paymentCompleted / linkClicks) * 100).toFixed(1)
            : '0.0';

          setFunnelStats({
            linkClicks,
            formStarted,
            formCompleted,
            paymentStarted,
            paymentCompleted,
            conversionRate: parseFloat(conversionRate),
          });
        }
      } catch (err) {
        console.error('Error loading data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/seller/login');
  };

  const copyLink = (productSlug: string) => {
    if (!seller) return;
    
    const siteUrl = window.location.origin;
    const link = `${siteUrl}/checkout/visa/${productSlug}?seller=${seller.seller_id_public}`;
    
    navigator.clipboard.writeText(link);
    setCopiedLink(link);
    
    setTimeout(() => setCopiedLink(null), 3000);
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

  const getStatusBadgeFunc = (status: string) => {
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

  if (!seller) {
    return <Navigate to="/seller/login" />;
  }

  return (
    <div className="min-h-screen bg-black py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold migma-gold-text">Seller Dashboard</h1>
            <p className="text-gray-400 mt-1">Welcome, {seller.full_name}</p>
            <p className="text-sm text-gold-light mt-1">Seller ID: {seller.seller_id_public}</p>
          </div>
          <Button
            onClick={handleLogout}
            variant="outline"
            className="border-gold-medium/50 bg-black/50 text-white hover:bg-red-500/20"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Total Sales</p>
                  <p className="text-3xl font-bold text-white">{stats.totalSales}</p>
                </div>
                <ShoppingCart className="w-10 h-10 text-gold-light" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 via-green-500/5 to-green-500/10 border border-green-500/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Completed</p>
                  <p className="text-3xl font-bold text-green-300">{stats.completedSales}</p>
                </div>
                <CheckCircle className="w-10 h-10 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-yellow-500/10 via-yellow-500/5 to-yellow-500/10 border border-yellow-500/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Pending</p>
                  <p className="text-3xl font-bold text-yellow-300">{stats.pendingSales}</p>
                </div>
                <Clock className="w-10 h-10 text-yellow-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Total Revenue</p>
                  <p className="text-2xl font-bold text-gold-light">
                    ${stats.totalRevenue.toFixed(2)}
                  </p>
                </div>
                <DollarSign className="w-10 h-10 text-gold-light" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Funnel Analytics */}
        <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30 mb-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <TrendingUp className="w-5 h-5 mr-2" />
              Conversion Funnel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Conversion Rate */}
              <div className="text-center p-6 bg-black/50 rounded-lg border border-gold-medium/20">
                <p className="text-sm text-gray-400 mb-2">Overall Conversion Rate</p>
                <p className="text-4xl font-bold text-gold-light">{funnelStats.conversionRate}%</p>
                <p className="text-xs text-gray-500 mt-2">
                  {funnelStats.paymentCompleted} completed / {funnelStats.linkClicks} clicks
                </p>
              </div>

              {/* Funnel Steps */}
              <div className="space-y-4">
                {/* Step 1: Link Clicks */}
                <div className="flex items-center justify-between p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                  <div className="flex items-center gap-3">
                    <MousePointerClick className="w-6 h-6 text-blue-400" />
                    <div>
                      <p className="text-white font-semibold">Link Clicks</p>
                      <p className="text-xs text-gray-400">Users who clicked your checkout link</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-blue-300">{funnelStats.linkClicks}</p>
                    <p className="text-xs text-gray-500">100%</p>
                  </div>
                </div>

                {/* Step 2: Form Started */}
                <div className="flex items-center justify-between p-4 bg-purple-500/10 rounded-lg border border-purple-500/30">
                  <div className="flex items-center gap-3">
                    <FileEdit className="w-6 h-6 text-purple-400" />
                    <div>
                      <p className="text-white font-semibold">Form Started</p>
                      <p className="text-xs text-gray-400">Users who started filling the form</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-purple-300">{funnelStats.formStarted}</p>
                    <p className="text-xs text-gray-500">
                      {funnelStats.linkClicks > 0 
                        ? `${((funnelStats.formStarted / funnelStats.linkClicks) * 100).toFixed(1)}%`
                        : '0%'}
                    </p>
                  </div>
                </div>

                {/* Step 3: Form Completed */}
                <div className="flex items-center justify-between p-4 bg-indigo-500/10 rounded-lg border border-indigo-500/30">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-6 h-6 text-indigo-400" />
                    <div>
                      <p className="text-white font-semibold">Form Completed</p>
                      <p className="text-xs text-gray-400">Users who completed the form</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-indigo-300">{funnelStats.formCompleted}</p>
                    <p className="text-xs text-gray-500">
                      {funnelStats.linkClicks > 0 
                        ? `${((funnelStats.formCompleted / funnelStats.linkClicks) * 100).toFixed(1)}%`
                        : '0%'}
                    </p>
                  </div>
                </div>

                {/* Step 4: Payment Started */}
                <div className="flex items-center justify-between p-4 bg-orange-500/10 rounded-lg border border-orange-500/30">
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-6 h-6 text-orange-400" />
                    <div>
                      <p className="text-white font-semibold">Payment Started</p>
                      <p className="text-xs text-gray-400">Users who initiated payment</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-orange-300">{funnelStats.paymentStarted}</p>
                    <p className="text-xs text-gray-500">
                      {funnelStats.linkClicks > 0 
                        ? `${((funnelStats.paymentStarted / funnelStats.linkClicks) * 100).toFixed(1)}%`
                        : '0%'}
                    </p>
                  </div>
                </div>

                {/* Step 5: Payment Completed */}
                <div className="flex items-center justify-between p-4 bg-green-500/10 rounded-lg border border-green-500/30">
                  <div className="flex items-center gap-3">
                    <DollarSign className="w-6 h-6 text-green-400" />
                    <div>
                      <p className="text-white font-semibold">Payment Completed</p>
                      <p className="text-xs text-gray-400">Successful payments</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-green-300">{funnelStats.paymentCompleted}</p>
                    <p className="text-xs text-gray-500">
                      {funnelStats.linkClicks > 0 
                        ? `${((funnelStats.paymentCompleted / funnelStats.linkClicks) * 100).toFixed(1)}%`
                        : '0%'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Link Generator */}
        <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30 mb-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <LinkIcon className="w-5 h-5 mr-2" />
              Generate Your Sales Links
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {products.map((product) => {
                const link = `${window.location.origin}/checkout/visa/${product.slug}?seller=${seller.seller_id_public}`;
                const isCopied = copiedLink === link;

                return (
                  <div
                    key={product.slug}
                    className="flex items-center justify-between p-4 bg-black/50 rounded-lg border border-gold-medium/20"
                  >
                    <div className="flex-1">
                      <p className="text-white font-semibold">{product.name}</p>
                      <p className="text-xs text-gray-400 font-mono mt-1 break-all">{link}</p>
                    </div>
                    <Button
                      onClick={() => copyLink(product.slug)}
                      size="sm"
                      className={`ml-4 ${
                        isCopied
                          ? 'bg-green-500 hover:bg-green-600'
                          : 'bg-gold-medium hover:bg-gold-light'
                      } text-black`}
                    >
                      {isCopied ? (
                        <>
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 mr-1" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
          <CardHeader>
            <CardTitle className="text-white">Your Recent Sales</CardTitle>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400 mb-2">No sales yet</p>
                <p className="text-sm text-gray-500">
                  Share your personalized links above to start making sales!
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gold-medium/30">
                      <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Order #</th>
                      <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Client</th>
                      <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Product</th>
                      <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Total</th>
                      <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Status</th>
                      <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Date</th>
                      <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id} className="border-b border-gold-medium/10 hover:bg-white/5">
                        <td className="py-3 px-4 text-sm text-white font-mono">{order.order_number}</td>
                        <td className="py-3 px-4">
                          <div className="text-sm">
                            <p className="text-white">{order.client_name}</p>
                            <p className="text-gray-400 text-xs">{order.client_email}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-sm">
                            <p className="text-white">{order.product_slug}</p>
                            {order.extra_units > 0 && (
                              <p className="text-gray-400 text-xs">+{order.extra_units} extra units</p>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-gold-light font-bold">
                          ${parseFloat(order.total_price_usd).toFixed(2)}
                        </td>
                        <td className="py-3 px-4">
                          {getStatusBadgeFunc(order.payment_status)}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-400">
                          {new Date(order.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2">
                            <Link to={`/seller/orders/${order.id}`}>
                              <Button size="sm" variant="outline" className="text-xs border-gold-medium/50 text-white hover:bg-gold-medium/20">
                                View
                              </Button>
                            </Link>
                            {order.contract_pdf_url && (
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={() => {
                                  setSelectedPdfUrl(order.contract_pdf_url);
                                  setSelectedPdfTitle(`Contract - ${order.order_number}`);
                                }}
                                className="text-xs border-gold-medium/50 bg-black/50 text-gold-light hover:bg-black hover:border-gold-medium hover:text-gold-medium"
                                title="View Contract PDF"
                              >
                                <FileText className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* PDF Modal */}
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
};




