import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import type { AnalyticsData } from '@/lib/seller-analytics';

/**
 * Gera o nome do arquivo baseado no período
 */
export function generateFileName(periodLabel: string): string {
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  // Normalizar o label do período para o nome do arquivo
  const periodSlug = periodLabel
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  
  return `seller-analytics-${periodSlug}-${dateStr}.xlsx`;
}

/**
 * Formata uma data para exibição no Excel
 */
function formatDateSafely(dateValue: string | Date | null | undefined): string {
  if (!dateValue) return '';
  
  // Se já for uma string no formato YYYY-MM-DD, apenas formatar
  if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateValue)) {
    const [year, month, day] = dateValue.split('T')[0].split('-');
    return `${day}/${month}/${year}`;
  }
  
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('pt-BR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

/**
 * Formata um número de forma segura
 */
function safeNumber(value: any, defaultValue: number = 0): number {
  if (typeof value === 'number' && !isNaN(value) && isFinite(value)) {
    return value;
  }
  return defaultValue;
}

/**
 * Cria o workbook e worksheet com estrutura básica
 */
function createWorkbook(periodLabel: string): {
  workbook: ExcelJS.Workbook;
  worksheet: ExcelJS.Worksheet;
  currentRow: number;
} {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Analytics');
  let currentRow = 1;

  // Adicionar linha de informação do período
  worksheet.mergeCells(1, 1, 1, 10);
  const periodCell = worksheet.getCell(1, 1);
  periodCell.value = `Período: ${periodLabel}`;
  periodCell.font = { bold: true, size: 12, color: { argb: 'FF000000' } };
  periodCell.alignment = { horizontal: 'left', vertical: 'middle' };
  periodCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF0F0F0' }
  };

  currentRow = 3; // Pular linha 2 (vazia)

  return { workbook, worksheet, currentRow };
}

/**
 * Adiciona seção de Resumo Executivo
 */
function addSummarySection(
  worksheet: ExcelJS.Worksheet,
  startRow: number,
  summary: AnalyticsData['summary']
): number {
  let currentRow = startRow;

  // Cabeçalho da seção
  worksheet.mergeCells(currentRow, 1, currentRow, 2);
  const sectionHeader = worksheet.getCell(currentRow, 1);
  sectionHeader.value = 'RESUMO EXECUTIVO';
  sectionHeader.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
  sectionHeader.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' }
  };
  sectionHeader.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  sectionHeader.border = {
    top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
    bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
    left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
    right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
  };
  worksheet.getRow(currentRow).height = 25;

  currentRow++;

  // Cabeçalhos das colunas
  const headers = ['Métrica', 'Valor'];
  headers.forEach((header, index) => {
    const cell = worksheet.getCell(currentRow, index + 1);
    cell.value = header;
    cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
    };
  });
  worksheet.getRow(currentRow).height = 25;

  currentRow++;

  // Dados do resumo
  const summaryData = [
    { label: 'Total Revenue', value: summary.totalRevenue, format: 'currency' },
    { label: 'Total Sales', value: summary.totalSales, format: 'number' },
    { label: 'Completed Orders', value: summary.completedOrders, format: 'number' },
    { label: 'Pending Orders', value: summary.pendingOrders, format: 'number' },
    { label: 'Commission', value: summary.commission, format: 'currency' }
  ];

  summaryData.forEach((item) => {
    const metricCell = worksheet.getCell(currentRow, 1);
    const valueCell = worksheet.getCell(currentRow, 2);

    metricCell.value = item.label;
    metricCell.font = { size: 11 };
    metricCell.alignment = { horizontal: 'left', vertical: 'middle' };
    metricCell.border = {
      top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
    };

    if (item.format === 'currency') {
      valueCell.value = safeNumber(item.value);
      valueCell.numFmt = '$#,##0.00';
    } else {
      valueCell.value = safeNumber(item.value);
      valueCell.numFmt = '#,##0';
    }
    valueCell.font = { size: 11 };
    valueCell.alignment = { horizontal: 'right', vertical: 'middle' };
    valueCell.border = {
      top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
    };

    currentRow++;
  });

  // Definir larguras das colunas
  worksheet.getColumn(1).width = 30;
  worksheet.getColumn(2).width = 25;

  return currentRow + 1; // Retornar próxima linha (com espaço)
}

/**
 * Adiciona seção de Dados Históricos
 */
