import { useEffect, useState } from 'react';
import { Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface PaymentRequestTimerProps {
  canRequest: boolean;
  lastRequestDate: string | null;
  nextWithdrawalDate: string | null;
  firstSaleDate?: string | null; // Data da primeira venda/comissão
}

export function PaymentRequestTimer({
  canRequest,
  lastRequestDate,
  nextWithdrawalDate,
  firstSaleDate,
}: PaymentRequestTimerProps) {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isAvailable, setIsAvailable] = useState<boolean>(canRequest);

  useEffect(() => {
    if (canRequest) {
      setIsAvailable(true);
      setTimeLeft('Disponível agora');
      return;
    }

    const updateTimer = () => {
      // Se nunca solicitou, precisa esperar 30 dias desde a primeira venda
      if (!lastRequestDate) {
        if (firstSaleDate) {
          const firstSale = new Date(firstSaleDate);
          const nextAvailableDate = new Date(firstSale);
          nextAvailableDate.setDate(nextAvailableDate.getDate() + 30);
          
          const now = new Date();
          const diff = nextAvailableDate.getTime() - now.getTime();
          
          if (diff <= 0) {
            setIsAvailable(true);
            setTimeLeft('Disponível agora');
            return;
          }
          
          setIsAvailable(false);
          const days = Math.floor(diff / (1000 * 60 * 60 * 24));
          const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          
          if (days > 0) {
            setTimeLeft(`${days} dia${days > 1 ? 's' : ''}, ${hours}h ${minutes}m`);
          } else if (hours > 0) {
            setTimeLeft(`${hours}h ${minutes}m`);
          } else {
            setTimeLeft(`${minutes} min`);
          }
          return;
        } else {
          setTimeLeft('Aguardando primeira venda');
          setIsAvailable(false);
          return;
        }
      }

      // Se já solicitou, calcula 30 dias desde a última solicitação aprovada
      const lastDate = new Date(lastRequestDate);
      const nextAvailableDate = new Date(lastDate);
      nextAvailableDate.setDate(nextAvailableDate.getDate() + 30);

      const now = new Date();
      const diff = nextAvailableDate.getTime() - now.getTime();

      if (diff <= 0) {
        setIsAvailable(true);
        setTimeLeft('Disponível agora');
        return;
      }

      setIsAvailable(false);
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      // Format like Lus American: "Available in X days, Yh Zm"
      if (days > 0) {
        setTimeLeft(`${days} dia${days > 1 ? 's' : ''}, ${hours}h ${minutes}m`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m`);
      } else {
        setTimeLeft(`${minutes} min`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [canRequest, lastRequestDate, nextWithdrawalDate, firstSaleDate]);

  // Estado: Sem primeira solicitação - mas pode ter primeira venda
  if (!lastRequestDate) {
    if (!firstSaleDate) {
      return (
        <Card className="bg-black/50 border border-gold-medium/30">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gold-medium/20 rounded-full flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6 text-gold-light" />
              </div>
              <div className="flex-1">
                <p className="text-base font-semibold text-white mb-1">
                  Sem vendas ainda
                </p>
                <p className="text-sm text-gray-400">
                  Faça sua primeira venda para começar a ganhar comissões
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }
    // Tem primeira venda mas ainda não pode solicitar (aguardando 30 dias)
    // O timer já foi calculado no useEffect, então só renderiza o estado de aguardando
  }

  // Estado: Disponível
  if (isAvailable) {
    return (
      <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/50">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gold-medium/20 rounded-full flex items-center justify-center shrink-0">
              <CheckCircle className="w-6 h-6 text-gold-light" />
            </div>
            <div className="flex-1">
              <p className="text-base font-semibold text-gold-light mb-1">
                Saque Disponível
              </p>
              <p className="text-sm text-gray-400">
                Você pode fazer uma nova solicitação agora
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-gold-light rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-gold-light">Pronto</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Estado: Aguardando período
  return (
    <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gold-medium/20 rounded-full flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6 text-gold-light" />
          </div>
          <div className="flex-1">
            <p className="text-base font-semibold text-gold-light mb-1">
              Saque Não Disponível
            </p>
            <p className="text-sm text-gray-400 mb-2">
              {timeLeft} restante
            </p>
            {lastRequestDate ? (
              <p className="text-xs text-gray-500">
                Última solicitação: {new Date(lastRequestDate).toLocaleDateString('pt-BR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            ) : firstSaleDate ? (
              <p className="text-xs text-gray-500">
                Primeira venda: {new Date(firstSaleDate).toLocaleDateString('pt-BR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
