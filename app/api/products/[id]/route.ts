import { getTenantModels } from "@/lib/tenantDb";
import { NextResponse } from "next/server";


export async function PUT(request: Request, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { Product } = await getTenantModels(tenantSlug);

  try {
    
    const { id } = await props.params;
    const body = await request.json();

    const updateData: Record<string, any> = { ...body };

    // If stock is being updated, reset lowStockNotifSent when stock recovers above
    // alertQuantity so that future low-stock drops can trigger WA notification again.
    if ("stock" in body) {
      const newStock = Number(body.stock);

      // alertQuantity: prefer value from body (if also being updated),
      // otherwise fetch the persisted value from DB.
      let alertQuantity: number;
      if ("alertQuantity" in body) {
        alertQuantity = Number(body.alertQuantity);
      } else {
        const existing = await Product.findById(id).select("alertQuantity");
        alertQuantity = existing?.alertQuantity ?? 5;
      }

      if (newStock > alertQuantity) {
        updateData.lowStockNotifSent = false;
      }
    }

    const product = await Product.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    return NextResponse.json({ success: true, data: product });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to update product" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { Product } = await getTenantModels(tenantSlug);

  try {
    
    const { id } = await props.params;
    const product = await Product.findByIdAndUpdate(
      id,
      { status: "inactive" },
      { new: true },
    );
    return NextResponse.json({ success: true, data: product });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to delete product" },
      { status: 500 },
    );
  }
}
