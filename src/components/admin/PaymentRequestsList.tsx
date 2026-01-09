import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, DollarSign } from 'lucide-react';
import type { SellerPaymentRequest } from '@/types/seller';

interface PaymentRequestsListProps {
  requests: SellerPaymentRequest[];
  onViewDetails: (request: SellerPaymentRequest) => void;
  loading?: boolean;
}

export function PaymentRequestsList({
  requests,
  onViewDetails,
  loading = false,
}: PaymentRequestsListProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500/20 text-green-300 border-green-500/50">Pago</Badge>;
      case 'approved':
        return <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/50">Aprovado</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/50">Pendente</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500/20 text-red-300 border-red-500/50">Rejeitado</Badge>;
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

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-black/50 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="py-12 text-center">
        <DollarSign className="w-16 h-16 text-gray-500 mx-auto mb-4" />
        <p className="text-gray-400 text-lg">Nenhuma solicitação encontrada</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {requests.map((request) => (
        <div
          key={request.id}
          className="p-4 bg-black/50 rounded-lg border border-gold-medium/20 hover:bg-gold-medium/10 transition"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                {getStatusBadge(request.status)}
                <span className="text-xl font-bold text-gold-light">
                  ${request.amount.toFixed(2)}
                </span>
                <span className="text-sm text-gray-400 capitalize">
                  {request.payment_method}
                </span>
                <span className="text-xs text-gray-500">
                  {formatDate(request.requested_at)}
                </span>
              </div>
              <div className="text-sm text-gray-400">
                Seller ID: <span className="text-white font-mono">{request.seller_id}</span>
              </div>
              {request.payment_details?.email && (
                <div className="text-sm text-gray-400 mt-1">
                  Email: <span className="text-white">{request.payment_details.email}</span>
                </div>
              )}
            </div>
            <Button
              onClick={() => onViewDetails(request)}
              variant="outline"
              className="border-gold-medium/50 bg-black/50 text-gold-light hover:bg-gold-medium/10 hover:border-gold-medium"
            >
              <Eye className="w-4 h-4 mr-2" />
              Ver Detalhes
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
