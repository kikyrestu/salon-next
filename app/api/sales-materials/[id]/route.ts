import { NextRequest, NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import SalesMaterial from "@/models/SalesMaterial";
import { checkPermission } from "@/lib/rbac";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const permissionError = await checkPermission(request, 'products', 'edit');
    if (permissionError) return permissionError;

    await connectToDB();
    const { id } = await params;
    const body = await request.json();

    const updateData: Record<string, any> = { ...body };

    const material = await SalesMaterial.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    if (!material) {
        return NextResponse.json({ success: false, error: "Sales Material not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: material });
  } catch (error: any) {
    if (error.code === 11000) {
        return NextResponse.json({ success: false, error: "Material Code already exists" }, { status: 400 });
    }
    return NextResponse.json(
      { success: false, error: "Failed to update sales material" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const permissionError = await checkPermission(request, 'products', 'delete');
    if (permissionError) return permissionError;

    await connectToDB();
    const { id } = await params;
    // Soft delete
    const material = await SalesMaterial.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true },
    );

    if (!material) {
        return NextResponse.json({ success: false, error: "Sales Material not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: material });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to delete sales material" },
      { status: 500 },
    );
  }
}
