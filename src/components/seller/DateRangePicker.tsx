import * as React from "react";
import { format } from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import { ptBR } from "date-fns/locale/pt-BR";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

interface DateRangePickerProps {
  dateRange: { start: string; end: string };
  onDateRangeChange: (range: { start: string; end: string }) => void;
  className?: string;
  locale?: 'pt' | 'en';
}

export function DateRangePicker({
  dateRange,
  onDateRangeChange,
  className,
  locale = 'pt',
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [tempStartDate, setTempStartDate] = React.useState<string>('');
  const [tempEndDate, setTempEndDate] = React.useState<string>('');
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(null);

  const dateLocale = locale === 'en' ? enUS : ptBR;
  const labels = locale === 'en'
    ? {
        selectPeriod: 'Select period',
        startDate: 'Start Date:',
        endDate: 'End Date:',
        clear: 'Clear',
        cancel: 'Cancel',
        apply: 'Apply',
      }
    : {
        selectPeriod: 'Selecione o período',
        startDate: 'Data Inicial:',
        endDate: 'Data Final:',
        clear: 'Limpar',
        cancel: 'Cancelar',
        apply: 'Aplicar',
      };

  const parseDateString = React.useCallback((dateString: string): Date => {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }, []);

  React.useEffect(() => {
    if (isOpen) {
      setTempStartDate('');
      setTempEndDate('');
      setSelectedDate(null);
    }
  }, [isOpen]);

  const calendarRange: DateRange | undefined = React.useMemo(() => {
    if (tempStartDate && tempEndDate) {
      return {
        from: parseDateString(tempStartDate),
        to: parseDateString(tempEndDate),
      };
    }
    if (tempStartDate) {
      return {
        from: parseDateString(tempStartDate),
        to: undefined,
      };
    }
    if (selectedDate) {
      return {
        from: selectedDate,
        to: undefined,
      };
    }
    return undefined;
  }, [tempStartDate, tempEndDate, selectedDate, parseDateString]);

  const handleCalendarRangeSelect = (range: DateRange | undefined) => {
    if (!range) {
      setTempStartDate('');
      setTempEndDate('');
      setSelectedDate(null);
      return;
    }

    if (range.from) {
      const startString = format(range.from, 'yyyy-MM-dd');
      setTempStartDate(startString);
      setSelectedDate(range.from);
    }

    if (range.to) {
      const endString = format(range.to, 'yyyy-MM-dd');
      setTempEndDate(endString);
    } else if (range.from && !range.to) {
      setTempEndDate('');
    }
  };

  const handleApply = () => {
    if (!tempStartDate || !tempEndDate) {
      return;
    }

    const startDate = parseDateString(tempStartDate);
    const endDate = parseDateString(tempEndDate);
    if (startDate > endDate) {
      return;
    }

    onDateRangeChange({
      start: tempStartDate,
      end: tempEndDate,
    });
    setIsOpen(false);
  };

  const handleClear = () => {
    setTempStartDate('');
    setTempEndDate('');
    setSelectedDate(null);
  };

  const handleCancel = () => {
    setIsOpen(false);
  };

  const displayText = React.useMemo(() => {
    if (!dateRange.start || !dateRange.end) {
      return labels.selectPeriod;
    }
    const startDate = parseDateString(dateRange.start);
    const endDate = parseDateString(dateRange.end);
    return `${format(startDate, 'dd/MM/yyyy', { locale: dateLocale })} - ${format(endDate, 'dd/MM/yyyy', { locale: dateLocale })}`;
  }, [dateLocale, dateRange, labels.selectPeriod, parseDateString]);

  const canApply = React.useMemo(() => {
    if (!tempStartDate || !tempEndDate) return false;
    const startDate = parseDateString(tempStartDate);
    const endDate = parseDateString(tempEndDate);
    return startDate <= endDate;
  }, [tempStartDate, tempEndDate, parseDateString]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full sm:w-[280px] justify-start text-left font-normal bg-black/50 border-gold-medium/50 text-white hover:bg-black/70 hover:text-white",
            !dateRange.start && !dateRange.end && "text-gray-400",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 text-gold-medium" />
          {displayText}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 bg-black border-gold-medium/50"
        align="start"
        onInteractOutside={(e) => {
          e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          e.preventDefault();
        }}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold text-sm">{labels.selectPeriod}</h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-gray-400 hover:text-white hover:bg-gold-medium/20"
              onClick={handleCancel}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="mb-4">
            <Calendar
              mode="range"
              selected={calendarRange}
              onSelect={handleCalendarRangeSelect}
              disabled={(date) => date > new Date()}
              locale={dateLocale}
              className="bg-black text-white"
              classNames={{
                months: "flex flex-col sm:flex-row gap-4 p-2",
                month: "space-y-4",
                caption: "flex justify-center pt-1 relative items-center",
                caption_label: "text-sm font-medium text-white",
                nav: "space-x-1 flex items-center",
                button_previous: "text-white hover:bg-gold-medium/20",
                button_next: "text-white hover:bg-gold-medium/20",
                month_caption: "text-white",
                table: "w-full border-collapse space-y-1",
                head_row: "flex",
                head_cell: "text-gray-300 rounded-md w-9 font-normal text-[0.8rem]",
                row: "flex w-full mt-2",
                cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-gold-medium/10 [&:has([aria-selected])]:bg-gold-medium/20 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                day: "h-9 w-9 p-0 font-normal text-gray-200 aria-selected:opacity-100 hover:bg-gold-medium/20 hover:text-white",
                day_range_end: "day-range-end",
                day_selected: "bg-gold-medium text-black hover:bg-gold-medium hover:text-black focus:bg-gold-medium focus:text-black",
                day_range_middle: "aria-selected:bg-gold-medium/20 aria-selected:text-white",
                day_today: "bg-gold-medium/30 text-white font-semibold",
                day_outside: "day-outside text-gray-300 opacity-70",
                day_disabled: "text-gray-400 opacity-60",
                day_hidden: "invisible",
              }}
            />
          </div>

          <div className="space-y-3 mb-4">
            <div className="space-y-2">
              <Label htmlFor="start-date" className="text-white text-xs">
                {labels.startDate}
              </Label>
              <Input
                id="start-date"
                type="date"
                value={tempStartDate}
                onChange={(e) => {
                  setTempStartDate(e.target.value);
                  if (e.target.value) {
                    setSelectedDate(parseDateString(e.target.value));
                  }
                }}
                max={tempEndDate || new Date().toISOString().split('T')[0]}
                className="bg-black/50 border-gold-medium/50 text-white hover:bg-black/70 text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date" className="text-white text-xs">
                {labels.endDate}
              </Label>
              <Input
                id="end-date"
                type="date"
                value={tempEndDate}
                onChange={(e) => {
                  setTempEndDate(e.target.value);
                  if (e.target.value) {
                    setSelectedDate(parseDateString(e.target.value));
                  }
                }}
                min={tempStartDate}
                max={new Date().toISOString().split('T')[0]}
                className="bg-black/50 border-gold-medium/50 text-white hover:bg-black/70 text-sm"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-3 border-t border-gold-medium/20">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="text-gray-400 hover:text-white hover:bg-gold-medium/20 text-xs"
            >
              {labels.clear}
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                className="bg-black/50 border-gold-medium/50 text-white hover:bg-black/70 text-xs"
              >
                {labels.cancel}
              </Button>
              <Button
                size="sm"
                onClick={handleApply}
                disabled={!canApply}
                className="bg-gold-medium text-black hover:bg-gold-light disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold"
              >
                {labels.apply}
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
