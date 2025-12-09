import { useState, useEffect, useMemo } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination } from '@/components/ui/pagination';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PdfModal } from '@/components/ui/pdf-modal';
import { Users, Eye, FileText, Filter, X, Search } from 'lucide-react';

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
  extra_units: number;
  contract_pdf_url: string | null;
  created_at: string;
}

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
          .select('*')
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
      <div>
        <div className="mb-8">
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-5 w-64" />
        </div>

        <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gold-medium/30">
                    {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                      <th key={i} className="text-left py-3 px-4">
                        <Skeleton className="h-4 w-20" />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[1, 2, 3, 4, 5].map((row) => (
                    <tr key={row} className="border-b border-gold-medium/10">
                      {[1, 2, 3, 4, 5, 6, 7].map((cell) => (
                        <td key={cell} className="py-3 px-4">
                          <Skeleton className="h-4 w-24" />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold migma-gold-text mb-2">Your Orders</h1>
        <p className="text-gray-400">View and manage all your sales</p>
      </div>

      <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white">All Orders</CardTitle>
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="border-gold-medium/50 bg-black/50 text-gold-light hover:bg-black hover:border-gold-medium hover:text-gold-medium"
              >
                <X className="w-4 h-4 mr-1" />
                Clear Filters
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters Section */}
          <div className="mb-6 p-4 bg-black/30 rounded-lg border border-gold-medium/20">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-4 h-4 text-gold-light" />
              <h3 className="text-sm font-semibold text-white">Filters</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Search */}
              <div>
                <Label htmlFor="search" className="text-xs text-gray-400 mb-2 block">
                  Search by Name, Email, or Order Number
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="search"
                    type="text"
                    placeholder="Search orders..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-black/50 border-gold-medium/50 text-white placeholder:text-gray-500 focus:border-gold-medium"
                  />
                </div>
              </div>

              {/* Product Filter */}
              {uniqueProducts.length > 0 && (
                <div>
                  <Label htmlFor="product-filter" className="text-xs text-gray-400 mb-2 block">
                    Product
                  </Label>
                  <Select value={productFilter} onValueChange={setProductFilter}>
                    <SelectTrigger 
                      id="product-filter"
                      className="bg-black/50 border-gold-medium/50 text-white"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-black border-gold-medium/50">
                      <SelectItem value="all" className="text-white focus:bg-gold-medium/20 focus:text-gold-light">
                        All Products
                      </SelectItem>
                      {uniqueProducts.map((product) => (
                        <SelectItem 
                          key={product} 
                          value={product}
                          className="text-white focus:bg-gold-medium/20 focus:text-gold-light"
                        >
                          {product}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          {/* Results count */}
          <div className="mb-4 text-sm text-gray-400">
            Showing <span className="text-gold-light font-medium">{filteredOrders.length}</span> of{' '}
            <span className="text-gold-light font-medium">{orders.length}</span> orders
            {hasActiveFilters && ' (filtered)'}
          </div>

          {orders.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400 mb-2">No orders yet</p>
              <p className="text-sm text-gray-500">
                Share your personalized links to start making sales!
              </p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <Filter className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400 mb-2">No orders match your filters</p>
              <p className="text-sm text-gray-500 mb-4">
                Try adjusting your filter criteria
              </p>
              <Button
                variant="outline"
                onClick={clearFilters}
                className="border-gold-medium/50 bg-black/50 text-gold-light hover:bg-black hover:border-gold-medium hover:text-gold-medium"
              >
                Clear All Filters
              </Button>
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
                  {paginatedOrders.map((order) => (
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
                        ${parseFloat(order.total_price_usd || '0').toFixed(2)}
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(order.payment_status)}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-400">
                        {new Date(order.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <Link to={`/seller/orders/${order.id}`}>
                            <Button size="sm" variant="outline" className="text-xs border-gold-medium/50 bg-black/50 text-gold-light hover:bg-black hover:border-gold-medium hover:text-gold-medium">
                              <Eye className="w-3 h-3 mr-1" />
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
          {filteredOrders.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              itemsPerPage={ITEMS_PER_PAGE}
              totalItems={filteredOrders.length}
            />
          )}
        </CardContent>
      </Card>

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


