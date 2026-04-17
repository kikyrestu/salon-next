
import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/rbac";
import { connectToDB } from "@/lib/mongodb";
import Invoice from "@/models/Invoice";
import Customer from "@/models/Customer";
import { initModels } from "@/lib/initModels";
import { logActivity } from "@/lib/logger";
import { scheduleFollowUp } from "@/lib/waFollowUp";
import { normalizeIndonesianPhone } from "@/lib/phone";
import WaFollowUpContact from "@/models/WaFollowUpContact";

const SPLIT_TOLERANCE = 0.01;

const toNum = (value: unknown): number => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
};

const validateSplitAssignments = (assignments: any[]): { valid: boolean; error?: string } => {
    if (!Array.isArray(assignments) || assignments.length === 0) {
        return { valid: true };
    }

    const ids = assignments
        .map((entry) => String(entry?.staffId || entry?.staff || '').trim())
        .filter(Boolean);

    if (ids.length !== new Set(ids).size) {
        return { valid: false, error: 'Duplicate staff is not allowed in split commission assignments' };
    }

    const total = assignments.reduce((sum, entry) => sum + toNum(entry?.porsiPersen ?? entry?.percentage), 0);
    const hasNonPositive = assignments.some((entry) => toNum(entry?.porsiPersen ?? entry?.percentage) <= 0);
    if (hasNonPositive) {
        return { valid: false, error: 'Each staff split percentage must be greater than 0' };
    }

    if (Math.abs(total - 100) > SPLIT_TOLERANCE) {
        return { valid: false, error: 'Split commission percentage must total 100%' };
    }

    return { valid: true };
};

const normalizeSplitAssignments = (assignments: any[] = []) => {
    return assignments.map((entry) => {
        const staffId = entry?.staffId || entry?.staff;
        const porsiPersen = toNum(entry?.porsiPersen ?? entry?.percentage);
        const komisiNominal = toNum(entry?.komisiNominal ?? entry?.commission);

        return {
            ...entry,
            staff: staffId,
            staffId,
            percentage: porsiPersen,
            porsiPersen,
            commission: komisiNominal,
            komisiNominal,
        };
    });
};

export async function POST(request: NextRequest) {
    try {
        await connectToDB();

        // Security Check
        const permissionError = await checkPermission(request, 'invoices', 'create');
        if (permissionError) return permissionError;

        initModels();
        const body = await request.json();

        const normalizedBody = {
            ...body,
            followUpPhoneNumber: normalizeIndonesianPhone(body?.followUpPhoneNumber) || undefined,
            staffAssignments: normalizeSplitAssignments(body.staffAssignments || []),
            items: Array.isArray(body.items)
                ? body.items.map((item: any) => ({
                    ...item,
                    splitCommissionMode: item?.splitCommissionMode || 'auto',
                    staffAssignments: normalizeSplitAssignments(item?.staffAssignments || []),
                }))
                : [],
        };

        const topSplitValidation = validateSplitAssignments(normalizedBody.staffAssignments || []);
        if (!topSplitValidation.valid) {
            return NextResponse.json({ success: false, error: topSplitValidation.error }, { status: 400 });
        }

        for (const item of normalizedBody.items) {
            if (item.itemModel !== 'Service') continue;
            const itemSplitValidation = validateSplitAssignments(item.staffAssignments || []);
            if (!itemSplitValidation.valid) {
                return NextResponse.json({
                    success: false,
                    error: `${item.name || 'Service item'}: ${itemSplitValidation.error}`,
                }, { status: 400 });
            }
        }

        // Generate Invoice Number: Find the latest invoice and increment its number
        const lastInvoice = await Invoice.findOne().sort({ createdAt: -1 });
        let nextNum = 1;

        if (lastInvoice && lastInvoice.invoiceNumber) {
            const lastNum = parseInt(lastInvoice.invoiceNumber.split('-').pop() || "0");
            if (!isNaN(lastNum)) {
                nextNum = lastNum + 1;
            }
        }

        const invoiceNumber = `INV-${new Date().getFullYear()}-${nextNum.toString().padStart(5, '0')}`;

        const invoice = await Invoice.create({
            ...normalizedBody,
            invoiceNumber
        }) as any;

        let followUpPhone = normalizeIndonesianPhone(normalizedBody.followUpPhoneNumber);
        if (!followUpPhone && normalizedBody.customer) {
            const customer = await Customer.findById(normalizedBody.customer).select('phone').lean<any>();
            followUpPhone = normalizeIndonesianPhone(customer?.phone);
        }

        if (followUpPhone) {
            await WaFollowUpContact.findOneAndUpdate(
                { phoneNumber: followUpPhone },
                {
                    $set: {
                        lastTransactionId: invoice._id,
                        lastSource: 'pos',
                        lastSeenAt: new Date(),
                    },
                    $setOnInsert: {
                        isActive: true,
                    },
                },
                { upsert: true, new: true }
            );
        }

        await scheduleFollowUp(invoice._id);

        await logActivity({
            req: request,
            action: 'create',
            resource: 'invoice',
            resourceId: invoice._id as string,
            details: `Created invoice ${invoiceNumber} for amount $${invoice.totalAmount}`
        });

        return NextResponse.json({ success: true, data: invoice });
    } catch (error: any) {
        console.error("INVOICE_CREATE_ERROR:", error);
        if (error.name === 'ValidationError') {
            return NextResponse.json({
                success: false,
                error: "Validation failed: " + Object.values(error.errors).map((e: any) => e.message).join(', ')
            }, { status: 400 });
        }
        if (error.code === 11000) {
            return NextResponse.json({ success: false, error: "Duplicate invoice number. Please try again." }, { status: 400 });
        }
        return NextResponse.json({ success: false, error: "Failed to create invoice" }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    try {
        await connectToDB();

        // Security Check
        const permissionError = await checkPermission(request, 'invoices', 'view');
        if (permissionError) return permissionError;

        initModels();

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "10");
        const search = searchParams.get("search") || "";
        const status = searchParams.get("status") || "all";

        const skip = (page - 1) * limit;

        const query: any = {};

        // Scope Check (Own vs All) - Optional refinement
        // const scope = await getViewScope('invoices');
        // if (scope === 'own') query.staff = session.user.id; 

        if (status !== "all") {
            query.status = status;
        }

        if (search) {
            // Search in invoiceNumber
            const searchQueries: any[] = [
                { invoiceNumber: { $regex: search, $options: "i" } }
            ];

            // Or search by customer name if we can find customer IDs
            const customers = await Customer.find({ name: { $regex: search, $options: "i" } }).select('_id');
            if (customers.length > 0) {
                searchQueries.push({ customer: { $in: customers.map(c => c._id) } });
            }

            query.$or = searchQueries;
        }

        const total = await Invoice.countDocuments(query);
        const invoices = await Invoice.find(query)
            .populate('customer', 'name phone')
            .populate('staff', 'name')
            .populate('staffAssignments.staff', 'name')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        return NextResponse.json({
            success: true,
            data: invoices,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error("API Error Invoices GET:", error);
        return NextResponse.json({ success: false, error: "Failed to fetch invoices" }, { status: 500 });
    }
}
