import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import type { AnalyticsData } from '@/lib/seller-analytics';
import { exportSellerAnalytics } from '@/pages/seller/services/sellerAnalyticsExcelExport';

interface ExportButtonProps {
  data: AnalyticsData;
  periodLabel: string;
}

export function ExportButton({ data, periodLabel }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (isExporting) return;

    setIsExporting(true);
    try {
      await exportSellerAnalytics(data, periodLabel);
    } catch (error) {
      console.error('[ExportButton] Error exporting:', error);
      alert('Erro ao exportar dados. Por favor, tente novamente.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      onClick={handleExport}
      disabled={isExporting}
      variant="outline"
      size="sm"
      className="w-full sm:w-auto bg-black/50 border-gold-medium/50 text-white hover:bg-gold-medium/20 disabled:opacity-50 text-xs sm:text-sm"
    >
      {isExporting ? (
        <>
          <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 mr-2 animate-spin" />
          <span className="hidden sm:inline">Exportando...</span>
          <span className="sm:hidden">Exportando</span>
        </>
      ) : (
        <>
          <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
          <span className="hidden sm:inline">Exportar Excel</span>
          <span className="sm:hidden">Exportar</span>
        </>
      )}
    </Button>
  );
}

