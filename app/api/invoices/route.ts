import { getTenantModels } from "@/lib/tenantDb";
import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/rbac";





import { logActivity } from "@/lib/logger";
import { scheduleFollowUp } from "@/lib/waFollowUp";
import { normalizeIndonesianPhone } from "@/lib/phone";
import { sendWhatsApp } from "@/lib/fonnte";


import { auth } from "@/auth";

const SPLIT_TOLERANCE = 0.01;

const toNum = (value: unknown): number => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const validateSplitAssignments = (
  assignments: any[],
): { valid: boolean; error?: string } => {
  if (!Array.isArray(assignments) || assignments.length === 0) {
    return { valid: true };
  }

  const ids = assignments
    .map((entry) => String(entry?.staffId || entry?.staff || "").trim())
    .filter(Boolean);

  if (ids.length !== new Set(ids).size) {
    return {
      valid: false,
      error: "Duplicate staff is not allowed in split commission assignments",
    };
  }

  const total = assignments.reduce(
    (sum, entry) => sum + toNum(entry?.porsiPersen ?? entry?.percentage),
    0,
  );
  const hasNonPositive = assignments.some(
    (entry) => toNum(entry?.porsiPersen ?? entry?.percentage) <= 0,
  );
  if (hasNonPositive) {
    return {
      valid: false,
      error:
        "Porsi split staff wajib lebih dari 0%. Jika komisi service di-set 0, kirim porsi staff tetap > 0% (atau kosongkan staffAssignments level invoice).",
    };
  }

  if (Math.abs(total - 100) > SPLIT_TOLERANCE) {
    return {
      valid: false,
      error: "Split commission percentage must total 100%",
    };
  }

  return { valid: true };
};

const normalizeSplitAssignments = (assignments: any[] = []) => {
  return assignments.map((entry) => {
    const staffId = entry?.staffId || entry?.staff;
    const porsiPersen = toNum(entry?.porsiPersen ?? entry?.percentage);
    const komisiNominal = toNum(entry?.komisiNominal ?? entry?.commission);

    return {
      ...entry,
      staff: staffId,
      staffId,
      percentage: porsiPersen,
      porsiPersen,
      commission: komisiNominal,
      komisiNominal,
    };
  });
};

