import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { adminSupabase } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronDown, ChevronRight, DollarSign, Users, ShoppingCart, Eye, Coins, Wallet, Clock, TrendingUp, Award } from 'lucide-react';

// Helper function to calculate net amount and fee
const calculateNetAmountAndFee = (order: Order) => {
  const totalPrice = parseFloat(order.total_price_usd || '0');
  const metadata = order.payment_metadata as any;
  const feeAmount = metadata?.fee_amount ? parseFloat(metadata.fee_amount) : 0;
  const netAmount = totalPrice - feeAmount;
  return {
    netAmount: Math.max(netAmount, 0),
    feeAmount: feeAmount,
  };
};

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
  payment_metadata?: any;
  created_at: string;
}

interface SellerBalance {
  available_balance: number;
  pending_balance: number;
  next_withdrawal_date: string | null;
  can_request: boolean;
  last_request_date: string | null;
  next_request_window_start?: string | null;
  next_request_window_end?: string | null;
  is_in_request_window?: boolean;
}

interface PaymentRequest {
  id: string;
  seller_id: string;
  amount: number;
  status: string;
  requested_at: string;
  payment_method: string;
}

interface SellerStats {
  seller: Seller;
  totalOrders: number;
  paidOrders: number;
  pendingOrders: number;
  totalRevenue: number;
  orders: Order[];
  balance: SellerBalance;
  totalCommissions: number;
  pendingPaymentRequests: PaymentRequest[];
}

interface SummaryStats {
  totalSellers: number;
  totalRevenue: number;
  totalCommissions: number;
  totalAvailableBalance: number;
  totalPendingBalance: number;
  totalPendingRequests: number;
  totalPendingRequestsAmount: number;
}

