import { NextRequest, NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import Invoice from "@/models/Invoice";
import Customer from "@/models/Customer";
import { initModels } from "@/lib/initModels";
import { checkPermission } from "@/lib/rbac";
import { logActivity } from "@/lib/logger";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        // Security Check
        const permissionError = await checkPermission(request, 'invoices', 'view');
        if (permissionError) return permissionError;

        await connectToDB();
        initModels();
        const { id } = await params;
        const invoice = await Invoice.findById(id)
            .populate({
                path: 'customer',
                populate: { path: 'referredBy', select: 'name phone' }
            })
            .populate('staffAssignments.staff');
        if (!invoice) {
            return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });
        }
        return NextResponse.json({ success: true, data: invoice });
    } catch (error) {
        return NextResponse.json({ success: false, error: "Failed to fetch invoice" }, { status: 500 });
    }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await connectToDB();
        initModels();
        const { id } = await params;

        // Security Check
        const permissionError = await checkPermission(request, 'invoices', 'edit');
        if (permissionError) return permissionError;

        const body = await request.json();

        // Find existing invoice to check status change
        const oldInvoice = await Invoice.findById(id);
        if (!oldInvoice) {
            return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });
        }

        const invoice = await Invoice.findByIdAndUpdate(id, body, { new: true });

        // Loyalty Point Logic: If status changed to 'paid'
        if (body.status === 'paid' && oldInvoice.status !== 'paid' && invoice.customer) {
            const pointsToGain = Math.floor(invoice.totalAmount / 10);
            if (pointsToGain > 0) {
                await Customer.findByIdAndUpdate(invoice.customer, {
                    $inc: {
                        loyaltyPoints: pointsToGain,
                        totalPurchases: invoice.totalAmount
                    }
                });
            }
        }

        // Log Activity
        await logActivity({
            req: request,
            action: 'update',
            resource: 'Invoice',
            resourceId: id,
            details: `Updated invoice ${invoice.invoiceNumber}. Status: ${invoice.status}`
        });

        return NextResponse.json({ success: true, data: invoice });
    } catch (error) {
        console.error("API Error Invoice PUT:", error);
        return NextResponse.json({ success: false, error: "Failed to update invoice" }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        // Security Check
        const permissionError = await checkPermission(request, 'invoices', 'delete');
        if (permissionError) return permissionError;

        await connectToDB();
        const { id } = await params;
        await Invoice.findByIdAndDelete(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ success: false, error: "Failed to delete invoice" }, { status: 500 });
    }
}
