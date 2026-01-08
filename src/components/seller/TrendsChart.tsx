import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ChartDataPoint } from '@/lib/seller-analytics';
import { TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import * as am5 from '@amcharts/amcharts5';
import * as am5percent from '@amcharts/amcharts5/percent';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';

interface TrendsChartProps {
  data: ChartDataPoint[];
  trends: {
    direction: 'up' | 'down' | 'stable';
    growthRate: number;
    projection: {
      nextMonth: number;
      nextQuarter: number;
    };
  };
}

export function TrendsChart({ data, trends }: TrendsChartProps) {
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

    // Gráfico Velocímetro (Gauge) - Progresso Visual
    const chart = root.container.children.push(
      am5percent.SlicedChart.new(root, {
        layout: root.verticalLayout,
      })
    );

    // Calcular valor atual e meta
    const currentRevenue = data.reduce((sum, p) => sum + p.revenue, 0);
    const projectedRevenue = trends.projection.nextMonth;
    const maxValue = Math.max(currentRevenue, projectedRevenue) * 1.2; // 20% acima do maior valor
    const percentage = Math.min(100, (currentRevenue / maxValue) * 100);

    type GaugeSlice = {
      category: 'Atual' | 'Restante';
      value: number;
    };

    const series = chart.series.push(
      am5percent.PieSeries.new(root, {
        valueField: 'value',
        categoryField: 'category',
        alignLabels: false,
        startAngle: 180,
        endAngle: 360,
      })
    );

    // Dados do gauge - semicírculo
    const gaugeData: GaugeSlice[] = [
      {
        category: 'Atual',
        value: currentRevenue,
      },
      {
        category: 'Restante',
        value: Math.max(0, maxValue - currentRevenue),
      },
    ];

    series.data.setAll(gaugeData);

    // Configurar cores
    series.slices.template.adapters.add('fill', (fill, target) => {
      const dataItem = target.dataItem;
      const dataContext = dataItem?.dataContext as GaugeSlice | undefined;

      if (dataContext?.category === 'Atual') {
        return am5.color('#F3E196');
      }

      if (dataContext?.category === 'Restante') {
        return am5.color('#333333');
      }

      return fill;
    });

    series.slices.template.setAll({
      stroke: am5.color('#1a1a1a'),
      strokeWidth: 3,
      cornerRadius: 5,
    });

    // Remover labels padrão
    series.labels.template.set('visible', false);
    series.ticks.template.set('visible', false);

    // Adicionar label central com valor
    chart.seriesContainer.children.push(
      am5.Label.new(root, {
        text: `$${currentRevenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}\n${percentage.toFixed(0)}%`,
        fontSize: 24,
        fontWeight: 'bold',
        fill: am5.color('#F3E196'),
        centerX: am5.p50,
        centerY: am5.p50,
        textAlign: 'center',
      })
    );

    // Adicionar label de meta
    chart.seriesContainer.children.push(
      am5.Label.new(root, {
        text: `Meta: $${projectedRevenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
        fontSize: 12,
        fill: am5.color('#999999'),
        centerX: am5.p50,
        centerY: am5.p100,
        y: am5.percent(-10),
        textAlign: 'center',
      })
    );

    return () => {
      if (rootRef.current) {
        rootRef.current.dispose();
        rootRef.current = null;
      }
    };
  }, [data, trends]);

  if (!data || data.length === 0) {
    return (
      <Card className="bg-black/40 border border-gold-medium/20 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <div className="p-2 bg-gold-medium/20 rounded-lg">
              <TrendingUp className="w-5 h-5 text-gold-light" />
            </div>
            Tendências
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] flex items-center justify-center text-gray-400">
            <p>Nenhum dado disponível</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const TrendIcon = trends.direction === 'up' ? TrendingUp : trends.direction === 'down' ? TrendingDown : Minus;
  const trendColor = trends.direction === 'up' ? '#10b981' : trends.direction === 'down' ? '#ef4444' : '#6b7280';
  const TrendArrow = trends.direction === 'up' ? ArrowUpRight : trends.direction === 'down' ? ArrowDownRight : Minus;

  return (
    <Card className="bg-black/40 border border-gold-medium/20 backdrop-blur-sm hover:border-gold-medium/40 transition-all">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <div className="p-2 bg-gold-medium/20 rounded-lg">
              <TrendIcon className={`w-5 h-5 ${trendColor === '#10b981' ? 'text-green-400' : trendColor === '#ef4444' ? 'text-red-400' : 'text-gray-400'}`} />
            </div>
            Tendências
          </CardTitle>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs text-gray-400">Crescimento</p>
              <div className="flex items-center gap-1">
                <TrendArrow className={`w-4 h-4 ${trendColor === '#10b981' ? 'text-green-400' : trendColor === '#ef4444' ? 'text-red-400' : 'text-gray-400'}`} />
                <p className={`font-bold text-sm ${trendColor === '#10b981' ? 'text-green-400' : trendColor === '#ef4444' ? 'text-red-400' : 'text-gray-400'}`}>
                  {trends.growthRate > 0 ? '+' : ''}{trends.growthRate.toFixed(1)}%
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">Próximo Mês</p>
              <p className="text-gold-light font-bold text-sm">
                ${trends.projection.nextMonth.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div ref={chartRef} style={{ width: '100%', height: '280px' }}></div>
      </CardContent>
    </Card>
  );
}
