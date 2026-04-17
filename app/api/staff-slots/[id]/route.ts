import { NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import { initModels } from "@/lib/initModels";
import StaffSlot from "@/models/StaffSlot";

// Delete a specific slot by ID
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await connectToDB();
        initModels();
        
        const { id } = await params;
        
        if (!id) {
            return NextResponse.json(
                { success: false, error: "Slot ID is required" },
                { status: 400 }
            );
        }
        
        const deletedSlot = await StaffSlot.findByIdAndDelete(id);
        
        if (!deletedSlot) {
            return NextResponse.json(
                { success: false, error: "Slot not found" },
                { status: 404 }
            );
        }
        
        return NextResponse.json({
            success: true,
            message: "Slot deleted successfully",
            data: deletedSlot
        });
    } catch (error: any) {
        console.error("Error deleting staff slot:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Failed to delete slot" },
            { status: 500 }
        );
    }
}

