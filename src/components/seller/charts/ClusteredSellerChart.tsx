import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import type { TeamMonthlyData } from '@/lib/seller-analytics';
import { Badge } from '@/components/ui/badge';

interface ClusteredSellerChartProps {
    data: TeamMonthlyData[];
    title: string;
    total: number;
    avg: number;
}

export function ClusteredSellerChart({ data, title, total, avg }: ClusteredSellerChartProps) {
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

        // Extrair todos os nomes de vendedores únicos que tiveram > 0 vendas
        const allSellersSet = new Set<string>();
        data.forEach(item => {
            Object.entries(item.sellers).forEach(([sellerName, count]) => {
                if (count > 0) allSellersSet.add(sellerName);
            });
        });
        const allSellers = Array.from(allSellersSet);

        // Preparar dados formatados para AmCharts (mantendo todos os meses)
        const chartData = data.map(item => ({
            month: item.month,
            ...item.sellers
        }));

        // Eixos
        const xRenderer = am5xy.AxisRendererX.new(root, { 
            minGridDistance: 30
        });
        
        const xAxis = chart.xAxes.push(
            am5xy.CategoryAxis.new(root, {
                categoryField: 'month',
                renderer: xRenderer
            })
        );
        xAxis.data.setAll(chartData);

        const yAxisRenderer = am5xy.AxisRendererY.new(root, {});
        yAxisRenderer.labels.template.setAll({
            fill: am5.color('#ffffff'),
            fontSize: 10
        });

        const yAxis = chart.yAxes.push(am5xy.ValueAxis.new(root, {
            min: 0,
            max: 100,
            calculateTotals: true,
            numberFormat: "#'%'",
            strictMinMax: true,
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
                categoryXField: 'month',
                valueYShow: 'valueYTotalPercent',
                stacked: true,
                tooltip: (am5 as any).Tooltip.new(root, {
                    labelText: '{name}: [bold]{valueY}[/] sales',
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

            series.bullets.push(() => {
                const label = am5.Label.new(root, {
                    text: '{valueY}',
                    fill: am5.color('#ffffff'),
                    centerY: am5.p50,
                    centerX: am5.p50,
                    populateText: true,
                    fontSize: 11,
                    fontWeight: 'bold'
                });

                label.adapters.add('forceHidden', (hidden: any, target: any) => {
                    const dataItem = target.dataItem;
                    if (dataItem && dataItem.get('valueY') === 0) {
                        return true;
                    }
                    return hidden;
                });

                return am5.Bullet.new(root, {
                    locationY: 0.5,
                    sprite: label
                });
            });

            series.data.setAll(chartData);
            
            // Ocultar barras zeradas do agrupamento (opcional, mas amCharts lida bem)
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
            <CardHeader className="py-3 bg-gold-medium/5 flex flex-col items-center gap-2">
                <CardTitle className="text-sm font-bold text-center text-white uppercase tracking-wider">
                    {title}
                </CardTitle>
                <div className="flex gap-2">
                    <Badge variant="outline" className="bg-gold-medium/10 text-gold-light border-gold-medium/30 tracking-wider">
                        Total Year: {total}
                    </Badge>
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30 tracking-wider">
                        Avg/Month: {avg.toFixed(1)}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="p-4 pt-6 h-[420px]">
                <div ref={chartRef} className="w-full h-full"></div>
            </CardContent>
        </Card>
    );
}
