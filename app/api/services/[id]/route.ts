import { getTenantModels } from "@/lib/tenantDb";
import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/rbac";


const normalizeServicePayload = (payload: any) => {
    const body = { ...payload };

    const toLegacyDays = (value: number, unit: string) => {
        if (!Number.isFinite(value) || value <= 0) return 0;
        if (unit === 'minute') return value / 1440;
        if (unit === 'hour') return value / 24;
        return value;
    };

    if (body?.waFollowUp) {
        const firstDelayUnit = body.waFollowUp.firstDelayUnit || 'day';
        const secondDelayUnit = body.waFollowUp.secondDelayUnit || 'day';
        const firstDelayValue = Number(body.waFollowUp.firstDelayValue ?? body.waFollowUp.firstDays ?? 0);
        const secondDelayValue = Number(body.waFollowUp.secondDelayValue ?? body.waFollowUp.secondDays ?? 0);

        body.waFollowUp = {
            ...body.waFollowUp,
            firstDays: toLegacyDays(firstDelayValue, firstDelayUnit),
            secondDays: toLegacyDays(secondDelayValue, secondDelayUnit),
            firstDelayValue,
            firstDelayUnit,
            secondDelayValue,
            secondDelayUnit,
            firstTemplateId: body.waFollowUp.firstTemplateId || undefined,
            secondTemplateId: body.waFollowUp.secondTemplateId || undefined,
        };
    }

    return body;
};

export async function PUT(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { Service } = await getTenantModels(tenantSlug);

    try {
    const permissionErrorPUT = await checkPermission(request, 'services', 'edit');
    if (permissionErrorPUT) return permissionErrorPUT;
        
        const { id } = await props.params;
        const rawBody = await request.json();
        const body = normalizeServicePayload(rawBody);
        const service = await Service.findByIdAndUpdate(id, body, { new: true });

        if (!service) {
            return NextResponse.json({ success: false, error: "Service not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: service });
    } catch (error) {
        console.error("Error updating service:", error);
        return NextResponse.json({ success: false, error: "Failed to update service" }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { Service } = await getTenantModels(tenantSlug);

    try {
    const permissionErrorDELETE = await checkPermission(request, 'services', 'delete');
    if (permissionErrorDELETE) return permissionErrorDELETE;
        
        const { id } = await props.params;
        const service = await Service.findByIdAndUpdate(id, { status: "inactive" }, { new: true });

        if (!service) {
            return NextResponse.json({ success: false, error: "Service not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: service });
    } catch (error) {
        console.error("Error deleting service:", error);
        return NextResponse.json({ success: false, error: "Failed to delete service" }, { status: 500 });
    }
}
