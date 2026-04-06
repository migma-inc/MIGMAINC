import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import type { WeeklyMetric } from '@/lib/seller-analytics';
import { formatPlainNumber } from './chartFormatters';

interface WeeklyRevenueBarChartProps {
    data: WeeklyMetric[];
    title: string;
}

export function WeeklyRevenueBarChart({ data, title }: WeeklyRevenueBarChartProps) {
    const chartRef = useRef<HTMLDivElement>(null);
    const rootRef = useRef<am5.Root | null>(null);

    useEffect(() => {
        if (!chartRef.current || !data) return;

        if (rootRef.current) rootRef.current.dispose();

        const root = am5.Root.new(chartRef.current);
        if (root._logo) root._logo.dispose();
        rootRef.current = root;
        root.setThemes([am5themes_Animated.new(root)]);

        root.interfaceColors.set('text', am5.color('#ffffff'));
        root.interfaceColors.set('grid', am5.color('#333333'));

        const chart = root.container.children.push(
            am5xy.XYChart.new(root, {
                panX: false,
                panY: false,
                wheelX: 'none',
                wheelY: 'none',
                paddingLeft: 0,
                paddingRight: 10,
            })
        );

        const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0);
        const chartData = [
            ...data.map(d => ({ ...d })),
            { weekLabel: 'Total', revenue: totalRevenue, sales: 0, sellers: {} },
        ];

        const xRenderer = am5xy.AxisRendererX.new(root, { minGridDistance: 30 });
        xRenderer.grid.template.setAll({
            visible: true,
            strokeOpacity: 0.15,
            strokeDasharray: [3, 3],
            location: 0.5,
        });
        const xAxis = chart.xAxes.push(
            am5xy.CategoryAxis.new(root, {
                categoryField: 'weekLabel',
                renderer: xRenderer,
            })
        );
        xAxis.data.setAll(chartData);

        const yAxisRenderer = am5xy.AxisRendererY.new(root, {});
        yAxisRenderer.labels.template.setAll({
            visible: true,
            fill: am5.color('#9ca3af'),
            fontSize: 10,
        });

        const yAxis = chart.yAxes.push(
            am5xy.ValueAxis.new(root, {
                renderer: yAxisRenderer,
                numberFormat: '#,###.##',
            })
        );

        const series = chart.series.push(
            am5xy.ColumnSeries.new(root, {
                name: 'Net Revenue',
                xAxis,
                yAxis,
                valueYField: 'revenue',
                categoryXField: 'weekLabel',
                tooltip: (am5 as any).Tooltip.new(root, {
                    getFillFromSprite: false,
                    labelText: '{categoryX}: [bold]{valueY.formatNumber("#,###.##")}[/]',
                }),
            })
        );

        series.get('tooltip')?.get('background')?.setAll({
            fill: am5.color('#000000'),
            fillOpacity: 0.9,
            stroke: am5.color('#4A90E2'),
            strokeWidth: 1,
        });

        series.columns.template.setAll({
            strokeOpacity: 0,
            cornerRadiusTL: 6,
            cornerRadiusTR: 6,
            width: am5.percent(40),
            maxWidth: 40,
            fill: am5.color('#4A90E2'),
        });

        series.bullets.push((bulletRoot: any, _series: any, dataItem: any) => {
            const value = dataItem.get('valueY') as number || 0;
            const textValue = value > 0 ? formatPlainNumber(value) : '';

            const label = am5.Label.new(bulletRoot, {
                text: `[bold]${textValue}[/]`,
                fill: am5.color('#ffffff'),
                centerY: am5.p100,
                centerX: am5.p50,
                populateText: true,
                fontSize: 10,
                paddingBottom: 5,
            });

            return am5.Bullet.new(bulletRoot, {
                locationY: 1,
                sprite: label,
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
