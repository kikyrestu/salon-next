import { getTenantModels } from "@/lib/tenantDb";
import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/rbac";



// Delete a specific slot by ID
export async function DELETE(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { StaffSlot } = await getTenantModels(tenantSlug);

    try {
    const permissionErrorDELETE = await checkPermission(request, 'staff-slots', 'delete');
    if (permissionErrorDELETE) return permissionErrorDELETE;
        
        
        
        const { id } = await props.params;
        
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

