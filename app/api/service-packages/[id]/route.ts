import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/lib/mongodb';
import { checkPermission } from '@/lib/rbac';
import { initModels, ServicePackage, Service } from '@/lib/initModels';

interface PackageInputItem {
  service: string;
  quota: number;
  serviceName?: string;
}

interface PackageUpdateBody {
  name?: string;
  code?: string;
  description?: string;
  price?: number;
  isActive?: boolean;
  items?: PackageInputItem[];
}

function sanitizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '-');
}

function validateItems(items: PackageInputItem[]): string | null {
  if (!Array.isArray(items) || items.length === 0) {
    return 'Package must contain at least one service item';
  }

  const seen = new Set<string>();
  for (const item of items) {
    if (!item?.service) return 'Each item must include a service';
    if (!item?.quota || Number(item.quota) <= 0) return 'Each item quota must be greater than 0';

    const key = String(item.service);
    if (seen.has(key)) return 'Duplicate service in package items is not allowed';
    seen.add(key);
  }

  return null;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const permissionError = await checkPermission(request, 'services', 'view');
    if (permissionError) return permissionError;

    await connectToDB();
    initModels();
    const { id } = await params;

    const item = await ServicePackage.findById(id).populate('items.service', 'name price');
    if (!item) return NextResponse.json({ success: false, error: 'Service package not found' }, { status: 404 });

    return NextResponse.json({ success: true, data: item });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch service package';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const permissionError = await checkPermission(request, 'services', 'edit');
    if (permissionError) return permissionError;

    await connectToDB();
    initModels();

    const { id } = await params;
    const body = (await request.json()) as PackageUpdateBody;

    const updatePayload: Record<string, unknown> = {};

    if (body.name !== undefined) updatePayload.name = String(body.name).trim();
    if (body.description !== undefined) updatePayload.description = body.description ? String(body.description).trim() : '';
    if (body.price !== undefined) updatePayload.price = Number(body.price || 0);
    if (body.code !== undefined) updatePayload.code = sanitizeCode(String(body.code));
    if (body.isActive !== undefined) updatePayload.isActive = Boolean(body.isActive);

    if (body.items !== undefined) {
      const itemValidationError = validateItems(body.items);
      if (itemValidationError) {
        return NextResponse.json({ success: false, error: itemValidationError }, { status: 400 });
      }

      const serviceIds = body.items.map((item) => item.service);
      const services = await Service.find({ _id: { $in: serviceIds } }).select('_id name');

      if (services.length !== serviceIds.length) {
        return NextResponse.json({ success: false, error: 'One or more services are invalid' }, { status: 400 });
      }

      const serviceNameMap = new Map<string, string>(services.map((svc) => [String(svc._id), String(svc.name)]));
      updatePayload.items = body.items.map((item) => ({
        service: item.service,
        serviceName: serviceNameMap.get(String(item.service)) || item.serviceName || 'Service',
        quota: Number(item.quota),
      }));
    }

    const updated = await ServicePackage.findByIdAndUpdate(id, updatePayload, { new: true });
    if (!updated) return NextResponse.json({ success: false, error: 'Service package not found' }, { status: 404 });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: unknown) {
    const typedError = error as { code?: number };
    if (typedError.code === 11000) {
      return NextResponse.json({ success: false, error: 'Package code already exists' }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : 'Failed to update service package';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const permissionError = await checkPermission(request, 'services', 'delete');
    if (permissionError) return permissionError;

    await connectToDB();
    initModels();
    const { id } = await params;

    const updated = await ServicePackage.findByIdAndUpdate(id, { isActive: false }, { new: true });
    if (!updated) return NextResponse.json({ success: false, error: 'Service package not found' }, { status: 404 });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete service package';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
