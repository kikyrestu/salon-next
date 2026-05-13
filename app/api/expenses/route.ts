import { getTenantModels } from "@/lib/tenantDb";

import { NextRequest, NextResponse } from "next/server";

import { checkPermissionWithSession } from "@/lib/rbac";
import { getUtcRangeForDateRange } from "@/lib/dateUtils";

export async function GET(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { Expense, Settings } = await getTenantModels(tenantSlug);

    try {
        const permissionError = await checkPermissionWithSession(request, 'expenses', 'view').then(r => r.error);
        if (permissionError) return permissionError;

        const { searchParams } = new URL(request.url);
        const search = searchParams.get("search");
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");
        const category = searchParams.get("category");

        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "10");
        const settings = await Settings.findOne({}, { timezone: 1 }).lean();
        const timezone = settings?.timezone || "UTC";

        const query: any = {};

        if (search) {
            query.title = { $regex: search, $options: "i" };
        }

        if (startDate && endDate) {
            const { start, end } = getUtcRangeForDateRange(startDate, endDate, timezone);
            query.date = {
                $gte: start,
                $lte: end
            };
        }

        if (category) {
            query.category = category;
        }

        const skip = (page - 1) * limit;

        const [expenses, total] = await Promise.all([
            Expense.find(query)
                .populate("recordedBy", "name")
                .sort({ date: -1 })
                .skip(skip)
                .limit(limit),
            Expense.countDocuments(query)
        ]);

        return NextResponse.json({
            success: true,
            data: expenses,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ success: false, error: "Failed to fetch expenses" }, { status: 500 });
    }
}

export async function POST(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { Expense, CashBalance, CashLog } = await getTenantModels(tenantSlug);

    try {
        // [B14 FIX] Gunakan checkPermissionWithSession — 1 auth() call
        const { error: permissionError, session: permSession } = await checkPermissionWithSession(request, 'expenses', 'create');
        if (permissionError) return permissionError;

        const body = await request.json();

        // Validation
        const amountNum = Number(body.amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            return NextResponse.json({ success: false, error: "Nominal pengeluaran harus lebih dari 0." }, { status: 400 });
        }

        const expense: any = await Expense.create(body);

        // --- CASH DRAWER INTEGRATION ---
        if (expense.paymentMethod && expense.paymentMethod.toLowerCase() === 'cash') {
            const userId = (permSession as any)?.user?.id || expense.recordedBy;

            let balance = await CashBalance.findOneAndUpdate(
                {},
                { $inc: { kasirBalance: -amountNum }, $set: { lastUpdatedAt: new Date() } },
                { new: true, upsert: true }
            );

            await CashLog.create({
                type: 'expense',
                amount: amountNum,
                sourceLocation: 'kasir',
                destinationLocation: 'expense',
                performedBy: userId,
                description: `Expense Payment: ${expense.title}`,
                referenceModel: 'Expense',
                referenceId: expense._id,
                balanceAfter: {
                    kasir: balance.kasirBalance,
                    brankas: balance.brankasBalance,
                    bank: balance.bankBalance
                }
            });
        }
        // -------------------------------

        return NextResponse.json({ success: true, data: expense });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ success: false, error: "Failed to create expense" }, { status: 500 });
    }
}