import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface CommissionConversionCardProps {
  currentRate: number;
  previousRate?: number;
  currentRevenue: number;
  currentCommissions: number;
}

export function CommissionConversionCard({
  currentRate,
  previousRate,
  currentRevenue,
  currentCommissions,
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
    <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-xs sm:text-sm text-gray-400 mb-1">Commission Rate</p>
            <div className="flex items-center gap-2">
              <p className="text-xl sm:text-2xl font-bold text-gold-light">
                {currentRate.toFixed(2)}%
              </p>
              {previousRate !== undefined && (
                <div className={`flex items-center gap-1 ${getTrendColor()}`}>
                  {getTrendIcon()}
                  <span className="text-xs font-medium">
                    {rateChange > 0 ? '+' : ''}{rateChange.toFixed(2)}%
                  </span>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              ${currentCommissions.toFixed(2)} of ${currentRevenue.toFixed(2)} revenue
            </p>
          </div>
          <div className="w-12 h-12 bg-gold-medium/20 rounded-full flex items-center justify-center shrink-0">
            <TrendingUp className="w-6 h-6 text-gold-light" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
