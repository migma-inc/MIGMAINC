import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';

interface MonthlyRevenueChartProps {
    data: { month: string; revenue: number }[];
    avg: number;
    title: string;
    total: number;
}

export function MonthlyRevenueChart({ data, title }: MonthlyRevenueChartProps) {
    const chartRef = useRef<HTMLDivElement>(null);
    const rootRef = useRef<am5.Root | null>(null);

    useEffect(() => {
        const chartData = data.filter(d => d.revenue > 0);
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
                paddingRight: 60, // Spacing for badges
            })
        );

        const yRenderer = am5xy.AxisRendererY.new(root, {
            inversed: true,
            minGridDistance: 30,
            cellStartLocation: 0.2,
            cellEndLocation: 0.8
        });
        yRenderer.grid.template.set("visible", false);
        
        const yAxis = chart.yAxes.push(
            am5xy.CategoryAxis.new(root, {
                categoryField: 'month',
                renderer: yRenderer
            })
        );
        // yAxis.data.setAll(chartData);
        yAxis.data.setAll(chartData);

        const xRenderer = am5xy.AxisRendererX.new(root, {});
        xRenderer.labels.template.set('visible', false);
        xRenderer.grid.template.set('visible', false);

        const xAxis = chart.xAxes.push(
            am5xy.ValueAxis.new(root, {
                renderer: xRenderer,
                min: 0,
                extraMax: 0.1
            })
        );

        const series = chart.series.push(
            am5xy.ColumnSeries.new(root, {
                name: 'Revenue',
                xAxis: xAxis,
                yAxis: yAxis,
                valueXField: 'revenue',
                categoryYField: 'month'
            })
        );

        // Barra Azul
        series.columns.template.setAll({
            fill: am5.color('#4A90E2'),
            strokeOpacity: 0,
            height: 16,
            cornerRadiusTR: 8,
            cornerRadiusBR: 8,
            tooltipText: "{categoryY}: {valueX.formatNumber('$#,###.00')}"
        });

        // Badge vermelho no final da barra
        series.bullets.push(function () {
            return am5.Bullet.new(root, {
                locationX: 1,
                sprite: am5.Label.new(root, {
                    text: "{valueX.formatNumber('$#,###.00')}", // Mostra o valor de receita dentro da 'pílula'
                    fill: am5.color(0xffffff),
                    centerY: am5.p50,
                    centerX: 0, // Inicia exatamente no fim da barra, empurrado pelo dx
                    populateText: true,
                    fontSize: 10,
                    fontWeight: "bold",
                    dx: 10 // Espaçamento entre barra e badge
                })
            });
        });

        series.data.setAll(chartData);
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
            </CardHeader>
            <CardContent className="p-4 pt-6 h-[420px]">
                <div ref={chartRef} className="w-full h-full"></div>
            </CardContent>
        </Card>
    );
}
