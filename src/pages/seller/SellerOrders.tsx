import { useState, useEffect, useMemo } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, X, Search, ShoppingBag, FileSignature } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { calculateOrderAmounts } from '@/lib/seller-commissions';

interface SellerInfo {
  id: string;
  seller_id_public: string;
  full_name: string;
  email: string;
  status: string;
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
  payment_metadata?: any; // Include payment_metadata to access fee_amount
  extra_units: number;
  contract_pdf_url: string | null;
  annex_pdf_url: string | null;
  created_at: string;
}

// Helper function to calculate net amount and fee
// Helper function to calculate net amount and fee
const calculateNetAmountAndFee = (order: Order) => calculateOrderAmounts(order);

const ITEMS_PER_PAGE = 30;

// Internal component for the order list to avoid duplication
const OrderTableSection = ({
  orders,
  calculateNetAmountAndFee,
  getStatusBadge,
  currentPage,
  setCurrentPage,
  ITEMS_PER_PAGE,
  isSignatureOnly = false
}: {
  orders: Order[],
  calculateNetAmountAndFee: any,
  getStatusBadge: any,
  currentPage: number,
  setCurrentPage: (p: number) => void,
  ITEMS_PER_PAGE: number,
  isSignatureOnly?: boolean,
  getProductName: (slug: string) => string
}) => {
  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return orders.slice(startIndex, endIndex);
  }, [orders, currentPage, ITEMS_PER_PAGE]);

  const totalPages = Math.ceil(orders.length / ITEMS_PER_PAGE);

  if (orders.length === 0) {
    return (
      <div className="text-center py-20 bg-zinc-950/50">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-zinc-900 mb-4">
          <Search className="w-8 h-8 text-zinc-700" />
        </div>
        <p className="text-zinc-500 text-sm">No {isSignatureOnly ? 'signatures' : 'orders'} found matching your criteria</p>
      </div>
    );
  }

  return (
    <>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gold-medium/30">
              <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Order # / Date</th>
              <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Client</th>
              <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Product</th>
              <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Method</th>
              <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">{isSignatureOnly ? 'Value' : 'Total / Fee'}</th>
              {!isSignatureOnly && <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Net Amount</th>}
              <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Status</th>
              <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedOrders.map((order) => {
              const { netAmount, feeAmount, totalPrice } = calculateNetAmountAndFee(order);
              return (
                <tr key={order.id} className="border-b border-gold-medium/10 hover:bg-white/5 transition-colors">
                  <td className="py-3 px-4">
                    <p className="text-sm text-white font-mono">{order.order_number}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {new Date(order.created_at).toLocaleDateString()}
                    </p>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-sm">
                      <p className="text-white">{order.client_name}</p>
                      <p className="text-gray-400 text-xs">{order.client_email}</p>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant="outline" className="text-[10px] border-zinc-800 text-zinc-400 bg-transparent uppercase font-medium">
                      {order.product_slug}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant="outline" className="text-[10px] border-zinc-800 text-zinc-300 bg-zinc-900/50 uppercase font-medium">
                      {order.payment_method === 'stripe'
                        ? 'Credit Card'
                        : order.payment_method === 'square_card'
                          ? 'Square Card'
                          : order.payment_method}
                    </Badge>
                  </td>
                  <td className={`py-3 px-4 text-sm font-bold ${isSignatureOnly ? 'text-blue-400' : 'text-gold-light'}`}>
                    <div>${totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    {!isSignatureOnly && (
                      <div className="text-[10px] font-normal mt-0.5 flex flex-col gap-0.5">
                        <span className={`text-[10px] ${feeAmount > 0 ? 'text-red-400' : 'text-zinc-600'}`}>
                          {feeAmount > 0 ? `-$${feeAmount.toFixed(2)} fee` : '$0.00 fee'}
                        </span>
                        {order.extra_units && order.extra_units > 0 ? (
                          <span className="text-blue-400">+{order.extra_units} dependent{order.extra_units > 1 ? 's' : ''}</span>
                        ) : null}
                      </div>
                    )}
                  </td>
                  {!isSignatureOnly && (
                    <td className="py-3 px-4 text-sm text-white font-semibold">
                      ${netAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  )}
                  <td className="py-3 px-4">
                    {getStatusBadge(order.payment_status)}
                  </td>
                  <td className="py-3 px-4">
                    <Link to={`/seller/orders/${order.id}`}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2 border-gold-medium/50 bg-black/50 text-white hover:bg-gold-medium/30 hover:text-gold-light h-8"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Details
                      </Button>
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile view for OrderTableSection */}
      <div className="md:hidden space-y-4 p-4">
        {paginatedOrders.map((order) => {
          const { netAmount, feeAmount, totalPrice } = calculateNetAmountAndFee(order);
          return (
            <Card key={order.id} className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                    <span className="text-sm font-mono text-gold-light font-semibold">{order.order_number}</span>
                    <span className="text-base font-semibold text-white mt-1">{order.client_name}</span>
                    <span className="text-xs text-gray-400">{order.client_email}</span>
                  </div>
                  {getStatusBadge(order.payment_status)}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm pt-2">
                  <div>
                    <p className="text-gray-400">Product</p>
                    <p className="text-white break-words">{order.product_slug}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">{isSignatureOnly ? 'Value' : 'Total (with fee)'}</p>
                    <p className="text-gold-light font-bold">${totalPrice.toFixed(2)}</p>
                    {order.extra_units && order.extra_units > 0 ? (
                      <div className="text-[10px] text-blue-400 mt-1">+{order.extra_units} dependent{order.extra_units > 1 ? 's' : ''}</div>
                    ) : null}
                  </div>
                  {!isSignatureOnly && (
                    <div>
                      <p className="text-gray-400">Net Amount</p>
                      <p className="text-white font-semibold">${netAmount.toFixed(2)}</p>
                    </div>
                  )}
                  {!isSignatureOnly && (
                    <div>
                      <p className="text-gray-400">Fee</p>
                      <p className="text-red-400">${feeAmount > 0 ? `-${feeAmount.toFixed(2)}` : '0.00'}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-gray-400">Date</p>
                    <p className="text-white">{new Date(order.created_at).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-2 border-t border-gold-medium/20">
                  <Link to={`/seller/orders/${order.id}`}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full flex items-center justify-center gap-2 border-gold-medium/50 bg-black/50 text-white hover:bg-gold-medium/30 hover:text-gold-light text-xs"
                    >
                      <Eye className="w-3 h-3" />
                      View Details
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="border-t border-zinc-900 p-4">
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          itemsPerPage={ITEMS_PER_PAGE}
          totalItems={orders.length}
        />
      </div>
    </>
  );
};

export function SellerOrders() {
  const { seller } = useOutletContext<{ seller: SellerInfo }>();
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'all');
  const [productFilter, setProductFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    const loadOrders = async () => {
      if (!seller) return;

      try {
        const { data: ordersData } = await supabase
          .from('visa_orders')
          .select('*, payment_metadata')
          .eq('seller_id', seller.seller_id_public)
          .order('created_at', { ascending: false });

        if (ordersData) {
          setOrders(ordersData as Order[]);
        }

        // Fetch products for names
        const { data: productsData } = await supabase
          .from('visa_products')
          .select('slug, name');
        setProducts(productsData || []);
      } catch (err) {
        console.error('Error loading orders:', err);
      } finally {
        setLoading(false);
      }
    };

    loadOrders();
  }, [seller]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
      case 'paid':
        return <Badge className="bg-green-500/20 text-green-300 border-green-500/50 uppercase text-[10px]">Paid</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/50 uppercase text-[10px]">Pending</Badge>;
      case 'manual_pending':
        return (
          <Badge className="bg-amber-500/20 text-amber-200 border-amber-500/50 animate-pulse whitespace-nowrap uppercase text-[10px]">
            Awaiting Approval
          </Badge>
        );
      case 'failed':
        return <Badge className="bg-red-500/20 text-red-300 border-red-500/50 uppercase text-[10px]">Failed</Badge>;
      case 'cancelled':
        return <Badge className="bg-gray-500/20 text-gray-300 border-gray-500/50 uppercase text-[10px]">Cancelled</Badge>;
      default:
        return <Badge className="uppercase text-[10px]">{status}</Badge>;
    }
  };

  // Get unique products for filter
  const uniqueProducts = useMemo(() => {
    const products = new Set(orders.map(order => order.product_slug));
    return Array.from(products).sort();
  }, [orders]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    let filtered = [...orders];

    // Filter by product
    if (productFilter !== 'all') {
      filtered = filtered.filter(order => order.product_slug === productFilter);
    }

    // Filter by status
    if (statusFilter !== 'all') {
      if (statusFilter === 'completed') {
        filtered = filtered.filter(order => order.payment_status === 'completed' || order.payment_status === 'paid');
      } else {
        filtered = filtered.filter(order => order.payment_status === statusFilter);
      }
    }

    // Search filter (by name, email, or order number)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(order =>
        order.client_name.toLowerCase().includes(query) ||
        order.client_email.toLowerCase().includes(query) ||
        order.order_number.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [orders, productFilter, statusFilter, searchQuery]);

  // Update status filter when URL params change
  useEffect(() => {
    const status = searchParams.get('status');
    if (status) {
      setStatusFilter(status);
    }
  }, [searchParams]);

  // Handle status filter change
  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);

    // Update URL params
    const newParams = new URLSearchParams(searchParams);
    if (value === 'all') {
      newParams.delete('status');
    } else {
      newParams.set('status', value);
    }
    setSearchParams(newParams);
  };

  const displayedRealOrders = useMemo(() =>
    filteredOrders.filter(o => o.payment_method !== 'manual'),
    [filteredOrders]);

  const displayedSignatureOrders = useMemo(() =>
    filteredOrders.filter(o => o.payment_method === 'manual'),
    [filteredOrders]);

  useEffect(() => {
    setCurrentPage(1);
  }, [productFilter, statusFilter, searchQuery]);

  const hasActiveFilters = productFilter !== 'all' || statusFilter !== 'all' || searchQuery.trim() !== '';

  // Clear all filters
  const clearFilters = () => {
    setProductFilter('all');
    setStatusFilter('all');
    setSearchParams(new URLSearchParams());
    setSearchQuery('');
  };

  const getProductName = (slug: string) => {
    return products.find(p => p.slug === slug)?.name || slug;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-medium"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ... Header ... */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold migma-gold-text">Your Orders</h1>
          <p className="text-sm text-gray-400 mt-1">Manage and track your sales performance</p>
        </div>
      </div>

      <Card className="bg-zinc-950 border border-zinc-900 overflow-hidden">
        <CardHeader className="border-b border-zinc-900 bg-zinc-950/50">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-lg font-semibold text-white">All Orders</CardTitle>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-gold-medium transition-colors" />
                <Input
                  placeholder="Order #, name, email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 w-full sm:w-64 bg-zinc-900/50 border-zinc-800 text-white placeholder:text-zinc-500 focus:border-gold-medium focus:ring-gold-medium/20"
                />
              </div>

              <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                <SelectTrigger className="h-9 w-full sm:w-40 bg-zinc-900/50 border-zinc-800 text-white focus:border-gold-medium focus:ring-gold-medium/20">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-950 border-zinc-800 text-white">
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Paid / Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

               <Select value={productFilter} onValueChange={(val) => {
                setProductFilter(val);
                setCurrentPage(1);
              }}>
                <SelectTrigger className="h-9 w-full sm:w-48 bg-zinc-900/50 border-zinc-800 text-white focus:border-gold-medium focus:ring-gold-medium/20">
                  <SelectValue placeholder="All Products" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-950 border-zinc-800 text-white">
                  <SelectItem value="all">All Products</SelectItem>
                  {uniqueProducts.map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-9 text-zinc-400 hover:text-white hover:bg-zinc-900"
                >
                  <X className="w-4 h-4 mr-2" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Tabs 
            defaultValue="real" 
            className="w-full"
            onValueChange={() => setCurrentPage(1)}
          >
            <div className="px-6 border-b border-zinc-900 bg-zinc-950/30">
              <TabsList className="bg-transparent h-12 gap-6 border-none p-0">
                <TabsTrigger
                  value="real"
                  className="data-[state=active]:bg-transparent data-[state=active]:text-gold-medium data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-gold-medium rounded-none bg-transparent text-zinc-500 h-12 px-2 gap-2"
                >
                  <ShoppingBag className="w-4 h-4" />
                  Paid Orders ({displayedRealOrders.length})
                </TabsTrigger>
                <TabsTrigger
                  value="signatures"
                  className="data-[state=active]:bg-transparent data-[state=active]:text-gold-medium data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-gold-medium rounded-none bg-transparent text-zinc-500 h-12 px-2 gap-2"
                >
                  <FileSignature className="w-4 h-4" />
                  Contract Signatures ({displayedSignatureOrders.length})
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="real" className="m-0">
              <OrderTableSection
                orders={displayedRealOrders}
                calculateNetAmountAndFee={calculateNetAmountAndFee}
                getStatusBadge={getStatusBadge}
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
                ITEMS_PER_PAGE={ITEMS_PER_PAGE}
                getProductName={getProductName}
              />
            </TabsContent>

            <TabsContent value="signatures" className="m-0">
              <OrderTableSection
                orders={displayedSignatureOrders}
                calculateNetAmountAndFee={calculateNetAmountAndFee}
                getStatusBadge={getStatusBadge}
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
                ITEMS_PER_PAGE={ITEMS_PER_PAGE}
                isSignatureOnly={true}
                getProductName={getProductName}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>


      {/* PDF Modal */}
    </div>
  );
}


