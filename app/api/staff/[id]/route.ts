
import { NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import Staff from "@/models/Staff";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        await connectToDB();
        const { id } = await params;
        const body = await request.json();
        const staff = await Staff.findByIdAndUpdate(id, body, { new: true });
        return NextResponse.json({ success: true, data: staff });
    } catch (error) {
        return NextResponse.json({ success: false, error: "Failed to update staff" }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        await connectToDB();
        const { id } = await params;
        await Staff.findByIdAndUpdate(id, { isActive: false }); // Soft delete
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ success: false, error: "Failed to delete staff" }, { status: 500 });
    }
}
