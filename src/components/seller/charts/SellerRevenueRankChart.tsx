import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';

import { Badge } from '@/components/ui/badge';

interface SellerRevenueRankChartProps {
    data: { name: string; revenue: number; percentage: number }[];
    total: number;
    title: string;
    year?: string | number;
}

export function SellerRevenueRankChart({ data, total, title, year = new Date().getFullYear() }: SellerRevenueRankChartProps) {
    const chartRef = useRef<HTMLDivElement>(null);
    const rootRef = useRef<am5.Root | null>(null);

    const formatMoney = (val: number) => `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const chartData = data
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
                paddingRight: 30, // Reduzido pois não tem mais o label externo
            })
        );

        // Eixos
        const yRenderer = am5xy.AxisRendererY.new(root, {
            inversed: true,
            minGridDistance: 20
        });

        yRenderer.labels.template.setAll({
            maxWidth: 220, // Aumentado para caber nome + valor
            oversizedBehavior: 'truncate',
            textAlign: 'right',
            fontSize: 11
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
            stroke: am5.color('#CE9F48'),
            strokeWidth: 1
        });

        series.columns.template.setAll({
            strokeOpacity: 0,
            height: am5.percent(40),
            cornerRadiusBR: 4,
            cornerRadiusTR: 4
        });

        series.columns.template.set('fillGradient', am5.LinearGradient.new(root, {
            stops: [
                { color: am5.color('#CE9F48') },
                { color: am5.color('#8B6B32') }
            ],
            rotation: 0
        }));

        // Porcentagem dentro da barra
        series.bullets.push(() => {
            const label = am5.Label.new(root, {
                text: '{percentage.formatNumber("#.0")}%',
                fill: am5.color('#ffffff'),
                centerY: am5.p50,
                centerX: 0,
                populateText: true,
                fontSize: 10,
                fontWeight: 'bold'
            });

            label.adapters.add('forceHidden', (hidden: any, target: any) => {
                const dataItem = target.dataItem;
                if (dataItem && dataItem.get('valueX') === 0) {
                    return true;
                }
                return hidden;
            });

            return am5.Bullet.new(root, {
                locationX: 0.05,
                sprite: label
            });
        });

        series.data.setAll(chartData);

        chart.appear(1000, 100);

        return () => {
            if (rootRef.current) rootRef.current.dispose();
        };
    }, [chartData]);

    return (
        <Card className="bg-black/40 border-gold-medium/20 h-[500px]">
            <CardHeader className="py-3 bg-gold-medium/5 flex flex-col items-center gap-2">
                <CardTitle className="text-sm font-bold text-center text-white uppercase tracking-wider">
                    {title}
                </CardTitle>
                <Badge variant="outline" className="bg-gold-medium/10 text-gold-light border-gold-medium/30 tracking-wider">
                    Total Arrecadado {year}: ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Badge>
            </CardHeader>
            <CardContent className="p-4 pt-6 h-[420px]">
                <div ref={chartRef} className="w-full h-full"></div>
            </CardContent>
        </Card>
    );
}
