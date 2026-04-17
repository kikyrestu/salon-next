
import { NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import Expense from "@/models/Expense";
import { initModels } from "@/lib/initModels";
import Settings from "@/models/Settings";
import { getUtcRangeForDateRange } from "@/lib/dateUtils";

export async function GET(request: Request) {
    try {
        await connectToDB();
        initModels();

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

export async function POST(request: Request) {
    try {
        await connectToDB();
        const body = await request.json();
        const expense = await Expense.create(body);
        return NextResponse.json({ success: true, data: expense });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ success: false, error: "Failed to create expense" }, { status: 500 });
    }
}
