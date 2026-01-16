import { useState, useEffect, useMemo } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PdfModal } from '@/components/ui/pdf-modal';
import { Eye, FileText, X, Search } from 'lucide-react';

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
const calculateNetAmountAndFee = (order: Order) => {
  let dbPrice = parseFloat(order.total_price_usd || '0');

  // Fix for total_price_usd being in cents
  if (dbPrice > 10000) {
    dbPrice = dbPrice / 100;
  }

  const metadata = order.payment_metadata;
  let feeAmount = 0;
  let totalPrice = dbPrice;
  let netAmount = dbPrice;

  // Main calculation logic: Net = Gross - Fee
  // 1. Determine Gross Total
  if (order.payment_method === 'parcelow') {
    // For Parcelow, total_price_usd in DB is the Gross amount (including markup)
    totalPrice = dbPrice;
  } else {
    // For Stripe/Zelle, total_price_usd in DB is the Gross amount (amount paid by client)
    totalPrice = dbPrice;
  }

  // 2. Determine Fee
  if (metadata?.fee_amount) {
    let val = parseFloat(metadata.fee_amount.toString());
    // If val is > 10000, it's likely in cents, but Parcelow fee might be large? 
    // Usually fees are < 10% of total. 
    // Let's assume if it matches total_price_usd it might be cents
    if (val > 10000 && val > dbPrice) val = val / 100;
    feeAmount = val;
  }
  // Fallback for Parcelow if fee_amount is missing: 5% markup
  else if (order.payment_method === 'parcelow') {
    // Estimate: Net = Gross / 1.05 -> Fee = Gross - Net
    feeAmount = totalPrice - (totalPrice / 1.05);
  }
  // Fallback for Stripe if fee_amount is missing: ~3.5%
  else if (order.payment_method?.startsWith('stripe')) {
    feeAmount = totalPrice * 0.035;
  }

  // 3. Final Net Amount
  netAmount = totalPrice - feeAmount;

  return {
    netAmount: Math.max(netAmount, 0),
    feeAmount: Math.max(feeAmount, 0),
    totalPrice: totalPrice
  };
};

const ITEMS_PER_PAGE = 10;

