/**
 * ESC/POS Command Builder for Thermal Printing
 * Builds raw ESC/POS binary data for 58mm/80mm thermal printers
 */

export const ESC = '\x1B';
export const GS = '\x1D';
export const LF = '\x0A';

export const Commands = {
    INIT: `${ESC}@`,              // Initialize printer
    CENTER: `${ESC}a\x01`,       // Center align
    LEFT: `${ESC}a\x00`,         // Left align
    RIGHT: `${ESC}a\x02`,        // Right align
    BOLD_ON: `${ESC}E\x01`,      // Bold on
    BOLD_OFF: `${ESC}E\x00`,     // Bold off
    DOUBLE_HEIGHT: `${ESC}!\x10`, // Double height
    DOUBLE_WIDTH: `${ESC}!\x20`,  // Double width
    DOUBLE_BOTH: `${ESC}!\x30`,   // Double height + width
    NORMAL_SIZE: `${ESC}!\x00`,   // Normal size
    UNDERLINE_ON: `${ESC}-\x01`,  // Underline on
    UNDERLINE_OFF: `${ESC}-\x00`, // Underline off
    SEPARATOR_58: '------------------------------\n',   // 30 chars for 58mm
    SEPARATOR_80: '----------------------------------------------\n', // 46 chars for 80mm
    FEED_1: `${ESC}d\x01`,       // Feed 1 line
    FEED_2: `${ESC}d\x02`,       // Feed 2 lines
    FEED_3: `${ESC}d\x03`,       // Feed 3 lines
    FEED_5: `${ESC}d\x05`,       // Feed 5 lines
    PARTIAL_CUT: `${GS}V\x01`,   // Partial cut
    FULL_CUT: `${GS}V\x00`,      // Full cut
};

function formatCurrencyShort(amount: number): string {
    return `Rp${(amount || 0).toLocaleString('id-ID')}`;
}

function padRight(text: string, width: number): string {
    return text.length >= width ? text.substring(0, width) : text + ' '.repeat(width - text.length);
}

function padLeft(text: string, width: number): string {
    return text.length >= width ? text.substring(0, width) : ' '.repeat(width - text.length) + text;
}

function formatDate(date: Date): string {
    const d = new Date(date);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yy} ${hh}:${mi}`;
}

export interface ThermalReceiptData {
    storeName: string;
    address?: string;
    phone?: string;
    invoiceNumber: string;
    date: Date;
    staffName: string;
    customerName?: string;
    items: {
        name: string;
        quantity: number;
        price: number;
        discount: number;
        total: number;
    }[];
    subtotal: number;
    discount: number;
    tax: number;
    totalAmount: number;
    amountPaid: number;
    paymentMethod: string;
    tips?: number;
    loyaltyPointsUsed?: number;
    loyaltyPointsEarned?: number;
    receiptFooter?: string;
    paperWidth?: 58 | 80; // mm
}

export function buildReceiptBuffer(data: ThermalReceiptData): string {
    const width = data.paperWidth === 80 ? 46 : 30; // character width
    const separator = data.paperWidth === 80 ? Commands.SEPARATOR_80 : Commands.SEPARATOR_58;
    let buffer = '';

    // Initialize
    buffer += Commands.INIT;

    // Store Header
    buffer += Commands.CENTER;
    buffer += Commands.BOLD_ON;
    buffer += Commands.DOUBLE_HEIGHT;
    buffer += `${data.storeName}\n`;
    buffer += Commands.NORMAL_SIZE;
    buffer += Commands.BOLD_OFF;
    if (data.address) buffer += `${data.address}\n`;
    if (data.phone) buffer += `${data.phone}\n`;
    buffer += separator;

    // Invoice Info
    buffer += Commands.LEFT;
    buffer += `No   : ${data.invoiceNumber}\n`;
    buffer += `Tgl  : ${formatDate(data.date)}\n`;
    buffer += `Staff: ${data.staffName}\n`;
    if (data.customerName) buffer += `Cust : ${data.customerName}\n`;
    buffer += separator;

    // Items
    for (const item of data.items) {
        buffer += `${item.name}\n`;
        const qtyPrice = `  ${item.quantity} x ${formatCurrencyShort(item.price)}`;
        const totalStr = formatCurrencyShort(item.total);
        const spaces = Math.max(1, width - qtyPrice.length - totalStr.length);
        buffer += `${qtyPrice}${' '.repeat(spaces)}${totalStr}\n`;

        if (item.discount > 0) {
            buffer += `  Diskon: -${formatCurrencyShort(item.discount)}\n`;
        }
    }

    buffer += separator;

    // Totals
    const labelWidth = width - 14;

    buffer += `${padRight('Subtotal', labelWidth)}${padLeft(formatCurrencyShort(data.subtotal), 14)}\n`;

    if (data.discount > 0) {
        buffer += `${padRight('Diskon', labelWidth)}${padLeft('-' + formatCurrencyShort(data.discount), 14)}\n`;
    }

    if (data.tax > 0) {
        buffer += `${padRight('Pajak', labelWidth)}${padLeft(formatCurrencyShort(data.tax), 14)}\n`;
    }

    if (data.tips && data.tips > 0) {
        buffer += `${padRight('Tips', labelWidth)}${padLeft(formatCurrencyShort(data.tips), 14)}\n`;
    }

    buffer += Commands.BOLD_ON;
    buffer += `${padRight('TOTAL', labelWidth)}${padLeft(formatCurrencyShort(data.totalAmount), 14)}\n`;
    buffer += Commands.BOLD_OFF;

    buffer += `${padRight('Bayar (' + data.paymentMethod + ')', labelWidth)}${padLeft(formatCurrencyShort(data.amountPaid), 14)}\n`;

    const change = Math.max(0, data.amountPaid - data.totalAmount);
    buffer += `${padRight('Kembali', labelWidth)}${padLeft(formatCurrencyShort(change), 14)}\n`;

    // Loyalty info
    if (data.loyaltyPointsUsed && data.loyaltyPointsUsed > 0) {
        buffer += `${padRight('Poin Dipakai', labelWidth)}${padLeft(String(data.loyaltyPointsUsed), 14)}\n`;
    }
    if (data.loyaltyPointsEarned && data.loyaltyPointsEarned > 0) {
        buffer += `${padRight('Poin Didapat', labelWidth)}${padLeft('+' + String(data.loyaltyPointsEarned), 14)}\n`;
    }

    buffer += separator;

    // Footer
    buffer += Commands.CENTER;
    if (data.receiptFooter) {
        buffer += `${data.receiptFooter}\n`;
    }

    // Feed and cut
    buffer += Commands.FEED_5;
    buffer += Commands.PARTIAL_CUT;

    return buffer;
}
