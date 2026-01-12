import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface PendingBalanceCardProps {
  pendingBalance: number;
  nextWithdrawalDate: string | null;
  nextRequestWindowStart?: string | null;
  nextRequestWindowEnd?: string | null;
  isInRequestWindow?: boolean;
}

export function PendingBalanceCard({
  pendingBalance,
  nextWithdrawalDate: _nextWithdrawalDate,
  nextRequestWindowStart,
  nextRequestWindowEnd: _nextRequestWindowEnd,
  isInRequestWindow = false,
}: PendingBalanceCardProps) {
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      
      // Calculate when next request window opens
      const windowStartDate = nextRequestWindowStart ? new Date(nextRequestWindowStart) : null;
      
      // New logic: Commissions become available on day 1 of next month
      // Seller can only request from days 1-5 of each month
      // So we only need to check when the next window opens
      
      if (pendingBalance <= 0) {
        setTimeLeft('No pending balance');
        return;
      }
      
      // If we're in the request window and have pending balance
      if (isInRequestWindow) {
        setTimeLeft('Available in current window');
        return;
      }
      
      // Calculate next window if not provided
      if (!windowStartDate) {
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const actualAvailableDate = nextMonth;
        
        const diff = actualAvailableDate.getTime() - now.getTime();
        
        if (diff <= 0) {
          setTimeLeft('Available in next window');
          return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (days > 0) {
          setTimeLeft(`Available in ${days} day${days > 1 ? 's' : ''}, ${hours}h ${minutes}m`);
        } else if (hours > 0) {
          setTimeLeft(`Available in ${hours}h ${minutes}m`);
        } else {
          setTimeLeft(`Available in ${minutes} min`);
        }
        return;
      }
      
      // Use provided window start date
      const diff = windowStartDate.getTime() - now.getTime();
      
      if (diff <= 0) {
        setTimeLeft('Available in next window');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      // Format: "Available in X days, Yh Zm"
      if (days > 0) {
        setTimeLeft(`Available in ${days} day${days > 1 ? 's' : ''}, ${hours}h ${minutes}m`);
      } else if (hours > 0) {
        setTimeLeft(`Available in ${hours}h ${minutes}m`);
      } else {
        setTimeLeft(`Available in ${minutes} min`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [pendingBalance, nextRequestWindowStart, isInRequestWindow]);

  return (
    <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gold-medium/20 rounded-full flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6 text-gold-light" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-400 mb-1">Pending Balance</p>
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
