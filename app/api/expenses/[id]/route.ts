import { NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import Expense from "@/models/Expense";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        await connectToDB();
        const { id } = await params;
        const body = await request.json();
        const expense = await Expense.findByIdAndUpdate(id, body, { new: true });
        return NextResponse.json({ success: true, data: expense });
    } catch (error) {
        return NextResponse.json({ success: false, error: "Failed to update expense" }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        await connectToDB();
        const { id } = await params;
        await Expense.findByIdAndDelete(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ success: false, error: "Failed to delete expense" }, { status: 500 });
    }
}
