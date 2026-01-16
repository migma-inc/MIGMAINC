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
import { Users, Eye, Mail, Phone, Globe, FileText, Filter, X, Search } from 'lucide-react';

interface SellerInfo {
  id: string;
  seller_id_public: string;
  full_name: string;
  email: string;
  status: string;
}

interface Lead {
  order_id: string | null; // Can be null if no order created yet
  order_number: string | null; // Can be null if no order created yet
  service_request_id: string;
  client_name: string;
  client_email: string;
  client_whatsapp: string | null;
  client_country: string | null;
  client_nationality: string | null;
  product_slug: string;
  payment_status: string; // From order if exists, or from service_request status
  created_at: string;
  contract_pdf_url: string | null;
  // Form data from service_requests
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
        // Load ALL service requests for this seller (including those without orders)
        const { data: serviceRequestsData, error: serviceRequestsError } = await supabase
          .from('service_requests')
          .select(`
            id,
            client_id,
            service_id,
            dependents_count,
            status,
            created_at
          `)
          .eq('seller_id', seller.seller_id_public)
          .order('created_at', { ascending: false });

        if (serviceRequestsError) {
          console.error('Error loading service requests:', serviceRequestsError);
          return;
        }

        // Load orders to get payment status and order details
        const { data: ordersData } = await supabase
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
          .eq('seller_id', seller.seller_id_public);

        // Create a map of orders by service_request_id
        const ordersMap = new Map(
          (ordersData || [])
            .filter(o => o.service_request_id)
            .map(o => [o.service_request_id, o])
        );

        // Get all client IDs from service requests
        const clientIds = (serviceRequestsData || [])
          .map(sr => sr.client_id)
          .filter(Boolean) || [];

        // Load client data
        let clientsMap: Record<string, any> = {};
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

        // Combine service requests with order data (if exists)
        const allLeads: Lead[] = (serviceRequestsData || []).map(serviceRequest => {
          const order = ordersMap.get(serviceRequest.id);
          const client = clientsMap[serviceRequest.client_id];

          // Use order data if exists, otherwise use client data
          const clientName = order?.client_name || client?.full_name || 'N/A';
          const clientEmail = order?.client_email || client?.email || 'N/A';
          const clientWhatsapp = order?.client_whatsapp || client?.phone || null;
          const clientCountry = order?.client_country || client?.country || null;
          const clientNationality = order?.client_nationality || client?.nationality || null;

          // Payment status: use order payment_status if order exists, otherwise map service_request status
          let paymentStatus = 'pending';
          if (order) {
            paymentStatus = order.payment_status;
          } else {
            // Map service_request status to payment_status
            switch (serviceRequest.status) {
              case 'paid':
                paymentStatus = 'paid';
                break;
              case 'pending_payment':
                paymentStatus = 'pending';
                break;
              case 'cancelled':
                paymentStatus = 'cancelled';
                break;
              case 'onboarding':
              default:
                paymentStatus = 'pending';
                break;
            }
          }

          return {
            order_id: order?.id || null,
            order_number: order?.order_number || null,
            service_request_id: serviceRequest.id,
            client_name: clientName,
            client_email: clientEmail,
            client_whatsapp: clientWhatsapp,
            client_country: clientCountry,
            client_nationality: clientNationality,
            product_slug: serviceRequest.service_id || order?.product_slug || 'N/A',
            payment_status: paymentStatus,
            created_at: serviceRequest.created_at,
            contract_pdf_url: order?.contract_pdf_url || null,
            form_data: {
              service_request: serviceRequest,
              client: client,
            },
          };
        });

        // Group leads by client email to avoid duplicates
        // If same client has multiple service requests, keep the most recent one
        // and update payment status if any order was paid
        const leadsMap = new Map<string, Lead>();

        for (const lead of allLeads) {
          const key = lead.client_email.toLowerCase().trim();
          const existingLead = leadsMap.get(key);

          if (!existingLead) {
            // First time seeing this client
            leadsMap.set(key, lead);
          } else {
            // Client already exists - update if:
            // 1. This lead has a paid order and existing doesn't
            // 2. This lead is more recent
            const existingIsPaid = existingLead.payment_status === 'paid' || existingLead.payment_status === 'completed';
            const currentIsPaid = lead.payment_status === 'paid' || lead.payment_status === 'completed';
            const currentIsNewer = new Date(lead.created_at) > new Date(existingLead.created_at);

            if (currentIsPaid && !existingIsPaid) {
              // Update to paid version
              leadsMap.set(key, lead);
            } else if (currentIsNewer && !existingIsPaid) {
              // Update to newer version if existing is not paid
              leadsMap.set(key, lead);
            } else if (currentIsPaid && existingIsPaid && currentIsNewer) {
              // Both paid, use newer
              leadsMap.set(key, lead);
            }
            // Otherwise keep existing
          }
        }

