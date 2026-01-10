import { useEffect, useState } from 'react';
import { Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface PaymentRequestTimerProps {
  canRequest: boolean;
  nextWithdrawalDate: string | null;
  firstSaleDate?: string | null; // Data da primeira venda/comissão
  nextRequestWindowStart?: string | null;
  nextRequestWindowEnd?: string | null;
  isInRequestWindow?: boolean;
}

export function PaymentRequestTimer({
  canRequest,
  nextWithdrawalDate,
  firstSaleDate,
  nextRequestWindowStart,
  nextRequestWindowEnd,
  isInRequestWindow = false,
}: PaymentRequestTimerProps) {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isAvailable, setIsAvailable] = useState<boolean>(canRequest);
  const [windowTimeLeft, setWindowTimeLeft] = useState<string>('');

  useEffect(() => {
    // Update availability based on canRequest (which checks both balance and window)
    setIsAvailable(canRequest);
    
    if (canRequest) {
      setTimeLeft('Available now');
    } else if (!isInRequestWindow && nextRequestWindowStart) {
      // Calculate time until next request window
      const updateWindowTimer = () => {
        const windowStart = new Date(nextRequestWindowStart!);
        const now = new Date();
        const diff = windowStart.getTime() - now.getTime();

        if (diff <= 0) {
          setWindowTimeLeft('Window opening soon...');
          // Trigger parent to refresh data when window opens
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('requestWindowStatusChange'));
          }
          return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (days > 0) {
          setWindowTimeLeft(`${days}d ${hours}h until next request window`);
        } else if (hours > 0) {
          setWindowTimeLeft(`${hours}h ${minutes}m until next request window`);
        } else {
          setWindowTimeLeft(`${minutes}m until next request window`);
        }
      };

      updateWindowTimer();
      
      // Determine update interval based on time remaining
      const windowStart = new Date(nextRequestWindowStart!);
      const now = new Date();
      const diff = windowStart.getTime() - now.getTime();
      
      // If we're within the last hour before window opens, update more frequently
      const updateInterval = diff < 3600000 ? 10000 : 60000; // 10 seconds if < 1 hour, else 1 minute
      
      const interval = setInterval(updateWindowTimer, updateInterval);
      return () => clearInterval(interval);
    } else {
      setTimeLeft('Awaiting available balance');
    }
  }, [canRequest, isInRequestWindow, nextRequestWindowStart]);

  // Estado: Sem vendas ainda
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
                No sales yet
              </p>
              <p className="text-sm text-gray-400">
                Make your first sale to start earning commissions
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
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
                Withdrawal Available
              </p>
              <p className="text-sm text-gray-400">
                You can make a new request now
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-gold-light rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-gold-light">Ready</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Estado: Aguardando saldo disponível ou fora da janela
  return (
    <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gold-medium/20 rounded-full flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6 text-gold-light" />
          </div>
          <div className="flex-1">
            {!isInRequestWindow && nextRequestWindowStart ? (
              <>
                <p className="text-base font-semibold text-gold-light mb-1">
                  Request Window Closed
                </p>
                <p className="text-sm text-gray-400 mb-2">
                  Payment requests can only be made from the 1st to the 5th day of each month
                </p>
                <p className="text-xs text-gold-light font-medium mb-1">
                  {windowTimeLeft || 'Calculating...'}
                </p>
                {nextRequestWindowEnd && (
                  <p className="text-xs text-gray-500">
                    Next window: {new Date(nextRequestWindowStart).toLocaleDateString('en-US', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })} to {new Date(nextRequestWindowEnd).toLocaleDateString('en-US', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-base font-semibold text-gold-light mb-1">
                  Awaiting Available Balance
                </p>
                <p className="text-sm text-gray-400 mb-2">
                  {timeLeft}
                </p>
                {nextWithdrawalDate && (
                  <p className="text-xs text-gray-500">
                    Next commission available: {new Date(nextWithdrawalDate).toLocaleDateString('en-US', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
