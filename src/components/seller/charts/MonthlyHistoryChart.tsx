import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { formatPlainNumber } from './chartFormatters';

interface MonthlyHistoryChartProps {
    data: { month: string; sales: number }[];
    avg: number;
    title: string;
}

export function MonthlyHistoryChart({ data, avg, title }: MonthlyHistoryChartProps) {
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
                paddingRight: 10,
            })
        );

        const xRenderer = am5xy.AxisRendererX.new(root, { minGridDistance: 30 });
        xRenderer.grid.template.setAll({
            visible: true,
            strokeOpacity: 0.15,
            strokeDasharray: [3, 3],
            location: 0.5,
        });
        const xAxis = chart.xAxes.push(
            am5xy.CategoryAxis.new(root, {
                categoryField: 'month',
                renderer: xRenderer,
            })
        );
        xAxis.data.setAll(chartData);

        const yAxisRenderer = am5xy.AxisRendererY.new(root, {});
        yAxisRenderer.labels.template.set('visible', false);

        const yAxis = chart.yAxes.push(
            am5xy.ValueAxis.new(root, {
                renderer: yAxisRenderer,
                extraMax: 0.15,
            })
        );

        const series = chart.series.push(
            am5xy.ColumnSeries.new(root, {
                name: 'Sales',
                xAxis,
                yAxis,
                valueYField: 'sales',
                categoryXField: 'month',
                tooltip: (am5 as any).Tooltip.new(root, {
                    getFillFromSprite: false,
                    labelText: '{categoryX}: [bold]{valueY}[/] sales',
                }),
            })
        );

        series.get('tooltip')?.get('background')?.setAll({
            fill: am5.color('#000000'),
            fillOpacity: 0.9,
            stroke: am5.color('#CE9F48'),
            strokeWidth: 1,
        });

        series.columns.template.setAll({
            strokeOpacity: 0,
            cornerRadiusTL: 6,
            cornerRadiusTR: 6,
            fill: am5.color('#4A90E2'),
            width: am5.percent(60),
            maxWidth: 40,
        });

        series.bullets.push(() => {
            const label = am5.Label.new(root, {
                text: '{valueY}',
                fill: am5.color('#ffffff'),
                centerY: am5.p100,
                centerX: am5.p50,
                populateText: true,
                fontSize: 12,
                fontWeight: 'bold',
                paddingBottom: 5,
            });

            label.adapters.add('forceHidden', (hidden: any, target: any) => {
                const dataItem = target.dataItem;
                if (dataItem && dataItem.get('valueY') === 0) {
                    return true;
                }
                return hidden;
            });

            return am5.Bullet.new(root, {
                locationY: 1,
                sprite: label,
            });
        });

        series.data.setAll(chartData);

        if (avg > 0) {
            const rangeDataItem = yAxis.makeDataItem({
                value: avg,
                endValue: avg,
            });

            const range = yAxis.createAxisRange(rangeDataItem);
            range.get('grid')?.setAll({
                stroke: am5.color('#CE9F48'),
                strokeOpacity: 1,
                strokeWidth: 2,
                strokeDasharray: [6, 4],
                interactive: true,
                tooltipText: `Average: ${formatPlainNumber(avg, 1)}`,
            });

            range.get('grid')?.get('tooltip')?.get('background')?.setAll({
                fill: am5.color('#000000'),
                fillOpacity: 0.9,
                stroke: am5.color('#CE9F48'),
                strokeWidth: 1,
            });

            range.get('label')?.setAll({
                text: `AVG ${formatPlainNumber(avg, 1)}`,
                inside: true,
                paddingLeft: 10,
                paddingRight: 10,
                paddingTop: 5,
                paddingBottom: 5,
                fill: am5.color('#ffffff'),
                fontSize: 10,
                fontWeight: 'bold',
                background: (am5 as any).Rectangle.new(root, {
                    fill: am5.color('#CE9F48'),
                    fillOpacity: 0.8,
                    cornerRadius: 4,
                }),
            });
        }

        chart.appear(1000, 100);

        return () => {
            if (rootRef.current) rootRef.current.dispose();
        };
    }, [data, avg]);

    return (
        <Card className="bg-black/40 border-gold-medium/20 h-[500px]">
            <CardHeader className="py-3 bg-gold-medium/5">
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
