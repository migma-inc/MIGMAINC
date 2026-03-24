import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import * as am5 from '@amcharts/amcharts5';
import * as am5percent from '@amcharts/amcharts5/percent';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import type { ProductMetric } from '@/lib/seller-analytics';

interface SubProductPieChartProps {
    data: ProductMetric[];
    filterType: 'student' | 'tourist-us' | 'tourist-ca';
    title: string;
}

export function SubProductPieChart({ data, filterType, title }: SubProductPieChartProps) {
    const chartRef = useRef<HTMLDivElement>(null);
    const rootRef = useRef<am5.Root | null>(null);

    // Filtrar e agrupar dados baseados no tipo
    const summarizedData: { productName: string, sales: number }[] = [];

    if (filterType === 'student') {
        let initialSales = 0;
        let cosSales = 0;
        let transferSales = 0;

        data.forEach(item => {
            const slug = item.productSlug.toLowerCase();
            if (slug.includes('initial')) initialSales += item.sales;
            else if (slug.includes('cos') || slug.includes('change of status')) cosSales += item.sales;
            else if (slug.includes('transfer')) transferSales += item.sales;
        });

        if (initialSales > 0) summarizedData.push({ productName: 'F1 Initial', sales: initialSales });
        if (cosSales > 0) summarizedData.push({ productName: 'COS', sales: cosSales });
        if (transferSales > 0) summarizedData.push({ productName: 'Transfer', sales: transferSales });
    } else if (filterType === 'tourist-us') {
        data.forEach(item => {
            const slug = item.productSlug.toLowerCase();
            if (slug.includes('b1') || slug.includes('turista americano') || slug.includes('tourist-us')) {
                summarizedData.push({ productName: item.productName, sales: item.sales });
            }
        });
    } else if (filterType === 'tourist-ca') {
        data.forEach(item => {
            const slug = item.productSlug.toLowerCase();
            if (slug.includes('canada')) {
                summarizedData.push({ productName: item.productName, sales: item.sales });
            }
        });
    }
    
    const hasData = summarizedData.some(item => item.sales > 0);

    // Dados para o gráfico (se vazio, usa placeholder)
    const chartData = hasData 
        ? summarizedData.filter(d => d.sales > 0) 
        : [{ productName: 'No sales in period', sales: 1, isPlaceholder: true }];

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
                layout: root.verticalLayout
            })
        );

        const series = chart.series.push(
            am5percent.PieSeries.new(root, {
                name: 'Sales',
                valueField: 'sales',
                categoryField: 'productName',
                alignLabels: false,
                stroke: am5.color('#000000'),
                strokeWidth: 2
            })
        );

        // Paleta Dourada Migma ou Cinza para Placeholder
        if (!hasData) {
            series.get('colors')?.set('colors', [am5.color('#333333')]);
        } else {
            series.get('colors')?.set('colors', [
                am5.color('#CE9F48'), // Migma Gold
                am5.color('#8B6B32'), // Bronze
                am5.color('#F3E196'), // Pale Gold
                am5.color('#A67C00'), // Darker Gold
                am5.color('#B69146')  // Gold 2
            ]);
        }

        series.labels.template.setAll({
            text: hasData ? '{valuePercentTotal.formatNumber("0.0")}%' : '',
            textType: 'circular',
            inside: true,
            fill: am5.color('#ffffff'),
            fontSize: 10,
            fontWeight: 'bold'
        });

        series.slices.template.setAll({
            tooltipText: hasData ? '{category}: [bold]{value}[/] ({valuePercentTotal.formatNumber("0.0")}%)' : '',
            cornerRadius: 6
        });

        series.data.setAll(chartData);

        // Adicionar Legenda
        const legend = chart.children.push(am5.Legend.new(root, {
            centerX: am5.p50,
            x: am5.p50,
            marginTop: 10,
            marginBottom: 0,
        }));
        
        if (hasData) {
            legend.data.setAll(series.dataItems);
        }
        
        legend.labels.template.setAll({
            fill: am5.color('#ffffff'),
            fontSize: 10,
            maxWidth: 150,
            oversizedBehavior: 'truncate'
        });

        chart.appear(1000, 100);

        return () => {
            if (rootRef.current) rootRef.current.dispose();
        };
    }, [data, filterType]);

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
