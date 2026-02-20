import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Coins, AlertCircle, RefreshCw } from 'lucide-react';
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
  // PAYMENT REQUEST - COMENTADO: Usando apenas commissions por enquanto
  const [activeTab, setActiveTab] = useState<'commissions' | 'payment-request'>('commissions');
  const [commissions, setCommissions] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Blacklist of products that should NEVER have commission
  const isBlacklistedProduct = (slug: string) => {
    if (!slug) return false;
    const lowerSlug = slug.toLowerCase();
    const directBlacklist = ['consultation-brant', 'consultation-common', 'visa-retry-defense', 'rfe-defense'];
    return directBlacklist.includes(lowerSlug) ||
      lowerSlug.endsWith('-scholarship') ||
      lowerSlug.endsWith('-i20-control');
  };

  // Use shared hook for stats
  const { refresh: refreshStats } = useSellerStats(seller?.seller_id_public);

  // Calculate total from the list to ensure it's always in sync with what's visible
  const totalInList = commissions.reduce((acc, item) => {
    const isBlacklisted = isBlacklistedProduct(item.visa_orders?.product_slug);
    if (isBlacklisted) return acc;
    return acc + (item.commission?.commission_amount_usd || 0);
  }, 0);

  // Auto-refresh stats periodically
  useEffect(() => {
    if (!seller) return;

    const handleWindowStatusChange = () => {
      console.log('[SellerCommissions] Window status changed, refreshing...');
      refreshStats();
    };

    window.addEventListener('requestWindowStatusChange', handleWindowStatusChange);

    const checkAndRefresh = () => {
      refreshStats();
    };

    checkAndRefresh();
    const interval = setInterval(checkAndRefresh, 60000);

    return () => {
      clearInterval(interval);
      window.removeEventListener('requestWindowStatusChange', handleWindowStatusChange);
    };
  }, [seller, refreshStats]);

  // Cache utilities
  const getCacheKey = (key: string) => `seller_commissions_${seller?.seller_id_public}_${key}`;
  const CACHE_DURATION = 5 * 60 * 1000;

  const loadCachedData = (key: string) => {
    try {
      const cached = localStorage.getItem(key);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) return data;
      }
    } catch (e) {
      console.error('Error loading cache:', e);
    }
    return null;
  };

  const saveToCache = (key: string, data: any) => {
    try {
      localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
    } catch (e) {
      console.error('Error saving cache:', e);
    }
  };

  // Load commissions and synchronizing with all sales
  useEffect(() => {
    const loadCommissions = async () => {
      if (!seller) return;

      const cacheKey = getCacheKey('commissions');
      const cachedCommissions = loadCachedData(cacheKey);

      if (cachedCommissions) {
        setCommissions(cachedCommissions);
        setLoading(false);
      } else {
        setLoading(true);
      }

      try {
        // Fetch ALL orders linked to the seller for full synchronization
        const { data: ordersData, error: ordersError } = await supabase
          .from('visa_orders')
          .select('id, order_number, product_slug, client_name, client_email, total_price_usd, payment_status, created_at')
          .eq('seller_id', seller.seller_id_public)
          .order('created_at', { ascending: false });

        if (ordersError) throw ordersError;

        if (ordersData && ordersData.length > 0) {
          const orderIds = ordersData.map(o => o.id);
          const { data: commissionsData, error: commissionsError } = await supabase
            .from('seller_commissions')
            .select('*')
            .in('order_id', orderIds);

          if (commissionsError) throw commissionsError;

          const commissionsMap = new Map((commissionsData || []).map((c: any) => [c.order_id, c]));

          const listData = ordersData.map((order: any) => ({
            id: order.id,
            created_at: order.created_at,
            visa_orders: order,
            commission: commissionsMap.get(order.id) || null
          }));

          setCommissions(listData);
          saveToCache(cacheKey, listData);
        } else {
          setCommissions([]);
          saveToCache(cacheKey, []);
        }
      } catch (err) {
        console.error('Error loading commissions/orders:', err);
      } finally {
        setLoading(false);
      }
    };

    loadCommissions();
  }, [seller]);


  const handleRefresh = async () => {
    if (!seller) return;
    setRefreshing(true);
    try {
      localStorage.removeItem(getCacheKey('commissions'));
      localStorage.removeItem(getCacheKey('stats'));
      await refreshStats();
      // Wait a bit for the useEffect to trigger reload
    } finally {
      setRefreshing(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Card className="bg-zinc-950 border border-zinc-900">
          <CardContent className="p-6 space-y-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold migma-gold-text flex items-center gap-2">
            <Coins className="w-6 h-6 sm:w-8 sm:h-8" />
            My Commissions
          </h1>
          <p className="text-sm text-gray-400 mt-1">Total control over your earnings and sales</p>
        </div>
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

      {/* Total Balance Card - Simplified to small card */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gold-medium/20 rounded-full flex items-center justify-center shrink-0">
                <Coins className="w-5 h-5 text-gold-light" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-gold-light/60 uppercase tracking-wider mb-0.5">Total Accumulated</p>
                <p className="text-2xl font-black text-white migma-gold-text">
                  ${totalInList.toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-4">
        <button
          onClick={() => setActiveTab('commissions')}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold transition-all ${activeTab === 'commissions'
            ? 'bg-gold-medium/20 text-gold-light border-2 border-gold-medium/50 shadow-lg shadow-gold-medium/20'
            : 'bg-black/50 text-gray-400 border-2 border-gold-medium/20 hover:bg-gold-medium/10'
            }`}
        >
          <Coins className="w-4 h-4" />
          Commissions History
        </button>
      </div>

      <Tabs value={activeTab}>
        <TabsContent value="commissions" className="mt-0">
          <Card className="bg-zinc-950/50 border border-zinc-900">
            <CardContent className="p-4 sm:p-6">
              {commissions.length === 0 ? (
                <div className="py-20 text-center">
                  <Coins className="w-16 h-16 text-zinc-800 mx-auto mb-4" />
                  <p className="text-zinc-500">No sales linked to your account yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {commissions.map((item: any) => {
                    const order = item.visa_orders;
                    const isBlacklisted = isBlacklistedProduct(order?.product_slug);
                    const commission = isBlacklisted ? null : item.commission;

                    return (
                      <div
                        key={item.id}
                        className={`p-4 bg-black/50 rounded-lg border transition ${commission
                          ? 'border-gold-medium/20 hover:bg-gold-medium/10'
                          : 'border-white/5 opacity-70 grayscale-[0.5]'
                          }`}
                      >
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-3">
                              {order?.order_number && (
                                <span className="text-xs text-gold-light font-mono font-bold">
                                  {order.order_number}
                                </span>
                              )}
                              <span className="text-[10px] text-gray-400">
                                {formatDate(item.created_at)}
                              </span>
                            </div>
                          </div>

                          {order && (
                            <div className="text-xs sm:text-sm">
                              <span className="text-gray-400">Product:</span>
                              <span className="text-white ml-2 font-medium">{order.product_slug}</span>
                              {order.client_name && (
                                <>
                                  <span className="text-gray-500 mx-2">•</span>
                                  <span className="text-gray-400">{order.client_name}</span>
                                </>
                              )}
                            </div>
                          )}

                          {commission ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4 text-xs sm:text-sm pt-2 border-t border-white/5">
                              <div>
                                <span className="text-gray-400">Net Amount:</span>
                                <span className="text-white ml-2">${commission.net_amount_usd.toFixed(2)}</span>
                              </div>
                              <div>
                                <span className="text-gray-400">Percentage:</span>
                                <span className="text-white ml-2">{commission.commission_percentage}%</span>
                              </div>
                              <div>
                                <span className="text-gray-400">Value:</span>
                                <span className="text-gold-light font-bold ml-2">
                                  ${commission.commission_amount_usd.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs text-gray-500 flex items-center gap-2 py-1 italic">
                              <AlertCircle className="w-3.5 h-3.5 text-zinc-600" />
                              <span>Sale identified, but does not meet commission criteria (e.g. consultations).</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div >
  );
}
