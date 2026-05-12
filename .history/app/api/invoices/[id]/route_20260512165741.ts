import { getTenantModels } from "@/lib/tenantDb";
import { NextRequest, NextResponse } from "next/server";



import { checkPermission } from "@/lib/rbac";
import { logActivity } from "@/lib/logger";
import { auth } from "@/auth";

export async function GET(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { Invoice, Customer } = await getTenantModels(tenantSlug);

    try {
        // Security Check — kasir butuh akses untuk receipt page post-checkout
        const posPermErr = await checkPermission(request, 'pos', 'view');
        const invPermErr = await checkPermission(request, 'invoices', 'view');
        if (posPermErr && invPermErr) return invPermErr;



        const { id } = await props.params;
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

export async function PUT(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { Invoice, Customer } = await getTenantModels(tenantSlug);

    try {


        const { id } = await props.params;

        // Security Check
        const permissionError = await checkPermission(request, 'invoices', 'edit');
        if (permissionError) return permissionError;

        const body = await request.json();

        // Find existing invoice to check status change
        const oldInvoice = await Invoice.findById(id);
        if (!oldInvoice) {
            return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });
        }

        // Security: Prevent mass assignment of financial fields
        const safeBody = { ...body };
        delete safeBody.totalAmount;
        delete safeBody.amountPaid;
        delete safeBody.subtotal;
        delete safeBody.tax;
        delete safeBody.discount;
        delete safeBody.loyaltyPointsUsed;

        const invoice = await Invoice.findByIdAndUpdate(id, safeBody, { new: true });

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

/**
 * DELETE /api/invoices/[id]
 * ──────────────────────────────────────────────────────
 * IMMUTABLE SALES LOG — Invoices are NEVER hard-deleted.
 * Only Super Admin can VOID an invoice (soft-delete).
 * A void reason is required for the audit trail.
 * ──────────────────────────────────────────────────────
 */
export async function DELETE(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { Invoice, Customer } = await getTenantModels(tenantSlug);

    try {
        // Must be Super Admin to void an invoice
        const session: any = await auth();
        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const isSuperAdmin =
            session.user.role === 'Super Admin' ||
            session.user.role?.name === 'Super Admin';

        if (!isSuperAdmin) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Akses ditolak: Hanya Super Admin yang dapat membatalkan (void) invoice. Invoice tidak dapat dihapus untuk menjaga integritas data keuangan.",
                },
                { status: 403 }
            );
        }



        const { id } = await props.params;

        const invoice = await Invoice.findById(id);
        if (!invoice) {
            return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });
        }

        if (invoice.status === 'voided') {
            return NextResponse.json({ success: false, error: "Invoice sudah di-void sebelumnya" }, { status: 400 });
        }

        // Get void reason from request body
        let voidReason = 'No reason provided';
        try {
            const body = await request.json();
            if (body?.reason) voidReason = body.reason;
        } catch {
            // No body is fine, use default reason
        }

        // Soft-delete: mark as voided with full audit trail
        invoice.status = 'voided';
        invoice.voidedBy = session.user.id;
        invoice.voidedAt = new Date();
        invoice.voidReason = voidReason;
        await invoice.save();

        // Log activity with detailed audit
        await logActivity({
            req: request,
            action: 'void',
            resource: 'Invoice',
            resourceId: id,
            details: `VOIDED invoice ${invoice.invoiceNumber} (was ${invoice.totalAmount}). Reason: ${voidReason}`,
        });

        return NextResponse.json({
            success: true,
            message: `Invoice ${invoice.invoiceNumber} berhasil di-void`,
            data: {
                invoiceNumber: invoice.invoiceNumber,
                status: 'voided',
                voidedAt: invoice.voidedAt,
                voidReason,
            },
        });
    } catch (error: any) {
        console.error("API Error Invoice VOID:", error);
        return NextResponse.json({ success: false, error: "Failed to void invoice" }, { status: 500 });
    }
}