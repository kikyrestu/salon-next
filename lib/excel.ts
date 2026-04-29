/**
 * lib/excel.ts
 * ─────────────────────────────────────────────
 * Shared Excel template definitions, generator & parser.
 * Uses the `xlsx` (SheetJS) package already installed.
 */

import * as XLSX from 'xlsx';

/* ------------------------------------------------------------------ */
/*  Column schema per entity                                           */
/* ------------------------------------------------------------------ */

export interface ExcelColumn {
    header: string;       // Column header shown in template
    key: string;          // Field name in the database model
    required?: boolean;
    type?: 'string' | 'number' | 'date' | 'boolean' | 'enum';
    enumValues?: string[];
    example?: string;
    description?: string; // Shown in instruction sheet
}

export type EntityType =
    | 'services'
    | 'products'
    | 'customers'
    | 'staff'
    | 'suppliers'
    | 'service-categories'
    | 'expenses'
    | 'vouchers';

export const ENTITY_LABEL: Record<EntityType, string> = {
    services: 'Services',
    products: 'Products',
    customers: 'Customers',
    staff: 'Staff',
    suppliers: 'Suppliers',
    'service-categories': 'Service Categories',
    expenses: 'Expenses',
    vouchers: 'Vouchers',
};

/* ---------- Service ---------- */
export const SERVICE_COLUMNS: ExcelColumn[] = [
    { header: 'Name', key: 'name', required: true, type: 'string', example: 'Hair Cut Premium' },
    { header: 'Category', key: 'categoryName', required: true, type: 'string', example: 'Hair Care', description: 'Category name — will auto-create if not found' },
    { header: 'Description', key: 'description', type: 'string', example: 'Premium hair cutting service' },
    { header: 'Duration (minutes)', key: 'duration', required: true, type: 'number', example: '60' },
    { header: 'Price', key: 'price', required: true, type: 'number', example: '150000' },
    { header: 'Member Price', key: 'memberPrice', type: 'number', example: '120000' },
    { header: 'Gender', key: 'gender', type: 'enum', enumValues: ['male', 'female', 'unisex'], example: 'unisex' },
    { header: 'Commission Type', key: 'commissionType', type: 'enum', enumValues: ['percentage', 'fixed'], example: 'fixed' },
    { header: 'Commission Value', key: 'commissionValue', type: 'number', example: '15000' },
];

/* ---------- Product ---------- */
export const PRODUCT_COLUMNS: ExcelColumn[] = [
    { header: 'Name', key: 'name', required: true, type: 'string', example: 'Shampoo Anti-Dandruff' },
    { header: 'Category', key: 'category', required: true, type: 'string', example: 'Hair Care' },
    { header: 'Brand', key: 'brand', type: 'string', example: 'L\'Oréal' },
    { header: 'Description', key: 'description', type: 'string', example: 'Anti-dandruff shampoo 250ml' },
    { header: 'Retail Price', key: 'price', required: true, type: 'number', example: '85000' },
    { header: 'Member Price', key: 'memberPrice', type: 'number', example: '75000' },
    { header: 'Cost Price', key: 'costPrice', required: true, type: 'number', example: '45000' },
    { header: 'Stock', key: 'stock', type: 'number', example: '50' },
    { header: 'Alert Quantity', key: 'alertQuantity', type: 'number', example: '5', description: 'Low stock alert threshold' },
    { header: 'SKU', key: 'sku', type: 'string', example: 'SHP-AD-001' },
    { header: 'Barcode', key: 'barcode', type: 'string', example: '8991234567890' },
    { header: 'Type', key: 'type', type: 'enum', enumValues: ['retail', 'internal'], example: 'retail' },
    { header: 'Commission Type', key: 'commissionType', type: 'enum', enumValues: ['percentage', 'fixed'], example: 'fixed' },
    { header: 'Commission Value', key: 'commissionValue', type: 'number', example: '5000' },
];

