import { getTenantModels } from "@/lib/tenantDb";
import { NextRequest, NextResponse } from 'next/server';
import { checkPermission } from '@/lib/rbac';


interface PackageInputItem {
  service: string;
  quota: number;
  serviceName?: string;
}

interface PackageBody {
  name: string;
  code: string;
  description?: string;
  price: number;
  image?: string;
  items: PackageInputItem[];
  isActive?: boolean;
  commissionType?: 'percentage' | 'fixed';
  commissionValue?: number;
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

export async function GET(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { ServicePackage, Service } = await getTenantModels(tenantSlug);

  try {
    const permissionError = await checkPermission(request, 'services', 'view');
    if (permissionError) return permissionError;

    
    

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const active = searchParams.get('active');

    const query: Record<string, unknown> = {};
    if (active === 'true') query.isActive = true;
    if (active === 'false') query.isActive = false;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
      ];
    }

    const packages = await ServicePackage.find(query)
      .populate('items.service', 'name price')
      .sort({ createdAt: -1 });

    return NextResponse.json({ success: true, data: packages });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch service packages';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { ServicePackage, Service } = await getTenantModels(tenantSlug);

  try {
    const permissionError = await checkPermission(request, 'services', 'create');
    if (permissionError) return permissionError;

    
    

    const body = (await request.json()) as PackageBody;
    const { name, code, description, price, image, items } = body;

    if (!name || !code) {
      return NextResponse.json({ success: false, error: 'name and code are required' }, { status: 400 });
    }

    const itemValidationError = validateItems(items);
    if (itemValidationError) {
      return NextResponse.json({ success: false, error: itemValidationError }, { status: 400 });
    }

    const serviceIds = items.map((item) => item.service);
    const services = await Service.find({ _id: { $in: serviceIds } }).select('_id name');

    if (services.length !== serviceIds.length) {
      return NextResponse.json({ success: false, error: 'One or more services are invalid' }, { status: 400 });
    }

    const serviceNameMap = new Map<string, string>(services.map((svc) => [String(svc._id), String(svc.name)]));
    const normalizedCode = sanitizeCode(code);

    const created = await ServicePackage.create({
      name: String(name).trim(),
      code: normalizedCode,
      description: description ? String(description).trim() : undefined,
      price: Number(price || 0),
      image: image ? String(image).trim() : undefined,
      items: items.map((item) => ({
        service: item.service,
        serviceName: serviceNameMap.get(String(item.service)) || item.serviceName || 'Service',
        quota: Number(item.quota),
      })),
      isActive: body.isActive !== false,
      commissionType: body.commissionType || 'fixed',
      commissionValue: Number(body.commissionValue || 0),
    });

    return NextResponse.json({ success: true, data: created });
  } catch (error: unknown) {
    const typedError = error as { code?: number };
    if (typedError.code === 11000) {
      return NextResponse.json({ success: false, error: 'Package code already exists' }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : 'Failed to create service package';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
