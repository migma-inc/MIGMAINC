import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import * as am5 from '@amcharts/amcharts5';
import * as am5percent from '@amcharts/amcharts5/percent';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { shortenServiceLabel } from './chartFormatters';

interface ServiceRankChartProps {
    data: { productName: string; sales: number; percentage: number }[];
    total: number;
    title: string;
}

export function ServiceRankChart({ data, title }: ServiceRankChartProps) {
    const chartRef = useRef<HTMLDivElement>(null);
    const rootRef = useRef<am5.Root | null>(null);

    const hasData = data.some(item => item.sales > 0);
    const chartData = hasData
        ? data.filter(d => d.sales > 0).map(item => ({
            ...item,
            displayName: shortenServiceLabel(item.productName),
        }))
        : [{ productName: 'No sales', displayName: 'No sales', sales: 1, isPlaceholder: true }];

    useEffect(() => {
        if (!chartRef.current) return;

        if (rootRef.current) rootRef.current.dispose();

        const root = am5.Root.new(chartRef.current);
        if (root._logo) root._logo.dispose();
        rootRef.current = root;
        root.setThemes([am5themes_Animated.new(root)]);

        root.interfaceColors.set('text', am5.color('#ffffff'));

        const chart = root.container.children.push(
            am5percent.PieChart.new(root, {
                layout: root.verticalLayout,
            })
        );

        const series = chart.series.push(
            am5percent.PieSeries.new(root, {
                name: 'Distribution',
                valueField: 'sales',
                categoryField: 'displayName',
                alignLabels: false,
                stroke: am5.color('#000000'),
                strokeWidth: 2,
            })
        );

        if (!hasData) {
            series.get('colors')?.set('colors', [am5.color('#333333')]);
        } else {
            series.get('colors')?.set('colors', [
                am5.color('#CE9F48'),
                am5.color('#4A90E2'),
                am5.color('#E24A4A'),
                am5.color('#8B6B32'),
                am5.color('#4AE24A'),
                am5.color('#E24AD0'),
                am5.color('#4AE2D0'),
                am5.color('#E2D04A'),
            ]);
        }

        series.labels.template.setAll({
            text: hasData ? '{valuePercentTotal.formatNumber("0.0")}% ' : '',
            textType: 'circular',
            inside: true,
            fill: am5.color('#ffffff'),
            fontSize: 10,
            fontWeight: 'bold',
        });

        series.slices.template.setAll({
            tooltipText: hasData ? '{category}: [bold]{value}[/] ({valuePercentTotal.formatNumber("0.0")}%)' : '',
            cornerRadius: 8,
        });

        series.data.setAll(chartData);

        const legend = chart.children.push(am5.Legend.new(root, {
            centerX: am5.p50,
            x: am5.p50,
            marginTop: 15,
            marginBottom: 0,
        }));

        if (hasData) {
            legend.data.setAll(series.dataItems);
        }

        legend.labels.template.setAll({
            fill: am5.color('#ffffff'),
            fontSize: 10,
            maxWidth: 200,
            oversizedBehavior: 'truncate',
        });

        chart.appear(1000, 100);

        return () => {
            if (rootRef.current) rootRef.current.dispose();
        };
    }, [chartData, data, hasData]);

    return (
        <Card className="bg-black/40 border-gold-medium/20 h-[500px] relative overflow-hidden">
            <CardHeader className="py-3 bg-gold-medium/5 relative z-10">
                <CardTitle className="text-sm font-bold text-center text-white uppercase tracking-wider">
                    {title}
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2 h-[420px] relative">
                <div ref={chartRef} className="w-full h-full"></div>
            </CardContent>
        </Card>
    );
}
