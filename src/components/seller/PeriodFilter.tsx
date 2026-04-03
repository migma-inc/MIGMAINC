import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { DateRangePicker } from './DateRangePicker';

export type PeriodOption =
  | 'thismonth'
  | 'lastmonth'
  | 'today'
  | 'yesterday'
  | 'last7days'
  | 'last30days'
  | 'last3months'
  | 'last6months'
  | 'lastyear'
  | 'all_time'
  | 'custom';

export interface CustomDateRange {
  start: string;
  end: string;
}

interface PeriodFilterProps {
  value: PeriodOption;
  onChange: (value: PeriodOption) => void;
  showLabel?: boolean;
  className?: string;
  customDateRange?: CustomDateRange;
  onCustomDateRangeChange?: (range: CustomDateRange) => void;
  locale?: 'pt' | 'en';
}

const LABELS = {
  pt: {
    period: 'Período:',
    allTime: 'Acumulado',
    thisMonth: 'Este mês',
    lastMonth: 'Mês passado',
    last7Days: 'Últimos 7 dias',
    last30Days: 'Últimos 30 dias',
    last3Months: 'Últimos 3 meses',
    last6Months: 'Últimos 6 meses',
    lastYear: 'Último ano',
    customPeriod: 'Período customizado',
    selectPeriod: 'Selecione o período:',
  },
  en: {
    period: 'Period:',
    allTime: 'All Time',
    thisMonth: 'This Month',
    lastMonth: 'Last Month',
    last7Days: 'Last 7 Days',
    last30Days: 'Last 30 Days',
    last3Months: 'Last 3 Months',
    last6Months: 'Last 6 Months',
    lastYear: 'Last Year',
    customPeriod: 'Custom Period',
    selectPeriod: 'Select period:',
  },
} as const;

export function PeriodFilter({
  value,
  onChange,
  showLabel = true,
  className,
  customDateRange,
  onCustomDateRangeChange,
  locale = 'pt',
}: PeriodFilterProps) {
  const [localCustomRange, setLocalCustomRange] = useState<CustomDateRange>(() => {
    if (customDateRange) {
      return customDateRange;
    }

    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);

    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  });

  useEffect(() => {
    if (customDateRange) {
      setLocalCustomRange(customDateRange);
    }
  }, [customDateRange]);

  const labels = LABELS[locale];

  return (
    <div className={`flex flex-col gap-3 ${className || ''}`}>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
        {showLabel && (
          <Label htmlFor="period-filter" className="text-white text-xs sm:text-sm whitespace-nowrap">
            {labels.period}
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
          <SelectContent className="bg-zinc-950 border-zinc-800 text-white">
            <SelectItem value="all_time" className="font-semibold text-gold-medium">{labels.allTime}</SelectItem>
            <SelectItem value="thismonth">{labels.thisMonth}</SelectItem>
            <SelectItem value="lastmonth">{labels.lastMonth}</SelectItem>
            <SelectItem value="last7days">{labels.last7Days}</SelectItem>
            <SelectItem value="last30days">{labels.last30Days}</SelectItem>
            <SelectItem value="last3months">{labels.last3Months}</SelectItem>
            <SelectItem value="last6months">{labels.last6Months}</SelectItem>
            <SelectItem value="lastyear">{labels.lastYear}</SelectItem>
            <SelectItem value="custom" className="border-t border-zinc-800 mt-1 pt-1">{labels.customPeriod}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {value === 'custom' && (
        <div className="p-3 bg-black/20 rounded-lg border border-gold-medium/20">
          <Label className="text-white text-xs sm:text-sm mb-2 block">
            {labels.selectPeriod}
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
