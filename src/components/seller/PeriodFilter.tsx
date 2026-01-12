import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { DateRangePicker } from './DateRangePicker';

export type PeriodOption = 
  | 'last7days'
  | 'last30days'
  | 'thismonth'
  | 'lastmonth'
  | 'last3months'
  | 'last6months'
  | 'lastyear'
  | 'custom';

export interface CustomDateRange {
  start: string; // ISO date string (YYYY-MM-DD)
  end: string;   // ISO date string (YYYY-MM-DD)
}

interface PeriodFilterProps {
  value: PeriodOption;
  onChange: (value: PeriodOption) => void;
  showLabel?: boolean;
  className?: string;
  customDateRange?: CustomDateRange;
  onCustomDateRangeChange?: (range: CustomDateRange) => void;
}

export function PeriodFilter({ 
  value, 
  onChange, 
  showLabel = true, 
  className,
  customDateRange,
  onCustomDateRangeChange
}: PeriodFilterProps) {
  const [localCustomRange, setLocalCustomRange] = useState<CustomDateRange>(() => {
    if (customDateRange) {
      return customDateRange;
    }
    // Default: últimos 30 dias
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  });

  // Sincronizar com prop externa quando mudar
  useEffect(() => {
    if (customDateRange) {
      setLocalCustomRange(customDateRange);
    }
  }, [customDateRange]);

  return (
    <div className={`flex flex-col gap-3 ${className || ''}`}>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
        {showLabel && (
          <Label htmlFor="period-filter" className="text-white text-xs sm:text-sm whitespace-nowrap">
            Período:
          </Label>
        )}
        <Select
          value={value}
          onValueChange={(val) => onChange(val as PeriodOption)}
        >
          <SelectTrigger 
            id="period-filter"
            className="w-full sm:w-[180px] bg-black/50 border-gold-medium/50 text-white hover:bg-black/70 text-xs sm:text-sm"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="last7days">Últimos 7 dias</SelectItem>
            <SelectItem value="last30days">Últimos 30 dias</SelectItem>
            <SelectItem value="thismonth">Este Mês</SelectItem>
            <SelectItem value="lastmonth">Mês Passado</SelectItem>
            <SelectItem value="last3months">Últimos 3 meses</SelectItem>
            <SelectItem value="last6months">Últimos 6 meses</SelectItem>
            <SelectItem value="lastyear">Último ano</SelectItem>
            <SelectItem value="custom">Período Customizado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Calendário de seleção de período customizado */}
      {value === 'custom' && (
        <div className="p-3 bg-black/20 rounded-lg border border-gold-medium/20">
          <Label className="text-white text-xs sm:text-sm mb-2 block">
            Selecione o período:
          </Label>
          <DateRangePicker
            dateRange={localCustomRange}
            onDateRangeChange={(range) => {
              setLocalCustomRange(range);
              if (onCustomDateRangeChange) {
                onCustomDateRangeChange(range);
              }
            }}
          />
        </div>
      )}
    </div>
  );
}

