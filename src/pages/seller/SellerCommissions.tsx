import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Coins, DollarSign, Clock, CheckCircle, XCircle, Wallet, AlertCircle, CreditCard, RefreshCw } from 'lucide-react';
import { type SellerCommission } from '@/lib/seller-commissions';
import { 
  getSellerPaymentRequests, 
  createPaymentRequest
} from '@/lib/seller-payment-requests';
import type { SellerPaymentRequest } from '@/types/seller';
import { PaymentRequestTimer } from '@/components/seller/PaymentRequestTimer';
import { PaymentRequestForm } from '@/components/seller/PaymentRequestForm';
import { PendingBalanceCard } from '@/components/seller/PendingBalanceCard';
import { useSellerStats } from '@/hooks/useSellerStats';

interface SellerInfo {
  id: string;
  seller_id_public: string;
  full_name: string;
  email: string;
  status: string;
}

export function SellerCommissions() {
  const { seller } = useOutletContext<{ seller: SellerInfo }>();
  const [activeTab, setActiveTab] = useState<'commissions' | 'payment-request'>('commissions');
  // PAYMENT REQUEST - COMENTADO: Sempre mostrar apenas a aba de commissions
  // const [activeTab, setActiveTab] = useState<'commissions' | 'payment-request'>('commissions');
  const [commissions, setCommissions] = useState<SellerCommission[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Use shared hook for stats
  const { balance, totalReceived, refresh: refreshStats } = useSellerStats(seller?.seller_id_public);
  
  // Auto-refresh when window status might change
  useEffect(() => {
    if (!seller) return;
    
    // Listen for window status change events from PaymentRequestTimer
    const handleWindowStatusChange = () => {
      console.log('[SellerCommissions] Window status changed, refreshing...');
      refreshStats();
    };
    
    window.addEventListener('requestWindowStatusChange', handleWindowStatusChange);
    
    // Determine refresh interval based on current day
    const getRefreshInterval = () => {
      const now = new Date();
      const currentDay = now.getDate();
      
      // On boundary days (1, 5, 6), refresh more frequently
      if (currentDay === 1 || currentDay === 5 || currentDay === 6) {
        return 30000; // 30 seconds on boundary days
      }
      return 60000; // 1 minute normally
    };
    
    // Check and refresh function
    const checkAndRefresh = () => {
      refreshStats();
    };
    
    // Check immediately
    checkAndRefresh();
    
    // Set up interval with dynamic refresh rate
    let interval: ReturnType<typeof setInterval>;
    const setupInterval = () => {
      if (interval) clearInterval(interval);
      const refreshInterval = getRefreshInterval();
      interval = setInterval(checkAndRefresh, refreshInterval);
    };
    
    setupInterval();
    
    // Re-setup interval every hour to adjust for day changes
    const hourInterval = setInterval(setupInterval, 3600000); // Every hour
    
    return () => {
      if (interval) clearInterval(interval);
      clearInterval(hourInterval);
      window.removeEventListener('requestWindowStatusChange', handleWindowStatusChange);
    };
  }, [seller, refreshStats]);
  
  // Payment request state
  const [paymentRequests, setPaymentRequests] = useState<SellerPaymentRequest[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [firstSaleDate, setFirstSaleDate] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successAmount, setSuccessAmount] = useState<number | null>(null);
  
  // Cache keys
  const getCacheKey = (key: string) => `seller_commissions_${seller?.seller_id_public}_${key}`;
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

  // Load cached data
  const loadCachedData = (key: string) => {
    try {
      const cached = localStorage.getItem(key);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
          return data;
        }
      }
    } catch (e) {
      console.error('Error loading cache:', e);
    }
    return null;
  };

  // Save to cache
  const saveToCache = (key: string, data: any) => {
    try {
      localStorage.setItem(key, JSON.stringify({
        data,
        timestamp: Date.now(),
      }));
    } catch (e) {
      console.error('Error saving cache:', e);
    }
  };

  // Load commissions data
  useEffect(() => {
    const loadCommissions = async () => {
      if (!seller) return;

      // Check cache first
      const cacheKey = getCacheKey('commissions');
      const cachedCommissions = loadCachedData(cacheKey);

      if (cachedCommissions) {
        setCommissions(cachedCommissions);
        setLoading(false);
      } else {
        setLoading(true);
      }

      try {
        // Load commission list (only if not cached)
        if (!cachedCommissions) {
          const { data: commissionsData, error: commissionsError } = await supabase
            .from('seller_commissions')
            .select('*')
            .eq('seller_id', seller.seller_id_public)
            .order('created_at', { ascending: false });

          if (commissionsError) {
            console.error('Error loading commissions:', commissionsError);
            setCommissions([]);
          } else {
            // Load order details for each commission
            if (commissionsData && commissionsData.length > 0) {
              const orderIds = commissionsData.map((c: any) => c.order_id);
              const { data: ordersData, error: ordersError } = await supabase
                .from('visa_orders')
                .select('id, order_number, product_slug, client_name, total_price_usd')
                .in('id', orderIds);

              if (ordersError) {
                console.error('Error loading orders:', ordersError);
              } else {
                // Map orders to commissions
                const ordersMap = new Map(
                  (ordersData || []).map((order: any) => [order.id, order])
                );
                
                const commissionsWithOrders = commissionsData.map((commission: any) => ({
                  ...commission,
                  visa_orders: ordersMap.get(commission.order_id) || null
                }));
                
                setCommissions(commissionsWithOrders as any);
                saveToCache(cacheKey, commissionsWithOrders);
              }
            } else {
              setCommissions([]);
              saveToCache(cacheKey, []);
            }
          }
        }
      } catch (err) {
        console.error('Error loading commissions:', err);
      } finally {
        setLoading(false);
      }
    };

    loadCommissions();
  }, [seller]);
  
  // PAYMENT REQUEST - COMENTADO TEMPORARIAMENTE
  const handleSubmitPaymentRequest = async (_formData: any) => {
    // Função temporária para evitar erros de compilação
    return Promise.resolve();
  };
  // const handleSubmitPaymentRequest = async (formData: any) => {
  //   if (!seller) return;

  //   setSubmitting(true);
  //   try {
  //     const result = await createPaymentRequest(seller.seller_id_public, formData);
      
  //     if (!result.success) {
  //       throw new Error(result.error || 'Failed to create payment request');
  //     }

  //     // Reload data and update cache
  //     const [requestsData, firstCommission] = await Promise.all([
  //       getSellerPaymentRequests(seller.seller_id_public),
  //       supabase
  //         .from('seller_commissions')
  //         .select('created_at')
  //         .eq('seller_id', seller.seller_id_public)
  //         .order('created_at', { ascending: true })
  //         .limit(1)
  //         .single(),
  //     ]);

  //     setPaymentRequests(requestsData);
  //     setFirstSaleDate(firstCommission?.data?.created_at || null);
      
  //     // Update cache
  //     saveToCache(getCacheKey('payment_requests'), requestsData);
      
  //     // Refresh shared stats (balance, commission stats, total received)
  //     await refreshStats();
      
  //     // Invalidate commissions cache to refresh stats
  //     localStorage.removeItem(getCacheKey('stats'));
      
  //     // Show success modal
  //     setSuccessAmount(formData.amount);
  //     setShowSuccessModal(true);
  //   } catch (error: any) {
  //     throw error;
  //   } finally {
  //     setSubmitting(false);
  //   }
  // };
  
  // Load first sale date for timer
  useEffect(() => {
    const loadFirstSaleDate = async () => {
      if (!seller) return;

      const cachedFirstSale = loadCachedData(getCacheKey('first_sale_date'));
      if (cachedFirstSale) {
        setFirstSaleDate(cachedFirstSale);
      }

      try {
        const { data: firstCommission } = await supabase
          .from('seller_commissions')
          .select('created_at')
          .eq('seller_id', seller.seller_id_public)
          .order('created_at', { ascending: true })
          .limit(1)
          .single();

        if (firstCommission?.created_at) {
          setFirstSaleDate(firstCommission.created_at);
          saveToCache(getCacheKey('first_sale_date'), firstCommission.created_at);
        }
      } catch (err) {
        console.error('[SellerCommissions] Error loading first sale date:', err);
      }
    };

    loadFirstSaleDate();
  }, [seller]);

  // Load payment requests only when switching to payment-request tab
  const loadPaymentRequests = async () => {
    if (!seller) return;

    try {
      const requestsData = await getSellerPaymentRequests(seller.seller_id_public);
      setPaymentRequests(requestsData);
      saveToCache(getCacheKey('payment_requests'), requestsData);
    } catch (err) {
      console.error('Error loading payment requests:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'payment-request' && seller) {
      const cachedRequests = loadCachedData(getCacheKey('payment_requests'));

      if (cachedRequests) {
        setPaymentRequests(cachedRequests);
      }

      // Load immediately
      loadPaymentRequests();
    }
  }, [activeTab, seller]);

  // Refresh function to reload all data
  const handleRefresh = async () => {
    if (!seller) return;

    setRefreshing(true);
    try {
      // Clear cache
      localStorage.removeItem(getCacheKey('balance'));
      // PAYMENT REQUEST - COMENTADO: localStorage.removeItem(getCacheKey('payment_requests'));
      localStorage.removeItem(getCacheKey('stats'));

      // Reload all data
      await Promise.all([
        refreshStats(), // Refresh shared stats
        // PAYMENT REQUEST - COMENTADO: loadPaymentRequests(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };
  
  // PAYMENT REQUEST - COMENTADO TEMPORARIAMENTE
  const getPaymentRequestStatusBadge = (_status: string) => {
    // Função temporária para evitar erros de compilação
    return <Badge>N/A</Badge>;
  };
  // const getPaymentRequestStatusBadge = (status: string) => {
  //   switch (status) {
  //     case 'completed':
  //       return (
  //         <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-300 border border-green-500/50">
  //           <CheckCircle className="w-3 h-3" />
  //           Paid
  //         </span>
  //       );
  //     case 'approved':
  //       return (
  //         <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gold-medium/20 text-gold-light border border-gold-medium/50">
  //           <CheckCircle className="w-3 h-3" />
  //           Approved
  //         </span>
  //       );
  //     case 'pending':
  //       return (
  //         <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-300 border border-yellow-500/50">
  //           <Clock className="w-3 h-3" />
  //           Pending
  //         </span>
  //       );
  //     case 'rejected':
  //       return (
  //         <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-300 border border-red-500/50">
  //           <XCircle className="w-3 h-3" />
  //           Rejected
  //         </span>
  //       );
  //     default:
  //       return <Badge>{status}</Badge>;
  //   }
  // };


  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  
  const formatDateShort = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div>
        <div className="mb-8">
          <Skeleton className="h-9 w-64 mb-2" />
          <Skeleton className="h-5 w-48" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
              <CardContent className="p-6">
                <Skeleton className="h-4 w-20 mb-3" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col gap-4 mb-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-2xl sm:text-3xl font-bold migma-gold-text flex items-center gap-2">
                <Coins className="w-6 h-6 sm:w-8 sm:h-8" />
                My Commissions
              </h1>
              <Button
                onClick={handleRefresh}
                disabled={refreshing}
                variant="outline"
                size="sm"
                className="bg-black border border-gold-medium/50 text-gold-light hover:bg-gold-medium/10"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Updating...' : 'Refresh'}
              </Button>
            </div>
            <p className="text-sm sm:text-base text-gray-400">View your commission history and available balance</p>
          </div>
        </div>
      </div>

      {/* Stats Cards - 4 cards like Lus American (always visible) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 sm:mb-8">
        <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gold-medium/20 rounded-full flex items-center justify-center shrink-0">
                <DollarSign className="w-6 h-6 text-gold-light" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-400 mb-1">Available Balance</p>
                <p className="text-xl font-bold text-gold-light">
                  ${balance.available_balance.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 mt-1">Ready to withdraw</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <PendingBalanceCard
          pendingBalance={balance.pending_balance}
          nextWithdrawalDate={balance.next_withdrawal_date}
          nextRequestWindowStart={balance.next_request_window_start}
          nextRequestWindowEnd={balance.next_request_window_end}
          isInRequestWindow={balance.is_in_request_window}
        />

        <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gold-medium/20 rounded-full flex items-center justify-center shrink-0">
                <CheckCircle className="w-6 h-6 text-gold-light" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-400 mb-1">Total Received</p>
                <p className="text-xl font-bold text-gold-light">
                  ${totalReceived.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 mt-1">Paid commissions</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gold-medium/20 rounded-full flex items-center justify-center shrink-0">
                <Wallet className="w-6 h-6 text-gold-light" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-400 mb-1">Total Accumulated</p>
                <p className="text-xl font-bold text-gold-light">
                  ${(balance.available_balance + balance.pending_balance).toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 mt-1">Available + Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'commissions' | 'payment-request')}>
        <div className="mb-6 sm:mb-8">
          <div className="flex gap-3 sm:gap-4">
            <button
              onClick={() => setActiveTab('commissions')}
              className={`
                flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold transition-all
                ${activeTab === 'commissions'
                  ? 'bg-gold-medium/20 text-gold-light border-2 border-gold-medium/50 shadow-lg shadow-gold-medium/20'
                  : 'bg-black/50 text-gray-400 border-2 border-gold-medium/20 hover:bg-gold-medium/10 hover:text-gold-light hover:border-gold-medium/30'
                }
              `}
            >
              <Coins className="w-4 h-4 shrink-0" />
              <span>Commissions</span>
            </button>
            {/* PAYMENT REQUEST - COMENTADO TEMPORARIAMENTE */}
            {/* <button
              onClick={() => setActiveTab('payment-request')}
              className={`
                flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold transition-all
                ${activeTab === 'payment-request'
                  ? 'bg-gold-medium/20 text-gold-light border-2 border-gold-medium/50 shadow-lg shadow-gold-medium/20'
                  : 'bg-black/50 text-gray-400 border-2 border-gold-medium/20 hover:bg-gold-medium/10 hover:text-gold-light hover:border-gold-medium/30'
                }
              `}
            >
              <Wallet className="w-4 h-4 shrink-0" />
              <span>Request Payment</span>
            </button> */}
          </div>
        </div>

        <TabsContent value="commissions" className="mt-0 space-y-0">
          {/* Commissions List */}
          <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
            <CardHeader className="pb-4">
              <CardTitle className="text-white text-lg sm:text-xl flex items-center gap-2">
                <Coins className="w-5 h-5" />
                Commission History
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
          {commissions.length === 0 ? (
            <div className="py-12 text-center">
              <Coins className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">No commissions found</p>
              <p className="text-gray-500 text-sm mt-2">
                You don't have any commissions yet
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {commissions.map((commission: any) => {
                const order = commission.visa_orders;
                return (
                  <div
                    key={commission.id}
                    className="p-4 bg-black/50 rounded-lg border border-gold-medium/20 hover:bg-gold-medium/10 transition"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          {order?.order_number && (
                            <span className="text-xs text-gold-light font-mono">
                              {order.order_number}
                            </span>
                          )}
                          <span className="text-xs text-gray-400">
                            {formatDate(commission.created_at)}
                          </span>
                        </div>
                        {order && (
                          <div className="mb-3 text-xs sm:text-sm">
                            <span className="text-gray-400">Order:</span>
                            <span className="text-white ml-2">{order.product_slug}</span>
                            {order.client_name && (
                              <>
                                <span className="text-gray-500 mx-2">•</span>
                                <span className="text-gray-400">{order.client_name}</span>
                              </>
                            )}
                          </div>
                        )}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 text-xs sm:text-sm">
                          <div>
                            <span className="text-gray-400">Net Amount:</span>
                            <span className="text-white ml-2">${commission.net_amount_usd.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-gray-400">Percentage:</span>
                            <span className="text-white ml-2">{commission.commission_percentage}%</span>
                          </div>
                          <div>
                            <span className="text-gray-400">Commission:</span>
                            <span className="text-gold-light font-bold ml-2">
                              ${commission.commission_amount_usd.toFixed(2)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-400">Method:</span>
                            <span className="text-white ml-2 text-xs capitalize">
                              {commission.calculation_method.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                        {commission.withdrawn_amount > 0 && (
                          <div className="mt-2 text-xs text-gray-500">
                            Withdrawn: ${commission.withdrawn_amount.toFixed(2)} of ${commission.commission_amount_usd.toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PAYMENT REQUEST - COMENTADO TEMPORARIAMENTE */}
        {false && (
        <TabsContent value="payment-request" className="mt-0 space-y-0">
          {/* Payment Request Section - Inspired by Lus American Design */}
          <div className="space-y-6">
            {/* Timer - Inspired by WithdrawalTimer from Lus American */}
            <PaymentRequestTimer
              canRequest={balance.can_request}
              nextWithdrawalDate={balance.next_withdrawal_date}
              firstSaleDate={firstSaleDate}
              nextRequestWindowStart={balance.next_request_window_start}
              nextRequestWindowEnd={balance.next_request_window_end}
              isInRequestWindow={balance.is_in_request_window}
            />

            {/* Main Content Card - Inspired by Lus American Tab Container */}
            <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
              {/* Header with Action Button */}
              <CardHeader className="border-b border-gold-medium/20 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle className="text-white text-lg sm:text-xl flex items-center gap-2">
                      <Wallet className="w-5 h-5" />
                      Payment Requests
                    </CardTitle>
                    <p className="text-sm text-gray-400 mt-1">
                      Manage your withdrawal requests
                    </p>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="p-6">
                {/* Request Form Section */}
                <div id="payment-request-form" className="mb-8">
                  {balance.can_request ? (
                    <PaymentRequestForm
                      availableBalance={balance.available_balance}
                      onSubmit={handleSubmitPaymentRequest}
                      isLoading={submitting}
                    />
                  ) : (
                    <div className="bg-black/50 rounded-lg p-8 text-center border border-gold-medium/30">
                      <AlertCircle className="w-16 h-16 text-gold-light mx-auto mb-4 bg-gold-medium/20 rounded-full p-4" />
                      <h3 className="text-lg font-medium text-white mb-2">
                        No available balance
                      </h3>
                      <p className="text-gray-400 text-sm">
                        You don't have available balance at the moment to request payment.
                      </p>
                      {balance.pending_balance > 0 && (
                        <p className="text-gray-500 text-xs mt-3">
                          You have ${balance.pending_balance.toFixed(2)} awaiting release
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Payment Requests History */}
                <div className="border-t border-gold-medium/20 pt-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Request History
                  </h3>
                  {paymentRequests.length === 0 ? (
                    <div className="bg-black/50 rounded-lg p-8 text-center border border-gold-medium/30">
                      <Clock className="w-16 h-16 text-gold-light mx-auto mb-4 bg-gold-medium/20 rounded-full p-4" />
                      <h3 className="text-lg font-medium text-white mb-2">
                        No requests found
                      </h3>
                      <p className="text-gray-400 text-sm">
                        Your payment requests will appear here
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-black/50 border-b border-gold-medium/30">
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                              Amount
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                              Method
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                              Details
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                              Status
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                              Date
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-black/30 divide-y divide-gold-medium/20">
                          {paymentRequests.map((request) => (
                            <tr key={request.id} className="hover:bg-gold-medium/10 transition">
                              <td className="px-4 py-4 whitespace-nowrap">
                                <span className="text-sm font-medium text-gold-light">
                                  ${request.amount.toFixed(2)}
                                </span>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <CreditCard className="w-4 h-4 text-gold-light" />
                                  <span className="text-sm text-white capitalize">
                                    {request.payment_method}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <div className="max-w-xs truncate text-sm text-gray-400">
                                  {request.payment_details?.email || 'N/A'}
                                </div>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                {getPaymentRequestStatusBadge(request.status)}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-1">
                                  <Clock className="w-4 h-4 text-gold-light" />
                                  <div className="flex flex-col">
                                    <span className="text-sm text-gray-400">
                                      {formatDateShort(request.requested_at)}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      {new Date(request.requested_at).toLocaleTimeString('en-US', {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                {request.approved_at ? (
                                  <div className="flex flex-col">
                                    <span className="text-sm text-gray-400">
                                      {formatDateShort(request.approved_at)}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      {new Date(request.approved_at).toLocaleTimeString('en-US', {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </span>
                                  </div>
                                ) : request.rejected_at ? (
                                  <div className="flex flex-col">
                                    <span className="text-sm text-red-400">
                                      {formatDateShort(request.rejected_at)}
                                    </span>
                                    <span className="text-xs text-red-500">
                                      {new Date(request.rejected_at).toLocaleTimeString('pt-BR', {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </span>
                                    {request.rejection_reason && (
                                      <span className="text-xs text-red-400 mt-1">
                                        {request.rejection_reason}
                                      </span>
                                    )}
                                  </div>
                                ) : request.completed_at ? (
                                  <div className="flex flex-col">
                                    <span className="text-sm text-green-400">
                                      {formatDateShort(request.completed_at)}
                                    </span>
                                    <span className="text-xs text-green-500">
                                      {new Date(request.completed_at).toLocaleTimeString('en-US', {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-sm text-gray-500">Pending</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        )}
      </Tabs>

      {/* PAYMENT REQUEST - COMENTADO TEMPORARIAMENTE */}
      {/* Success Modal */}
      {false && (
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
          <DialogHeader>
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
            </div>
            <DialogTitle className="text-2xl font-bold text-gold-light text-center">
              Request Sent Successfully!
            </DialogTitle>
            <DialogDescription className="text-center text-gray-300 mt-4">
              Your payment request for{' '}
              <span className="font-bold text-gold-light text-lg">
                ${successAmount?.toFixed(2) || '0.00'} USD
              </span>{' '}
              has been created successfully and is awaiting approval.
            </DialogDescription>
            <DialogDescription className="text-center text-gray-400 mt-2 text-sm">
              You will receive an email notification once your request is processed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6">
            <Button
              onClick={() => setShowSuccessModal(false)}
              className="w-full bg-gold-medium hover:bg-gold-light text-black font-semibold"
            >
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      )}
    </div>
  );
}