export const SellersPage = () => {
  const [sellersStats, setSellersStats] = useState<SellerStats[]>([]);
  const [summaryStats, setSummaryStats] = useState<SummaryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSellers, setExpandedSellers] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadSellersData();
  }, []);

  const loadSellersData = async () => {
    try {
      setLoading(true);
      
      // Load all sellers using adminSupabase
      // We'll order by last sale date after loading orders
      const { data: sellers, error: sellersError } = await adminSupabase
        .from('sellers')
        .select('*');

      if (sellersError) {
        console.error('Error loading sellers:', sellersError);
        return;
      }

      if (!sellers || sellers.length === 0) {
        setSellersStats([]);
        setSummaryStats({
          totalSellers: 0,
          totalRevenue: 0,
          totalCommissions: 0,
          totalAvailableBalance: 0,
          totalPendingBalance: 0,
          totalPendingRequests: 0,
          totalPendingRequestsAmount: 0,
        });
        setLoading(false);
        return;
      }

      // For each seller, load their orders, balance, commissions, and payment requests
      const statsPromises = sellers.map(async (seller) => {
        // Load orders
        const { data: orders, error: ordersError } = await adminSupabase
          .from('visa_orders')
          .select('*, payment_metadata')
          .eq('seller_id', seller.seller_id_public)
          .order('created_at', { ascending: false });

        if (ordersError) {
          console.error(`Error loading orders for seller ${seller.seller_id_public}:`, ordersError);
        }

        const ordersList = (orders || []) as Order[];
        const totalOrders = ordersList.length;
        const paidOrders = ordersList.filter(o => o.payment_status === 'paid' || o.payment_status === 'completed').length;
        const pendingOrders = ordersList.filter(o => o.payment_status === 'pending').length;
        
        // Calculate total revenue WITHOUT Stripe fees (net amount)
        const totalRevenue = ordersList
          .filter(o => o.payment_status === 'paid' || o.payment_status === 'completed')
          .reduce((sum, o) => {
            const totalPrice = parseFloat(o.total_price_usd || '0');
            const metadata = o.payment_metadata as any;
            const feeAmount = metadata?.fee_amount ? parseFloat(metadata.fee_amount) : 0;
            const netAmount = totalPrice - feeAmount;
            return sum + Math.max(netAmount, 0);
          }, 0);

        // Load balance using RPC
        let balance: SellerBalance = {
          available_balance: 0,
          pending_balance: 0,
          next_withdrawal_date: null,
          can_request: false,
          last_request_date: null,
        };

        try {
          const { data: balanceData, error: balanceError } = await adminSupabase.rpc('get_seller_available_balance', {
            p_seller_id: seller.seller_id_public,
          });

          if (!balanceError && balanceData) {
            const result = Array.isArray(balanceData) ? balanceData[0] : balanceData;
            if (result) {
              balance = {
                available_balance: parseFloat(result.available_balance || '0'),
                pending_balance: parseFloat(result.pending_balance || '0'),
                next_withdrawal_date: result.next_withdrawal_date || null,
                can_request: result.can_request || false,
                last_request_date: result.last_request_date || null,
                next_request_window_start: result.next_request_window_start || null,
                next_request_window_end: result.next_request_window_end || null,
                is_in_request_window: result.is_in_request_window || false,
              };
            }
          }
        } catch (err) {
          console.error(`Error loading balance for seller ${seller.seller_id_public}:`, err);
        }

        // Load total commissions
        let totalCommissions = 0;
        try {
          const { data: commissionsData } = await adminSupabase
            .from('seller_commissions')
            .select('commission_amount_usd')
            .eq('seller_id', seller.seller_id_public);

          if (commissionsData) {
            totalCommissions = commissionsData.reduce(
              (sum, c) => sum + parseFloat(c.commission_amount_usd || '0'),
              0
            );
          }
        } catch (err) {
          console.error(`Error loading commissions for seller ${seller.seller_id_public}:`, err);
        }

        // PAYMENT REQUEST - COMENTADO TEMPORARIAMENTE
        // Load pending payment requests
        let pendingPaymentRequests: PaymentRequest[] = [];
        // try {
        //   const { data: requestsData } = await adminSupabase
        //     .from('seller_payment_requests')
        //     .select('id, seller_id, amount, status, requested_at, payment_method')
        //     .eq('seller_id', seller.seller_id_public)
        //     .eq('status', 'pending')
        //     .order('requested_at', { ascending: false });

        //   if (requestsData) {
        //     pendingPaymentRequests = requestsData.map((req: any) => ({
        //       id: req.id,
        //       seller_id: req.seller_id,
        //       amount: parseFloat(req.amount || '0'),
        //       status: req.status,
        //       requested_at: req.requested_at || req.created_at,
        //       payment_method: req.payment_method,
        //     }));
        //   }
        // } catch (err) {
        //   console.error(`Error loading payment requests for seller ${seller.seller_id_public}:`, err);
        // }

        return {
          seller,
          totalOrders,
          paidOrders,
          pendingOrders,
          totalRevenue,
          orders: ordersList,
          balance,
          totalCommissions,
          pendingPaymentRequests,
        } as SellerStats;
      });

      const stats = await Promise.all(statsPromises);
      const validStats = stats.filter(s => s !== null) as SellerStats[];

      // Sort sellers by last sale date (most recent first)
      // Sellers with sales come first, ordered by most recent sale
      // Sellers without sales come last, ordered by account creation date
      validStats.sort((a, b) => {
        const aLastSale = a.orders.length > 0 
          ? new Date(a.orders[0].created_at).getTime() // Most recent order
          : 0;
        const bLastSale = b.orders.length > 0 
          ? new Date(b.orders[0].created_at).getTime()
          : 0;

        // If both have sales, sort by most recent
        if (aLastSale > 0 && bLastSale > 0) {
          return bLastSale - aLastSale; // Most recent first
        }
        
        // If only one has sales, prioritize it
        if (aLastSale > 0 && bLastSale === 0) return -1;
        if (aLastSale === 0 && bLastSale > 0) return 1;
        
        // If neither has sales, sort by account creation date (most recent first)
        return new Date(b.seller.created_at).getTime() - new Date(a.seller.created_at).getTime();
      });

      // Calculate summary stats
      const summary: SummaryStats = {
        totalSellers: validStats.length,
        totalRevenue: validStats.reduce((sum, s) => sum + s.totalRevenue, 0),
        totalCommissions: validStats.reduce((sum, s) => sum + s.totalCommissions, 0),
        totalAvailableBalance: validStats.reduce((sum, s) => sum + s.balance.available_balance, 0),
        totalPendingBalance: validStats.reduce((sum, s) => sum + s.balance.pending_balance, 0),
        totalPendingRequests: validStats.reduce((sum, s) => sum + s.pendingPaymentRequests.length, 0),
        totalPendingRequestsAmount: validStats.reduce(
          (sum, s) => sum + s.pendingPaymentRequests.reduce((reqSum, req) => reqSum + req.amount, 0),
          0
        ),
      };

      setSellersStats(validStats);
      setSummaryStats(summary);
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

  const formatTimeUntilRelease = (dateString: string | null): string => {
    if (!dateString) return 'N/A';
    
    const releaseDate = new Date(dateString);
    const now = new Date();
    const diff = releaseDate.getTime() - now.getTime();

    if (diff <= 0) return 'Available now';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return `${days}d ${hours}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  // Get top sellers by revenue
  const topSellersByRevenue = [...sellersStats]
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 5);

  // Get top sellers by commissions
  const topSellersByCommissions = [...sellersStats]
    .sort((a, b) => b.totalCommissions - a.totalCommissions)
    .slice(0, 5);

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <Skeleton className="h-9 w-64 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold migma-gold-text mb-2">Sellers & Sales</h1>
          <p className="text-sm sm:text-base text-gray-400">Comprehensive overview of sellers, commissions, and sales performance</p>
        </div>

        {/* Summary Cards */}
        {summaryStats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
            <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-gray-400 mb-1">Total Sellers</p>
                    <p className="text-2xl sm:text-3xl font-bold text-white">{summaryStats.totalSellers}</p>
                  </div>
                  <Users className="w-8 h-8 sm:w-10 sm:h-10 text-gold-light shrink-0" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-500/10 via-green-500/5 to-green-500/10 border border-green-500/30">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-gray-400 mb-1">Total Revenue</p>
                    <p className="text-xl sm:text-2xl font-bold text-green-300">
                      ${summaryStats.totalRevenue.toFixed(2)}
                    </p>
                  </div>
                  <DollarSign className="w-8 h-8 sm:w-10 sm:h-10 text-green-400 shrink-0" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-purple-500/10 border border-purple-500/30">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-gray-400 mb-1">Total Commissions</p>
                    <p className="text-xl sm:text-2xl font-bold text-purple-300">
                      ${summaryStats.totalCommissions.toFixed(2)}
                    </p>
                  </div>
                  <Coins className="w-8 h-8 sm:w-10 sm:h-10 text-purple-400 shrink-0" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-yellow-500/10 via-yellow-500/5 to-yellow-500/10 border border-yellow-500/30">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-gray-400 mb-1">Pending Requests</p>
                    <p className="text-xl sm:text-2xl font-bold text-yellow-300">
                      {summaryStats.totalPendingRequests}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      ${summaryStats.totalPendingRequestsAmount.toFixed(2)}
                    </p>
                  </div>
                  <Clock className="w-8 h-8 sm:w-10 sm:h-10 text-yellow-400 shrink-0" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Top Sellers Section */}
        {sellersStats.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
            {/* Top Sellers by Revenue */}
            <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-gold-light" />
                  Top Sellers by Revenue
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topSellersByRevenue.length === 0 ? (
                    <p className="text-gray-400 text-sm text-center py-4">No sellers with revenue yet</p>
                  ) : (
                    topSellersByRevenue.map((stats, index) => (
                      <div
                        key={stats.seller.id}
                        className="flex items-center justify-between p-3 bg-black/30 rounded-lg border border-gold-medium/20"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gold-medium/20 text-gold-light font-bold text-sm shrink-0">
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-semibold truncate">{stats.seller.full_name || stats.seller.email}</p>
                            <p className="text-xs text-gray-400 truncate">{stats.seller.seller_id_public}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-gold-light font-bold">${stats.totalRevenue.toFixed(2)}</p>
                          <p className="text-xs text-gray-500">{stats.paidOrders} orders</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Top Sellers by Commissions */}
            <Card className="bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-purple-500/10 border border-purple-500/30">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Award className="w-5 h-5 text-purple-300" />
                  Top Sellers by Commissions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topSellersByCommissions.length === 0 ? (
                    <p className="text-gray-400 text-sm text-center py-4">No commissions yet</p>
                  ) : (
                    topSellersByCommissions.map((stats, index) => (
                      <div
                        key={stats.seller.id}
                        className="flex items-center justify-between p-3 bg-black/30 rounded-lg border border-purple-500/20"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-500/20 text-purple-300 font-bold text-sm shrink-0">
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-semibold truncate">{stats.seller.full_name || stats.seller.email}</p>
                            <p className="text-xs text-gray-400 truncate">{stats.seller.seller_id_public}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-purple-300 font-bold">${stats.totalCommissions.toFixed(2)}</p>
                          <p className="text-xs text-gray-500">
                            ${stats.balance.available_balance.toFixed(2)} available
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* All Sellers List */}
        {sellersStats.length === 0 ? (
          <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
            <CardContent className="p-6 text-center">
              <p className="text-gray-400">No sellers found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white mb-4">All Sellers</h2>
            {sellersStats.map((stats) => {
              const isExpanded = expandedSellers.has(stats.seller.id);
              
              return (
                <Card
                  key={stats.seller.id}
                  className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30"
                >
                  <CardHeader>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleSeller(stats.seller.id)}
                          className="p-1 h-auto text-gold-light hover:text-gold-medium shrink-0"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" />
                          ) : (
                            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                          )}
                        </Button>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-white text-base sm:text-xl break-words">
                            {stats.seller.full_name || stats.seller.email}
                          </CardTitle>
                          <p className="text-xs sm:text-sm text-gray-400 mt-1 break-words">
                            ID: {stats.seller.seller_id_public} | {stats.seller.email}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Statistics Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-4">
                      {/* Total Orders */}
                      <div className="bg-black/30 rounded-lg p-3 sm:p-4 border border-gold-medium/20">
                        <div className="flex items-center gap-2 mb-2">
                          <ShoppingCart className="w-3 h-3 sm:w-4 sm:h-4 text-gold-light" />
                          <span className="text-xs sm:text-sm text-gray-400">Orders</span>
                        </div>
                        <p className="text-xl sm:text-2xl font-bold text-white">{stats.totalOrders}</p>
                        <p className="text-xs text-gray-500 mt-1">{stats.paidOrders} paid</p>
                      </div>

                      {/* Total Revenue */}
                      <div className="bg-green-900/20 rounded-lg p-3 sm:p-4 border border-green-500/30">
                        <div className="flex items-center gap-2 mb-2">
                          <DollarSign className="w-3 h-3 sm:w-4 sm:h-4 text-green-300" />
                          <span className="text-xs sm:text-sm text-gray-400">Revenue</span>
                        </div>
                        <p className="text-lg sm:text-xl font-bold text-green-300">
                          ${stats.totalRevenue.toFixed(2)}
                        </p>
                      </div>

                      {/* Total Commissions */}
                      <div className="bg-purple-900/20 rounded-lg p-3 sm:p-4 border border-purple-500/30">
                        <div className="flex items-center gap-2 mb-2">
                          <Coins className="w-3 h-3 sm:w-4 sm:h-4 text-purple-300" />
                          <span className="text-xs sm:text-sm text-gray-400">Commissions</span>
                        </div>
                        <p className="text-lg sm:text-xl font-bold text-purple-300">
                          ${stats.totalCommissions.toFixed(2)}
                        </p>
                      </div>

                      {/* Available Balance */}
                      <div className="bg-blue-900/20 rounded-lg p-3 sm:p-4 border border-blue-500/30">
                        <div className="flex items-center gap-2 mb-2">
                          <Wallet className="w-3 h-3 sm:w-4 sm:h-4 text-blue-300" />
                          <span className="text-xs sm:text-sm text-gray-400">Available</span>
                        </div>
                        <p className="text-lg sm:text-xl font-bold text-blue-300">
                          ${stats.balance.available_balance.toFixed(2)}
                        </p>
                      </div>

                      {/* Pending Balance */}
                      <div className="bg-yellow-900/20 rounded-lg p-3 sm:p-4 border border-yellow-500/30">
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-300" />
                          <span className="text-xs sm:text-sm text-gray-400">Pending</span>
                        </div>
                        <p className="text-lg sm:text-xl font-bold text-yellow-300">
                          ${stats.balance.pending_balance.toFixed(2)}
                        </p>
                        {stats.balance.next_withdrawal_date && (
                          <p className="text-xs text-gray-500 mt-1">
                            {formatTimeUntilRelease(stats.balance.next_withdrawal_date)}
                          </p>
                        )}
                      </div>

                      {/* Pending Requests */}
                      <div className="bg-orange-900/20 rounded-lg p-3 sm:p-4 border border-orange-500/30">
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-orange-300" />
                          <span className="text-xs sm:text-sm text-gray-400">Requests</span>
                        </div>
                        <p className="text-lg sm:text-xl font-bold text-orange-300">
                          {/* PAYMENT REQUEST - COMENTADO: {stats.pendingPaymentRequests.length} */}
                          0
                        </p>
                        {/* PAYMENT REQUEST - COMENTADO TEMPORARIAMENTE */}
                        {/* {stats.pendingPaymentRequests.length > 0 && (
                          <p className="text-xs text-gray-500 mt-1">
                            ${stats.pendingPaymentRequests.reduce((sum, req) => sum + req.amount, 0).toFixed(2)}
                          </p>
                        )} */}
                      </div>
                    </div>

                    {/* PAYMENT REQUEST - COMENTADO TEMPORARIAMENTE */}
                    {/* Pending Payment Requests */}
                    {/* {stats.pendingPaymentRequests.length > 0 && (
                      <div className="mb-4 p-4 bg-orange-500/10 rounded-lg border border-orange-500/30">
                        <h4 className="text-sm font-semibold text-orange-300 mb-3 flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          Pending Payment Requests ({stats.pendingPaymentRequests.length})
                        </h4>
                        <div className="space-y-2">
                          {stats.pendingPaymentRequests.map((request) => (
                            <div
                              key={request.id}
                              className="flex items-center justify-between p-2 bg-black/30 rounded border border-orange-500/20"
                            >
                              <div className="flex-1">
                                <p className="text-white text-sm font-semibold">
                                  ${request.amount.toFixed(2)} via {request.payment_method}
                                </p>
                                <p className="text-xs text-gray-400">
                                  Requested: {new Date(request.requested_at).toLocaleString()}
                                </p>
                              </div>
                              <Link to="/dashboard/payment-requests">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-orange-500/50 bg-black/50 text-orange-300 hover:bg-black hover:border-orange-500 hover:text-orange-200"
                                >
                                  <Eye className="w-3 h-3 mr-1" />
                                  View
                                </Button>
                              </Link>
                            </div>
                          ))}
                        </div>
                      </div>
                    )} */}

                    {/* Orders List (when expanded) */}
                    {isExpanded && (
                      <div className="mt-6 pt-6 border-t border-gold-medium/30">
                        <h3 className="text-lg font-semibold text-white mb-4">Orders</h3>
                        {stats.orders.length === 0 ? (
                          <p className="text-gray-400 text-center py-4 text-sm">No orders found</p>
                        ) : (
                          <div className="hidden md:block overflow-x-auto">
                            <table className="w-full">
                            <thead>
                              <tr className="border-b border-gold-medium/30">
                                <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Order #</th>
                                <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Client</th>
                                <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Product</th>
                                <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Total (with fee)</th>
                                <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Net Amount</th>
                                <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Stripe Fee</th>
                                <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Status</th>
                                <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Date</th>
                                <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {stats.orders.map((order) => {
                                const { netAmount, feeAmount } = calculateNetAmountAndFee(order);
                                return (
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
                                  <td className="py-3 px-4 text-sm text-white font-semibold">
                                    ${netAmount.toFixed(2)}
                                  </td>
                                  <td className="py-3 px-4 text-sm text-gray-400">
                                    {feeAmount > 0 ? (
                                      <span className="text-red-400">-${feeAmount.toFixed(2)}</span>
                                    ) : (
                                      <span className="text-gray-500">$0.00</span>
                                    )}
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
                                );
                              })}
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
