import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Coins, DollarSign, Clock, CheckCircle, XCircle, Wallet, AlertCircle, CreditCard, RefreshCw } from 'lucide-react';
import { getSellerCommissionStats, type SellerCommission } from '@/lib/seller-commissions';
import { 
  getSellerBalance, 
  getSellerPaymentRequests, 
  createPaymentRequest
} from '@/lib/seller-payment-requests';
import type { SellerPaymentRequest } from '@/types/seller';
import { PaymentRequestTimer } from '@/components/seller/PaymentRequestTimer';
import { PaymentRequestForm } from '@/components/seller/PaymentRequestForm';
import { PendingBalanceCard } from '@/components/seller/PendingBalanceCard';
import type { SellerBalance } from '@/types/seller';

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
  const [periodFilter, setPeriodFilter] = useState<'month' | 'all'>('month');
  const [commissions, setCommissions] = useState<SellerCommission[]>([]);
  const [_stats, setStats] = useState({
    currentMonth: 0,
    totalPending: 0,
    totalPaid: 0,
    totalAmount: 0,
  });
  const [totalReceived, _setTotalReceived] = useState(0); // Total from completed payment requests
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Payment request state
  const [balance, setBalance] = useState<SellerBalance>({
    available_balance: 0,
    pending_balance: 0,
    next_withdrawal_date: null,
    can_request: false,
    last_request_date: null,
  });
  const [paymentRequests, setPaymentRequests] = useState<SellerPaymentRequest[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [firstSaleDate, setFirstSaleDate] = useState<string | null>(null);
  
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
      const cacheKey = getCacheKey(`commissions_${periodFilter}`);
      const cachedCommissions = loadCachedData(cacheKey);
      const cachedStats = loadCachedData(getCacheKey(`stats_${periodFilter}`));

      if (cachedCommissions && cachedStats) {
        setCommissions(cachedCommissions);
        setStats(cachedStats);
        setLoading(false);
      } else {
        setLoading(true);
      }

      try {
        // Load commission stats (only if not cached)
        if (!cachedStats) {
          const commissionStats = await getSellerCommissionStats(seller.seller_id_public, periodFilter);
          setStats(commissionStats);
          saveToCache(getCacheKey(`stats_${periodFilter}`), commissionStats);
        }

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
            // Filter by period if needed
            let filteredCommissions = commissionsData || [];
            if (periodFilter === 'month') {
              const now = new Date();
              const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
              filteredCommissions = filteredCommissions.filter(
                (c: any) => new Date(c.created_at) >= startOfMonth
              );
            }

            // Load order details for each commission
            if (filteredCommissions.length > 0) {
              const orderIds = filteredCommissions.map((c: any) => c.order_id);
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
                
                const commissionsWithOrders = filteredCommissions.map((commission: any) => ({
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
  }, [seller, periodFilter]);
  
  const handleSubmitPaymentRequest = async (formData: any) => {
    if (!seller) return;

    setSubmitting(true);
    try {
      const result = await createPaymentRequest(seller.seller_id_public, formData);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to create payment request');
      }

      // Reload data and update cache
      const [balanceData, requestsData, firstCommission] = await Promise.all([
        getSellerBalance(seller.seller_id_public),
        getSellerPaymentRequests(seller.seller_id_public),
        supabase
          .from('seller_commissions')
          .select('created_at')
          .eq('seller_id', seller.seller_id_public)
          .order('created_at', { ascending: true })
          .limit(1)
          .single(),
      ]);

      setBalance(balanceData);
      setPaymentRequests(requestsData);
      setFirstSaleDate(firstCommission?.data?.created_at || null);
      
      // Update cache
      saveToCache(getCacheKey('balance'), balanceData);
      saveToCache(getCacheKey('payment_requests'), requestsData);
      
      // Invalidate commissions cache to refresh stats
      localStorage.removeItem(getCacheKey(`stats_${periodFilter}`));
    } catch (error: any) {
      throw error;
    } finally {
      setSubmitting(false);
    }
  };
  
  // Load payment request data (balance and first sale) - Always load for stats cards
  const loadBalanceData = async () => {
    if (!seller) return;

    const cachedBalance = loadCachedData(getCacheKey('balance'));
    const cachedFirstSale = loadCachedData(getCacheKey('first_sale_date'));

    if (cachedBalance) {
      setBalance(cachedBalance);
    }
    if (cachedFirstSale) {
      setFirstSaleDate(cachedFirstSale);
    }

    // Always load balance and first sale for stats cards
    try {
      const [balanceData, firstCommission] = await Promise.all([
        getSellerBalance(seller.seller_id_public),
        supabase
          .from('seller_commissions')
          .select('created_at')
          .eq('seller_id', seller.seller_id_public)
          .order('created_at', { ascending: true })
          .limit(1)
          .single(),
      ]);

      console.log('[SellerCommissions] Balance loaded:', balanceData);
      console.log('[SellerCommissions] First commission:', firstCommission);
      setBalance(balanceData);
      setFirstSaleDate(firstCommission?.data?.created_at || null);
      saveToCache(getCacheKey('balance'), balanceData);
      if (firstCommission?.data?.created_at) {
        saveToCache(getCacheKey('first_sale_date'), firstCommission.data.created_at);
      }
    } catch (err) {
      console.error('[SellerCommissions] Error loading balance:', err);
    }
  };

  useEffect(() => {
    if (seller) {
      loadBalanceData();
    }
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
      localStorage.removeItem(getCacheKey('payment_requests'));
      localStorage.removeItem(getCacheKey(`stats_${periodFilter}`));

      // Reload all data
      await Promise.all([
        loadBalanceData(),
        loadPaymentRequests(),
        (async () => {
          const commissionStats = await getSellerCommissionStats(seller.seller_id_public, periodFilter);
          setStats(commissionStats);
          saveToCache(getCacheKey(`stats_${periodFilter}`), commissionStats);
        })(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };
  
  const getPaymentRequestStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-300 border border-green-500/50">
            <CheckCircle className="w-3 h-3" />
            Pago
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gold-medium/20 text-gold-light border border-gold-medium/50">
            <CheckCircle className="w-3 h-3" />
            Aprovado
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-300 border border-yellow-500/50">
            <Clock className="w-3 h-3" />
            Pendente
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-300 border border-red-500/50">
            <XCircle className="w-3 h-3" />
            Rejeitado
          </span>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-500/20 text-green-300 border-green-500/50">Paid</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/50">Pending</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-500/20 text-red-300 border-red-500/50">Cancelled</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  
  const formatDateShort = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
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
                {refreshing ? 'Atualizando...' : 'Atualizar'}
              </Button>
            </div>
            <p className="text-sm sm:text-base text-gray-400">View your commission history and available balance</p>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <Label htmlFor="period-filter" className="text-white text-sm whitespace-nowrap">
              Período:
            </Label>
            <Select
              value={periodFilter}
              onValueChange={(value) => setPeriodFilter(value as 'month' | 'all')}
            >
              <SelectTrigger 
                id="period-filter"
                className="w-full sm:w-[160px] bg-black/50 border-gold-medium/50 text-white hover:bg-black/70"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Este Mês</SelectItem>
                <SelectItem value="all">Acumulado</SelectItem>
              </SelectContent>
            </Select>
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
                <p className="text-xs font-medium text-gray-400 mb-1">Saldo Disponível</p>
                <p className="text-xl font-bold text-gold-light">
                  ${balance.available_balance.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 mt-1">Pronto para saque</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <PendingBalanceCard 
          pendingBalance={balance.pending_balance}
          nextWithdrawalDate={balance.next_withdrawal_date}
        />

        <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gold-medium/20 rounded-full flex items-center justify-center shrink-0">
                <CheckCircle className="w-6 h-6 text-gold-light" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-400 mb-1">Total Recebido</p>
                <p className="text-xl font-bold text-gold-light">
                  ${totalReceived.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 mt-1">Comissões pagas</p>
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
                <p className="text-xs font-medium text-gray-400 mb-1">Total Acumulado</p>
                <p className="text-xl font-bold text-gold-light">
                  ${(balance.available_balance + balance.pending_balance).toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 mt-1">Disponível + Pendente</p>
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
              <span>Comissões</span>
            </button>
            <button
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
              <span>Solicitar Pagamento</span>
            </button>
          </div>
        </div>

        <TabsContent value="commissions" className="mt-0 space-y-0">
          {/* Commissions List */}
          <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
            <CardHeader className="pb-4">
              <CardTitle className="text-white text-lg sm:text-xl flex items-center gap-2">
                <Coins className="w-5 h-5" />
                Histórico de Comissões
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
          {commissions.length === 0 ? (
            <div className="py-12 text-center">
              <Coins className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">No commissions found</p>
              <p className="text-gray-500 text-sm mt-2">
                {periodFilter === 'month' 
                  ? 'No commissions for this month yet'
                  : 'You don\'t have any commissions yet'}
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
                          {getStatusBadge(commission.commission_status)}
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
                        {commission.payment_date && (
                          <div className="mt-2 text-xs text-gray-500">
                            Paid on: {formatDate(commission.payment_date)}
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

        <TabsContent value="payment-request" className="mt-0 space-y-0">
          {/* Payment Request Section - Inspired by Lus American Design */}
          <div className="space-y-6">
            {/* Timer - Inspired by WithdrawalTimer from Lus American */}
            <PaymentRequestTimer
              canRequest={balance.can_request}
              lastRequestDate={balance.last_request_date}
              nextWithdrawalDate={balance.next_withdrawal_date}
              firstSaleDate={firstSaleDate}
            />

            {/* Main Content Card - Inspired by Lus American Tab Container */}
            <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
              {/* Header with Action Button */}
              <CardHeader className="border-b border-gold-medium/20 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle className="text-white text-lg sm:text-xl flex items-center gap-2">
                      <Wallet className="w-5 h-5" />
                      Solicitações de Pagamento
                    </CardTitle>
                    <p className="text-sm text-gray-400 mt-1">
                      Gerencie suas solicitações de saque
                    </p>
                  </div>
                  {balance.available_balance > 0 && balance.can_request && (
                    <Button
                      onClick={() => {
                        // Scroll to form
                        const formElement = document.getElementById('payment-request-form');
                        if (formElement) {
                          formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-gold-medium hover:bg-gold-light text-black font-semibold rounded-lg"
                    >
                      <Wallet className="w-4 h-4" />
                      Nova Solicitação
                    </Button>
                  )}
                  {(!balance.available_balance || !balance.can_request) && (
                    <Button
                      disabled
                      className="flex items-center gap-2 px-4 py-2 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed"
                    >
                      <Wallet className="w-4 h-4" />
                      Nova Solicitação
                    </Button>
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="p-6">
                {/* Request Form Section */}
                <div id="payment-request-form" className="mb-8">
                  {balance.available_balance > 0 && balance.can_request ? (
                    <PaymentRequestForm
                      availableBalance={balance.available_balance}
                      onSubmit={handleSubmitPaymentRequest}
                      isLoading={submitting}
                    />
                  ) : (
                    <div className="bg-black/50 rounded-lg p-8 text-center border border-gold-medium/30">
                      <AlertCircle className="w-16 h-16 text-gold-light mx-auto mb-4 bg-gold-medium/20 rounded-full p-4" />
                      <h3 className="text-lg font-medium text-white mb-2">
                        {balance.available_balance <= 0 
                          ? 'Sem saldo disponível'
                          : 'Aguarde o período de 30 dias'}
                      </h3>
                      <p className="text-gray-400 text-sm">
                        {balance.available_balance <= 0 
                          ? 'Você não tem saldo disponível no momento para solicitar pagamento.'
                          : 'Você precisa aguardar 30 dias desde sua última solicitação aprovada para fazer uma nova.'}
                      </p>
                      {balance.pending_balance > 0 && (
                        <p className="text-gray-500 text-xs mt-3">
                          Você tem ${balance.pending_balance.toFixed(2)} aguardando liberação
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Payment Requests History */}
                <div className="border-t border-gold-medium/20 pt-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Histórico de Solicitações
                  </h3>
                  {paymentRequests.length === 0 ? (
                    <div className="bg-black/50 rounded-lg p-8 text-center border border-gold-medium/30">
                      <Clock className="w-16 h-16 text-gold-light mx-auto mb-4 bg-gold-medium/20 rounded-full p-4" />
                      <h3 className="text-lg font-medium text-white mb-2">
                        Nenhuma solicitação encontrada
                      </h3>
                      <p className="text-gray-400 text-sm">
                        Suas solicitações de pagamento aparecerão aqui
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-black/50 border-b border-gold-medium/30">
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                              Valor
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                              Método
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                              Detalhes
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                              Status
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                              Data
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
                                      {new Date(request.requested_at).toLocaleTimeString('pt-BR', {
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
                                      {new Date(request.approved_at).toLocaleTimeString('pt-BR', {
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
                                      {new Date(request.completed_at).toLocaleTimeString('pt-BR', {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-sm text-gray-500">Pendente</span>
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
      </Tabs>
    </div>
  );
}