/* ---------- Customer ---------- */
export const CUSTOMER_COLUMNS: ExcelColumn[] = [
    { header: 'Name', key: 'name', required: true, type: 'string', example: 'Siti Aminah' },
    { header: 'Email', key: 'email', type: 'string', example: 'siti@email.com' },
    { header: 'Phone', key: 'phone', type: 'string', example: '08123456789', description: 'Will be normalized to 628xxx format' },
    { header: 'Address', key: 'address', type: 'string', example: 'Jl. Sudirman No.10, Jakarta' },
    { header: 'Notes', key: 'notes', type: 'string', example: 'VIP customer' },
    { header: 'Membership Tier', key: 'membershipTier', type: 'enum', enumValues: ['regular', 'silver', 'gold', 'platinum', 'premium'], example: 'regular' },
    { header: 'Birthday (YYYY-MM-DD)', key: 'birthday', type: 'date', example: '1990-05-15' },
    { header: 'WA Notification', key: 'waNotifEnabled', type: 'boolean', example: 'yes', description: 'yes/no — enable WA notifications' },
];

/* ---------- Staff ---------- */
export const STAFF_COLUMNS: ExcelColumn[] = [
    { header: 'Name', key: 'name', required: true, type: 'string', example: 'Budi Santoso' },
    { header: 'Email', key: 'email', type: 'string', example: 'budi@salon.com' },
    { header: 'Phone', key: 'phone', type: 'string', example: '08198765432' },
    { header: 'Designation', key: 'designation', type: 'string', example: 'Senior Stylist' },
    { header: 'Skills (comma separated)', key: 'skills', type: 'string', example: 'Hair Cut, Coloring, Facial' },
    { header: 'Commission Rate (%)', key: 'commissionRate', type: 'number', example: '10' },
    { header: 'Salary', key: 'salary', type: 'number', example: '3500000' },
    { header: 'Join Date (YYYY-MM-DD)', key: 'joinDate', type: 'date', example: '2024-01-15' },
];

/* ---------- Supplier ---------- */
export const SUPPLIER_COLUMNS: ExcelColumn[] = [
    { header: 'Name', key: 'name', required: true, type: 'string', example: 'PT. Beauty Supplies' },
    { header: 'Contact Person', key: 'contactPerson', type: 'string', example: 'Ahmad' },
    { header: 'Email', key: 'email', type: 'string', example: 'contact@beautysupplies.com' },
    { header: 'Phone', key: 'phone', type: 'string', example: '02150001234' },
    { header: 'Address', key: 'address', type: 'string', example: 'Jl. Industri No.5, Tangerang' },
];

/* ---------- Service Category ---------- */
export const SERVICE_CATEGORY_COLUMNS: ExcelColumn[] = [
    { header: 'Name', key: 'name', required: true, type: 'string', example: 'Hair Care' },
    { header: 'Description', key: 'description', type: 'string', example: 'All hair related services' },
];

/* ---------- Expense ---------- */
export const EXPENSE_COLUMNS: ExcelColumn[] = [
    { header: 'Title', key: 'title', required: true, type: 'string', example: 'Electricity Bill' },
    { header: 'Amount', key: 'amount', required: true, type: 'number', example: '500000' },
    { header: 'Category', key: 'category', required: true, type: 'string', example: 'Utilities' },
    { header: 'Date (YYYY-MM-DD)', key: 'date', type: 'date', example: '2024-03-15' },
    { header: 'Reference', key: 'reference', type: 'string', example: 'INV-PLN-0321' },
    { header: 'Notes', key: 'notes', type: 'string', example: 'March 2024 electricity' },
    { header: 'Payment Method', key: 'paymentMethod', type: 'enum', enumValues: ['Cash', 'Transfer', 'Debit', 'Credit Card'], example: 'Transfer' },
];

