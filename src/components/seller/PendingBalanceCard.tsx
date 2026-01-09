import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface PendingBalanceCardProps {
  pendingBalance: number;
  nextWithdrawalDate: string | null;
}

export function PendingBalanceCard({
  pendingBalance,
  nextWithdrawalDate,
}: PendingBalanceCardProps) {
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    if (!nextWithdrawalDate) {
      setTimeLeft('Aguardando liberação');
      return;
    }

    const updateTimer = () => {
      const nextDate = new Date(nextWithdrawalDate);
      const now = new Date();
      const diff = nextDate.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft('Disponível agora');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      // Format like Lus American: "Available in X days, Yh Zm"
      if (days > 0) {
        setTimeLeft(`Disponível em ${days} dia${days > 1 ? 's' : ''}, ${hours}h ${minutes}m`);
      } else if (hours > 0) {
        setTimeLeft(`Disponível em ${hours}h ${minutes}m`);
      } else {
        setTimeLeft(`Disponível em ${minutes} min`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [nextWithdrawalDate]);

  return (
    <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gold-medium/20 rounded-full flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6 text-gold-light" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-400 mb-1">Saldo Pendente</p>
            <p className="text-xl font-bold text-gold-light">
              ${pendingBalance.toFixed(2)}
            </p>
            <p className="text-xs text-gold-light mt-1 font-medium">
              {timeLeft}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