function addHistoricalDataSection(
  worksheet: ExcelJS.Worksheet,
  startRow: number,
  chartData: AnalyticsData['chartData']
): number {
  let currentRow = startRow;

  // Cabeçalho da seção
  worksheet.mergeCells(currentRow, 1, currentRow, 4);
  const sectionHeader = worksheet.getCell(currentRow, 1);
  sectionHeader.value = 'DADOS HISTÓRICOS';
  sectionHeader.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
  sectionHeader.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' }
  };
  sectionHeader.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  sectionHeader.border = {
    top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
    bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
    left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
    right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
  };
  worksheet.getRow(currentRow).height = 25;

  currentRow++;

  // Cabeçalhos das colunas
  const headers = ['Data', 'Receita', 'Contratos', 'Comissão'];
  headers.forEach((header, index) => {
    const cell = worksheet.getCell(currentRow, index + 1);
    cell.value = header;
    cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
    };
  });
  worksheet.getRow(currentRow).height = 25;

  currentRow++;

  // Dados históricos
  chartData.forEach((point) => {
    const dateCell = worksheet.getCell(currentRow, 1);
    const revenueCell = worksheet.getCell(currentRow, 2);
    const contractsCell = worksheet.getCell(currentRow, 3);
    const commissionCell = worksheet.getCell(currentRow, 4);

    dateCell.value = formatDateSafely(point.date);
    dateCell.font = { size: 11 };
    dateCell.alignment = { horizontal: 'left', vertical: 'middle' };
    dateCell.border = {
      top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
    };

    revenueCell.value = safeNumber(point.revenue);
    revenueCell.numFmt = '$#,##0.00';
    revenueCell.font = { size: 11 };
    revenueCell.alignment = { horizontal: 'right', vertical: 'middle' };
    revenueCell.border = {
      top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
    };

    contractsCell.value = safeNumber(point.contracts);
    contractsCell.numFmt = '#,##0';
    contractsCell.font = { size: 11 };
    contractsCell.alignment = { horizontal: 'right', vertical: 'middle' };
    contractsCell.border = {
      top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
    };

    commissionCell.value = safeNumber(point.commission);
    commissionCell.numFmt = '$#,##0.00';
    commissionCell.font = { size: 11 };
    commissionCell.alignment = { horizontal: 'right', vertical: 'middle' };
    commissionCell.border = {
      top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
    };

    currentRow++;
  });

  // Definir larguras das colunas
  worksheet.getColumn(1).width = 15;
  worksheet.getColumn(2).width = 20;
  worksheet.getColumn(3).width = 15;
  worksheet.getColumn(4).width = 20;

  return currentRow + 1; // Retornar próxima linha (com espaço)
}

/**
 * Adiciona seção de Métricas por Produto
 */
function addProductMetricsSection(
  worksheet: ExcelJS.Worksheet,
  startRow: number,
  productMetrics: AnalyticsData['productMetrics']
): number {
  let currentRow = startRow;

  // Cabeçalho da seção
  worksheet.mergeCells(currentRow, 1, currentRow, 5);
  const sectionHeader = worksheet.getCell(currentRow, 1);
  sectionHeader.value = 'MÉTRICAS POR PRODUTO';
  sectionHeader.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
  sectionHeader.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' }
  };
  sectionHeader.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  sectionHeader.border = {
    top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
    bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
    left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
    right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
  };
  worksheet.getRow(currentRow).height = 25;

  currentRow++;

  // Cabeçalhos das colunas
  const headers = ['Produto', 'Vendas', 'Receita', 'Receita Média', 'Porcentagem'];
  headers.forEach((header, index) => {
    const cell = worksheet.getCell(currentRow, index + 1);
    cell.value = header;
    cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
    };
  });
  worksheet.getRow(currentRow).height = 25;

  currentRow++;

  // Dados de produtos
  productMetrics.forEach((product) => {
    const productCell = worksheet.getCell(currentRow, 1);
    const salesCell = worksheet.getCell(currentRow, 2);
    const revenueCell = worksheet.getCell(currentRow, 3);
    const avgRevenueCell = worksheet.getCell(currentRow, 4);
    const percentageCell = worksheet.getCell(currentRow, 5);

    productCell.value = product.productName;
    productCell.font = { size: 11 };
    productCell.alignment = { horizontal: 'left', vertical: 'middle' };
    productCell.border = {
      top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
    };

    salesCell.value = safeNumber(product.sales);
    salesCell.numFmt = '#,##0';
    salesCell.font = { size: 11 };
    salesCell.alignment = { horizontal: 'right', vertical: 'middle' };
    salesCell.border = {
      top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
    };

    revenueCell.value = safeNumber(product.revenue);
    revenueCell.numFmt = '$#,##0.00';
    revenueCell.font = { size: 11 };
    revenueCell.alignment = { horizontal: 'right', vertical: 'middle' };
    revenueCell.border = {
      top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
    };

    avgRevenueCell.value = safeNumber(product.avgRevenue);
    avgRevenueCell.numFmt = '$#,##0.00';
    avgRevenueCell.font = { size: 11 };
    avgRevenueCell.alignment = { horizontal: 'right', vertical: 'middle' };
    avgRevenueCell.border = {
      top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
    };

    percentageCell.value = safeNumber(product.percentage);
    percentageCell.numFmt = '0.00%';
    percentageCell.font = { size: 11 };
    percentageCell.alignment = { horizontal: 'right', vertical: 'middle' };
    percentageCell.border = {
      top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
    };

    currentRow++;
  });

  // Definir larguras das colunas
  worksheet.getColumn(1).width = 40;
  worksheet.getColumn(2).width = 15;
  worksheet.getColumn(3).width = 20;
  worksheet.getColumn(4).width = 20;
  worksheet.getColumn(5).width = 15;

  return currentRow + 1; // Retornar próxima linha (com espaço)
}