/* ---------- Voucher ---------- */
export const VOUCHER_COLUMNS: ExcelColumn[] = [
    { header: 'Code', key: 'code', required: true, type: 'string', example: 'WELCOME20' },
    { header: 'Description', key: 'description', type: 'string', example: 'Welcome discount 20%' },
    { header: 'Discount Type', key: 'discountType', required: true, type: 'enum', enumValues: ['flat', 'percentage'], example: 'percentage' },
    { header: 'Discount Value', key: 'discountValue', required: true, type: 'number', example: '20' },
    { header: 'Min Purchase', key: 'minPurchase', type: 'number', example: '100000' },
    { header: 'Max Discount', key: 'maxDiscount', type: 'number', example: '50000', description: 'Cap for percentage discount' },
    { header: 'Expires At (YYYY-MM-DD)', key: 'expiresAt', type: 'date', example: '2025-12-31' },
    { header: 'Usage Limit', key: 'usageLimit', type: 'number', example: '100', description: '0 = unlimited' },
];

/* ------------------------------------------------------------------ */
/*  Lookup map                                                         */
/* ------------------------------------------------------------------ */

export const ENTITY_COLUMNS: Record<EntityType, ExcelColumn[]> = {
    services: SERVICE_COLUMNS,
    products: PRODUCT_COLUMNS,
    customers: CUSTOMER_COLUMNS,
    staff: STAFF_COLUMNS,
    suppliers: SUPPLIER_COLUMNS,
    'service-categories': SERVICE_CATEGORY_COLUMNS,
    expenses: EXPENSE_COLUMNS,
    vouchers: VOUCHER_COLUMNS,
};

/* ------------------------------------------------------------------ */
/*  Template generator                                                 */
/* ------------------------------------------------------------------ */

export function generateTemplate(entity: EntityType): XLSX.WorkBook {
    const columns = ENTITY_COLUMNS[entity];
    if (!columns) throw new Error(`Unknown entity: ${entity}`);

    const wb = XLSX.utils.book_new();

    // ─── Sheet 1: Data Entry ───
    const headers = columns.map(c => c.header);
    const exampleRow = columns.map(c => c.example || '');
    const dataSheet = XLSX.utils.aoa_to_sheet([headers, exampleRow]);

    // Style column widths
    dataSheet['!cols'] = columns.map(c => ({ wch: Math.max(c.header.length + 4, (c.example?.length || 0) + 2, 15) }));

    XLSX.utils.book_append_sheet(wb, dataSheet, 'Data');

    // ─── Sheet 2: Instructions ───
    const instructionRows: string[][] = [
        ['Column', 'Required', 'Type', 'Allowed Values', 'Description'],
    ];
    columns.forEach(c => {
        instructionRows.push([
            c.header,
            c.required ? 'YES' : 'No',
            c.type || 'string',
            c.enumValues?.join(', ') || '-',
            c.description || '-',
        ]);
    });
    const instrSheet = XLSX.utils.aoa_to_sheet(instructionRows);
    instrSheet['!cols'] = [
        { wch: 30 }, { wch: 10 }, { wch: 10 }, { wch: 40 }, { wch: 50 },
    ];
    XLSX.utils.book_append_sheet(wb, instrSheet, 'Instructions');

    return wb;
}

/* ------------------------------------------------------------------ */
/*  Row parser & validator                                             */
/* ------------------------------------------------------------------ */

export interface ParsedRow {
    rowIndex: number;        // 1-based (header = 1, first data = 2)
    data: Record<string, any>;
    errors: string[];
}

export interface ParseResult {
    success: ParsedRow[];
    errors: ParsedRow[];
    totalRows: number;
}

