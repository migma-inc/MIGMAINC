import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { formatPlainNumber } from './chartFormatters';

interface MonthlyRevenueChartProps {
    data: { month: string; revenue: number }[];
    avg: number;
    title: string;
    total: number;
}

export function MonthlyRevenueChart({ data, avg, title }: MonthlyRevenueChartProps) {
    const chartRef = useRef<HTMLDivElement>(null);
    const rootRef = useRef<am5.Root | null>(null);

    useEffect(() => {
        const chartData = data;
        if (!chartRef.current || chartData.length === 0) return;

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
                paddingRight: 60,
            })
        );

        const yRenderer = am5xy.AxisRendererY.new(root, {
            inversed: true,
            minGridDistance: 30,
            cellStartLocation: 0.2,
            cellEndLocation: 0.8,
        });
        yRenderer.grid.template.setAll({
            visible: true,
            strokeOpacity: 0.15,
            strokeDasharray: [3, 3],
        });
        yRenderer.labels.template.setAll({
            fill: am5.color('#ffffff'),
            fontSize: 11,
        });

        const yAxis = chart.yAxes.push(
            am5xy.CategoryAxis.new(root, {
                categoryField: 'month',
                renderer: yRenderer,
            })
        );
        yAxis.data.setAll(chartData);

        const xRenderer = am5xy.AxisRendererX.new(root, {});
        xRenderer.labels.template.setAll({
            visible: true,
            fill: am5.color('#9ca3af'),
            fontSize: 10,
        });
        xRenderer.grid.template.setAll({
            visible: true,
            strokeOpacity: 0.12,
            strokeDasharray: [3, 3],
        });

        const xAxis = chart.xAxes.push(
            am5xy.ValueAxis.new(root, {
                renderer: xRenderer,
                min: 0,
                extraMax: 0.1,
                numberFormat: '#,###.##',
            })
        );

        const series = chart.series.push(
            am5xy.ColumnSeries.new(root, {
                name: 'Revenue',
                xAxis,
                yAxis,
                valueXField: 'revenue',
                categoryYField: 'month',
                tooltip: (am5 as any).Tooltip.new(root, {
                    getFillFromSprite: false,
                    labelText: '{categoryY}: [bold]{valueX.formatNumber("#,###.##")}[/]',
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
            fill: am5.color('#4A90E2'),
            strokeOpacity: 0,
            height: 16,
            cornerRadiusTR: 8,
            cornerRadiusBR: 8,
            tooltipText: '{categoryY}: {valueX.formatNumber("#,###.##")}',
        });

        series.bullets.push(() => {
            return am5.Bullet.new(root, {
                locationX: 1,
                sprite: am5.Label.new(root, {
                    text: '{valueX.formatNumber("#,###.##")}',
                    fill: am5.color(0xffffff),
                    centerY: am5.p50,
                    centerX: 0,
                    populateText: true,
                    fontSize: 10,
                    fontWeight: 'bold',
                    dx: 10,
                }),
            });
        });

        if (avg > 0) {
            const rangeDataItem = xAxis.makeDataItem({
                value: avg,
                endValue: avg,
            });

            const range = xAxis.createAxisRange(rangeDataItem);
            range.get('grid')?.setAll({
                stroke: am5.color('#CE9F48'),
                strokeOpacity: 1,
                strokeWidth: 2,
                strokeDasharray: [6, 4],
                interactive: true,
                tooltipText: `Average: ${formatPlainNumber(avg)}`,
            });

            range.get('grid')?.get('tooltip')?.get('background')?.setAll({
                fill: am5.color('#000000'),
                fillOpacity: 0.9,
                stroke: am5.color('#CE9F48'),
                strokeWidth: 1,
            });

            range.get('label')?.setAll({
                text: `AVG ${formatPlainNumber(avg)}`,
                fill: am5.color('#ffffff'),
                fontSize: 10,
                fontWeight: 'bold',
                centerY: am5.p100,
                paddingLeft: 8,
                paddingRight: 8,
                paddingTop: 4,
                paddingBottom: 4,
                background: (am5 as any).Rectangle.new(root, {
                    fill: am5.color('#CE9F48'),
                    fillOpacity: 0.85,
                    cornerRadius: 4,
                }),
            });
        }

        series.data.setAll(chartData);
        chart.appear(1000, 100);

        return () => {
            if (rootRef.current) rootRef.current.dispose();
        };
    }, [data, avg]);

    return (
        <Card className="bg-black/40 border-gold-medium/20 h-[500px]">
            <CardHeader className="py-3 bg-gold-medium/5 flex flex-col items-center gap-2">
                <CardTitle className="text-sm font-bold text-center text-white uppercase tracking-wider">
                    {title}
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-6 h-[420px]">
                <div ref={chartRef} className="w-full h-full"></div>
            </CardContent>
        </Card>
    );
}
