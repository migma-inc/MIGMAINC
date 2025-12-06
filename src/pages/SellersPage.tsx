import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, DollarSign, Users, ShoppingCart, Eye } from 'lucide-react';

interface Seller {
  id: string;
  seller_id_public: string;
  full_name: string;
  email: string;
  phone: string | null;
  created_at: string;
  user_id: string;
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
  created_at: string;
}

interface SellerStats {
  seller: Seller;
  totalOrders: number;
  paidOrders: number;
  pendingOrders: number;
  totalRevenue: number;
  orders: Order[];
}

export const SellersPage = () => {
  const [sellersStats, setSellersStats] = useState<SellerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSellers, setExpandedSellers] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadSellersData();
  }, []);

  const loadSellersData = async () => {
    try {
      // Load all sellers
      const { data: sellers, error: sellersError } = await supabase
        .from('sellers')
        .select('*')
        .order('created_at', { ascending: false });

      if (sellersError) {
        console.error('Error loading sellers:', sellersError);
        return;
      }

      if (!sellers || sellers.length === 0) {
        setSellersStats([]);
        setLoading(false);
        return;
      }

      // For each seller, load their orders and calculate stats
      const statsPromises = sellers.map(async (seller) => {
        const { data: orders, error: ordersError } = await supabase
          .from('visa_orders')
          .select('*')
          .eq('seller_id', seller.seller_id_public)
          .order('created_at', { ascending: false });

        if (ordersError) {
          console.error(`Error loading orders for seller ${seller.seller_id_public}:`, ordersError);
          return null;
        }

        const ordersList = (orders || []) as Order[];
        const totalOrders = ordersList.length;
        const paidOrders = ordersList.filter(o => o.payment_status === 'paid' || o.payment_status === 'completed').length;
        const pendingOrders = ordersList.filter(o => o.payment_status === 'pending').length;
        const totalRevenue = ordersList
          .filter(o => o.payment_status === 'paid' || o.payment_status === 'completed')
          .reduce((sum, o) => sum + parseFloat(o.total_price_usd || '0'), 0);

        return {
          seller,
          totalOrders,
          paidOrders,
          pendingOrders,
          totalRevenue,
          orders: ordersList,
        } as SellerStats;
      });

      const stats = await Promise.all(statsPromises);
      setSellersStats(stats.filter(s => s !== null) as SellerStats[]);
    } catch (err) {
      console.error('Error loading sellers data:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSeller = (sellerId: string) => {
    setExpandedSellers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sellerId)) {
        newSet.delete(sellerId);
      } else {
        newSet.add(sellerId);
      }
      return newSet;
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
      case 'paid':
        return <Badge className="bg-green-500/20 text-green-300 border-green-500/50">Paid</Badge>;
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
          <p className="mt-4 text-gray-400">Loading sellers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold migma-gold-text mb-8">Sellers & Sales</h1>

        {sellersStats.length === 0 ? (
          <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
            <CardContent className="p-6 text-center">
              <p className="text-gray-400">No sellers found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {sellersStats.map((stats) => {
              const isExpanded = expandedSellers.has(stats.seller.id);
              
              return (
                <Card
                  key={stats.seller.id}
                  className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30"
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleSeller(stats.seller.id)}
                          className="p-1 h-auto text-gold-light hover:text-gold-medium"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5" />
                          ) : (
                            <ChevronRight className="w-5 h-5" />
                          )}
                        </Button>
                        <div>
                          <CardTitle className="text-white text-xl">
                            {stats.seller.full_name || stats.seller.email}
                          </CardTitle>
                          <p className="text-sm text-gray-400 mt-1">
                            ID: {stats.seller.seller_id_public} | {stats.seller.email}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Statistics */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                      <div className="bg-black/30 rounded-lg p-4 border border-gold-medium/20">
                        <div className="flex items-center gap-2 mb-2">
                          <ShoppingCart className="w-4 h-4 text-gold-light" />
                          <span className="text-sm text-gray-400">Total Orders</span>
                        </div>
                        <p className="text-2xl font-bold text-white">{stats.totalOrders}</p>
                      </div>
                      <div className="bg-green-900/20 rounded-lg p-4 border border-green-500/30">
                        <div className="flex items-center gap-2 mb-2">
                          <DollarSign className="w-4 h-4 text-green-300" />
                          <span className="text-sm text-gray-400">Paid Orders</span>
                        </div>
                        <p className="text-2xl font-bold text-green-300">{stats.paidOrders}</p>
                      </div>
                      <div className="bg-yellow-900/20 rounded-lg p-4 border border-yellow-500/30">
                        <div className="flex items-center gap-2 mb-2">
                          <Users className="w-4 h-4 text-yellow-300" />
                          <span className="text-sm text-gray-400">Pending Orders</span>
                        </div>
                        <p className="text-2xl font-bold text-yellow-300">{stats.pendingOrders}</p>
                      </div>
                      <div className="bg-gold-light/10 rounded-lg p-4 border border-gold-medium/30">
                        <div className="flex items-center gap-2 mb-2">
                          <DollarSign className="w-4 h-4 text-gold-light" />
                          <span className="text-sm text-gray-400">Total Revenue</span>
                        </div>
                        <p className="text-2xl font-bold text-gold-light">
                          ${stats.totalRevenue.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    {/* Orders List (when expanded) */}
                    {isExpanded && (
                      <div className="mt-6 pt-6 border-t border-gold-medium/30">
                        <h3 className="text-lg font-semibold text-white mb-4">Orders</h3>
                        {stats.orders.length === 0 ? (
                          <p className="text-gray-400 text-center py-4">No orders found</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead>
                                <tr className="border-b border-gold-medium/30">
                                  <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Order #</th>
                                  <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Client</th>
                                  <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Product</th>
                                  <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Amount</th>
                                  <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Status</th>
                                  <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Date</th>
                                  <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {stats.orders.map((order) => (
                                  <tr key={order.id} className="border-b border-gold-medium/10 hover:bg-white/5">
                                    <td className="py-3 px-4 text-sm text-white font-mono">{order.order_number}</td>
                                    <td className="py-3 px-4">
                                      <div className="text-sm">
                                        <p className="text-white">{order.client_name}</p>
                                        <p className="text-gray-400 text-xs">{order.client_email}</p>
                                      </div>
                                    </td>
                                    <td className="py-3 px-4 text-sm text-white">{order.product_slug}</td>
                                    <td className="py-3 px-4 text-sm text-gold-light font-bold">
                                      ${parseFloat(order.total_price_usd || '0').toFixed(2)}
                                    </td>
                                    <td className="py-3 px-4">
                                      {getStatusBadge(order.payment_status)}
                                    </td>
                                    <td className="py-3 px-4 text-sm text-gray-400">
                                      {new Date(order.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="py-3 px-4">
                                      <Link to={`/dashboard/visa-orders/${order.id}`}>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="flex items-center gap-2 border-gold-medium/50 bg-black/50 text-white hover:bg-gold-medium/30 hover:text-gold-light"
                                        >
                                          <Eye className="w-4 h-4" />
                                          View
                                        </Button>
                                      </Link>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
