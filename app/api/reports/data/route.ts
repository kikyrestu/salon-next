import { getTenantModels } from "@/lib/tenantDb";
import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/rbac";

// Endpoint aggregator khusus Reports — hanya butuh reports.view
// Return semua data yang dibutuhkan reports page tanpa butuh permission terpisah
// Staff bisa lihat laporan lengkap tanpa akses ke management resource lain
export async function GET(request: NextRequest) {
    const tenantSlug = request.headers.get("x-store-slug") || "pusat";
    const { Staff, Service, Invoice, Expense, Appointment, Customer, Product, Purchase } = await getTenantModels(tenantSlug);

    try {
        const permissionError = await checkPermission(request, "reports", "view");
        if (permissionError) return permissionError;

        const { searchParams } = new URL(request.url);
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");
        const dataType = searchParams.get("type"); // 'lists' or 'full'

        // For filter dropdowns - return minimal data
        if (dataType === 'lists') {
            const [staff, services] = await Promise.all([
                Staff.find({ status: 'active' }).select("_id name").sort({ name: 1 }),
                Service.find({ status: 'active' }).select("_id name").sort({ name: 1 })
            ]);

            return NextResponse.json({
                success: true,
                data: {
                    staff: staff || [],
                    services: services || []
                }
            });
        }

        // For full report data
        const dateFilter: any = {};
        if (startDate && endDate) {
            dateFilter.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }

        const [invoices, expenses, appointments, customers, products, purchases] = await Promise.all([
            Invoice.find(startDate && endDate ? { date: dateFilter.date } : {})
                .populate('customer')
                .populate('staffAssignments.staff')
                .sort({ date: -1 }),
            Expense.find(startDate && endDate ? { date: dateFilter.date } : {})
                .sort({ date: -1 }),
            Appointment.find(startDate && endDate ? {
                start: { $gte: new Date(startDate), $lte: new Date(endDate) }
            } : {})
                .populate('customer')
                .populate('staff')
                .populate('service'),
            Customer.find().select("_id name phone email totalPurchases membershipTier"),
            Product.find().select("_id name stock alertQuantity price"),
            Purchase.find(startDate && endDate ? { date: dateFilter.date } : {})
                .populate('supplier')
                .sort({ date: -1 })
        ]);

        return NextResponse.json({
            success: true,
            data: {
                invoices: invoices || [],
                expenses: expenses || [],
                appointments: appointments || [],
                customers: customers || [],
                products: products || [],
                purchases: purchases || []
            }
        });
    } catch (error) {
        console.error("Error fetching reports data:", error);
        return NextResponse.json(
            { success: false, error: "Failed to fetch reports data" },
            { status: 500 }
        );
    }
}