export function SellerOrders() {
  const { seller } = useOutletContext<{ seller: SellerInfo }>();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  // Filters
  const [productFilter, setProductFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // PDF Modal
  const [selectedPdfUrl, setSelectedPdfUrl] = useState<string | null>(null);
  const [selectedPdfTitle, setSelectedPdfTitle] = useState<string>('Contract PDF');

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
  }, [orders, productFilter, searchQuery]);

  // Pagination logic
  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredOrders.slice(startIndex, endIndex);
  }, [filteredOrders, currentPage]);

  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [productFilter, searchQuery, filteredOrders.length]);

  // Clear all filters
  const clearFilters = () => {
    setProductFilter('all');
    setSearchQuery('');
  };

  const hasActiveFilters = productFilter !== 'all' || searchQuery.trim() !== '';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-medium"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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

              <Select value={productFilter} onValueChange={setProductFilter}>
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
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-900 bg-zinc-900/20">
                  <th className="text-left py-4 px-6 text-xs font-bold text-zinc-500 uppercase tracking-wider">Order</th>
                  <th className="text-left py-4 px-6 text-xs font-bold text-zinc-500 uppercase tracking-wider">Client</th>
                  <th className="text-left py-4 px-6 text-xs font-bold text-zinc-500 uppercase tracking-wider">Product</th>
                  <th className="text-left py-4 px-6 text-xs font-bold text-zinc-500 uppercase tracking-wider">Gross Total</th>
                  <th className="text-left py-4 px-6 text-xs font-bold text-zinc-500 uppercase tracking-wider">Fee</th>
                  <th className="text-left py-4 px-6 text-xs font-bold text-zinc-500 uppercase tracking-wider">Net Amount</th>
                  <th className="text-left py-4 px-6 text-xs font-bold text-zinc-500 uppercase tracking-wider">Status</th>
                  <th className="text-left py-4 px-6 text-xs font-bold text-zinc-500 uppercase tracking-wider">Date</th>
                  <th className="text-right py-4 px-6 text-xs font-bold text-zinc-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {paginatedOrders.map((order) => {
                  const { netAmount, feeAmount, totalPrice } = calculateNetAmountAndFee(order);
                  return (
                    <tr key={order.id} className="hover:bg-zinc-900/30 transition-colors group">
                      <td className="py-4 px-6">
                        <span className="text-sm font-mono text-zinc-400">{order.order_number}</span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-white">{order.client_name}</span>
                          <span className="text-xs text-zinc-500">{order.client_email}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <Badge variant="outline" className="text-[10px] border-zinc-800 text-zinc-400 bg-transparent uppercase font-medium">
                          {order.product_slug}
                        </Badge>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-sm font-bold migma-gold-text">
                          ${totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`text-xs ${feeAmount > 0 ? 'text-red-400' : 'text-zinc-600'}`}>
                          {feeAmount > 0 ? `-$${feeAmount.toFixed(2)}` : '$0.00'}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-sm font-semibold text-white">
                          ${netAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        {getStatusBadge(order.payment_status)}
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-xs text-zinc-500">
                          {new Date(order.created_at).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center justify-end gap-2">
                          {order.annex_pdf_url && (
                            <button
                              onClick={() => { setSelectedPdfUrl(order.annex_pdf_url); setSelectedPdfTitle(`Annex I - ${order.order_number}`); }}
                              className="p-2 text-zinc-500 hover:text-gold-light hover:bg-zinc-800 rounded-md transition-all"
                              title="Annex I"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                          )}
                          {order.contract_pdf_url && (
                            <button
                              onClick={() => { setSelectedPdfUrl(order.contract_pdf_url); setSelectedPdfTitle(`Contract - ${order.order_number}`); }}
                              className="p-2 text-zinc-500 hover:text-gold-light hover:bg-zinc-800 rounded-md transition-all"
                              title="Contract"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                          )}
                          <Link to={`/seller/orders/${order.id}`}>
                            <Button variant="outline" size="sm" className="h-8 border-zinc-800 bg-zinc-900/50 text-xs text-white hover:bg-zinc-800 hover:border-gold-medium/50">
                              <Eye className="w-3.5 h-3.5 mr-1.5" />
                              View
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!loading && filteredOrders.length === 0 && (
            <div className="text-center py-20 bg-zinc-950/50">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-zinc-900 mb-4">
                <Search className="w-8 h-8 text-zinc-700" />
              </div>
              <p className="text-zinc-500 text-sm">No orders found matching your criteria</p>
              {hasActiveFilters && (
                <Button variant="link" onClick={clearFilters} className="text-gold-medium text-sm mt-2">
                  Clear all filters
                </Button>
              )}
            </div>
          )}

          {filteredOrders.length > 0 && (
            <div className="border-t border-zinc-900 p-4">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                itemsPerPage={ITEMS_PER_PAGE}
                totalItems={filteredOrders.length}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mobile Card View (Hidden on Desktop) */}
      <div className="md:hidden space-y-4">
        {paginatedOrders.map((order) => {
          const { netAmount, totalPrice } = calculateNetAmountAndFee(order);
          return (
            <Card key={order.id} className="bg-zinc-950 border border-zinc-900">
              <CardContent className="p-4 space-y-4">
                <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase">{order.order_number}</span>
                    <span className="text-sm font-semibold text-white mt-1">{order.client_name}</span>
                  </div>
                  {getStatusBadge(order.payment_status)}
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-900">
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Total</span>
                    <span className="text-sm font-bold migma-gold-text">${totalPrice.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Net</span>
                    <span className="text-sm font-semibold text-white">${netAmount.toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-zinc-900">
                  <span className="text-xs text-zinc-500">{new Date(order.created_at).toLocaleDateString()}</span>
                  <Link to={`/seller/orders/${order.id}`} className="w-full sm:w-auto">
                    <Button variant="outline" size="sm" className="h-8 border-zinc-800 bg-zinc-900 text-xs w-full">
                      View Details
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          );
        })}
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
}


