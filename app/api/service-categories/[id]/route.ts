import { NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import ServiceCategory from "@/models/ServiceCategory";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        await connectToDB();
        const { id } = await params;
        const body = await request.json();
        const category = await ServiceCategory.findByIdAndUpdate(id, body, { new: true });

        if (!category) {
            return NextResponse.json({ success: false, error: "Category not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: category });
    } catch (error) {
        console.error("Error updating category:", error);
        return NextResponse.json({ success: false, error: "Failed to update category" }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        await connectToDB();
        const { id } = await params;
        const category = await ServiceCategory.findByIdAndUpdate(id, { status: "inactive" }, { new: true });

        if (!category) {
            return NextResponse.json({ success: false, error: "Category not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: category });
    } catch (error) {
        console.error("Error deleting category:", error);
        return NextResponse.json({ success: false, error: "Failed to delete category" }, { status: 500 });
    }
}
