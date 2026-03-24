import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';

interface StackedSellerChartProps {
    data: { month: string; sellers: { [name: string]: number } }[];
    title: string;
}

export function StackedSellerChart({ data, title }: StackedSellerChartProps) {
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

        // Extrair todos os nomes de vendedores únicos
        const allSellersSet = new Set<string>();
        data.forEach(item => {
            Object.keys(item.sellers).forEach(s => allSellersSet.add(s));
        });
        const allSellers = Array.from(allSellersSet);

        // Preparar dados formatados para AmCharts
        const chartData = data.map(item => ({
            month: item.month,
            ...item.sellers
        }));

        // Eixos
        const xRenderer = am5xy.AxisRendererX.new(root, { minGridDistance: 30 });
        const xAxis = chart.xAxes.push(
            am5xy.CategoryAxis.new(root, {
                categoryField: 'month',
                renderer: xRenderer
            })
        );
        xAxis.data.setAll(chartData);

        const yAxis = chart.yAxes.push(am5xy.ValueAxis.new(root, {
            stacked: true,
            renderer: am5xy.AxisRendererY.new(root, {})
        }));

        // Paleta de cores Migma (Dourados, Bronzes e Tons Escuros Contrastantes)
        const colors = [
            am5.color('#CE9F48'), // Migma Gold
            am5.color('#8B6B32'), // Bronze
            am5.color('#F3E196'), // Pale Gold
            am5.color('#A67C00'), // Darker Gold
            am5.color('#D4AF37'), // Metallic Gold
            am5.color('#B8860B'), // Dark Goldenrod
            am5.color('#C0C0C0'), // Silver
            am5.color('#4A4A4A')  // Charcoal
        ];

        // Criar uma série para cada vendedor
        allSellers.forEach((seller, index) => {
            const series = chart.series.push(am5xy.ColumnSeries.new(root, {
                name: seller,
                xAxis: xAxis,
                yAxis: yAxis,
                valueYField: seller,
                categoryXField: 'month',
                stacked: true,
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
                strokeOpacity: 0,
                width: am5.percent(60)
            });

            series.data.setAll(chartData);
            
            // Labels internos nas barras
            series.bullets.push(() => {
                const label = am5.Label.new(root, {
                    text: '{valueY}',
                    fill: am5.color('#000000'),
                    centerY: am5.p50,
                    centerX: am5.p50,
                    populateText: true,
                    fontSize: 10,
                    fontWeight: 'bold'
                });

                // Ocultar label se valor for 0
                label.adapters.add('forceHidden', (hidden: any, target: any) => {
                    const dataItem = target.dataItem;
                    if (dataItem && dataItem.get('valueY') === 0) {
                        return true;
                    }
                    return hidden;
                });

                return am5.Bullet.new(root, {
                    sprite: label
                });
            });
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
            fontSize: 10,
            maxWidth: 100,
            oversizedBehavior: 'truncate'
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
