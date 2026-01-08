import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ProductMetric } from '@/lib/seller-analytics';
import { Package, TrendingUp } from 'lucide-react';

interface ProductMetricsChartProps {
  data: ProductMetric[];
  chartType?: 'bar' | 'pie';
}

export function ProductMetricsChart({ data }: ProductMetricsChartProps) {

  // Ordenar produtos por receita (maior para menor)
  const sortedData = [...data].sort((a, b) => b.revenue - a.revenue).slice(0, 10);

  if (!data || data.length === 0) {
    return (
      <Card className="bg-black/40 border border-gold-medium/20 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <div className="p-2 bg-gold-medium/20 rounded-lg">
              <Package className="w-5 h-5 text-gold-light" />
            </div>
            Produtos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] sm:h-[300px] flex items-center justify-center text-gray-400">
            <p>Nenhum dado disponível</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalRevenue = data.reduce((sum, p) => sum + p.revenue, 0);

  return (
    <Card className="bg-black/40 border border-gold-medium/20 backdrop-blur-sm hover:border-gold-medium/40 transition-all">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
          <CardTitle className="text-white text-base sm:text-lg flex items-center gap-2">
            <div className="p-1.5 sm:p-2 bg-gold-medium/20 rounded-lg">
              <Package className="w-4 h-4 sm:w-5 sm:h-5 text-gold-light" />
            </div>
            Top Produtos
          </CardTitle>
          <div className="text-left sm:text-right">
            <p className="text-xs text-gray-400">Total Receita</p>
            <p className="text-gold-light font-bold text-base sm:text-lg">
              ${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {sortedData.length === 0 ? (
          <div className="h-[250px] sm:h-[300px] flex items-center justify-center text-gray-400">
            <p>Nenhum produto encontrado</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedData.map((product, index) => (
              <div
                key={index}
                className={`p-3 sm:p-4 rounded-lg border transition-all ${
                  index % 2 === 0
                    ? 'bg-gold-light/5 border-gold-medium/20 hover:bg-gold-light/10'
                    : 'bg-gold-medium/5 border-gold-medium/15 hover:bg-gold-medium/10'
                }`}
              >
                <div className="flex items-start justify-between gap-2 sm:gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold ${
                        index === 0 ? 'bg-gold-light/20 text-gold-light' :
                        index === 1 ? 'bg-gold-medium/20 text-gold-medium' :
                        index === 2 ? 'bg-gold-dark/20 text-gold-dark' :
                        'bg-gray-700/50 text-gray-400'
                      }`}>
                        {index + 1}
                      </div>
                      <h3 className="text-white font-semibold text-xs sm:text-sm truncate">
                        {product.productName}
                      </h3>
                    </div>
                    <div className="ml-8 sm:ml-10 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 text-xs">
                      <div>
                        <p className="text-gray-400 mb-1">Vendas</p>
                        <p className="text-white font-medium">{product.sales}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 mb-1">Receita</p>
                        <p className="text-gold-light font-bold">
                          ${product.revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400 mb-1">Média</p>
                        <p className="text-white font-medium">
                          ${product.avgRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400 mb-1">% do Total</p>
                        <div className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3 text-gold-light" />
                          <p className="text-gold-light font-bold">{product.percentage.toFixed(1)}%</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Barra de progresso visual */}
                <div className="mt-3 ml-8 sm:ml-10">
                  <div className="h-1 sm:h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-gold-light to-gold-medium rounded-full transition-all"
                      style={{ width: `${Math.min(product.percentage, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
