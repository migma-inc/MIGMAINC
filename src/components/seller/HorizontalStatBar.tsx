import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface HorizontalStatBarProps {
  title: string;
  value: string;
  trend?: number;
  icon: LucideIcon;
  variant?: 'gold' | 'green' | 'purple' | 'blue';
}

const variants = {
  gold: {
    bg: 'bg-gold-500/10',
    border: 'border-gold-500/20',
    icon: 'text-gold-light',
  },
  green: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
    icon: 'text-green-400',
  },
  purple: {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    icon: 'text-purple-400',
  },
  blue: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    icon: 'text-blue-400',
  },
};

export function HorizontalStatBar({ 
  title, 
  value, 
  trend, 
  icon: Icon, 
  variant = 'gold' 
}: HorizontalStatBarProps) {
  const isPositive = trend !== undefined && trend > 0;
  const isNegative = trend !== undefined && trend < 0;
  const trendColor = isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : 'text-gray-500';
  const TrendIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;
  
  const colors = variants[variant];

  return (
    <div className="bg-zinc-900/40 border border-white/5 shadow-sm rounded-xl overflow-hidden mb-1.5 last:mb-0">
      <div className="p-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={`shrink-0 w-8 h-8 rounded-lg ${colors.bg} ${colors.border} border flex items-center justify-center ${colors.icon}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-0.5 truncate leading-none">{title}</p>
            <p className="text-sm font-black text-white truncate leading-tight">{value}</p>
          </div>
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 shrink-0 bg-black/40 px-2 py-1 rounded-lg border border-white/5 ${trendColor}`}>
            <TrendIcon className="w-2.5 h-2.5" />
            <span className="text-[10px] font-black tracking-tighter">
              {Math.abs(trend).toFixed(1)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
