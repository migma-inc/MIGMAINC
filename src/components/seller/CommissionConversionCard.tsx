import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface CommissionConversionCardProps {
  currentRate: number;
  previousRate?: number;
  currentRevenue: number;
  currentCommissions: number;
  title?: string;
  className?: string;
}

export function CommissionConversionCard({
  currentRate,
  previousRate,
  currentRevenue,
  currentCommissions,
  title = 'Commission Rate',
  className = '',
}: CommissionConversionCardProps) {
  const rateChange = previousRate !== undefined
    ? currentRate - previousRate
    : 0;

  const getTrendIcon = () => {
    if (rateChange > 0.1) return <TrendingUp className="w-4 h-4 text-green-400" />;
    if (rateChange < -0.1) return <TrendingDown className="w-4 h-4 text-red-400" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  const getTrendColor = () => {
    if (rateChange > 0.1) return 'text-green-400';
    if (rateChange < -0.1) return 'text-red-400';
    return 'text-gray-400';
  };

  return (
    <Card className={`bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30 shadow-lg shadow-black/20 overflow-hidden ${className}`}>
      <CardContent className="p-3 sm:p-5 lg:p-6">
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex-1 min-w-0 text-gray-400">
            <p className="text-[9px] sm:text-sm font-black uppercase tracking-widest mb-1 truncate">{title}</p>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <p className="text-base sm:text-2xl font-bold text-gold-light tracking-tight">
                {currentRate.toFixed(2)}%
              </p>
              {previousRate !== undefined && (
                <div className={`flex items-center gap-0.5 ${getTrendColor()}`}>
                  <span className="scale-75">{getTrendIcon()}</span>
                  <span className="text-[9px] sm:text-xs font-black">
                    {rateChange > 0 ? '+' : ''}{rateChange.toFixed(2)}%
                  </span>
                </div>
              )}
            </div>
            <p className="text-[8px] sm:text-xs font-medium mt-1 truncate opacity-60">
              ${currentCommissions.toFixed(2)} / ${currentRevenue.toFixed(2)}
            </p>
          </div>
          <div className="w-8 h-8 sm:w-12 sm:h-12 bg-gold-medium/20 rounded-lg flex items-center justify-center shrink-0 border border-gold-medium/20 shadow-inner">
            <TrendingUp className="w-4 h-4 sm:w-6 sm:h-6 text-gold-light opacity-80" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
