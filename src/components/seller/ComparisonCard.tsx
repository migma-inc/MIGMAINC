import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ComparisonCardProps {
  title: string;
  currentValue: number;
  previousValue: number;
  formatValue?: (value: number) => string;
  icon?: React.ReactNode;
  className?: string;
}

export function ComparisonCard({ 
  title, 
  currentValue, 
  previousValue, 
  formatValue = (v) => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  icon,
  className = '',
}: ComparisonCardProps) {
  const change = previousValue === 0 
    ? (currentValue > 0 ? 100 : 0)
    : ((currentValue - previousValue) / previousValue) * 100;
  
  const changeAbs = currentValue - previousValue;
  const isPositive = change > 0;
  const isNegative = change < 0;

  const TrendIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;
  const trendColor = isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : 'text-gray-400';
  const bgColor = isPositive ? 'from-green-500/10' : isNegative ? 'from-red-500/10' : 'from-gray-500/10';
  const borderColor = isPositive ? 'border-green-500/30' : isNegative ? 'border-red-500/30' : 'border-gray-500/30';

  return (
    <Card className={`bg-gradient-to-br ${bgColor} via-gold-medium/5 to-gold-dark/10 border ${borderColor} shadow-lg shadow-black/20 overflow-hidden ${className}`}>
      <CardContent className="p-3 sm:p-5 lg:p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
             <div className="flex items-center gap-1.5 mb-1 sm:mb-2 text-gray-400">
              {icon && <span className="shrink-0 scale-90">{icon}</span>}
              <p className="text-[9px] sm:text-sm font-black uppercase tracking-widest truncate">{title}</p>
            </div>
            <p className="text-base sm:text-2xl lg:text-3xl font-black text-white mb-1 sm:mb-2 tracking-tight">
              {formatValue(currentValue)}
            </p>
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <div className={`flex items-center gap-0.5 ${trendColor}`}>
                <TrendIcon className="w-2.5 h-2.5 sm:w-4 sm:h-4" />
                <span className="text-[9px] sm:text-sm font-black">
                  {isPositive ? '+' : ''}{change.toFixed(1)}%
                </span>
              </div>
              <span className="text-[8px] sm:text-xs text-gray-500 whitespace-nowrap font-medium opacity-60">
                ({isPositive ? '+' : ''}{formatValue(changeAbs)})
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

