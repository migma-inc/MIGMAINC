import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import type { WeeklyMetric } from '@/lib/seller-analytics';

interface WeeklySellerRevenueChartProps {
    data: WeeklyMetric[];
    title: string;
}

export function WeeklySellerRevenueChart({ data, title }: WeeklySellerRevenueChartProps) {
    const chartRef = useRef<HTMLDivElement>(null);
    const rootRef = useRef<am5.Root | null>(null);

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
            numericFields: ["valueY", "value"]
        });

        const chart = root.container.children.push(
            am5xy.XYChart.new(root, {
                panX: false,
                panY: false,
                wheelX: 'none',
                wheelY: 'none',
                paddingLeft: 0,
                paddingRight: 10,
                layout: root.verticalLayout
            })
        );

        // Extrair todos os nomes de vendedores únicos que tiveram > 0 receita nas semanas
        const allSellersSet = new Set<string>();
        data.forEach(item => {
            Object.entries(item.sellers || {}).forEach(([sellerName, rev]) => {
                if (rev > 0) allSellersSet.add(sellerName);
            });
        });
        const allSellers = Array.from(allSellersSet);

        // Preparar dados formatados para AmCharts
        const chartData = data.filter(item => {
            return Object.values(item.sellers || {}).some(val => (val as number) > 0);
        }).map(item => ({
            weekLabel: item.weekLabel,
            ...item.sellers
        }));

        // Eixos
        const xRenderer = am5xy.AxisRendererX.new(root, { 
            minGridDistance: 30
        });
        
        const xAxis = chart.xAxes.push(
            am5xy.CategoryAxis.new(root, {
                categoryField: 'weekLabel',
                renderer: xRenderer
            })
        );
        xAxis.data.setAll(chartData);

        const yAxisRenderer = am5xy.AxisRendererY.new(root, {});
        const yAxis = chart.yAxes.push(am5xy.ValueAxis.new(root, {
            renderer: yAxisRenderer
        }));

        // Cores variadas para os vendedores
        const colors = [
            am5.color('#CE9F48'), // Gold
            am5.color('#4A90E2'), // Blue
            am5.color('#E24A4A'), // Red
            am5.color('#4AE24A'), // Green
            am5.color('#E2E24A'), // Yellow
            am5.color('#E24AE2'), // Purple
            am5.color('#4AE2E2'), // Cyan
            am5.color('#A67C00')  // Bronze
        ];

        // Criar uma série para cada vendedor
        allSellers.forEach((seller, index) => {
            const series = chart.series.push(am5xy.ColumnSeries.new(root, {
                name: seller,
                xAxis: xAxis,
                yAxis: yAxis,
                valueYField: seller,
                categoryXField: 'weekLabel',
                stacked: true,
                clustered: false,
                tooltip: (am5 as any).Tooltip.new(root, {
                    labelText: '{name}: [bold]{valueY}[/]',
                    getFillFromSprite: false
                })
            }));

            series.get('tooltip')?.get('background')?.setAll({
                fill: am5.color('#000000'),
                fillOpacity: 0.9,
                stroke: colors[index % colors.length],
                strokeWidth: 1
            });

            series.columns.template.setAll({
                fill: colors[index % colors.length],
                strokeOpacity: 0
            });

            series.data.setAll(chartData);
        });

        // Adicionar Legenda
        const legend = chart.children.push(am5.Legend.new(root, {
            centerX: am5.p50,
            x: am5.p50,
            marginTop: 15,
            marginBottom: 5,
            layout: root.gridLayout
        }));

        legend.data.setAll(chart.series.values);
        legend.labels.template.setAll({
            fill: am5.color('#ffffff'),
            fontSize: 10
        });

        chart.appear(1000, 100);

        return () => {
            if (rootRef.current) rootRef.current.dispose();
        };
    }, [data]);

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
