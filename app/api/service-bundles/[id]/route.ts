import { NextRequest, NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import ServiceBundle from "@/models/ServiceBundle";
import { initModels } from "@/lib/initModels";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDB();
    initModels();

    const { id } = await params;

    const bundle = await ServiceBundle.findById(id).populate(
      "services.service",
      "name price commissionType commissionValue duration"
    );

    if (!bundle) {
      return NextResponse.json(
        { success: false, error: "Bundle tidak ditemukan" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: bundle });
  } catch (error) {
    console.error("SERVICE_BUNDLE_GET_ID_ERROR:", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil data bundle" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDB();
    initModels();

    const { id } = await params;
    const body = await request.json();

    const { name, description, price, image, services } = body;

    if (name !== undefined && (!name || String(name).trim().length === 0)) {
      return NextResponse.json(
        { success: false, error: "Nama bundle tidak boleh kosong" },
        { status: 400 }
      );
    }

    if (price !== undefined && Number(price) < 0) {
      return NextResponse.json(
        { success: false, error: "Harga bundle tidak boleh negatif" },
        { status: 400 }
      );
    }

    if (services !== undefined) {
      if (!Array.isArray(services) || services.length < 1) {
        return NextResponse.json(
          { success: false, error: "Bundle harus memiliki minimal 1 jasa" },
          { status: 400 }
        );
      }

      for (const item of services) {
        if (!item.service) {
          return NextResponse.json(
            {
              success: false,
              error: "Setiap item bundel harus merujuk ke jasa yang valid",
            },
            { status: 400 }
          );
        }
      }
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = String(name).trim();
    if (description !== undefined)
      updateData.description = description?.trim() || undefined;
    if (price !== undefined) updateData.price = Number(price);
    if (image !== undefined) updateData.image = image?.trim() || undefined;
    if (services !== undefined) updateData.services = services;

    const bundle = await ServiceBundle.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).populate("services.service", "name price commissionType commissionValue duration");

    if (!bundle) {
      return NextResponse.json(
        { success: false, error: "Bundle tidak ditemukan" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: bundle });
  } catch (error: any) {
    console.error("SERVICE_BUNDLE_PUT_ERROR:", error);
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
      { success: false, error: "Gagal mengupdate bundle" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDB();
    initModels();

    const { id } = await params;

    const bundle = await ServiceBundle.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!bundle) {
      return NextResponse.json(
        { success: false, error: "Bundle tidak ditemukan" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Bundle berhasil dinonaktifkan",
    });
  } catch (error) {
    console.error("SERVICE_BUNDLE_DELETE_ERROR:", error);
    return NextResponse.json(
      { success: false, error: "Gagal menghapus bundle" },
      { status: 500 }
    );
  }
}
