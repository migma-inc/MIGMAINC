import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ChartDataPoint } from '@/lib/seller-analytics';
import { FileText } from 'lucide-react';
import * as am5 from '@amcharts/amcharts5';
import * as am5percent from '@amcharts/amcharts5/percent';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';

interface ContractsChartProps {
  data: ChartDataPoint[];
}

export function ContractsChart({ data }: ContractsChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<am5.Root | null>(null);

  useEffect(() => {
    if (!chartRef.current || !data || data.length === 0) {
      if (rootRef.current) {
        rootRef.current.dispose();
        rootRef.current = null;
      }
      return;
    }

    if (rootRef.current) {
      rootRef.current.dispose();
      rootRef.current = null;
    }

    const root = am5.Root.new(chartRef.current);
    rootRef.current = root;
    root.setThemes([am5themes_Animated.new(root)]);

    // Configurar cores do tema para texto branco
    root.interfaceColors.set('text', am5.color('#ffffff'));

    // Gráfico Donut - Distribuição Visual
    const chart = root.container.children.push(
      am5percent.PieChart.new(root, {
        layout: root.verticalLayout,
        innerRadius: am5.percent(50),
      })
    );

    // Preparar dados para o donut
    const totalContracts = data.reduce((sum, p) => sum + p.contracts, 0);
    const colors = ['#F3E196', '#D4AF37', '#CE9F48', '#B8860B', '#9A7A3A', '#8E6E2F'];
    type ChartSlice = {
      category: string;
      value: number;
      percentage: number;
      fill: am5.Color;
    };

    const chartData: ChartSlice[] = data.map((point, index) => ({
      category: new Date(point.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
      value: point.contracts,
      percentage: totalContracts > 0 ? (point.contracts / totalContracts) * 100 : 0,
      fill: am5.color(colors[index % colors.length]),
    }));

    const series = chart.series.push(
      am5percent.PieSeries.new(root, {
        valueField: 'value',
        categoryField: 'category',
        alignLabels: false,
      })
    );

    // Aplicar cores dos dados
    series.slices.template.adapters.add('fill', (fill: any, target: any) => {
      const dataItem = target.dataItem;
      const dataContext = dataItem?.dataContext as ChartSlice | undefined;

      if (dataContext?.fill) {
        return dataContext.fill;
      }

      return fill;
    });

    series.slices.template.setAll({
      stroke: am5.color('#1a1a1a'),
      strokeWidth: 2,
      tooltipText: '{category}: {value} contratos ({valuePercentTotal.formatNumber(\'#.0\')}%)',
    });

    // Labels no donut
    series.labels.template.setAll({
      text: '{category}\n{value} ({valuePercentTotal.formatNumber(\'#.0\')}%)',
      fontSize: 11,
      fill: am5.color('#ffffff'),
      textAlign: 'center',
    });

    series.data.setAll(chartData);

    // Legenda
    const legend = chart.children.push(
      am5.Legend.new(root, {
        centerX: am5.p50,
        x: am5.p50,
        marginTop: 20,
        marginBottom: 20,
      })
    );
    legend.data.setAll(series.dataItems);

    return () => {
      if (rootRef.current) {
        rootRef.current.dispose();
        rootRef.current = null;
      }
    };
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <Card className="bg-black/40 border border-gold-medium/20 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <div className="p-2 bg-gold-medium/20 rounded-lg">
              <FileText className="w-5 h-5 text-gold-light" />
            </div>
            Contratos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] sm:h-[280px] flex items-center justify-center text-gray-400">
            <p>Nenhum dado disponível</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalContracts = data.reduce((sum, p) => sum + p.contracts, 0);

  return (
    <Card className="bg-black/40 border border-gold-medium/20 backdrop-blur-sm hover:border-gold-medium/40 transition-all">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <div className="p-2 bg-gold-medium/20 rounded-lg">
              <FileText className="w-5 h-5 text-gold-light" />
            </div>
            Contratos
          </CardTitle>
          <div className="text-right">
            <p className="text-xs text-gray-400">Total</p>
            <p className="text-gold-light font-bold text-lg">{totalContracts}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div ref={chartRef} className="w-full h-[250px] sm:h-[280px]"></div>
      </CardContent>
    </Card>
  );
}
