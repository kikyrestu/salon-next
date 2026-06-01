import { NextRequest, NextResponse } from "next/server";
import { getTenantModels } from "@/lib/tenantDb";
import { auth } from "@/auth";

// GET /api/customers/[id]/medical-records
export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const tenantSlug = req.headers.get("x-store-slug") || "pusat";

  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { MedicalRecord, User } = await getTenantModels(tenantSlug);
    
    const records = await MedicalRecord.find({ customer: id, storeSlug: tenantSlug })
      .populate("createdBy", "name")
      .sort({ date: -1 })
      .lean();

    return NextResponse.json({ success: true, data: records });
  } catch (error: any) {
    console.error("Fetch medical records error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/customers/[id]/medical-records
export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const tenantSlug = req.headers.get("x-store-slug") || "pusat";

  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { MedicalRecord } = await getTenantModels(tenantSlug);

    const newRecord = new MedicalRecord({
      customer: id,
      storeSlug: tenantSlug,
      date: body.date || new Date(),
      complaint: body.complaint || "",
      diagnosis: body.diagnosis || "",
      treatment: body.treatment || "",
      prescription: body.prescription || "",
      handledBy: body.handledBy || "",
      createdBy: session.user.id,
    });

    await newRecord.save();
    
    // Populate createdBy
    await newRecord.populate("createdBy", "name");

    return NextResponse.json({ success: true, data: newRecord });
  } catch (error: any) {
    console.error("Create medical record error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
