import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DollarSign, Clock, CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { 
  getSellerBalance, 
  getSellerPaymentRequests, 
  createPaymentRequest,
  type SellerPaymentRequest 
} from '@/lib/seller-payment-requests';
import { PaymentRequestTimer } from '@/components/seller/PaymentRequestTimer';
import { PaymentRequestForm } from '@/components/seller/PaymentRequestForm';
import type { SellerBalance } from '@/types/seller';

interface SellerInfo {
  id: string;
  seller_id_public: string;
  full_name: string;
  email: string;
  status: string;
}

export function SellerPaymentRequests() {
  const { seller } = useOutletContext<{ seller: SellerInfo }>();
  const [balance, setBalance] = useState<SellerBalance>({
    available_balance: 0,
    pending_balance: 0,
    next_withdrawal_date: null,
    can_request: false,
    last_request_date: null,
  });
  const [requests, setRequests] = useState<SellerPaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'request' | 'history'>('request');

  const loadData = async () => {
    if (!seller) return;

    try {
      const [balanceData, requestsData] = await Promise.all([
        getSellerBalance(seller.seller_id_public),
        getSellerPaymentRequests(seller.seller_id_public),
      ]);

      setBalance(balanceData);
      setRequests(requestsData);
    } catch (err) {
      console.error('Error loading payment requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (seller) {
      loadData();
    }
  }, [seller]);

  const handleRefresh = async () => {
    if (!seller) return;
    setRefreshing(true);
    try {
      await loadData();
    } finally {
      setRefreshing(false);
    }
  };

  const handleSubmitRequest = async (formData: any) => {
    if (!seller) return;

    setSubmitting(true);
    try {
      const result = await createPaymentRequest(seller.seller_id_public, formData);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to create payment request');
      }

      // Reload data
      const [balanceData, requestsData] = await Promise.all([
        getSellerBalance(seller.seller_id_public),
        getSellerPaymentRequests(seller.seller_id_public),
      ]);

      setBalance(balanceData);
      setRequests(requestsData);
      setActiveTab('history');
    } catch (error: any) {
      throw error;
    } finally {
      setSubmitting(false);
    }
  };

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
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold migma-gold-text mb-2 flex items-center gap-2">
          <DollarSign className="w-6 h-6 sm:w-8 sm:h-8" />
          Solicitações de Pagamento
        </h1>
        <p className="text-sm sm:text-base text-gray-400">
          Solicite pagamentos do seu saldo disponível
        </p>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <Card className="bg-gradient-to-br from-green-500/10 via-green-500/5 to-green-500/10 border border-green-500/30">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-400">Saldo Disponível</p>
                <p className="text-xl sm:text-2xl font-bold text-green-300">
                  ${balance.available_balance.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 mt-1">Pronto para saque</p>
              </div>
              <DollarSign className="w-8 h-8 sm:w-10 sm:h-10 text-green-400 shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-500/10 via-yellow-500/5 to-yellow-500/10 border border-yellow-500/30">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-400">Saldo Pendente</p>
                <p className="text-xl sm:text-2xl font-bold text-yellow-300">
                  ${balance.pending_balance.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 mt-1">Aguardando liberação</p>
              </div>
              <Clock className="w-8 h-8 sm:w-10 sm:h-10 text-yellow-400 shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-blue-500/10 border border-blue-500/30">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-400">Total Acumulado</p>
                <p className="text-xl sm:text-2xl font-bold text-blue-300">
                  ${(balance.available_balance + balance.pending_balance).toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 mt-1">Disponível + Pendente</p>
              </div>
              <CheckCircle className="w-8 h-8 sm:w-10 sm:h-10 text-blue-400 shrink-0" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Timer */}
      <div className="mb-6 sm:mb-8">
        <PaymentRequestTimer
          canRequest={balance.can_request}
          lastRequestDate={balance.last_request_date}
          nextWithdrawalDate={balance.next_withdrawal_date}
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'request' | 'history')}>
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="request">Nova Solicitação</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="request">
          {balance.available_balance > 0 && balance.can_request ? (
            <PaymentRequestForm
              availableBalance={balance.available_balance}
              onSubmit={handleSubmitRequest}
              isLoading={submitting}
            />
          ) : (
            <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
              <CardContent className="p-6 sm:p-8 text-center">
                <AlertCircle className="w-12 h-12 sm:w-16 sm:h-16 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400 text-lg mb-2">
                  {balance.available_balance <= 0 
                    ? 'Você não tem saldo disponível no momento'
                    : 'Aguarde o período de 30 dias para fazer uma nova solicitação'}
                </p>
                {balance.pending_balance > 0 && (
                  <p className="text-gray-500 text-sm mt-2">
                    Você tem ${balance.pending_balance.toFixed(2)} aguardando liberação
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history">
          <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
            <CardHeader>
              <CardTitle className="text-white text-lg sm:text-xl">Histórico de Solicitações</CardTitle>
            </CardHeader>
            <CardContent>
              {requests.length === 0 ? (
                <div className="py-12 text-center">
                  <DollarSign className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-400 text-lg">Nenhuma solicitação encontrada</p>
                  <p className="text-gray-500 text-sm mt-2">
                    Suas solicitações de pagamento aparecerão aqui
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {requests.map((request) => (
                    <div
                      key={request.id}
                      className="p-4 bg-black/50 rounded-lg border border-gold-medium/20 hover:bg-gold-medium/10 transition"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            {getStatusBadge(request.status)}
                            <span className="text-lg sm:text-xl font-bold text-gold-light">
                              ${request.amount.toFixed(2)}
                            </span>
                            <span className="text-xs sm:text-sm text-gray-400 capitalize">
                              {request.payment_method}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm">
                            <div>
                              <span className="text-gray-400">Solicitado em:</span>
                              <span className="text-white ml-2">{formatDate(request.requested_at)}</span>
                            </div>
                            {request.approved_at && (
                              <div>
                                <span className="text-gray-400">Aprovado em:</span>
                                <span className="text-white ml-2">{formatDate(request.approved_at)}</span>
                              </div>
                            )}
                            {request.rejected_at && (
                              <div>
                                <span className="text-gray-400">Rejeitado em:</span>
                                <span className="text-white ml-2">{formatDate(request.rejected_at)}</span>
                              </div>
                            )}
                            {request.completed_at && (
                              <div>
                                <span className="text-gray-400">Pago em:</span>
                                <span className="text-white ml-2">{formatDate(request.completed_at)}</span>
                              </div>
                            )}
                          </div>
                          {request.rejection_reason && (
                            <div className="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-300">
                              <strong>Motivo da rejeição:</strong> {request.rejection_reason}
                            </div>
                          )}
                          {request.payment_proof_url && (
                            <div className="mt-2">
                              <a
                                href={request.payment_proof_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-gold-light hover:text-gold-medium underline"
                              >
                                Ver comprovante de pagamento
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