/**
 * Adiciona seção de Comparação (se disponível)
 */
function addComparisonSection(
  worksheet: ExcelJS.Worksheet,
  startRow: number,
  comparison: AnalyticsData['comparison']
): number {
  if (!comparison) {
    return startRow;
  }

  let currentRow = startRow;

  // Cabeçalho da seção
  worksheet.mergeCells(currentRow, 1, currentRow, 2);
  const sectionHeader = worksheet.getCell(currentRow, 1);
  sectionHeader.value = 'COMPARAÇÃO COM PERÍODO ANTERIOR';
  sectionHeader.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
  sectionHeader.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' }
  };
  sectionHeader.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  sectionHeader.border = {
    top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
    bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
    left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
    right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
  };
  worksheet.getRow(currentRow).height = 25;

  currentRow++;

  // Cabeçalhos das colunas
  const headers = ['Métrica', 'Mudança %'];
  headers.forEach((header, index) => {
    const cell = worksheet.getCell(currentRow, index + 1);
    cell.value = header;
    cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
    };
  });
  worksheet.getRow(currentRow).height = 25;

  currentRow++;

  // Dados de comparação
  const comparisonData = [
    { label: 'Revenue Change', value: comparison.revenueChange },
    { label: 'Sales Change', value: comparison.salesChange },
    { label: 'Completed Orders Change', value: comparison.completedOrdersChange },
    { label: 'Commission Change', value: comparison.commissionChange }
  ];

  comparisonData.forEach((item) => {
    const metricCell = worksheet.getCell(currentRow, 1);
    const changeCell = worksheet.getCell(currentRow, 2);

    metricCell.value = item.label;
    metricCell.font = { size: 11 };
    metricCell.alignment = { horizontal: 'left', vertical: 'middle' };
    metricCell.border = {
      top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
    };

    changeCell.value = safeNumber(item.value) / 100; // Converter para decimal para formato de porcentagem
    changeCell.numFmt = '0.00%';
    changeCell.font = { size: 11 };
    changeCell.alignment = { horizontal: 'right', vertical: 'middle' };
    changeCell.border = {
      top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
    };

    // Formatação condicional de cores (verde para positivo, vermelho para negativo)
    if (safeNumber(item.value) > 0) {
      changeCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFC6EFCE' } // Verde claro
      };
    } else if (safeNumber(item.value) < 0) {
      changeCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFC7CE' } // Vermelho claro
      };
    }

    currentRow++;
  });

  // Definir larguras das colunas
  worksheet.getColumn(1).width = 30;
  worksheet.getColumn(2).width = 20;

  return currentRow;
}

/**
 * Aplica formatação final na planilha
 */
function formatWorksheet(worksheet: ExcelJS.Worksheet): void {
  // Congelar primeira linha de dados (após período)
  worksheet.views = [
    {
      state: 'frozen',
      ySplit: 2 // Congelar até a linha 2 (após período)
    }
  ];

  // Aplicar filtros automáticos nas seções principais
  // (ExcelJS aplica filtros automaticamente quando há cabeçalhos formatados)
}

/**
 * Função principal de exportação
 */
export async function exportSellerAnalytics(
  analyticsData: AnalyticsData,
  periodLabel: string
): Promise<void> {
  try {
    // Validações
    if (!analyticsData) {
      throw new Error('Dados de analytics não disponíveis');
    }

    if (!analyticsData.chartData || analyticsData.chartData.length === 0) {
      throw new Error('Não há dados para exportar');
    }

    // Gerar nome do arquivo
    const fileName = generateFileName(periodLabel);

    // Criar workbook
    const { workbook, worksheet, currentRow } = createWorkbook(periodLabel);

    // Adicionar seções
    let nextRow = addSummarySection(worksheet, currentRow, analyticsData.summary);
    nextRow = addHistoricalDataSection(worksheet, nextRow, analyticsData.chartData);
    nextRow = addProductMetricsSection(worksheet, nextRow, analyticsData.productMetrics);
    
    // Adicionar comparação se disponível
    if (analyticsData.comparison) {
      addComparisonSection(worksheet, nextRow, analyticsData.comparison);
    }

    // Aplicar formatação final
    formatWorksheet(worksheet);

    // Gerar buffer e fazer download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    saveAs(blob, fileName);
  } catch (error) {
    console.error('[SellerAnalyticsExport] Error exporting:', error);
    throw error;
  }
}

