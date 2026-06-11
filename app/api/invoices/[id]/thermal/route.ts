import { getTenantModels } from "@/lib/tenantDb";
import { NextRequest, NextResponse } from "next/server";
import { checkPermissionWithSession } from "@/lib/rbac";
import { buildReceiptBuffer, ThermalReceiptData } from "@/lib/escpos";

export async function GET(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { Invoice, Settings } = await getTenantModels(tenantSlug);

    try {
        const { error: permissionError } = await checkPermissionWithSession(request, 'pos', 'view');
        if (permissionError) return permissionError;

        const { id } = await props.params;
        const { searchParams } = new URL(request.url);
        const paperWidth = searchParams.get('width') === '80' ? 80 : 58;

        const invoice: any = await Invoice.findById(id)
            .populate('customer', 'name phone')
            .populate('staff', 'name')
            .populate('staffAssignments.staff', 'name')
            .lean();

        if (!invoice) {
            return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 });
        }

        const settings: any = await Settings.findOne({}).lean();

        // Get staff name
        const staffName = invoice.staffAssignments?.[0]?.staff?.name
            || invoice.staff?.name
            || '-';

        const receiptData: ThermalReceiptData = {
            storeName: settings?.storeName || 'Salon',
            address: settings?.address || '',
            phone: settings?.phone || '',
            invoiceNumber: invoice.invoiceNumber,
            date: invoice.date,
            staffName,
            customerName: invoice.customer?.name,
            items: (invoice.items || []).map((item: any) => ({
                name: item.name,
                quantity: item.quantity || 1,
                price: item.price || 0,
                discount: item.discount || 0,
                total: item.total || 0,
            })),
            subtotal: invoice.subtotal || 0,
            discount: invoice.discount || 0,
            tax: invoice.tax || 0,
            totalAmount: invoice.totalAmount || 0,
            amountPaid: invoice.amountPaid || 0,
            paymentMethod: invoice.paymentMethod || 'Cash',
            tips: invoice.tips || 0,
            loyaltyPointsUsed: invoice.loyaltyPointsUsed || 0,
            loyaltyPointsEarned: invoice.loyaltyPointsEarned || 0,
            receiptFooter: settings?.receiptFooter || '',
            paperWidth,
        };

        const receiptBuffer = buildReceiptBuffer(receiptData);

        // Return as binary data
        const bytes = Buffer.from(receiptBuffer, 'binary');
        return new Response(bytes, {
            headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': `attachment; filename="receipt-${invoice.invoiceNumber}.bin"`,
                'Content-Length': String(bytes.length),
            },
        });
    } catch (error: any) {
        console.error('[Thermal Print] Error:', error);
        return NextResponse.json({ success: false, error: 'Failed to generate thermal receipt' }, { status: 500 });
    }
}