        // Convert map to array and sort by created_at (most recent first)
        const leadsData = Array.from(leadsMap.values()).sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

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
        (lead.order_number && lead.order_number.toLowerCase().includes(query)) ||
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
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-medium"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold migma-gold-text">Leads & Users</h1>
          <p className="text-sm text-gray-400 mt-1">Detailed information about users who filled out forms</p>
        </div>
      </div>

      <Card className="bg-zinc-950 border border-zinc-900 overflow-hidden">
        <CardHeader className="border-b border-zinc-900 bg-zinc-950/50">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-lg font-semibold text-white flex items-center">
              <Users className="w-5 h-5 mr-2 text-gold-medium" />
              All Leads
            </CardTitle>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-gold-medium transition-colors" />
                <Input
                  id="search"
                  placeholder="Search name, email, order..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 w-full sm:w-64 bg-zinc-900/50 border-zinc-800 text-white placeholder:text-zinc-500 focus:border-gold-medium focus:ring-gold-medium/20"
                />
              </div>

              <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
                <SelectTrigger className="h-9 w-full sm:w-40 bg-zinc-900/50 border-zinc-800 text-white focus:border-gold-medium focus:ring-gold-medium/20">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-950 border-zinc-800 text-white">
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="not_paid">Not Paid</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
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
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-900 bg-zinc-900/30">
                  <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Client</th>
                  <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Contact</th>
                  <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Details</th>
                  <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {leads.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">
                      <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
                      <p>No leads found</p>
                    </td>
                  </tr>
                ) : filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">
                      <Filter className="w-12 h-12 mx-auto mb-4 opacity-20" />
                      <p>No leads match your filters</p>
                    </td>
                  </tr>
                ) : (
                  paginatedLeads.map((lead) => (
                    <tr key={lead.service_request_id} className="group hover:bg-zinc-900/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-white group-hover:text-gold-light transition-colors">
                            {lead.client_name}
                          </span>
                          <span className="text-xs text-zinc-500 uppercase tracking-tight">
                            {lead.order_number || 'No Order Yet'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center text-xs text-zinc-400">
                            <Mail className="w-3 h-3 mr-1.5 text-zinc-500" />
                            {lead.client_email}
                          </div>
                          {lead.client_whatsapp && (
                            <div className="flex items-center text-xs text-zinc-400">
                              <Phone className="w-3 h-3 mr-1.5 text-zinc-500" />
                              {lead.client_whatsapp}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center text-xs text-zinc-400">
                            <Globe className="w-3 h-3 mr-1.5 text-zinc-500" />
                            {lead.client_country || 'N/A'}
                          </div>
                          <div className="text-[10px] text-zinc-500 font-mono">
                            {lead.product_slug}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(lead.payment_status)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-xs text-zinc-300">
                            {new Date(lead.created_at).toLocaleDateString()}
                          </span>
                          <span className="text-[10px] text-zinc-500 uppercase">
                            {new Date(lead.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          {lead.order_id && (
                            <Link to={`/seller/orders/${lead.order_id}`}>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-gold-light hover:bg-gold-light/10">
                                <Eye className="w-4 h-4" />
                              </Button>
                            </Link>
                          )}
                          {lead.contract_pdf_url && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-zinc-400 hover:text-gold-light hover:bg-gold-light/10"
                              onClick={() => {
                                setSelectedPdfUrl(lead.contract_pdf_url);
                                setSelectedPdfTitle(`Contract - ${lead.order_number}`);
                              }}
                            >
                              <FileText className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {filteredLeads.length > ITEMS_PER_PAGE && (
            <div className="px-6 py-4 border-t border-zinc-900 bg-zinc-950/50">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                itemsPerPage={ITEMS_PER_PAGE}
                totalItems={filteredLeads.length}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mobile view could be added here as cards if needed, similar to SellerOrders */}

      <PdfModal
        isOpen={!!selectedPdfUrl}
        onClose={() => setSelectedPdfUrl(null)}
        pdfUrl={selectedPdfUrl || ''}
        title={selectedPdfTitle}
      />
    </div>
  );
}


