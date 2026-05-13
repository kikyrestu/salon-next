import { getTenantModels } from "@/lib/tenantDb";
import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/rbac";


export async function GET(request: NextRequest, props: any) {
  const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
  const { Voucher } = await getTenantModels(tenantSlug);

  try {
    const permissionError = await checkPermission(request, 'vouchers', 'view');
    if (permissionError) return permissionError;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limitParam = parseInt(searchParams.get("limit") || "20");
    const limit = limitParam === 0 ? 0 : limitParam;
    const skip = limit > 0 ? (page - 1) * limit : 0;
    const search = searchParams.get("search") || "";

    const query: any = {};
    if (search) {
      query.code = { $regex: search.toUpperCase(), $options: "i" };
    }

    const total = await Voucher.countDocuments(query);
    let voucherQuery = Voucher.find(query).sort({ createdAt: -1 });
    if (limit > 0) {
      voucherQuery = voucherQuery.skip(skip).limit(limit);
    }
    const vouchers = await voucherQuery;

    return NextResponse.json({
      success: true,
      data: vouchers,
      pagination: {
        total,
        page,
        limit,
        // [B11 FIX] Hindari division by zero saat limit=0
        pages: limit > 0 ? Math.ceil(total / limit) : 1,
      },
    });
  } catch (error) {
    console.error("VOUCHERS_GET_ERROR:", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil data voucher" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, props: any) {
  const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
  const { Voucher } = await getTenantModels(tenantSlug);

  try {
    const body = await request.json();

    // Handle validate action for POS redemption
    if (body.action === "validate") {
      const { code, totalAmount, customerId } = body;

      if (!code) {
        return NextResponse.json(
          { success: false, error: "Kode voucher wajib diisi" },
          { status: 400 }
        );
      }

      const voucher = await Voucher.findOne({
        code: String(code).toUpperCase().trim(),
        isActive: true,
      });

      if (!voucher) {
        return NextResponse.json(
          { success: false, error: "Voucher tidak ditemukan atau tidak aktif" },
          { status: 404 }
        );
      }

      // Check expiry
      if (voucher.expiresAt && new Date(voucher.expiresAt) < new Date()) {
        return NextResponse.json(
          { success: false, error: "Voucher sudah kadaluarsa" },
          { status: 400 }
        );
      }

      // Check usage limit
      if (voucher.usageLimit > 0 && voucher.usedCount >= voucher.usageLimit) {
        return NextResponse.json(
          { success: false, error: "Voucher sudah mencapai batas penggunaan" },
          { status: 400 }
        );
      }

      // Check if this customer already used it (for single-use per customer)
      if (
        customerId &&
        voucher.usedBy.some((id: any) => String(id) === String(customerId))
      ) {
        return NextResponse.json(
          { success: false, error: "Voucher sudah pernah digunakan oleh customer ini" },
          { status: 400 }
        );
      }

      // Check minimum purchase
      if (totalAmount !== undefined && totalAmount < voucher.minPurchase) {
        return NextResponse.json(
          {
            success: false,
            error: `Minimum pembelian untuk voucher ini adalah ${voucher.minPurchase.toLocaleString("id-ID")}`,
          },
          { status: 400 }
        );
      }

      // Calculate discount
      let discountAmount = 0;
      if (voucher.discountType === "flat") {
        discountAmount = voucher.discountValue;
      } else {
        discountAmount = Math.round(
          (totalAmount || 0) * (voucher.discountValue / 100)
        );
        if (voucher.maxDiscount && discountAmount > voucher.maxDiscount) {
          discountAmount = voucher.maxDiscount;
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          voucherId: voucher._id,
          code: voucher.code,
          discountType: voucher.discountType,
          discountValue: voucher.discountValue,
          discountAmount,
          description: voucher.description,
        },
      });
    }

    // Create new voucher
    const permissionError = await checkPermission(request, 'vouchers', 'create');
    if (permissionError) return permissionError;

    const {
      code,
      description,
      discountType,
      discountValue,
      minPurchase,
      maxDiscount,
      expiresAt,
      usageLimit,
    } = body;

    if (!code || String(code).trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Kode voucher wajib diisi" },
        { status: 400 }
      );
    }

    if (!discountType || !["flat", "percentage"].includes(discountType)) {
      return NextResponse.json(
        { success: false, error: "Tipe diskon harus flat atau percentage" },
        { status: 400 }
      );
    }

    if (discountValue === undefined || Number(discountValue) < 0) {
      return NextResponse.json(
        { success: false, error: "Nilai diskon tidak valid" },
        { status: 400 }
      );
    }

    if (discountType === "percentage" && Number(discountValue) > 100) {
      return NextResponse.json(
        { success: false, error: "Diskon persentase tidak boleh lebih dari 100%" },
        { status: 400 }
      );
    }

    const voucher = await Voucher.create({
      code: String(code).toUpperCase().trim(),
      description: description?.trim() || undefined,
      discountType,
      discountValue: Number(discountValue),
      minPurchase: Number(minPurchase || 0),
      maxDiscount: maxDiscount ? Number(maxDiscount) : undefined,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      usageLimit: Number(usageLimit || 1),
    });

    return NextResponse.json({ success: true, data: voucher }, { status: 201 });
  } catch (error: any) {
    console.error("VOUCHERS_POST_ERROR:", error);
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
      { success: false, error: "Gagal membuat voucher" },
      { status: 500 }
    );
  }
}