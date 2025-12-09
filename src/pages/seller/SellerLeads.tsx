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
import { Users, Eye, Mail, Phone, Globe, Calendar, FileText, Filter, X, Search } from 'lucide-react';

interface SellerInfo {
  id: string;
  seller_id_public: string;
  full_name: string;
  email: string;
  status: string;
}

interface Lead {
  order_id: string;
  order_number: string;
  client_name: string;
  client_email: string;
  client_whatsapp: string | null;
  client_country: string | null;
  client_nationality: string | null;
  product_slug: string;
  payment_status: string;
  created_at: string;
  contract_pdf_url: string | null;
  // Form data from service_requests
  service_request_id: string | null;
  form_data: any;
}

const ITEMS_PER_PAGE = 5;

export function SellerLeads() {
  const { seller } = useOutletContext<{ seller: SellerInfo }>();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Filters
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [productFilter, setProductFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // PDF Modal
  const [selectedPdfUrl, setSelectedPdfUrl] = useState<string | null>(null);
  const [selectedPdfTitle, setSelectedPdfTitle] = useState<string>('Contract PDF');

  useEffect(() => {
    const loadLeads = async () => {
      if (!seller) return;

      try {
        // Load orders with service request data
        const { data: ordersData, error: ordersError } = await supabase
          .from('visa_orders')
          .select(`
            id,
            order_number,
            client_name,
            client_email,
            client_whatsapp,
            client_country,
            client_nationality,
            product_slug,
            payment_status,
            created_at,
            contract_pdf_url,
            service_request_id
          `)
          .eq('seller_id', seller.seller_id_public)
          .order('created_at', { ascending: false });

        if (ordersError) {
          console.error('Error loading orders:', ordersError);
          return;
        }

        // Load service requests for additional form data
        const serviceRequestIds = ordersData
          ?.filter(o => o.service_request_id)
          .map(o => o.service_request_id) || [];

        let serviceRequestsMap: Record<string, any> = {};
        
        if (serviceRequestIds.length > 0) {
          const { data: serviceRequests } = await supabase
            .from('service_requests')
            .select('id, dependents_count, status')
            .in('id', serviceRequestIds);

          if (serviceRequests) {
            serviceRequestsMap = serviceRequests.reduce((acc, sr) => {
              acc[sr.id] = sr;
              return acc;
            }, {} as Record<string, any>);
          }
        }

        // Load client data from clients table
        const orderIds = ordersData?.map(o => o.id) || [];
        let clientsMap: Record<string, any> = {};

        if (orderIds.length > 0) {
          // Get client IDs from service_requests
          const { data: serviceRequestsForClients } = await supabase
            .from('service_requests')
            .select('id, client_id')
            .in('id', serviceRequestIds);

          const clientIds = serviceRequestsForClients
            ?.map(sr => sr.client_id)
            .filter(Boolean) || [];

          if (clientIds.length > 0) {
            const { data: clientsData } = await supabase
              .from('clients')
              .select('*')
              .in('id', clientIds);

            if (clientsData) {
              clientsMap = clientsData.reduce((acc, client) => {
                acc[client.id] = client;
                return acc;
              }, {} as Record<string, any>);
            }
          }
        }

        // Combine data
        const leadsData: Lead[] = (ordersData || []).map(order => {
          const serviceRequest = order.service_request_id 
            ? serviceRequestsMap[order.service_request_id] 
            : null;
          
          // Find client data (if available)
          const clientData = serviceRequest?.client_id 
            ? clientsMap[serviceRequest.client_id]
            : null;

          return {
            order_id: order.id,
            order_number: order.order_number,
            client_name: order.client_name,
            client_email: order.client_email,
            client_whatsapp: order.client_whatsapp,
            client_country: order.client_country,
            client_nationality: order.client_nationality,
            product_slug: order.product_slug,
            payment_status: order.payment_status,
            created_at: order.created_at,
            contract_pdf_url: order.contract_pdf_url,
            service_request_id: order.service_request_id,
            form_data: {
              service_request: serviceRequest,
              client: clientData,
            },
          };
        });

        setLeads(leadsData);
      } catch (err) {
        console.error('Error loading leads:', err);
      } finally {
        setLoading(false);
      }
    };

    loadLeads();
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
      default:
        return <Badge>{status}</Badge>;
    }
  };

  // Get unique products for filter
  const uniqueProducts = useMemo(() => {
    const products = new Set(leads.map(lead => lead.product_slug));
    return Array.from(products).sort();
  }, [leads]);

  // Filtered leads
  const filteredLeads = useMemo(() => {
    let filtered = [...leads];

    // Filter by payment status
    if (paymentStatusFilter !== 'all') {
      if (paymentStatusFilter === 'paid') {
        filtered = filtered.filter(lead => 
          lead.payment_status === 'completed' || lead.payment_status === 'paid'
        );
      } else if (paymentStatusFilter === 'not_paid') {
        filtered = filtered.filter(lead => 
          lead.payment_status !== 'completed' && lead.payment_status !== 'paid'
        );
      } else {
        filtered = filtered.filter(lead => lead.payment_status === paymentStatusFilter);
      }
    }

    // Filter by date
    if (dateFilter !== 'all') {
      const now = new Date();
      let cutoffDate = new Date();
      
      switch (dateFilter) {
        case '7d':
          cutoffDate.setDate(now.getDate() - 7);
          break;
        case '30d':
          cutoffDate.setDate(now.getDate() - 30);
          break;
        case '90d':
          cutoffDate.setDate(now.getDate() - 90);
          break;
        case 'custom':
          // For custom date, we'd need a date picker - for now, skip
          break;
      }
      
      if (dateFilter !== 'custom') {
        filtered = filtered.filter(lead => {
          const leadDate = new Date(lead.created_at);
          return leadDate >= cutoffDate;
        });
      }
    }

    // Filter by product
    if (productFilter !== 'all') {
      filtered = filtered.filter(lead => lead.product_slug === productFilter);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(lead => 
        lead.client_name.toLowerCase().includes(query) ||
        lead.client_email.toLowerCase().includes(query) ||
        lead.order_number.toLowerCase().includes(query) ||
        (lead.client_whatsapp && lead.client_whatsapp.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [leads, paymentStatusFilter, dateFilter, productFilter, searchQuery]);

  // Pagination logic
  const paginatedLeads = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredLeads.slice(startIndex, endIndex);
  }, [filteredLeads, currentPage]);

  const totalPages = Math.ceil(filteredLeads.length / ITEMS_PER_PAGE);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [paymentStatusFilter, dateFilter, productFilter, searchQuery, filteredLeads.length]);

  // Clear all filters
  const clearFilters = () => {
    setPaymentStatusFilter('all');
    setDateFilter('all');
    setProductFilter('all');
    setSearchQuery('');
  };

  const hasActiveFilters = paymentStatusFilter !== 'all' || 
    dateFilter !== 'all' || 
    productFilter !== 'all' || 
    searchQuery.trim() !== '';

  if (loading) {
    return (
      <div>
        <div className="mb-8">
          <Skeleton className="h-9 w-56 mb-2" />
          <Skeleton className="h-5 w-80" />
        </div>

        <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="p-6 bg-black/50 rounded-lg border border-gold-medium/20"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Skeleton className="h-6 w-40" />
                        <Skeleton className="h-5 w-16 rounded-full" />
                      </div>
                      <Skeleton className="h-4 w-32 mb-1" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                    <div className="flex gap-2">
                      <Skeleton className="h-8 w-24" />
                      <Skeleton className="h-8 w-8" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gold-medium/20">
                    <div>
                      <Skeleton className="h-3 w-32 mb-2" />
                      <Skeleton className="h-4 w-48 mb-1" />
                      <Skeleton className="h-4 w-36" />
                    </div>
                    <div>
                      <Skeleton className="h-3 w-24 mb-2" />
                      <Skeleton className="h-4 w-32 mb-1" />
                      <Skeleton className="h-4 w-28" />
                    </div>
                    <div className="md:col-span-2">
                      <Skeleton className="h-3 w-40 mb-2" />
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {[1, 2, 3, 4].map((j) => (
                          <div key={j}>
                            <Skeleton className="h-3 w-24 mb-1" />
                            <Skeleton className="h-4 w-20" />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <Skeleton className="h-3 w-20 mb-1" />
                      <Skeleton className="h-4 w-40" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold migma-gold-text mb-2">Leads & Users</h1>
        <p className="text-gray-400">Detailed information about users who filled out forms</p>
      </div>

      <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center">
              <Users className="w-5 h-5 mr-2" />
              All Leads
            </CardTitle>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Search */}
              <div className="lg:col-span-2">
                <Label htmlFor="search" className="text-xs text-gray-400 mb-2 block">
                  Search
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="search"
                    type="text"
                    placeholder="Search by name, email, order number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-black/50 border-gold-medium/50 text-white placeholder:text-gray-500 focus:border-gold-medium"
                  />
                </div>
              </div>

              {/* Payment Status Filter */}
              <div>
                <Label htmlFor="payment-status" className="text-xs text-gray-400 mb-2 block">
                  Payment Status
                </Label>
                <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
                  <SelectTrigger 
                    id="payment-status"
                    className="bg-black/50 border-gold-medium/50 text-white"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-black border-gold-medium/50">
                    <SelectItem value="all" className="text-white focus:bg-gold-medium/20 focus:text-gold-light">
                      All
                    </SelectItem>
                    <SelectItem value="paid" className="text-white focus:bg-gold-medium/20 focus:text-gold-light">
                      Paid
                    </SelectItem>
                    <SelectItem value="not_paid" className="text-white focus:bg-gold-medium/20 focus:text-gold-light">
                      Not Paid
                    </SelectItem>
                    <SelectItem value="pending" className="text-white focus:bg-gold-medium/20 focus:text-gold-light">
                      Pending
                    </SelectItem>
                    <SelectItem value="failed" className="text-white focus:bg-gold-medium/20 focus:text-gold-light">
                      Failed
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date Filter */}
              <div>
                <Label htmlFor="date-filter" className="text-xs text-gray-400 mb-2 block">
                  Date Range
                </Label>
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger 
                    id="date-filter"
                    className="bg-black/50 border-gold-medium/50 text-white"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-black border-gold-medium/50">
                    <SelectItem value="all" className="text-white focus:bg-gold-medium/20 focus:text-gold-light">
                      All Time
                    </SelectItem>
                    <SelectItem value="7d" className="text-white focus:bg-gold-medium/20 focus:text-gold-light">
                      Last 7 Days
                    </SelectItem>
                    <SelectItem value="30d" className="text-white focus:bg-gold-medium/20 focus:text-gold-light">
                      Last 30 Days
                    </SelectItem>
                    <SelectItem value="90d" className="text-white focus:bg-gold-medium/20 focus:text-gold-light">
                      Last 90 Days
                    </SelectItem>
                  </SelectContent>
                </Select>
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
            Showing <span className="text-gold-light font-medium">{filteredLeads.length}</span> of{' '}
            <span className="text-gold-light font-medium">{leads.length}</span> leads
            {hasActiveFilters && ' (filtered)'}
          </div>
          {leads.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400 mb-2">No leads yet</p>
              <p className="text-sm text-gray-500">
                Leads will appear here when users fill out forms through your links
              </p>
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="text-center py-12">
              <Filter className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400 mb-2">No leads match your filters</p>
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
            <>
              <div className="space-y-4">
                {paginatedLeads.map((lead) => (
                <div
                  key={lead.order_id}
                  className="p-6 bg-black/50 rounded-lg border border-gold-medium/20 hover:bg-gold-medium/5 transition"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-white">{lead.client_name}</h3>
                        {getStatusBadge(lead.payment_status)}
                      </div>
                      <p className="text-sm text-gray-400 font-mono mb-1">Order: {lead.order_number}</p>
                      <p className="text-sm text-gray-400">Product: {lead.product_slug}</p>
                    </div>
                    <div className="flex gap-2">
                      <Link to={`/seller/orders/${lead.order_id}`}>
                        <Button size="sm" variant="outline" className="border-gold-medium/50 bg-black/50 text-gold-light hover:bg-black hover:border-gold-medium hover:text-gold-medium">
                          <Eye className="w-4 h-4 mr-1" />
                          View Details
                        </Button>
                      </Link>
                      {lead.contract_pdf_url && (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => {
                            setSelectedPdfUrl(lead.contract_pdf_url);
                            setSelectedPdfTitle(`Contract - ${lead.order_number}`);
                          }}
                          className="border-gold-medium/50 bg-black/50 text-gold-light hover:bg-black hover:border-gold-medium hover:text-gold-medium"
                          title="View Contract PDF"
                        >
                          <FileText className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gold-medium/20">
                    <div>
                      <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        Contact Information
                      </p>
                      <div className="space-y-1">
                        <p className="text-sm text-white">{lead.client_email}</p>
                        {lead.client_whatsapp && (
                          <p className="text-sm text-gray-400 flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {lead.client_whatsapp}
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        Location
                      </p>
                      <div className="space-y-1">
                        {lead.client_country && (
                          <p className="text-sm text-white">Country: {lead.client_country}</p>
                        )}
                        {lead.client_nationality && (
                          <p className="text-sm text-gray-400">Nationality: {lead.client_nationality}</p>
                        )}
                      </div>
                    </div>

                    {lead.form_data?.client && (
                      <div className="md:col-span-2">
                        <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          Additional Form Data
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                          {lead.form_data.client.date_of_birth && (
                            <div>
                              <p className="text-gray-500 text-xs">Date of Birth</p>
                              <p className="text-white">{lead.form_data.client.date_of_birth}</p>
                            </div>
                          )}
                          {lead.form_data.client.document_type && (
                            <div>
                              <p className="text-gray-500 text-xs">Document Type</p>
                              <p className="text-white capitalize">{lead.form_data.client.document_type}</p>
                            </div>
                          )}
                          {lead.form_data.client.document_number && (
                            <div>
                              <p className="text-gray-500 text-xs">Document Number</p>
                              <p className="text-white font-mono text-xs">{lead.form_data.client.document_number}</p>
                            </div>
                          )}
                          {lead.form_data.client.marital_status && (
                            <div>
                              <p className="text-gray-500 text-xs">Marital Status</p>
                              <p className="text-white capitalize">{lead.form_data.client.marital_status}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="md:col-span-2">
                      <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Created
                      </p>
                      <p className="text-sm text-gray-400">
                        {new Date(lead.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
                ))}
              </div>
              {filteredLeads.length > 0 && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                  itemsPerPage={ITEMS_PER_PAGE}
                  totalItems={filteredLeads.length}
                />
              )}
            </>
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


