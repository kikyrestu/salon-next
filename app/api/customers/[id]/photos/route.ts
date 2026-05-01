import { getTenantModels } from "@/lib/tenantDb";
import { NextRequest, NextResponse } from "next/server";


export async function GET(_request: NextRequest, props: any) {
    const tenantSlug = _request.headers.get('x-store-slug') || 'pusat';
    const { Customer } = await getTenantModels(tenantSlug);

  try {
    
    const { id } = await props.params;

    const customer = await Customer.findById(id).select("beforeAfterPhotos name");
    if (!customer) {
      return NextResponse.json(
        { success: false, error: "Customer tidak ditemukan" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: customer.beforeAfterPhotos || [],
    });
  } catch (error) {
    console.error("CUSTOMER_PHOTOS_GET_ERROR:", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil foto" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { Customer } = await getTenantModels(tenantSlug);

  try {
    
    const { id } = await props.params;
    const body = await request.json();

    const { before, after, note } = body;

    if (!before || !after) {
      return NextResponse.json(
        { success: false, error: "Foto before dan after wajib diisi" },
        { status: 400 }
      );
    }

    const customer = await Customer.findByIdAndUpdate(
      id,
      {
        $push: {
          beforeAfterPhotos: {
            before: String(before).trim(),
            after: String(after).trim(),
            note: note ? String(note).trim() : undefined,
            date: new Date(),
          },
        },
      },
      { new: true, runValidators: true }
    ).select("beforeAfterPhotos");

    if (!customer) {
      return NextResponse.json(
        { success: false, error: "Customer tidak ditemukan" },
        { status: 404 }
      );
    }

    const newPhoto =
      customer.beforeAfterPhotos[customer.beforeAfterPhotos.length - 1];

    return NextResponse.json(
      { success: true, data: newPhoto },
      { status: 201 }
    );
  } catch (error) {
    console.error("CUSTOMER_PHOTOS_POST_ERROR:", error);
    return NextResponse.json(
      { success: false, error: "Gagal menambahkan foto" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { Customer } = await getTenantModels(tenantSlug);

  try {
    
    const { id } = await props.params;

    const { searchParams } = new URL(request.url);
    const photoId = searchParams.get("photoId");

    if (!photoId) {
      return NextResponse.json(
        { success: false, error: "photoId wajib disertakan" },
        { status: 400 }
      );
    }

    const customer = await Customer.findByIdAndUpdate(
      id,
      {
        $pull: {
          beforeAfterPhotos: { _id: photoId },
        },
      },
      { new: true }
    ).select("beforeAfterPhotos");

    if (!customer) {
      return NextResponse.json(
        { success: false, error: "Customer tidak ditemukan" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Foto berhasil dihapus",
    });
  } catch (error) {
    console.error("CUSTOMER_PHOTOS_DELETE_ERROR:", error);
    return NextResponse.json(
      { success: false, error: "Gagal menghapus foto" },
      { status: 500 }
    );
  }
}
