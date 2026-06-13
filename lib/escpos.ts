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
    SEPARATOR_58: '--------------------------------\n',   // 32 chars for 58mm (max)
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
    paymentMethods?: { method: string; amount: number }[];
    deposits?: { date: Date; paymentMethod: string; amount: number }[];
    staffAssignments?: { name: string; tip?: number }[];
    tips?: number;
    loyaltyPointsUsed?: number;
    loyaltyPointsEarned?: number;
    receiptFooter?: string;
    paperWidth?: 58 | 80; // mm
    isAppointment?: boolean;
    qrUrl?: string;
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
    buffer += `${data.storeName}\n`;
    buffer += Commands.BOLD_OFF;
    if (data.address) buffer += `${data.address}\n`;
    if (data.phone) buffer += `${data.phone}\n`;
    buffer += separator;

    // TAX RECEIPT Header
    buffer += Commands.BOLD_ON;
    buffer += `TAX RECEIPT\n`;
    buffer += Commands.BOLD_OFF;
    buffer += separator;

    // Invoice Info
    buffer += Commands.LEFT;
    buffer += `No      : ${data.invoiceNumber}\n`;
    buffer += `Tanggal : ${formatDate(data.date)}\n`;
    buffer += `Kasir   : ${data.staffName}\n`;
    if (data.customerName) buffer += `Customer: ${data.customerName}\n`;
    if (data.isAppointment) buffer += `Type    : APPOINTMENT\n`;
    buffer += separator;

    // Items Header
    // Column widths for 80mm (46 chars): ITEM (21) + QTY (5) + PRICE (10) + TOTAL (10)
    // Column widths for 58mm (32 chars): ITEM (11) + QTY (4) + PRICE (8) + TOTAL (9)
    if (data.paperWidth === 80) {
        buffer += `ITEM                  QTY  PRICE     TOTAL\n\n`;
    } else {
        buffer += `ITEM       QTY PRICE    TOTAL\n\n`;
    }

    // Items
    for (const item of data.items) {
        const qtyStr = String(item.quantity);
        // Remove 'Rp' and format with thousand separators
        const priceStr = (item.price || 0).toLocaleString('id-ID');
        const totalStr = (item.total || 0).toLocaleString('id-ID');
        
        let itemName = item.name;
        
        if (data.paperWidth === 80) {
            // Layout for 80mm
            itemName = padRight(itemName, 21);
            const qtyPadded = padLeft(qtyStr, 3);
            const pricePadded = padLeft(priceStr, 9);
            const totalPadded = padLeft(totalStr, 10);
            buffer += `${itemName} ${qtyPadded} ${pricePadded} ${totalPadded}\n`;
        } else {
            // Layout for 58mm (max 32 chars)
            itemName = padRight(itemName, 10);
            const qtyPadded = padLeft(qtyStr, 3);
            const pricePadded = padLeft(priceStr, 8);
            const totalPadded = padLeft(totalStr, 9);
            buffer += `${itemName} ${qtyPadded} ${pricePadded} ${totalPadded}\n`;
        }

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

    buffer += `${padRight('Bayar', labelWidth)}${padLeft(formatCurrencyShort(data.amountPaid), 14)}\n`;

    const change = Math.max(0, data.amountPaid - data.totalAmount);
    buffer += `${padRight('Kembali', labelWidth)}${padLeft(formatCurrencyShort(change), 14)}\n`;

    const due = Math.max(0, data.totalAmount - data.amountPaid);
    if (due > 0) {
        buffer += `${padRight('Sisa Tagihan', labelWidth)}${padLeft(formatCurrencyShort(due), 14)}\n`;
    }

    // Loyalty info
    if (data.loyaltyPointsUsed && data.loyaltyPointsUsed > 0) {
        buffer += `${padRight('Poin Dipakai', labelWidth)}${padLeft(String(data.loyaltyPointsUsed), 14)}\n`;
    }
    if (data.loyaltyPointsEarned && data.loyaltyPointsEarned > 0) {
        buffer += `${padRight('Poin Didapat', labelWidth)}${padLeft('+' + String(data.loyaltyPointsEarned), 14)}\n`;
    }

    buffer += separator;
    
    // Staff Assignments
    if (data.staffAssignments && data.staffAssignments.length > 0) {
        buffer += `Dilayani oleh:\n`;
        for (const sa of data.staffAssignments) {
            let line = `  ${sa.name}`;
            if (sa.tip && sa.tip > 0) line += ` (tip: ${formatCurrencyShort(sa.tip)})`;
            buffer += `${line}\n`;
        }
        buffer += separator;
    }

    // Payment Method(s)
    buffer += Commands.LEFT;
    if (data.paymentMethods && data.paymentMethods.length > 1) {
        buffer += `Metode Bayar: MULTIPLE\n`;
        for (const pm of data.paymentMethods) {
            buffer += `  ${padRight(pm.method, labelWidth - 2)}${padLeft(formatCurrencyShort(pm.amount), 14)}\n`;
        }
    } else {
        buffer += `Metode Bayar: ${data.paymentMethod}\n`;
    }
    buffer += separator;

    // Footer
    buffer += Commands.CENTER;
    if (data.receiptFooter) {
        buffer += `${data.receiptFooter}\n`;
    } else {
        buffer += `Terima kasih telah berkunjung\n`;
        buffer += `di ${data.storeName}\n`;
    }
    buffer += separator;

    // Small payment history summary at the end
    if (data.deposits && data.deposits.length > 0) {
        const lastDep = data.deposits[data.deposits.length - 1];
        const depDate = formatDate(lastDep.date);
        buffer += `${depDate} ${lastDep.paymentMethod}\n`;
    } else {
        buffer += `${formatDate(data.date)} ${data.paymentMethod}\n`;
    }
    
    // Add QR Code if qrUrl is provided
    if (data.qrUrl) {
        buffer += Commands.CENTER;
        buffer += `\nNota Digital:\n`;
        
        // QR Code ESC/POS commands
        const qrData = data.qrUrl;
        const storeLen = qrData.length + 3;
        const pL = storeLen & 0xFF;
        const pH = (storeLen >> 8) & 0xFF;

        // 1. Set QR model to 2 (GS ( k 4 0 49 65 50 0)
        buffer += `${GS}(k\x04\x00\x31\x41\x32\x00`;
        // 2. Set QR module size to 4 (GS ( k 3 0 49 67 4)
        buffer += `${GS}(k\x03\x00\x31\x43\x04`;
        // 3. Set QR error correction to L (GS ( k 3 0 49 69 48)
        buffer += `${GS}(k\x03\x00\x31\x45\x30`;
        // 4. Store QR data (GS ( k pL pH 49 80 48 [data])
        buffer += `${GS}(k${String.fromCharCode(pL)}${String.fromCharCode(pH)}\x31\x50\x30${qrData}`;
        // 5. Print QR code (GS ( k 3 0 49 81 48)
        buffer += `${GS}(k\x03\x00\x31\x51\x30`;
        
        buffer += `\n`;
    }
    
    buffer += `\nPowered by Iseo POS\n`;

    // Feed and cut
    buffer += Commands.FEED_5;
    buffer += Commands.PARTIAL_CUT;

    return buffer;
}