export async function POST(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { Invoice, Customer, Product, Settings, CashBalance, CashLog } = await getTenantModels(tenantSlug);

  try {
    

    // Security Check
    const permissionError = await checkPermission(
      request,
      "invoices",
      "create",
    );
    if (permissionError) return permissionError;

    
    const body = await request.json();

    const normalizedBody = {
      ...body,
      followUpPhoneNumber:
        normalizeIndonesianPhone(body?.followUpPhoneNumber) || undefined,
      staffAssignments: normalizeSplitAssignments(body.staffAssignments || []),
      items: Array.isArray(body.items)
        ? body.items.map((item: any) => ({
            ...item,
            splitCommissionMode: item?.splitCommissionMode || "auto",
            staffAssignments: normalizeSplitAssignments(
              item?.staffAssignments || [],
            ),
          }))
        : [],
      // Normalize split payment methods
      ...(Array.isArray(body.paymentMethods) && body.paymentMethods.length > 0
        ? {
            paymentMethods: body.paymentMethods.map((p: any) => ({
              method: String(p.method || "Cash"),
              amount: toNum(p.amount),
            })),
            // Primary paymentMethod = first entry (for backward compat with reports)
            paymentMethod: String(
              body.paymentMethods[0]?.method || body.paymentMethod || "Cash",
            ),
          }
        : {}),
    };

    const topSplitValidation = validateSplitAssignments(
      normalizedBody.staffAssignments || [],
    );
    if (!topSplitValidation.valid) {
      return NextResponse.json(
        { success: false, error: topSplitValidation.error },
        { status: 400 },
      );
    }

    for (const item of normalizedBody.items) {
      if (item.itemModel !== "Service") continue;
      const itemSplitValidation = validateSplitAssignments(
        item.staffAssignments || [],
      );
      if (!itemSplitValidation.valid) {
        return NextResponse.json(
          {
            success: false,
            error: `${item.name || "Service item"}: ${itemSplitValidation.error}`,
          },
          { status: 400 },
        );
      }
    }

    // Generate Invoice Number: Find the latest invoice and increment its number
    const lastInvoice = await Invoice.findOne().sort({ createdAt: -1 });
    let nextNum = 1;

    if (lastInvoice && lastInvoice.invoiceNumber) {
      const lastNum = parseInt(
        lastInvoice.invoiceNumber.split("-").pop() || "0",
      );
      if (!isNaN(lastNum)) {
        nextNum = lastNum + 1;
      }
    }

    const invoiceNumber = `INV-${new Date().getFullYear()}-${nextNum.toString().padStart(5, "0")}`;

    const invoice = (await Invoice.create({
      ...normalizedBody,
      invoiceNumber,
    })) as any;

    // --- CASH DRAWER INTEGRATION ---
    if (invoice.status === "paid" || invoice.status === "partially_paid") {
      let cashAmount = 0;
      
      if (invoice.paymentMethods && invoice.paymentMethods.length > 0) {
          const cashPayment = invoice.paymentMethods.find((p: any) => p.method.toLowerCase() === 'cash');
          if (cashPayment) cashAmount = cashPayment.amount;
      } else if (invoice.paymentMethod && invoice.paymentMethod.toLowerCase() === 'cash') {
          cashAmount = invoice.amountPaid || invoice.totalAmount;
      }

      if (cashAmount > 0) {
          const session: any = await auth();
          const userId = session?.user?.id;
          
          let balance = await CashBalance.findOne();
          if (!balance) balance = await CashBalance.create({ kasirBalance: 0, brankasBalance: 0, bankBalance: 0 });
          
          balance.kasirBalance += cashAmount;
          balance.lastUpdatedAt = new Date();
          await balance.save();
          
          await CashLog.create({
              type: 'sale',
              amount: cashAmount,
              sourceLocation: 'customer',
              destinationLocation: 'kasir',
              performedBy: userId,
              description: `Sales Payment for Invoice ${invoiceNumber}`,
              referenceModel: 'Invoice',
              referenceId: invoice._id,
              balanceAfter: {
                  kasir: balance.kasirBalance,
                  brankas: balance.brankasBalance,
                  bank: balance.bankBalance
              }
          });
      }
    }
    // -------------------------------

    // Auto-deduct product stock and send low-stock WA notification if needed
    for (const item of normalizedBody.items) {
      if (item.itemModel !== "Product") continue;

      const itemId = item.item || item._id || item.itemId;
      const quantity = toNum(item.quantity ?? 1);

      try {
        const updatedProduct = await Product.findByIdAndUpdate(
          itemId,
          { $inc: { stock: -quantity } },
          { new: true },
        );

        if (!updatedProduct) continue;

        if (
          updatedProduct.stock <= updatedProduct.alertQuantity &&
          !updatedProduct.lowStockNotifSent &&
          updatedProduct.lowStockAlertEnabled !== false
        ) {
          // Send WA low-stock notification to admin — error must NOT fail invoice creation
          try {
            const settings = await Settings.findOne();
            const adminPhone = settings?.phone;

            if (adminPhone) {
              const message =
                `⚠️ *Stok Hampir Habis!*\n\nProduk: ${updatedProduct.name}\n` +
                `Stok saat ini: ${updatedProduct.stock}\n` +
                `Batas minimum: ${updatedProduct.alertQuantity}\n\n` +
                `Segera lakukan pemesanan stok.`;

              await sendWhatsApp(adminPhone, message);
            }
          } catch (waError) {
            console.error(
              `[LowStock] WA notification error for product ${itemId}:`,
              waError,
            );
          }

          // Mark notif as sent to prevent duplicates
          await Product.findByIdAndUpdate(itemId, { lowStockNotifSent: true });
        } else if (updatedProduct.stock > updatedProduct.alertQuantity) {
          // Stock recovered — reset flag so future drops trigger notification again
          await Product.findByIdAndUpdate(itemId, { lowStockNotifSent: false });
        }
      } catch (stockError) {
        console.error(
          `[LowStock] Failed to update stock for product ${itemId}:`,
          stockError,
        );
      }
    }

    // Process Wallet Top-Up items
    if (invoice.status === "paid" && invoice.customer) {
      for (const item of normalizedBody.items) {
        if (item.itemModel === "TopUp") {
          const topUpAmount = toNum(item.total || (item.price * item.quantity));
          
          if (topUpAmount > 0) {
            // Find settings for bonus
            const settings = await Settings.findOne({}).lean() as any;
            const tiers = (settings?.walletBonusTiers || [])
                .filter((t: any) => t.minAmount && t.bonusPercent)
                .sort((a: any, b: any) => b.minAmount - a.minAmount);
            
            let bonusPercent = 0;
            let bonusAmount = 0;

            for (const tier of tiers) {
                if (topUpAmount >= tier.minAmount) {
                    bonusPercent = tier.bonusPercent;
                    bonusAmount = Math.round(topUpAmount * (tier.bonusPercent / 100));
                    break;
                }
            }

            const totalCredited = topUpAmount + bonusAmount;
            
            // Update customer wallet balance
            const cust = await Customer.findById(invoice.customer);
            if (cust) {
                cust.walletBalance = (cust.walletBalance || 0) + totalCredited;
                await cust.save();

                const session: any = await auth();
                const WalletTransaction = (await import('@/models/WalletTransaction')).default;

                // Create WalletTransaction
                await WalletTransaction.create({
                    customer: cust._id,
                    type: 'topup',
                    amount: totalCredited,
                    balanceAfter: cust.walletBalance,
                    description: `Top-Up via POS Invoice ${invoiceNumber}`,
                    topupMethod: invoice.paymentMethod || 'Cash',
                    bonusPercent,
                    bonusAmount,
                    invoice: invoice._id,
                    performedBy: session?.user?.id,
                });
            }
          }
        }
      }
    }

    // Loyalty Point Logic: Calculate points if status is 'paid'
    let pointsToGain = 0;
    if (invoice.status === "paid" && invoice.customer) {
      const systemSettings = await Settings.findOne();
      const spendRule = systemSettings?.loyaltyPointPerSpend || 0;
      if (spendRule > 0) {
        pointsToGain = Math.floor(invoice.totalAmount / spendRule);
      }
      
      const loyaltyUpdates: any = {
        $inc: { totalPurchases: invoice.totalAmount },
      };

      if (pointsToGain > 0) {
        loyaltyUpdates.$inc.loyaltyPoints = pointsToGain;
      }
      
      // Deduct used loyalty points if provided
      const pointsUsed = toNum(normalizedBody.loyaltyPointsUsed);
      if (pointsUsed > 0) {
        loyaltyUpdates.$inc.loyaltyPoints = loyaltyUpdates.$inc.loyaltyPoints
          ? loyaltyUpdates.$inc.loyaltyPoints - pointsUsed
          : -pointsUsed;
      }

      if (Object.keys(loyaltyUpdates.$inc).length > 0) {
        await Customer.findByIdAndUpdate(invoice.customer, loyaltyUpdates);
        
        // Update the invoice to reflect earned/used points
        await Invoice.findByIdAndUpdate(invoice._id, {
          loyaltyPointsEarned: pointsToGain,
          loyaltyPointsUsed: pointsUsed,
        });
      }
    }

    // Referral reward: if a referral code was submitted, reward the referrer
    const referralCodeSubmitted = normalizedBody.referralCode;
    if (referralCodeSubmitted && invoice.status === "paid") {
      try {
        const referrer = await Customer.findOne({
          referralCode: String(referralCodeSubmitted).toUpperCase().trim(),
        });
        if (referrer) {
          // Set referredBy on the customer if not already set
          const currentCustomer = await Customer.findById(invoice.customer);
          if (currentCustomer && !currentCustomer.referredBy) {
            await Customer.findByIdAndUpdate(currentCustomer._id, {
              referredBy: referrer._id
            });
          }

          // Reward logic:
          const isVIP = referrer.membershipExpiry && new Date(referrer.membershipExpiry).getTime() > new Date().getTime();
          if (isVIP) {
            const systemSettings = await Settings.findOne();
            const rewardPoints = systemSettings?.referralRewardPoints || 0;
            if (rewardPoints > 0) {
              await Customer.findByIdAndUpdate(referrer._id, {
                $inc: { loyaltyPoints: rewardPoints },
              });
            }
          } else {
            console.log("[Referral] Referrer is not VIP, skipped reward.");
          }
        }
      } catch (refErr) {
        console.error("[Referral] Error rewarding referrer:", refErr);
      }
    }

    await scheduleFollowUp(invoice._id);

    await logActivity({
      req: request,
      action: "create",
      resource: "invoice",
      resourceId: invoice._id as string,
      details: `Created invoice ${invoiceNumber} for amount $${invoice.totalAmount}`,
    });

    return NextResponse.json({ success: true, data: invoice });
  } catch (error: any) {
    console.error("INVOICE_CREATE_ERROR:", error);
    if (error.name === "ValidationError") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Validation failed: " +
            Object.values(error.errors)
              .map((e: any) => e.message)
              .join(", "),
        },
        { status: 400 },
      );
    }
    if (error.code === 11000) {
      return NextResponse.json(
        {
          success: false,
          error: "Duplicate invoice number. Please try again.",
        },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to create invoice" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { Invoice, Customer, Product, Settings, CashBalance, CashLog } = await getTenantModels(tenantSlug);

  try {
    

    // Security Check
    const permissionError = await checkPermission(request, "invoices", "view");
    if (permissionError) return permissionError;

    

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "all";
    const customerId = searchParams.get("customerId");

    const skip = (page - 1) * limit;

    const query: any = {};

    if (customerId) {
      query.customer = customerId;
    }

    // Scope Check (Own vs All) - Optional refinement
    // const scope = await getViewScope('invoices');
    // if (scope === 'own') query.staff = session.user.id;

    if (status !== "all") {
      query.status = status;
    }

    if (search) {
      // Search in invoiceNumber
      const searchQueries: any[] = [
        { invoiceNumber: { $regex: search, $options: "i" } },
      ];

      // Or search by customer name if we can find customer IDs
      const customers = await Customer.find({
        name: { $regex: search, $options: "i" },
      }).select("_id");
      if (customers.length > 0) {
        searchQueries.push({ customer: { $in: customers.map((c) => c._id) } });
      }

      query.$or = searchQueries;
    }

    const total = await Invoice.countDocuments(query);
    const invoices = await Invoice.find(query)
      .populate("customer", "name phone")
      .populate("staff", "name")
      .populate("staffAssignments.staff", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return NextResponse.json({
      success: true,
      data: invoices,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("API Error Invoices GET:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch invoices" },
      { status: 500 },
    );
  }
}
