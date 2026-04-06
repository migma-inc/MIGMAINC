import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import type { WeeklyMetric } from '@/lib/seller-analytics';
import { formatPlainNumber } from './chartFormatters';

interface WeeklyFilteredSellerRevenueChartProps {
    data: WeeklyMetric[];
    titleBase: string;
}

export function WeeklyFilteredSellerRevenueChart({ data, titleBase }: WeeklyFilteredSellerRevenueChartProps) {
    const chartRef = useRef<HTMLDivElement>(null);
    const rootRef = useRef<am5.Root | null>(null);
    const [selectedWeek, setSelectedWeek] = useState<number>(0);

    useEffect(() => {
        if (data && data.length > 0) {
            const firstActive = data.findIndex(w => w.revenue > 0);
            setSelectedWeek(firstActive >= 0 ? firstActive : 0);
        }
    }, [data]);

    const activeWeekData = data[selectedWeek];
    const hasSellerRevenue = !!activeWeekData && Object.values(activeWeekData.sellers).some(value => value > 0);

    useEffect(() => {
        if (!chartRef.current || !data || !hasSellerRevenue) return;

        if (rootRef.current) rootRef.current.dispose();

        const root = am5.Root.new(chartRef.current);
        if (root._logo) root._logo.dispose();
        rootRef.current = root;
        root.setThemes([am5themes_Animated.new(root)]);

        root.interfaceColors.set('text', am5.color('#ffffff'));
        root.interfaceColors.set('grid', am5.color('#333333'));

        const totalWeekRevenue = activeWeekData?.revenue || 0;
        const rawSellers = activeWeekData ? Object.entries(activeWeekData.sellers) : [];
        const chartData = rawSellers
            .map(([name, revenue]) => ({
                name,
                revenue,
                percentage: totalWeekRevenue > 0 ? (revenue / totalWeekRevenue) * 100 : 0,
            }))
            .sort((a, b) => b.revenue - a.revenue)
            .filter(item => item.revenue > 0)
            .map(item => ({
                ...item,
                labelTitle: `${item.name}   [bold]${formatPlainNumber(item.revenue)}[/]`,
            }));

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

        const yRenderer = am5xy.AxisRendererY.new(root, {
            inversed: true,
            minGridDistance: 20,
        });

        yRenderer.labels.template.setAll({
            maxWidth: 220,
            oversizedBehavior: 'truncate',
            textAlign: 'right',
            fontSize: 10,
        });

        const yAxis = chart.yAxes.push(
            am5xy.CategoryAxis.new(root, {
                categoryField: 'labelTitle',
                renderer: yRenderer,
            })
        );
        yAxis.data.setAll(chartData);

        const xAxisRenderer = am5xy.AxisRendererX.new(root, {
            strokeOpacity: 0.1,
        });
        xAxisRenderer.labels.template.setAll({
            visible: true,
            fill: am5.color('#9ca3af'),
            fontSize: 10,
        });
        xAxisRenderer.grid.template.setAll({
            visible: true,
            strokeOpacity: 0.12,
            strokeDasharray: [3, 3],
        });

        const xAxis = chart.xAxes.push(
            am5xy.ValueAxis.new(root, {
                min: 0,
                renderer: xAxisRenderer,
                numberFormat: '#,###.##',
            })
        );

        const series = chart.series.push(
            am5xy.ColumnSeries.new(root, {
                name: 'Revenue',
                xAxis,
                yAxis,
                valueXField: 'revenue',
                categoryYField: 'labelTitle',
                tooltip: (am5 as any).Tooltip.new(root, {
                    labelText: '{valueX.formatNumber("#,###.##")} ({percentage.formatNumber("#.0")}%)',
                    pointerOrientation: 'horizontal',
                    getFillFromSprite: false,
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
            height: am5.percent(30),
            maxHeight: 24,
            cornerRadiusBR: 4,
            cornerRadiusTR: 4,
            fill: am5.color('#4A90E2'),
        });

        series.bullets.push(() => {
            const label = am5.Label.new(root, {
                text: '{percentage.formatNumber("#.0")}% ',
                fill: am5.color('#ffffff'),
                centerY: am5.p50,
                centerX: 0,
                populateText: true,
                fontSize: 10,
                fontWeight: 'bold',
                dx: 5,
            });

            label.adapters.add('forceHidden', (hidden: any, target: any) => {
                const dataItem = target.dataItem;
                if (dataItem && dataItem.get('valueX') === 0) {
                    return true;
                }
                return hidden;
            });

            return am5.Bullet.new(root, {
                locationX: 1,
                sprite: label,
            });
        });

        series.data.setAll(chartData);
        chart.appear(1000, 100);

        return () => {
            if (rootRef.current) rootRef.current.dispose();
        };
    }, [activeWeekData, data, hasSellerRevenue]);

    const weekLabels = ['W1', 'W2', 'W3', 'W4', 'W5'];

    return (
        <Card className="bg-black/40 border-gold-medium/20 h-[400px]">
            <CardHeader className="py-2 bg-gold-medium/5 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-bold text-white uppercase tracking-wider leading-tight">
                    {titleBase}
                </CardTitle>
                <Select value={selectedWeek.toString()} onValueChange={(val) => setSelectedWeek(parseInt(val))}>
                    <SelectTrigger className="w-[120px] h-8 text-xs bg-gold-medium/10 border-gold-medium/20 text-white">
                        <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1A1A1A] border-gold-medium/20">
                        {weekLabels.map((label, index) => (
                            <SelectItem key={index} value={index.toString()} className="text-white hover:bg-white/10">
                                {label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </CardHeader>
            <CardContent className="p-4 pt-4 h-[330px]">
                {hasSellerRevenue ? (
                    <div ref={chartRef} className="w-full h-full"></div>
                ) : (
                    <div className="h-full flex items-center justify-center text-sm text-zinc-400">
                        No revenue in this week
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
