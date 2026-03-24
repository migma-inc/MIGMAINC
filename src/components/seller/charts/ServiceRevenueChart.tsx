import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';

interface ServiceRevenueChartProps {
    data: { productName: string; revenue: number; percentage: number }[];
    total: number;
    title: string;
}

export function ServiceRevenueChart({ data, title }: ServiceRevenueChartProps) {
    const chartRef = useRef<HTMLDivElement>(null);
    const rootRef = useRef<am5.Root | null>(null);

    const hasData = data.some(item => item.revenue > 0);
    const rawChartData = hasData 
        ? data.filter(d => d.revenue > 0) 
        : [{ productName: 'No revenue', revenue: 1, percentage: 100 }];
    
    // Reverse sort for AmCharts so the highest is visually on top
    const sortedData = [...rawChartData].sort((a, b) => a.revenue - b.revenue);
    const chartData = sortedData.map(d => ({
        ...d,
        labelTitle: `${d.productName} [#4A90E2]${d.percentage.toFixed(1).replace('.', ',')}%[/]`
    }));

    useEffect(() => {
        if (!chartRef.current) return;

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
            minGridDistance: 20,
            cellStartLocation: 0.1,
            cellEndLocation: 0.9
        });
        yRenderer.grid.template.set("visible", false);
        yRenderer.labels.template.setAll({
            fontSize: 10,
            fill: am5.color('#ffffff')
        });
        
        const yAxis = chart.yAxes.push(
            am5xy.CategoryAxis.new(root, {
                categoryField: 'labelTitle',
                renderer: yRenderer
            })
        );
        yAxis.data.setAll(chartData);

        const xRenderer = am5xy.AxisRendererX.new(root, {});
        xRenderer.labels.template.set('visible', false);
        xRenderer.grid.template.set('visible', false);

        const xAxis = chart.xAxes.push(
            am5xy.ValueAxis.new(root, {
                renderer: xRenderer,
                min: 0,
                extraMax: 0.15 // Allows extra space for the badges
            })
        );

        const series = chart.series.push(
            am5xy.ColumnSeries.new(root, {
                name: 'Revenue',
                xAxis: xAxis,
                yAxis: yAxis,
                valueXField: 'revenue',
                categoryYField: 'labelTitle'
            })
        );

        series.columns.template.setAll({
            fill: am5.color('#4A90E2'), // Blue bar
            strokeOpacity: 0,
            height: 16,
            cornerRadiusTR: 8,
            cornerRadiusBR: 8,
            tooltipText: "{categoryY}: {valueX.formatNumber('$#,###.00')}"
        });

        series.bullets.push(function () {
            return am5.Bullet.new(root, {
                locationX: 1,
                sprite: am5.Label.new(root, {
                    text: hasData ? "{valueX.formatNumber('$#,###.00')}" : "0",
                    fill: am5.color(0xffffff),
                    centerY: am5.p50,
                    centerX: 0,
                    populateText: true,
                    fontSize: 10,
                    fontWeight: "bold",
                    dx: 10
                })
            });
        });

        series.data.setAll(chartData);

        // Custom Legend at bottom right
        const legend = chart.children.push(am5.Legend.new(root, {
            centerX: am5.p100,
            x: am5.p100,
            y: am5.p100,
            centerY: am5.p100,
            layout: root.horizontalLayout,
            paddingBottom: 0,
            paddingTop: 10
        }));

        legend.labels.template.setAll({
            fill: am5.color('#ffffff'),
            fontSize: 10,
            fontWeight: "bold"
        });

        legend.markers.template.setAll({
            width: 12,
            height: 12
        });

        legend.data.setAll([
            {
                name: "% share",
                fill: am5.color('#E24A4A') // Red/Orange color
            },
            {
                name: "Revenue generated",
                fill: am5.color('#4A90E2') // Blue color
            }
        ]);

        chart.appear(1000, 100);

        return () => {
            if (rootRef.current) rootRef.current.dispose();
        };
    }, [chartData, hasData]);

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
