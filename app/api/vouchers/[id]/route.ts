import { getTenantModels } from "@/lib/tenantDb";
import { NextRequest, NextResponse } from "next/server";


export async function GET(_request: NextRequest, props: any) {
    const tenantSlug = _request.headers.get('x-store-slug') || 'pusat';
    const { Voucher } = await getTenantModels(tenantSlug);

  try {
    
    const { id } = await props.params;

    const voucher = await Voucher.findById(id);
    if (!voucher) {
      return NextResponse.json(
        { success: false, error: "Voucher tidak ditemukan" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: voucher });
  } catch (error) {
    console.error("VOUCHER_GET_ID_ERROR:", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil data voucher" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { Voucher } = await getTenantModels(tenantSlug);

  try {
    
    const { id } = await props.params;
    const body = await request.json();

    const {
      code,
      description,
      discountType,
      discountValue,
      minPurchase,
      maxDiscount,
      expiresAt,
      usageLimit,
      isActive,
    } = body;

    // Validate discountType if provided
    if (discountType && !["flat", "percentage"].includes(discountType)) {
      return NextResponse.json(
        { success: false, error: "Tipe diskon harus flat atau percentage" },
        { status: 400 }
      );
    }

    if (
      discountType === "percentage" &&
      discountValue !== undefined &&
      Number(discountValue) > 100
    ) {
      return NextResponse.json(
        { success: false, error: "Diskon persentase tidak boleh lebih dari 100%" },
        { status: 400 }
      );
    }

    if (discountValue !== undefined && Number(discountValue) < 0) {
      return NextResponse.json(
        { success: false, error: "Nilai diskon tidak boleh negatif" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (code !== undefined)
      updateData.code = String(code).toUpperCase().trim();
    if (description !== undefined)
      updateData.description = description?.trim() || undefined;
    if (discountType !== undefined) updateData.discountType = discountType;
    if (discountValue !== undefined)
      updateData.discountValue = Number(discountValue);
    if (minPurchase !== undefined)
      updateData.minPurchase = Number(minPurchase);
    if (maxDiscount !== undefined)
      updateData.maxDiscount = maxDiscount ? Number(maxDiscount) : undefined;
    if (expiresAt !== undefined)
      updateData.expiresAt = expiresAt ? new Date(expiresAt) : undefined;
    if (usageLimit !== undefined)
      updateData.usageLimit = Number(usageLimit);
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);

    const voucher = await Voucher.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!voucher) {
      return NextResponse.json(
        { success: false, error: "Voucher tidak ditemukan" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: voucher });
  } catch (error: any) {
    console.error("VOUCHER_PUT_ERROR:", error);
    if (error.code === 11000) {
      return NextResponse.json(
        { success: false, error: "Kode voucher sudah digunakan" },
        { status: 400 }
      );
    }
    if (error.name === "ValidationError") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Validasi gagal: " +
            Object.values(error.errors)
              .map((e: any) => e.message)
              .join(", "),
        },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Gagal mengupdate voucher" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, props: any) {
    const tenantSlug = _request.headers.get('x-store-slug') || 'pusat';
    const { Voucher } = await getTenantModels(tenantSlug);

  try {
    
    const { id } = await props.params;

    // Soft delete — just deactivate
    const voucher = await Voucher.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!voucher) {
      return NextResponse.json(
        { success: false, error: "Voucher tidak ditemukan" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Voucher berhasil dinonaktifkan",
    });
  } catch (error) {
    console.error("VOUCHER_DELETE_ERROR:", error);
    return NextResponse.json(
      { success: false, error: "Gagal menghapus voucher" },
      { status: 500 }
    );
  }
}
