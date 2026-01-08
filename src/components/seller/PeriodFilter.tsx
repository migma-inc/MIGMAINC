import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export type PeriodOption = 
  | 'last7days'
  | 'last30days'
  | 'thismonth'
  | 'lastmonth'
  | 'last3months'
  | 'last6months'
  | 'lastyear'
  | 'custom';

interface PeriodFilterProps {
  value: PeriodOption;
  onChange: (value: PeriodOption) => void;
  showLabel?: boolean;
  className?: string;
}

export function PeriodFilter({ value, onChange, showLabel = true, className }: PeriodFilterProps) {
  return (
    <div className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 ${className || ''}`}>
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
        </SelectContent>
      </Select>
    </div>
  );
}

