import { NextRequest, NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import ServiceBundle from "@/models/ServiceBundle";
import { initModels } from "@/lib/initModels";

export async function GET() {
  try {
    await connectToDB();
    initModels();

    const bundles = await ServiceBundle.find({ isActive: true })
      .populate("services.service", "name price commissionType commissionValue duration")
      .sort({ createdAt: -1 });

    return NextResponse.json({ success: true, data: bundles });
  } catch (error) {
    console.error("SERVICE_BUNDLES_GET_ERROR:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch service bundles" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectToDB();
    initModels();

    const body = await request.json();

    const { name, description, price, image, services } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Nama bundle wajib diisi" },
        { status: 400 }
      );
    }

    if (price === undefined || price === null || Number(price) < 0) {
      return NextResponse.json(
        { success: false, error: "Harga bundle tidak boleh negatif" },
        { status: 400 }
      );
    }

    if (!Array.isArray(services) || services.length < 1) {
      return NextResponse.json(
        { success: false, error: "Bundle harus memiliki minimal 1 jasa" },
        { status: 400 }
      );
    }

    for (const item of services) {
      if (!item.service) {
        return NextResponse.json(
          { success: false, error: "Setiap item bundel harus merujuk ke jasa yang valid" },
          { status: 400 }
        );
      }
    }

    const bundle = await ServiceBundle.create({
      name: name.trim(),
      description: description?.trim() || undefined,
      price: Number(price),
      image: image?.trim() || undefined,
      services,
    });

    return NextResponse.json({ success: true, data: bundle }, { status: 201 });
  } catch (error: any) {
    console.error("SERVICE_BUNDLES_POST_ERROR:", error);
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
      { success: false, error: "Gagal membuat service bundle" },
      { status: 500 }
    );
  }
}
