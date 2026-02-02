import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';

interface IdleGap {
    start: Date;
    end: Date;
    minutes: number;
}

interface UserIdleData {
    userId: string;
    userName: string;
    gapsCount: number;
    totalMinutes: number;
    totalHoursFormatted: string;
    gaps: IdleGap[];
}

interface DailyIdleData {
    date: Date;
    users: UserIdleData[];
}

export async function exportIdleDataToExcel(data: DailyIdleData[], periodDays: number): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Idle Report');

    // --- Estilos ---
    const headerFill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD4AF37' } // Gold (Migma theme)
    };

    const subHeaderFill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2D3748' } // Dark gray
    };

    const headerFont = {
        bold: true,
        color: { argb: 'FF000000' }, // Black on gold
        size: 11
    };

    const warningFill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFC7CE' } // Light red for high idle time
    };

    const borderStyle = {
        top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
    };

    const centerAlign = { horizontal: 'center', vertical: 'middle' };
    const leftAlign = { horizontal: 'left', vertical: 'middle' };

    // --- Título do Relatório ---
    worksheet.mergeCells('A1:G1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `SLACK IDLE TIME REPORT (${periodDays} DAYS)`;
    titleCell.font = { bold: true, size: 14, color: { argb: 'FF000000' } };
    titleCell.fill = headerFill as any;
    titleCell.alignment = centerAlign as any;

    // Subtítulo com período
    worksheet.mergeCells('A2:G2');
    const subtitleCell = worksheet.getCell('A2');
    const startDate = data[data.length - 1]?.date || new Date();
    const endDate = data[0]?.date || new Date();
    subtitleCell.value = `Period: ${format(startDate, 'MM/dd/yyyy')} - ${format(endDate, 'MM/dd/yyyy')}`;
    subtitleCell.font = { italic: true, size: 10, color: { argb: 'FF666666' } };
    subtitleCell.alignment = centerAlign as any;

    let currentRowIdx = 4;

    // --- Para cada dia ---
    data.forEach((day, dayIndex) => {
        // Cabeçalho do Dia
        worksheet.mergeCells(`A${currentRowIdx}:G${currentRowIdx}`);
        const dayHeaderCell = worksheet.getCell(`A${currentRowIdx}`);
        dayHeaderCell.value = `📅 ${format(day.date, 'EEEE, dd/MM/yyyy')}`;
        dayHeaderCell.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
        dayHeaderCell.fill = subHeaderFill as any;
        dayHeaderCell.alignment = leftAlign as any;
        currentRowIdx++;

        // Cabeçalhos da Tabela
        const headers = [
            'User Name',
            'User ID',
            'Number of Breaks',
            'Total Time (h)',
            'Total Time (min)',
            'Longest Break (min)',
            'Alert'
        ];

        const headerRow = worksheet.getRow(currentRowIdx);
        headerRow.values = headers;
        headerRow.height = 20;

        headerRow.eachCell((cell: any) => {
            cell.fill = headerFill as any;
            cell.font = headerFont;
            cell.alignment = centerAlign as any;
            cell.border = borderStyle as any;
        });
        currentRowIdx++;

        // Dados dos Usuários daquele dia
        if (day.users.length === 0) {
            const emptyRow = worksheet.getRow(currentRowIdx);
            worksheet.mergeCells(`A${currentRowIdx}:G${currentRowIdx}`);
            const emptyCell = emptyRow.getCell(1);
            emptyCell.value = 'No idle periods recorded on this day';
            emptyCell.alignment = centerAlign as any;
            emptyCell.font = { italic: true, color: { argb: 'FF999999' } };
            emptyCell.border = borderStyle as any;
            currentRowIdx++;
        } else {
            day.users.forEach(user => {
                const row = worksheet.getRow(currentRowIdx);
                const hours = Math.floor(user.totalMinutes / 60);
                const mins = Math.round(user.totalMinutes % 60);
                const longestGap = Math.max(...user.gaps.map(g => g.minutes));
                const isHighIdle = user.totalMinutes > 480; // More than 8 hours

                row.values = [
                    user.userName,
                    user.userId,
                    user.gapsCount,
                    `${hours}h ${mins}m`,
                    Math.round(user.totalMinutes),
                    Math.round(longestGap),
                    isHighIdle ? '⚠️ HIGH' : 'Normal'
                ];

                // Cell by cell formatting
                const nameCell = row.getCell(1);
                nameCell.alignment = leftAlign as any;
                nameCell.border = borderStyle as any;
                nameCell.font = { bold: true };

                const idCell = row.getCell(2);
                idCell.alignment = centerAlign as any;
                idCell.border = borderStyle as any;
                idCell.font = { color: { argb: 'FF666666' }, size: 9 };

                const gapsCell = row.getCell(3);
                gapsCell.alignment = centerAlign as any;
                gapsCell.border = borderStyle as any;

                const timeFormattedCell = row.getCell(4);
                timeFormattedCell.alignment = centerAlign as any;
                timeFormattedCell.border = borderStyle as any;
                timeFormattedCell.font = { bold: true, color: { argb: 'FFD4AF37' } };

                const timeMinutesCell = row.getCell(5);
                timeMinutesCell.alignment = centerAlign as any;
                timeMinutesCell.border = borderStyle as any;
                timeMinutesCell.numFmt = '#,##0';

                const longestGapCell = row.getCell(6);
                longestGapCell.alignment = centerAlign as any;
                longestGapCell.border = borderStyle as any;
                longestGapCell.numFmt = '#,##0';
                if (longestGap > 120) {
                    longestGapCell.font = { color: { argb: 'FFFF0000' }, bold: true };
                }

                const alertCell = row.getCell(7);
                alertCell.alignment = centerAlign as any;
                alertCell.border = borderStyle as any;
                if (isHighIdle) {
                    alertCell.fill = warningFill as any;
                    alertCell.font = { bold: true, color: { argb: 'FF9C0006' } };
                } else {
                    alertCell.font = { color: { argb: 'FF00B050' } };
                }

                currentRowIdx++;
            });
        }

        // Linha em branco entre dias (exceto no último)
        if (dayIndex < data.length - 1) {
            currentRowIdx++;
        }
    });

    // Adicionar Resumo Geral no final
    currentRowIdx += 2;
    worksheet.mergeCells(`A${currentRowIdx}:G${currentRowIdx}`);
    const summaryTitleCell = worksheet.getCell(`A${currentRowIdx}`);
    summaryTitleCell.value = '📊 OVERALL SUMMARY';
    summaryTitleCell.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    summaryTitleCell.fill = subHeaderFill as any;
    summaryTitleCell.alignment = centerAlign as any;
    currentRowIdx++;

    // Calculate overall statistics
    let totalUsers = new Set<string>();
    let totalGaps = 0;
    let totalMinutes = 0;
    let maxIdleUser = { name: '', minutes: 0 };

    data.forEach(day => {
        day.users.forEach(user => {
            totalUsers.add(user.userId);
            totalGaps += user.gapsCount;
            totalMinutes += user.totalMinutes;
            if (user.totalMinutes > maxIdleUser.minutes) {
                maxIdleUser = { name: user.userName, minutes: user.totalMinutes };
            }
        });
    });

    const summaryData = [
        ['Total Users Analyzed', totalUsers.size],
        ['Total Breaks Recorded', totalGaps],
        ['Total Idle Time', `${Math.floor(totalMinutes / 60)}h ${Math.round(totalMinutes % 60)}m`],
        ['User with Highest Idle Time', `${maxIdleUser.name} (${Math.floor(maxIdleUser.minutes / 60)}h ${Math.round(maxIdleUser.minutes % 60)}m)`],
    ];

    summaryData.forEach(([label, value]) => {
        const row = worksheet.getRow(currentRowIdx);
        row.values = [label, '', '', '', '', '', value];

        const labelCell = row.getCell(1);
        worksheet.mergeCells(`A${currentRowIdx}:F${currentRowIdx}`);
        labelCell.font = { bold: true };
        labelCell.alignment = leftAlign as any;
        labelCell.border = borderStyle as any;

        const valueCell = row.getCell(7);
        valueCell.alignment = centerAlign as any;
        valueCell.border = borderStyle as any;
        valueCell.font = { bold: true, color: { argb: 'FFD4AF37' } };

        currentRowIdx++;
    });

    // --- Column Widths ---
    worksheet.columns = [
        { width: 25 }, // A - Name
        { width: 15 }, // B - User ID
        { width: 20 }, // C - Number of Breaks (aumentado de 12 para 20)
        { width: 20 }, // D - Time (h) (aumentado de 15 para 20)
        { width: 20 }, // E - Time (min) (aumentado de 15 para 20)
        { width: 22 }, // F - Longest Break (aumentado de 15 para 22)
        { width: 18 }, // G - Alert (aumentado de 12 para 18)
    ];

    // --- Generate File ---
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fileName = `slack-idle-${periodDays}days-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    saveAs(blob, fileName);
}
