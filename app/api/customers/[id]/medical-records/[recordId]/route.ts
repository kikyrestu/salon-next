import { NextRequest, NextResponse } from "next/server";
import { getTenantModels } from "@/lib/tenantDb";
import { auth } from "@/auth";

// PUT /api/customers/[id]/medical-records/[recordId]
export async function PUT(
  req: NextRequest,
  props: { params: Promise<{ id: string; recordId: string }> }
) {
  const { id, recordId } = await props.params;
  const tenantSlug = req.headers.get("x-store-slug") || "pusat";

  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { MedicalRecord } = await getTenantModels(tenantSlug);

    const record = await MedicalRecord.findOneAndUpdate(
      { _id: recordId, customer: id, storeSlug: tenantSlug },
      {
        $set: {
          date: body.date,
          complaint: body.complaint,
          diagnosis: body.diagnosis,
          treatment: body.treatment,
          prescription: body.prescription,
          handledBy: body.handledBy,
        }
      },
      { new: true }
    ).populate("createdBy", "name");

    if (!record) {
      return NextResponse.json({ success: false, error: "Record not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: record });
  } catch (error: any) {
    console.error("Update medical record error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE /api/customers/[id]/medical-records/[recordId]
export async function DELETE(
  req: NextRequest,
  props: { params: Promise<{ id: string; recordId: string }> }
) {
  const { id, recordId } = await props.params;
  const tenantSlug = req.headers.get("x-store-slug") || "pusat";

  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { MedicalRecord } = await getTenantModels(tenantSlug);

    const record = await MedicalRecord.findOneAndDelete({
      _id: recordId,
      customer: id,
      storeSlug: tenantSlug,
    });

    if (!record) {
      return NextResponse.json({ success: false, error: "Record not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: record });
  } catch (error: any) {
    console.error("Delete medical record error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
