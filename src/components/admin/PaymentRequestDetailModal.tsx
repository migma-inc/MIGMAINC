import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CheckCircle, 
  XCircle, 
  DollarSign, 
  User, 
  Calendar,
  AlertCircle,
  FileText
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { SellerPaymentRequest } from '@/types/seller';

interface PaymentRequestDetailModalProps {
  request: SellerPaymentRequest | null;
  seller?: {
    seller_id_public: string;
    full_name: string;
    email: string;
    phone?: string;
  } | null;
  open: boolean;
  onClose: () => void;
  onApprove: (requestId: string, adminId: string) => Promise<void>;
  onReject: (requestId: string, adminId: string, reason: string) => Promise<void>;
  onComplete: (requestId: string, proofUrl?: string, proofFilePath?: string) => Promise<void>;
  adminId: string;
}

export function PaymentRequestDetailModal({
  request,
  seller,
  open,
  onClose,
  onApprove,
  onReject,
  onComplete,
  adminId,
}: PaymentRequestDetailModalProps) {
  const [rejectionReason, setRejectionReason] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (open && request) {
      setRejectionReason('');
      setProofUrl('');
      setProofFile(null);
      setError('');
    }
  }, [open, request]);

  const handleFileUpload = async (file: File): Promise<string> => {
    if (!request) return '';

    const fileExt = file.name.split('.').pop();
    const fileName = `payment-proofs/${request.id}_${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      throw new Error('Failed to upload file');
    }

    const { data } = supabase.storage
      .from('documents')
      .getPublicUrl(fileName);

    return data.publicUrl;
  };

  const handleApprove = async () => {
    if (!request) return;

    setProcessing(true);
    setError('');

    try {
      await onApprove(request.id, adminId);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao aprovar solicitação');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!request) return;

    if (!rejectionReason.trim()) {
      setError('Motivo da rejeição é obrigatório');
      return;
    }

    setProcessing(true);
    setError('');

    try {
      await onReject(request.id, adminId, rejectionReason.trim());
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao rejeitar solicitação');
    } finally {
      setProcessing(false);
    }
  };

  const handleComplete = async () => {
    if (!request) return;

    setProcessing(true);
    setError('');

    try {
      let uploadedUrl = '';
      let uploadedPath = '';

      if (proofFile) {
        uploadedUrl = await handleFileUpload(proofFile);
        uploadedPath = `documents/payment-proofs/${request.id}_${Date.now()}.${proofFile.name.split('.').pop()}`;
      }

      await onComplete(
        request.id,
        proofUrl || uploadedUrl || undefined,
        uploadedPath || undefined
      );
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao completar solicitação');
    } finally {
      setProcessing(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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

  if (!request) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Detalhes da Solicitação de Pagamento
          </DialogTitle>
          <DialogDescription>
            ID: {request.id}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert className="bg-red-500/10 border-red-500/50">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <AlertDescription className="text-red-300 text-sm">
              {error}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-6">
          {/* Status and Amount */}
          <div className="flex items-center justify-between p-4 bg-black/50 rounded-lg border border-gold-medium/20">
            <div>
              <p className="text-sm text-gray-400 mb-1">Status</p>
              {getStatusBadge(request.status)}
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400 mb-1">Valor</p>
              <p className="text-2xl font-bold text-gold-light">
                ${request.amount.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Seller Info */}
          {seller && (
            <div className="p-4 bg-black/50 rounded-lg border border-gold-medium/20">
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <User className="w-4 h-4" />
                Informações do Seller
              </h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-400">Nome:</span>
                  <span className="text-white ml-2">{seller.full_name}</span>
                </div>
                <div>
                  <span className="text-gray-400">Email:</span>
                  <span className="text-white ml-2">{seller.email}</span>
                </div>
                {seller.phone && (
                  <div>
                    <span className="text-gray-400">Telefone:</span>
                    <span className="text-white ml-2">{seller.phone}</span>
                  </div>
                )}
                <div>
                  <span className="text-gray-400">Seller ID:</span>
                  <span className="text-white ml-2 font-mono">{seller.seller_id_public}</span>
                </div>
              </div>
            </div>
          )}

          {/* Payment Details */}
          <div className="p-4 bg-black/50 rounded-lg border border-gold-medium/20">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Detalhes do Pagamento
            </h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-400">Método:</span>
                <span className="text-white ml-2 capitalize">{request.payment_method}</span>
              </div>
              <div>
                <span className="text-gray-400">Email da conta:</span>
                <span className="text-white ml-2">{request.payment_details?.email}</span>
              </div>
              {request.payment_details?.account_id && (
                <div>
                  <span className="text-gray-400">Account ID:</span>
                  <span className="text-white ml-2">{request.payment_details.account_id}</span>
                </div>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div className="p-4 bg-black/50 rounded-lg border border-gold-medium/20">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Histórico
            </h3>
            <div className="space-y-2 text-sm">
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
          </div>

          {/* Rejection Reason */}
          {request.status === 'rejected' && request.rejection_reason && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm font-semibold text-red-300 mb-1">Motivo da Rejeição:</p>
              <p className="text-sm text-red-200">{request.rejection_reason}</p>
            </div>
          )}

          {/* Payment Proof */}
          {request.payment_proof_url && (
            <div className="p-4 bg-black/50 rounded-lg border border-gold-medium/20">
              <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Comprovante de Pagamento
              </h3>
              <a
                href={request.payment_proof_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gold-light hover:text-gold-medium underline text-sm"
              >
                Ver comprovante
              </a>
            </div>
          )}

          {/* Actions */}
          {request.status === 'pending' && (
            <div className="space-y-4 pt-4 border-t border-gold-medium/20">
              <div className="flex gap-3">
                <Button
                  onClick={handleApprove}
                  disabled={processing}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Aprovar
                </Button>
                <Button
                  onClick={handleReject}
                  disabled={processing}
                  variant="destructive"
                  className="flex-1"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Rejeitar
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rejection_reason" className="text-white">
                  Motivo da Rejeição (obrigatório para rejeitar)
                </Label>
                <Textarea
                  id="rejection_reason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="bg-black/50 border-gold-medium/50 text-white"
                  placeholder="Digite o motivo da rejeição..."
                  rows={3}
                />
              </div>
            </div>
          )}

          {request.status === 'approved' && (
            <div className="space-y-4 pt-4 border-t border-gold-medium/20">
              <div className="space-y-2">
                <Label htmlFor="proof_url" className="text-white">
                  URL do Comprovante (opcional)
                </Label>
                <Input
                  id="proof_url"
                  type="url"
                  value={proofUrl}
                  onChange={(e) => setProofUrl(e.target.value)}
                  className="bg-black/50 border-gold-medium/50 text-white"
                  placeholder="https://..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="proof_file" className="text-white">
                  Ou fazer upload de arquivo
                </Label>
                <Input
                  id="proof_file"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                  className="bg-black/50 border-gold-medium/50 text-white"
                />
              </div>

              <Button
                onClick={handleComplete}
                disabled={processing || (!proofUrl && !proofFile)}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Marcar como Pago
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
