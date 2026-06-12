import { NextRequest, NextResponse } from "next/server";
import { getTenantModels } from "@/lib/tenantDb";

export async function GET(request: NextRequest, props: any) {
  try {
    const { slug, code } = await props.params;

    if (!code) {
      return new NextResponse("Kode URL tidak valid", { status: 400 });
    }

    const { ShortLink } = await getTenantModels(slug);
    const link = await ShortLink.findOne({ code }).lean();

    if (!link || !link.targetUrl) {
      return new NextResponse("Link tidak ditemukan atau sudah kedaluwarsa.", { status: 404 });
    }

    return NextResponse.redirect(link.targetUrl);
  } catch (error) {
    console.error("Short URL Error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
