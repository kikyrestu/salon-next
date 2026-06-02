import { getTenantModels } from "@/lib/tenantDb";
import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/rbac";
import { auth } from "@/auth";

export async function POST(request: NextRequest, props: any) {
  const tenantSlug = request.headers.get("x-store-slug") || "pusat";
  const { Product, StockLog } = await getTenantModels(tenantSlug);
  const session = await auth();

  try {
    // 1. Validate Permission
    const body = await request.json();
    const actionType = body.type; // 'add' (restock) or 'adjust'

    // If it's adjust, require 'settings' edit permission (Admin level proxy)
    // If it's add, require 'products' edit permission
    if (actionType === "adjust") {
      const permissionError = await checkPermission(request, "settings", "edit");
      if (permissionError) return permissionError;
    } else {
      const permissionError = await checkPermission(request, "products", "edit");
      if (permissionError) return permissionError;
    }

    const { id } = await props.params;
    const { quantity, note, password } = body;

    if (actionType === "adjust") {
      const { Settings } = await getTenantModels(tenantSlug);
      const settings = await Settings.findOne();
      if (settings?.stockAdjustmentPassword && settings.stockAdjustmentPassword !== password) {
        return NextResponse.json(
          { success: false, error: "Password Otoritas salah atau kosong!" },
          { status: 401 }
        );
      }
    }

    const product = await Product.findById(id);
    if (!product) {
      return NextResponse.json(
        { success: false, error: "Product not found" },
        { status: 404 }
      );
    }

    let qtyChange = 0;
    let newBalance = 0;
    let logType: "in" | "out" | "adjustment" = "in";

    if (actionType === "add") {
      qtyChange = Number(quantity);
      if (qtyChange <= 0) {
        return NextResponse.json(
          { success: false, error: "Tambah stok harus lebih dari 0" },
          { status: 400 }
        );
      }
      newBalance = product.stock + qtyChange;
      logType = "in";
    } else if (actionType === "adjust") {
      const physicalStock = Number(quantity);
      if (physicalStock < 0) {
        return NextResponse.json(
          { success: false, error: "Stok fisik tidak valid" },
          { status: 400 }
        );
      }
      qtyChange = physicalStock - product.stock;
      newBalance = physicalStock;
      logType = "adjustment";
      
      if (qtyChange === 0) {
        return NextResponse.json({ success: true, message: "Tidak ada perubahan stok", data: product });
      }
    } else {
      return NextResponse.json(
        { success: false, error: "Tipe aksi tidak valid" },
        { status: 400 }
      );
    }

    // Update Product Stock
    product.stock = newBalance;
    // reset notification if stock goes above alert quantity
    if (product.stock > product.alertQuantity) {
      product.lowStockNotifSent = false;
    }
    await product.save();

    // Create Log
    await StockLog.create({
      product: product._id,
      storeSlug: tenantSlug,
      type: logType,
      quantity: qtyChange,
      balanceAfter: newBalance,
      note: note || (actionType === "add" ? "Restock manual" : "Stock adjustment"),
      performedBy: session?.user?.name || "System"
    });

    return NextResponse.json({ success: true, data: product });
  } catch (error: any) {
    console.error("Stock action error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal memproses stok" },
      { status: 500 }
    );
  }
}