export function parseExcelBuffer(buffer: ArrayBuffer, entity: EntityType): ParseResult {
    const columns = ENTITY_COLUMNS[entity];
    if (!columns) throw new Error(`Unknown entity: ${entity}`);

    const wb = XLSX.read(buffer, { type: 'array' });
    const sheetName = wb.SheetNames[0]; // Always read the first sheet
    const sheet = wb.Sheets[sheetName];
    const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (rawRows.length < 2) {
        return { success: [], errors: [], totalRows: 0 };
    }

    // Match header row to column definitions
    const headerRow = rawRows[0].map((h: any) => String(h).trim());
    const colIndexMap: Map<string, number> = new Map();

    columns.forEach(col => {
        const idx = headerRow.findIndex(
            (h: string) => h.toLowerCase() === col.header.toLowerCase()
        );
        if (idx >= 0) colIndexMap.set(col.key, idx);
    });

    const successRows: ParsedRow[] = [];
    const errorRows: ParsedRow[] = [];

    for (let i = 1; i < rawRows.length; i++) {
        const raw = rawRows[i];
        // Skip completely empty rows
        if (!raw || raw.every((cell: any) => cell === '' || cell === null || cell === undefined)) continue;

        const rowErrors: string[] = [];
        const data: Record<string, any> = {};

        columns.forEach(col => {
            const idx = colIndexMap.get(col.key);
            let value: any = idx !== undefined ? raw[idx] : undefined;

            // Trim strings
            if (typeof value === 'string') value = value.trim();

            // Convert empty string to undefined
            if (value === '' || value === null || value === undefined) {
                if (col.required) {
                    rowErrors.push(`"${col.header}" is required`);
                }
                return;
            }

            // Type coercion & validation
            switch (col.type) {
                case 'number': {
                    const num = Number(value);
                    if (isNaN(num)) {
                        rowErrors.push(`"${col.header}" must be a number (got "${value}")`);
                    } else {
                        data[col.key] = num;
                    }
                    break;
                }
                case 'date': {
                    // Handle Excel serial dates
                    if (typeof value === 'number') {
                        const dt = XLSX.SSF.parse_date_code(value);
                        if (dt) {
                            data[col.key] = new Date(dt.y, dt.m - 1, dt.d);
                        } else {
                            rowErrors.push(`"${col.header}" is not a valid date`);
                        }
                    } else {
                        const d = new Date(String(value));
                        if (isNaN(d.getTime())) {
                            rowErrors.push(`"${col.header}" is not a valid date (use YYYY-MM-DD)`);
                        } else {
                            data[col.key] = d;
                        }
                    }
                    break;
                }
                case 'boolean': {
                    const lower = String(value).toLowerCase();
                    data[col.key] = ['yes', 'true', '1', 'ya'].includes(lower);
                    break;
                }
                case 'enum': {
                    const lower = String(value).toLowerCase();
                    const match = col.enumValues?.find(e => e.toLowerCase() === lower);
                    if (!match) {
                        rowErrors.push(`"${col.header}" must be one of: ${col.enumValues?.join(', ')} (got "${value}")`);
                    } else {
                        data[col.key] = match;
                    }
                    break;
                }
                default:
                    data[col.key] = String(value);
            }
        });

        const parsed: ParsedRow = { rowIndex: i + 1, data, errors: rowErrors };
        if (rowErrors.length > 0) {
            errorRows.push(parsed);
        } else {
            successRows.push(parsed);
        }
    }

    return {
        success: successRows,
        errors: errorRows,
        totalRows: successRows.length + errorRows.length,
    };
}

/* ------------------------------------------------------------------ */
/*  Export helper — DB documents → Excel buffer                        */
/* ------------------------------------------------------------------ */

export function exportToExcel(
    data: Record<string, any>[],
    columns: ExcelColumn[],
    sheetName: string = 'Data'
): Buffer {
    const headers = columns.map(c => c.header);
    const rows = data.map(doc =>
        columns.map(col => {
            const val = doc[col.key];
            if (val === undefined || val === null) return '';
            if (col.type === 'date' && val instanceof Date) {
                return val.toISOString().split('T')[0]; // YYYY-MM-DD
            }
            if (col.type === 'boolean') return val ? 'Yes' : 'No';
            if (Array.isArray(val)) return val.join(', ');
            return val;
        })
    );

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = columns.map(c => ({ wch: Math.max(c.header.length + 4, 15) }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}
