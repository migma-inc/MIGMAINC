import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// Define the interface locally to match the one in VisaOrdersPage
// Ideally this should be shared, but for now we duplicate to keep it self-contained or import if available.
// We will accept 'any' for the order object to be flexible, but type it loosely.
interface VisaOrder {
    id: string;
    order_number: string;
    product_slug: string;
    seller_id: string | null;
    client_name: string;
    total_price_usd: string;
    payment_status: string;
    payment_method: string;
    payment_metadata?: { fee_amount?: string | number, total_usd?: string | number, final_amount?: string | number } | null;
    created_at: string;
}

const calculateNetAmountAndFee = (order: VisaOrder) => {
    let dbPrice = parseFloat(order.total_price_usd || '0');

    // Fix for total_price_usd being in cents
    if (dbPrice > 10000) {
        dbPrice = dbPrice / 100;
    }

    const metadata = order.payment_metadata as any;
    let feeAmount = 0;
    let totalPrice = dbPrice;
    let netAmount = dbPrice;

    if (order.payment_method === 'parcelow') {
        let paidTotal = dbPrice;

        if (metadata?.total_usd) {
            let val = parseFloat(metadata.total_usd.toString());
            // Divide by 100 if significantly larger than base price (heuristic for cents)
            if (val > (dbPrice * 5) && val > 100) val = val / 100;
            if (val > 0) paidTotal = val;
        } else if (metadata?.final_amount) {
            let val = parseFloat(metadata.final_amount.toString());
            if (val > (dbPrice * 5) && val > 100) val = val / 100;
            if (val > 0) paidTotal = val;
        }

        totalPrice = paidTotal;
        netAmount = dbPrice;
        feeAmount = Math.max(totalPrice - netAmount, 0);
    } else {
        totalPrice = dbPrice;
        if (metadata?.fee_amount) {
            let val = parseFloat(metadata.fee_amount.toString());
            // Fee is rarely more than the total, divide by 100 if suspiciously high
            if (val > (totalPrice / 2) && val > 100) val = val / 100;
            feeAmount = val;
        }
        netAmount = totalPrice - feeAmount;
    }

    return {
        netAmount: Math.max(netAmount, 0),
        feeAmount: feeAmount,
        totalPrice: totalPrice
    };
};

export async function exportVisaOrdersToExcel(orders: VisaOrder[]): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Relatório Financeiro');

    // --- Estilos ---
    const headerFill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' } // Azul padrão do Excel/Seller Analytics
    };

    const headerFont = {
        bold: true,
        color: { argb: 'FFFFFFFF' }, // Branco
        size: 11
    };

    const borderStyle = {
        top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
    };

    const centerAlign = { horizontal: 'center', vertical: 'middle' };
    const leftAlign = { horizontal: 'left', vertical: 'middle' };
    const rightAlign = { horizontal: 'right', vertical: 'middle' };

    // --- Título do Relatório ---
    worksheet.mergeCells('A1:H1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'RELATÓRIO FINANCEIRO DE PEDIDOS';
    titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = headerFill as any;
    titleCell.alignment = centerAlign as any;

    // Pular uma linha

    // --- Cabeçalhos das Colunas ---
    const headers = [
        'Data do Pagamento',
        'Status', // Nova Coluna
        'Nome do Cliente',
        'Tipo de Serviço',
        'Valor Bruto',
        'Taxa (Fee)',
        'Valor Líquido',
        'Vendedor Responsável'
    ];

    const headerRow = worksheet.getRow(3);
    headerRow.values = headers;
    headerRow.height = 25;

    headerRow.eachCell((cell: any) => {
        cell.fill = headerFill as any;
        cell.font = headerFont;
        cell.alignment = centerAlign as any;
        cell.border = borderStyle as any;
    });

    // --- Dados ---
    let currentRowIdx = 4;

    orders.forEach(order => {
        const { netAmount, feeAmount, totalPrice } = calculateNetAmountAndFee(order);
        const row = worksheet.getRow(currentRowIdx);

        // Preparar dados
        const dateValue = new Date(order.created_at);

        // Traduzir status se necessário, ou usar direto
        const status = order.payment_status === 'completed' ? 'Pago' :
            order.payment_status === 'pending' ? 'Pendente' :
                order.payment_status;

        row.values = [
            dateValue,              // Data
            status,                 // Status
            order.client_name,      // Cliente
            order.product_slug,     // Serviço
            totalPrice,             // Valor Bruto (Gross)
            feeAmount,              // Taxa (Fee)
            netAmount,              // Líquido (Net)
            order.seller_id || 'N/A' // Vendedor
        ];

        // Formatação Célula a Célula
        const dateCell = row.getCell(1);
        dateCell.numFmt = 'dd/mm/yyyy';
        dateCell.alignment = centerAlign as any;
        dateCell.border = borderStyle as any;

        const statusCell = row.getCell(2);
        statusCell.alignment = centerAlign as any;
        statusCell.border = borderStyle as any;
        // Cor condicional para status
        if (order.payment_status === 'completed') {
            statusCell.font = { color: { argb: 'FF00B050' }, bold: true }; // Verde
        } else if (order.payment_status === 'pending') {
            statusCell.font = { color: { argb: 'FFFFA500' }, bold: true }; // Laranja
        }

        const clientCell = row.getCell(3);
        clientCell.alignment = leftAlign as any;
        clientCell.border = borderStyle as any;

        const productCell = row.getCell(4);
        productCell.alignment = leftAlign as any;
        productCell.border = borderStyle as any;

        const grossCell = row.getCell(5);
        grossCell.numFmt = '$#,##0.00';
        grossCell.alignment = rightAlign as any;
        grossCell.border = borderStyle as any;

        const feeCell = row.getCell(6);
        feeCell.numFmt = '$#,##0.00';
        feeCell.font = { color: { argb: 'FFFF0000' } }; // Vermelho para taxas
        feeCell.alignment = rightAlign as any;
        feeCell.border = borderStyle as any;

        const netCell = row.getCell(7);
        netCell.numFmt = '$#,##0.00';
        netCell.font = { bold: true, color: { argb: 'FF000000' } };
        netCell.alignment = rightAlign as any;
        netCell.border = borderStyle as any;

        const sellerCell = row.getCell(8);
        sellerCell.alignment = centerAlign as any;
        sellerCell.border = borderStyle as any;

        currentRowIdx++;
    });

    // --- Largura das Colunas ---
    worksheet.columns = [
        { width: 15 }, // Data
        { width: 15 }, // Status
        { width: 30 }, // Cliente
        { width: 25 }, // Serviço
        { width: 15 }, // Valor Bruto
        { width: 15 }, // Taxa
        { width: 15 }, // Valor Líquido
        { width: 25 }, // Vendedor
    ];

    // --- Gerar Arquivo ---
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fileName = `financeiro-visa-orders-${new Date().toISOString().split('T')[0]}.xlsx`;
    saveAs(blob, fileName);
}
