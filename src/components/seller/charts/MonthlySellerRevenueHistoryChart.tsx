import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import type { TeamMonthlyData } from '@/lib/seller-analytics';

interface MonthlySellerRevenueHistoryChartProps {
    data: TeamMonthlyData[];
    sellerStats: { name: string; revenue: number }[];
    title: string;
    monthsCount: number;
}

export function MonthlySellerRevenueHistoryChart({ data, sellerStats, title, monthsCount }: MonthlySellerRevenueHistoryChartProps) {
    const chartRef = useRef<HTMLDivElement>(null);
    const rootRef = useRef<am5.Root | null>(null);

    const formatMoneyCompact = (val: number) => {
        if (val >= 1000) {
            return `$${(val / 1000).toFixed(1)}k`;
        }
        return `$${val.toFixed(0)}`;
    };

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
                paddingRight: 40,
                layout: root.verticalLayout
            })
        );

        // Extrair todos os nomes de vendedores únicos que tiveram > 0 receita no ano
        const allSellersSet = new Set<string>();
        data.forEach(item => {
            Object.entries(item.sellerRevenues || {}).forEach(([sellerName, rev]) => {
                if (rev > 0) allSellersSet.add(sellerName);
            });
        });
        const allSellers = Array.from(allSellersSet);

        // Preparar dados formatados para AmCharts (mantendo todos os meses para esticar o eixo X de Jan a Dez)
        const chartData = data.map(item => {
            const mapped: any = { month: item.month };
            allSellers.forEach(seller => {
                const rev = (item.sellerRevenues || {})[seller] || 0;
                mapped[seller] = rev;
                mapped[`${seller}_fmt`] = formatMoneyCompact(rev);
            });
            return mapped;
        });

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
            visible: false
        });

        const yAxis = chart.yAxes.push(am5xy.ValueAxis.new(root, {
            min: 0,
            renderer: yAxisRenderer
        }));

        // Cores baseadas nos vendedores (usando paleta Migma)
        const colors = [
            am5.color('#4A90E2'), // Blue
            am5.color('#E24A4A'), // Red
            am5.color('#A67C00'), // Bronze/Gold escuro
            am5.color('#CE9F48'), // Light Gold
            am5.color('#4AE24A'), // Green
            am5.color('#E2E24A'), // Yellow
            am5.color('#E24AE2'), // Purple
            am5.color('#4AE2E2')  // Cyan
        ];

        // Criar uma série de barras e uma de linha para cada vendedor
        allSellers.forEach((seller, index) => {
            const color = colors[index % colors.length];

            // 1. Column Series (Receita)
            const columnSeries = chart.series.push(am5xy.ColumnSeries.new(root, {
                name: seller,
                xAxis: xAxis,
                yAxis: yAxis,
                valueYField: seller,
                categoryXField: 'month',
                tooltip: (am5 as any).Tooltip.new(root, {
                    labelText: '{name}: [bold]{valueY.formatNumber("$#,###.00")}[/]',
                    getFillFromSprite: false
                })
            }));

            columnSeries.get('tooltip')?.get('background')?.setAll({
                fill: am5.color('#000000'),
                fillOpacity: 0.9,
                stroke: color,
                strokeWidth: 1
            });

            columnSeries.columns.template.setAll({
                fill: color,
                strokeOpacity: 0,
                width: am5.percent(80),
                cornerRadiusTL: 2,
                cornerRadiusTR: 2
            });

            columnSeries.bullets.push(() => {
                const label = am5.Label.new(root, {
                    text: `{${seller}_fmt}`,
                    fill: color,
                    centerY: am5.p100,
                    centerX: am5.p50,
                    populateText: true,
                    fontSize: 10,
                    fontWeight: 'bold',
                    dy: -5
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
                    sprite: label
                });
            });

            columnSeries.data.setAll(chartData);


        });

        // Adicionar Legenda
        const legend = chart.children.push(am5.Legend.new(root, {
            centerX: am5.p50,
            x: am5.p50,
            marginTop: 15,
            marginBottom: 5,
            layout: root.gridLayout
        }));

        legend.labels.template.setAll({
            fill: am5.color('#ffffff'),
            fontSize: 11
        });

        legend.data.setAll(chart.series.values);

        chart.appear(1000, 100);

        return () => {
            if (rootRef.current) rootRef.current.dispose();
        };
    }, [data, sellerStats, monthsCount]);

    return (
        <Card className="bg-black/40 border-gold-medium/20 h-[500px]">
            <CardHeader className="py-3 bg-gold-medium/5 flex flex-col items-center gap-2">
                <CardTitle className="text-sm font-bold text-center text-white uppercase tracking-wider">
                    {title}
                </CardTitle>
                <div className="text-xs text-white/50 italic mt-1">
                    *valores formatados em milhar (k) acima de 1k
                </div>
            </CardHeader>
            <CardContent className="p-4 pt-4 h-[440px]">
                <div ref={chartRef} className="w-full h-full"></div>
            </CardContent>
        </Card>
    );
}
