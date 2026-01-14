import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ChartDataPoint } from '@/lib/seller-analytics';
import { FileText } from 'lucide-react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
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
    root.interfaceColors.set('grid', am5.color('#333333'));

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: false,
        panY: false,
        wheelX: 'none',
        wheelY: 'none',
        paddingLeft: 0,
        paddingRight: 0,
      })
    );

    // Preparar dados
    const chartData = data.map((point) => ({
      date: new Date(point.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
      contracts: point.contracts,
    }));

    // Eixo X
    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: 'date',
        renderer: am5xy.AxisRendererX.new(root, {
          cellStartLocation: 0.1,
          cellEndLocation: 0.9,
          minGridDistance: 30,
        }),
      })
    );

    xAxis.data.setAll(chartData);
    xAxis.get('renderer').labels.template.setAll({
      fill: am5.color('#ffffff'),
      fontSize: 11,
    });

    // Eixo Y
    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererY.new(root, {
          stroke: am5.color('#666666'),
        }),
      })
    );

    yAxis.get('renderer').labels.template.setAll({
      fill: am5.color('#ffffff'),
      fontSize: 11,
    });

    yAxis.get('renderer').grid.template.setAll({
      stroke: am5.color('#333333'),
      strokeOpacity: 0.3,
    });

    // Gráfico de Colunas
    const series = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        name: 'Contratos',
        xAxis: xAxis,
        yAxis: yAxis,
        valueYField: 'contracts',
        categoryXField: 'date',
      })
    );

    const gradient = am5.LinearGradient.new(root, {
      rotation: 90,
      stops: [
        { color: am5.color('#F3E196'), offset: 0 },
        { color: am5.color('#CE9F48'), offset: 1 },
      ],
    });

    series.columns.template.setAll({
      fillGradient: gradient,
      stroke: am5.color('#D4AF37'),
      strokeWidth: 2,
      cornerRadiusTL: 6,
      cornerRadiusTR: 6,
      tooltipText: '{categoryX}: {valueY} contratos',
    });

    // Labels no topo das barras
    series.bullets.push(() => {
      return am5.Bullet.new(root, {
        locationY: 1,
        sprite: am5.Label.new(root, {
          text: '{valueY}',
          fill: am5.color('#ffffff'),
          centerY: am5.p100,
          centerX: am5.p50,
          populateText: true,
          fontSize: 11,
          fontWeight: 'bold',
        }),
      });
    });

    series.data.setAll(chartData);

    // Cursor
    chart.set('cursor', am5xy.XYCursor.new(root, {}));

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
