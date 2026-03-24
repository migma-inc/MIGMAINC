import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';

interface MonthlySellerRevenueBarChartProps {
    data: { name: string; revenue: number; percentage: number }[];
    title: string;
}

export function MonthlySellerRevenueBarChart({ data, title }: MonthlySellerRevenueBarChartProps) {
    const chartRef = useRef<HTMLDivElement>(null);
    const rootRef = useRef<am5.Root | null>(null);

    const formatMoney = (val: number) => `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    
    // Sort descending by revenue, keep only those with revenue > 0
    const chartData = [...data]
        .sort((a, b) => b.revenue - a.revenue)
        .filter(d => d.revenue > 0)
        .map(d => ({
            ...d,
            labelTitle: `${d.name}   [bold]${formatMoney(d.revenue)}[/]`
        }));

    useEffect(() => {
        if (!chartRef.current || !data || data.length === 0) return;

        if (rootRef.current) rootRef.current.dispose();

        const root = am5.Root.new(chartRef.current);
        if (root._logo) root._logo.dispose();
        rootRef.current = root;
        root.setThemes([am5themes_Animated.new(root)]);

        root.interfaceColors.set('text', am5.color('#ffffff'));
        root.interfaceColors.set('grid', am5.color('#333333'));

        root.numberFormatter.setAll({
            numberFormat: "'$'#,###.00",
            numericFields: ["valueX", "value"]
        });

        const chart = root.container.children.push(
            am5xy.XYChart.new(root, {
                panX: false,
                panY: false,
                wheelX: 'none',
                wheelY: 'none',
                paddingLeft: 10,
                paddingRight: 30, 
            })
        );

        // Eixos
        const yRenderer = am5xy.AxisRendererY.new(root, {
            inversed: true,
            minGridDistance: 20
        });

        yRenderer.labels.template.setAll({
            maxWidth: 220, 
            oversizedBehavior: 'truncate',
            textAlign: 'right',
            fontSize: 10
        });

        const yAxis = chart.yAxes.push(
            am5xy.CategoryAxis.new(root, {
                categoryField: 'labelTitle',
                renderer: yRenderer
            })
        );
        yAxis.data.setAll(chartData);

        const xAxisRenderer = am5xy.AxisRendererX.new(root, {
            strokeOpacity: 0.1
        });
        xAxisRenderer.labels.template.set('visible', false);

        const xAxis = chart.xAxes.push(am5xy.ValueAxis.new(root, {
            min: 0,
            renderer: xAxisRenderer
        }));

        // Série
        const series = chart.series.push(am5xy.ColumnSeries.new(root, {
            name: 'Revenue',
            xAxis: xAxis,
            yAxis: yAxis,
            valueXField: 'revenue',
            categoryYField: 'labelTitle',
            tooltip: (am5 as any).Tooltip.new(root, { 
                labelText: '{valueX} ({percentage.formatNumber("#.0")}%)',
                pointerOrientation: 'horizontal',
                getFillFromSprite: false
            })
        }));

        series.get('tooltip')?.get('background')?.setAll({
            fill: am5.color('#000000'),
            fillOpacity: 0.9,
            stroke: am5.color('#4A90E2'),
            strokeWidth: 1
        });

        series.columns.template.setAll({
            strokeOpacity: 0,
            height: am5.percent(30),
            maxHeight: 24,
            cornerRadiusBR: 4,
            cornerRadiusTR: 4,
            fill: am5.color('#4A90E2') // Azul
        });

        // Porcentagem dentro da barra
        series.bullets.push(() => {
            const label = am5.Label.new(root, {
                text: '{percentage.formatNumber("#.0")}%',
                fill: am5.color('#ffffff'),
                centerY: am5.p50,
                centerX: 0,
                populateText: true,
                fontSize: 10,
                fontWeight: 'bold',
                dx: 5
            });

            label.adapters.add('forceHidden', (hidden: any, target: any) => {
                const dataItem = target.dataItem;
                if (dataItem && dataItem.get('valueX') === 0) {
                    return true;
                }
                return hidden;
            });

            return am5.Bullet.new(root, {
                locationX: 1, // End of the bar
                sprite: label
            });
        });

        series.data.setAll(chartData);
        chart.appear(1000, 100);

        return () => {
            if (rootRef.current) rootRef.current.dispose();
        };
    }, [data]);

    return (
        <Card className="bg-black/40 border-gold-medium/20 h-[400px]">
            <CardHeader className="py-3 bg-gold-medium/5">
                <CardTitle className="text-sm font-bold text-center text-white uppercase tracking-wider">
                    {title}
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-6 h-[320px]">
                <div ref={chartRef} className="w-full h-full"></div>
            </CardContent>
        </Card>
    );
}
