import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Customer from "@/models/Customer";
import crypto from "crypto";

import { checkPermission, getViewScope } from "@/lib/rbac";
import { auth } from "@/auth";
import { validateAndSanitize, validationErrorResponse } from "@/lib/validation";
import { logActivity } from "@/lib/logger";
import { normalizeIndonesianPhone } from "@/lib/phone";
import { initModels, CustomerPackage } from "@/lib/initModels";

type CustomerQuery = Record<string, unknown>;

interface SessionLike {
  user?: {
    id?: string;
  };
}

interface CustomerListItem {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  totalPurchases: number;
  status: string;
  createdAt: Date;
  createdBy?: string;
  referralCode?: string;
  referredBy?: string | object;
  membershipExpiry?: Date;
}

interface CustomerPackageQuotaRow {
  remainingQuota?: number;
}

interface CustomerPackageRow {
  customer: string;
  status: "active" | "depleted" | "expired" | "cancelled";
  serviceQuotas?: CustomerPackageQuotaRow[];
  packageName?: string;
}

// GET /api/customers - List all customers
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    initModels();

    // Check Permissions
    const permissionError = await checkPermission(request, "customers", "view");
    if (permissionError) return permissionError;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    // Apply Scope
    const scope = await getViewScope("customers");
    let query: any = {};

    if (scope === "own") {
      const session = (await auth()) as SessionLike | null;
      if (session?.user?.id) {
        query.createdBy = session.user.id;
      }
    }
    
    const referralCodeParam = searchParams.get("referralCode");
    if (referralCodeParam) {
      query.referralCode = referralCodeParam;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const customers = await Customer.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean<CustomerListItem[]>();

    const customerIds = customers.map((customer) => customer._id);
    const packageRows =
      customerIds.length > 0
        ? await CustomerPackage.find({
            customer: { $in: customerIds },
            status: { $in: ["active", "depleted"] },
          })
            .select("customer status serviceQuotas packageName activatedAt")
            .lean<CustomerPackageRow[]>()
        : [];

    const packageSummaryByCustomer = new Map<
      string,
      {
        hasPackage: boolean;
        totalPackages: number;
        activePackages: number;
        totalRemainingQuota: number;
        latestPackageName: string;
      }
    >();

    packageRows.forEach((row) => {
      const key = String(row.customer);
      const current = packageSummaryByCustomer.get(key) || {
        hasPackage: false,
        totalPackages: 0,
        activePackages: 0,
        totalRemainingQuota: 0,
        latestPackageName: "",
      };

      const remainingQuota = Array.isArray(row.serviceQuotas)
        ? row.serviceQuotas.reduce(
            (sum: number, quota) => sum + Number(quota?.remainingQuota || 0),
            0,
          )
        : 0;

      const nextSummary = {
        hasPackage: true,
        totalPackages: current.totalPackages + 1,
        activePackages:
          current.activePackages + (row.status === "active" ? 1 : 0),
        totalRemainingQuota: current.totalRemainingQuota + remainingQuota,
        latestPackageName:
          current.latestPackageName || String(row.packageName || ""),
      };

      packageSummaryByCustomer.set(key, nextSummary);
    });

    const customersWithSummary = customers.map((customer) => ({
      ...customer,
      packageSummary: packageSummaryByCustomer.get(String(customer._id)) || {
        hasPackage: false,
        totalPackages: 0,
        activePackages: 0,
        totalRemainingQuota: 0,
        latestPackageName: "",
      },
    }));

    // Backfill missing referral codes for PREMIUM customers only
    const missingCodes = customersWithSummary.filter(c => !c.referralCode && (c as any).membershipTier === 'premium');
    if (missingCodes.length > 0) {
      for (const c of missingCodes) {
        let rc = "";
        let attempts = 0;
        while (!rc && attempts < 10) {
          attempts++;
          const candidate = crypto.randomBytes(3).toString("hex").toUpperCase();
          const exists = await Customer.findOne({ referralCode: candidate }).lean();
          if (!exists) rc = candidate;
        }
        if (rc) {
          await Customer.updateOne({ _id: c._id }, { $set: { referralCode: rc } });
          c.referralCode = rc;
        }
      }
    }

    const total = await Customer.countDocuments(query);

    return NextResponse.json({
      success: true,
      data: customersWithSummary,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch customers";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

// POST /api/customers - Create new customer
export async function POST(request: NextRequest) {
  try {
    await connectDB();

    // Check Permissions
    const permissionError = await checkPermission(
      request,
      "customers",
      "create",
    );
    if (permissionError) return permissionError;

    const body = await request.json();

    // Validate and sanitize input
    const validation = validateAndSanitize(body, {
      required: ["name"],
      email: ["email"],
      phone: ["phone"],
      maxLength: [
        { field: "name", length: 100 },
        { field: "email", length: 100 },
        { field: "phone", length: 20 },
        { field: "address", length: 255 },
      ],
    });

    if (!validation.isValid) {
      return validationErrorResponse(validation.errors);
    }

    if (validation.sanitizedData.phone) {
      validation.sanitizedData.phone = normalizeIndonesianPhone(
        validation.sanitizedData.phone,
      );
    }

    const session = (await auth()) as SessionLike | null;

    // Auto-generate unique referral code ONLY for premium members
    let referralCode: string | undefined;
    const tierToSet = validation.sanitizedData.membershipTier || 'regular';
    if (tierToSet === 'premium') {
      let attempts = 0;
      while (!referralCode && attempts < 10) {
        const candidate = crypto
          .randomBytes(4)
          .toString("hex")
          .toUpperCase()
          .slice(0, 6);
        const exists = await Customer.findOne({ referralCode: candidate }).lean();
        if (!exists) referralCode = candidate;
        attempts++;
      }
    }

    // Processing referredByCode
    let referredBy = undefined;
    if (validation.sanitizedData.referredByCode) {
      const codeStr = String(validation.sanitizedData.referredByCode).toUpperCase().trim();
      const referrer = await Customer.findOne({ referralCode: codeStr });
      if (referrer) {
         referredBy = referrer._id;
         const storeSettings = await import("@/models/Settings").then(m => m.default).then(S => S.findOne());
         const rewardPoints = storeSettings?.referralRewardPoints || 0;
         if (rewardPoints > 0) {
             referrer.loyaltyPoints = (referrer.loyaltyPoints || 0) + rewardPoints;
             await referrer.save();
         }
      }
    }

    const customer = await Customer.create({
      ...validation.sanitizedData,
      createdBy: session?.user?.id,
      referralCode,
      referredBy,
      membershipTier: tierToSet,
      waNotifEnabled: validation.sanitizedData.waNotifEnabled !== false,
    });
    const createdCustomer = Array.isArray(customer) ? customer[0] : customer;

    await logActivity({
      req: request,
      action: "create",
      resource: "customer",
      resourceId: String(createdCustomer._id),
      details: `Created customer: ${createdCustomer.name}`,
    });

    return NextResponse.json(
      { success: true, data: createdCustomer },
      { status: 201 },
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to create customer";
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 },
    );
  }
}
