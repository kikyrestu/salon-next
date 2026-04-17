
import { NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import { initModels } from "@/lib/initModels";
import Purchase from "@/models/Purchase";
import Invoice from "@/models/Invoice";
import Expense from "@/models/Expense";
import Settings from "@/models/Settings";
import { getMonthDateRangeInTimezone, getUtcRangeForDateRange } from "@/lib/dateUtils";

export async function GET(request: Request) {
    try {
        await connectToDB();
        initModels();

        const { searchParams } = new URL(request.url);
        const startDateParam = searchParams.get("startDate");
        const endDateParam = searchParams.get("endDate");
        const settings = await Settings.findOne({}, { timezone: 1 }).lean();
        const timezone = settings?.timezone || "UTC";

        const defaultRange = getMonthDateRangeInTimezone(timezone);
        const { start, end } = getUtcRangeForDateRange(
            startDateParam || defaultRange.startDate,
            endDateParam || defaultRange.endDate,
            timezone
        );

        const query: any = {
            date: { $gte: start, $lte: end }
        };

        // Calculate Totals
        // 1. Sales (Invoices) - we might want to use paidAmount for cash flow or totalAmount for accrued revenue
        // Usually financial reports show Sales Revenue (Total Amount) and actual Cash Collected (Paid Amount)
        // Let's return both.

        const invoiceStats = await Invoice.aggregate([
            { $match: { ...query, status: { $ne: 'cancelled' } } },
            {
                $group: {
                    _id: null,
                    totalSales: { $sum: "$totalAmount" },
                    totalCollected: { $sum: "$amountPaid" },
                    count: { $sum: 1 }
                }
            }
        ]);

        // 2. Purchases
        // Query for purchases might use 'date' or 'createdAt'. Purchase model has 'date'.
        // Assuming 'date' field in Purchase matches the query param (which is checking 'date')

        const purchaseStats = await Purchase.aggregate([
            { $match: { ...query, status: { $ne: 'cancelled' } } },
            {
                $group: {
                    _id: null,
                    totalPurchases: { $sum: "$totalAmount" },
                    totalPaid: { $sum: "$paidAmount" },
                    count: { $sum: 1 }
                }
            }
        ]);

        // 3. Expenses
        const expenseStats = await Expense.aggregate([
            { $match: query },
            {
                $group: {
                    _id: null,
                    totalExpenses: { $sum: "$amount" },
                    count: { $sum: 1 }
                }
            }
        ]);

        const sales = invoiceStats[0] || { totalSales: 0, totalCollected: 0, count: 0 };
        const purchases = purchaseStats[0] || { totalPurchases: 0, totalPaid: 0, count: 0 };
        const expenses = expenseStats[0] || { totalExpenses: 0, count: 0 };

        const netProfit = sales.totalSales - purchases.totalPurchases - expenses.totalExpenses;
        const cashFlow = sales.totalCollected - purchases.totalPaid - expenses.totalExpenses; // Assuming expenses are paid immediately or we track expense payment separately (Expense model has amount, assume paid)

        return NextResponse.json({
            success: true,
            data: {
                sales,
                purchases,
                expenses,
                netProfit,
                cashFlow
            }
        });
    } catch (error) {
        console.error("API Error Financial Report:", error);
        return NextResponse.json({ success: false, error: "Failed to generate report" }, { status: 500 });
    }
}
