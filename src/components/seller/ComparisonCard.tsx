import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ComparisonCardProps {
  title: string;
  currentValue: number;
  previousValue: number;
  formatValue?: (value: number) => string;
  icon?: React.ReactNode;
}

export function ComparisonCard({ 
  title, 
  currentValue, 
  previousValue, 
  formatValue = (v) => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  icon 
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
    <Card className={`bg-gradient-to-br ${bgColor} via-gold-medium/5 to-gold-dark/10 border ${borderColor}`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              {icon}
              <p className="text-sm text-gray-400">{title}</p>
            </div>
            <p className="text-3xl font-bold text-white mb-2">
              {formatValue(currentValue)}
            </p>
            <div className="flex items-center gap-2">
              <TrendIcon className={`w-4 h-4 ${trendColor}`} />
              <span className={`text-sm font-semibold ${trendColor}`}>
                {isPositive ? '+' : ''}{change.toFixed(1)}%
              </span>
              <span className="text-xs text-gray-500">
                ({isPositive ? '+' : ''}{formatValue(changeAbs)} vs período anterior)
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

