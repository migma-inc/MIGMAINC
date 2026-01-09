import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, Search } from 'lucide-react';
import { 
  getAllPaymentRequests, 
  getPaymentRequestWithSeller,
  approvePaymentRequest,
  rejectPaymentRequest,
  completePaymentRequest,
  getPaymentRequestStats,
  type PaymentRequestFilters
} from '@/lib/admin-payment-requests';
import { getCurrentUser } from '@/lib/auth';
import { PaymentRequestsList } from '@/components/admin/PaymentRequestsList';
import { PaymentRequestDetailModal } from '@/components/admin/PaymentRequestDetailModal';
import type { SellerPaymentRequest } from '@/types/seller';

export function AdminPaymentRequests() {
  const [requests, setRequests] = useState<SellerPaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<SellerPaymentRequest | null>(null);
  const [selectedSeller, setSelectedSeller] = useState<any>(null);
  const [adminId, setAdminId] = useState<string>('');
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    completed: 0,
    totalAmount: 0,
    pendingAmount: 0,
  });

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    const loadAdminId = async () => {
      const user = await getCurrentUser();
      if (user) {
        setAdminId(user.id);
      }
    };
    loadAdminId();
  }, []);

  useEffect(() => {
    loadData();
  }, [statusFilter, paymentMethodFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const filters: PaymentRequestFilters = {};
      
      if (statusFilter !== 'all') {
        filters.status = statusFilter as any;
      }
      
      if (paymentMethodFilter !== 'all') {
        filters.payment_method = paymentMethodFilter as any;
      }

      const [requestsData, statsData] = await Promise.all([
        getAllPaymentRequests(filters),
        getPaymentRequestStats(),
      ]);

      setRequests(requestsData);
      setStats(statsData);
    } catch (err) {
      console.error('Error loading payment requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (request: SellerPaymentRequest) => {
    setSelectedRequest(request);
    
    // Load seller details
    const requestWithSeller = await getPaymentRequestWithSeller(request.id);
    if (requestWithSeller?.seller) {
      setSelectedSeller(requestWithSeller.seller);
    }
  };

  const handleApprove = async (requestId: string, adminId: string) => {
    const result = await approvePaymentRequest(requestId, adminId);
    if (result.success) {
      await loadData();
      setSelectedRequest(null);
    } else {
      throw new Error(result.error || 'Failed to approve');
    }
  };

  const handleReject = async (requestId: string, adminId: string, reason: string) => {
    const result = await rejectPaymentRequest(requestId, adminId, reason);
    if (result.success) {
      await loadData();
      setSelectedRequest(null);
    } else {
      throw new Error(result.error || 'Failed to reject');
    }
  };

  const handleComplete = async (
    requestId: string,
    proofUrl?: string,
    proofFilePath?: string
  ) => {
    const result = await completePaymentRequest(requestId, proofUrl, proofFilePath);
    if (result.success) {
      await loadData();
      setSelectedRequest(null);
    } else {
      throw new Error(result.error || 'Failed to complete');
    }
  };

  // Filter requests by search query
  const filteredRequests = requests.filter((req) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      req.seller_id.toLowerCase().includes(query) ||
      req.payment_details?.email?.toLowerCase().includes(query) ||
      req.amount.toString().includes(query)
    );
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold migma-gold-text mb-2 flex items-center gap-2">
          <DollarSign className="w-6 h-6 sm:w-8 sm:h-8" />
          Solicitações de Pagamento
        </h1>
        <p className="text-sm sm:text-base text-gray-400">
          Gerencie solicitações de pagamento dos sellers
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <Card className="bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-blue-500/10 border border-blue-500/30">
          <CardContent className="p-4">
            <p className="text-xs text-gray-400 mb-1">Total</p>
            <p className="text-lg sm:text-xl font-bold text-blue-300">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-yellow-500/10 via-yellow-500/5 to-yellow-500/10 border border-yellow-500/30">
          <CardContent className="p-4">
            <p className="text-xs text-gray-400 mb-1">Pendentes</p>
            <p className="text-lg sm:text-xl font-bold text-yellow-300">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 via-green-500/5 to-green-500/10 border border-green-500/30">
          <CardContent className="p-4">
            <p className="text-xs text-gray-400 mb-1">Aprovados</p>
            <p className="text-lg sm:text-xl font-bold text-green-300">{stats.approved}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-500/10 via-red-500/5 to-red-500/10 border border-red-500/30">
          <CardContent className="p-4">
            <p className="text-xs text-gray-400 mb-1">Rejeitados</p>
            <p className="text-lg sm:text-xl font-bold text-red-300">{stats.rejected}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-purple-500/10 border border-purple-500/30">
          <CardContent className="p-4">
            <p className="text-xs text-gray-400 mb-1">Pagos</p>
            <p className="text-lg sm:text-xl font-bold text-purple-300">{stats.completed}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
          <CardContent className="p-4">
            <p className="text-xs text-gray-400 mb-1">Valor Pendente</p>
            <p className="text-lg sm:text-xl font-bold text-gold-light">
              ${stats.pendingAmount.toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30 mb-6">
        <CardContent className="p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search" className="text-white text-sm">
                Buscar
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-black/50 border-gold-medium/50 text-white"
                  placeholder="Seller ID, email, valor..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status" className="text-white text-sm">
                Status
              </Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger 
                  id="status"
                  className="bg-black/50 border-gold-medium/50 text-white"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="approved">Aprovado</SelectItem>
                  <SelectItem value="rejected">Rejeitado</SelectItem>
                  <SelectItem value="completed">Pago</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment_method" className="text-white text-sm">
                Método
              </Label>
              <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
                <SelectTrigger 
                  id="payment_method"
                  className="bg-black/50 border-gold-medium/50 text-white"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="stripe">Stripe</SelectItem>
                  <SelectItem value="wise">Wise</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Requests List */}
      <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
        <CardHeader>
          <CardTitle className="text-white text-lg sm:text-xl">
            Solicitações ({filteredRequests.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PaymentRequestsList
            requests={filteredRequests}
            onViewDetails={handleViewDetails}
            loading={loading}
          />
        </CardContent>
      </Card>

      {/* Detail Modal */}
      {selectedRequest && (
        <PaymentRequestDetailModal
          request={selectedRequest}
          seller={selectedSeller}
          open={!!selectedRequest}
          onClose={() => {
            setSelectedRequest(null);
            setSelectedSeller(null);
          }}
          onApprove={handleApprove}
          onReject={handleReject}
          onComplete={handleComplete}
          adminId={adminId}
        />
      )}
    </div>
  );
}
