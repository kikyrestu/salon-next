import { getTenantModels } from "@/lib/tenantDb";

import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";


import { getMonthDateRangeInTimezone, getUtcRangeForDateRange } from "@/lib/dateUtils";
import { checkPermission } from "@/lib/rbac";

export async function GET(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { Settings, Invoice, Expense, Appointment, Customer, Product, Service, Staff, Payroll, Purchase } = await getTenantModels(tenantSlug);

    try {
    const permissionErrorGET = await checkPermission(request, 'reports', 'view');
    if (permissionErrorGET) return permissionErrorGET;
        
        const { searchParams } = new URL(request.url);
        const type = searchParams.get("type");
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");
        const settings = await Settings.findOne({}, { timezone: 1 }).lean();
        const timezone = settings?.timezone || "UTC";
        const defaultRange = getMonthDateRangeInTimezone(timezone);
        const { start, end } = getUtcRangeForDateRange(
            startDate || defaultRange.startDate,
            endDate || defaultRange.endDate,
            timezone
        );

        let data: any = null;

        switch (type) {
            case "sales":
                // Sales Report: Invoices breakdown with optional staff/service filter
                const salesQuery: any = { date: { $gte: start, $lte: end }, status: { $nin: ['cancelled', 'voided'] } };
                const rawStaffFilter = searchParams.get("staffId");
                const rawServiceFilter = searchParams.get("serviceId");

                if (rawStaffFilter) {
                    try {
                        const staffObjectId = new mongoose.Types.ObjectId(rawStaffFilter);
                        salesQuery.$or = [
                            { staff: staffObjectId },
                            { 'staffAssignments.staff': staffObjectId },
                            { 'items.staffAssignments.staff': staffObjectId },
                        ];
                    } catch (err) {
                        // Ignore invalid ObjectId
                    }
                }
                if (rawServiceFilter) {
                    try {
                        const serviceObjectId = new mongoose.Types.ObjectId(rawServiceFilter);
                        salesQuery['items.item'] = serviceObjectId;
                        salesQuery['items.itemModel'] = 'Service';
                    } catch (err) {
                        // Ignore invalid ObjectId
                    }
                }

                data = await Invoice.find(salesQuery).populate('customer staff').populate('items.staffAssignments.staff', 'name').populate('staffAssignments.staff', 'name').lean();
                break;

            case "services":
                // Service Report: Revenue per service
                const invoices = await Invoice.find({
                    date: { $gte: start, $lte: end },
                    status: { $nin: ['cancelled', 'voided'] }
                }).lean();
                const serviceStats: any = {};

                invoices.forEach(inv => {
                    inv.items.forEach((item: any) => {
                        if (item.itemModel === 'Service') {
                            const name = item.name;
                            if (!serviceStats[name]) {
                                serviceStats[name] = { name, count: 0, revenue: 0 };
                            }
                            serviceStats[name].count += item.quantity;
                            serviceStats[name].revenue += item.total;
                        }
                    });
                });
                data = Object.values(serviceStats).sort((a: any, b: any) => b.revenue - a.revenue);
                break;

            case "products":
                // Product Report: Revenue per product
                const productInvoices = await Invoice.find({
                    date: { $gte: start, $lte: end },
                    status: { $nin: ['cancelled', 'voided'] }
                }).lean();
                const productStats: any = {};

                productInvoices.forEach(inv => {
                    inv.items.forEach((item: any) => {
                        if (item.itemModel === 'Product') {
                            const name = item.name;
                            if (!productStats[name]) {
                                productStats[name] = { name, count: 0, revenue: 0 };
                            }
                            productStats[name].count += item.quantity;
                            productStats[name].revenue += item.total;
                        }
                    });
                });
                data = Object.values(productStats).sort((a: any, b: any) => b.revenue - a.revenue);
                break;

            case "staff":
                // Staff Performance: Account for multi-staff assignments
                const staffInvoices = await Invoice.find({
                    date: { $gte: start, $lte: end },
                    status: { $nin: ['cancelled', 'voided'] }
                })
                    .populate('staff staffAssignments.staff')
                    .populate({ path: 'appointment', populate: { path: 'staff' } })
                    .lean();

                const staffStats: any = {};

                staffInvoices.forEach(inv => {
                    // If we have multi-staff assignments, process each one
                    if (inv.staffAssignments && inv.staffAssignments.length > 0) {
                        inv.staffAssignments.forEach((assignment: any) => {
                            const s = assignment.staff;
                            if (s) {
                                const id = s._id.toString();
                                if (!staffStats[id]) {
                                    staffStats[id] = { name: s.name, appointments: 0, sales: 0, commission: 0, revenue: 0 };
                                }
                                staffStats[id].sales += 1;
                                if (inv.appointment) staffStats[id].appointments += 1;
                                // Split revenue proportionally among all assigned staff to avoid double-counting
                                const staffCount = inv.staffAssignments.length;
                                staffStats[id].revenue += inv.totalAmount / staffCount;
                                staffStats[id].commission += (assignment.commission || 0);
                            }
                        });
                    } else if (inv.staff) {
                        // Compatibility for old invoices or single staff invoices
                        const s = inv.staff;
                        const id = s._id.toString();
                        if (!staffStats[id]) {
                            staffStats[id] = { name: s.name, appointments: 0, sales: 0, commission: 0, revenue: 0 };
                        }
                        staffStats[id].sales += 1;
                        if (inv.appointment) staffStats[id].appointments += 1;
                        staffStats[id].revenue += inv.totalAmount;
                        staffStats[id].commission += (inv.commission || 0);
                    } else if ((inv as any).appointment?.staff) {
                        // Fallback for appointment-linked invoices missing staff/staffAssignments
                        const apt: any = (inv as any).appointment;
                        const s: any = apt.staff;
                        const id = s._id.toString();
                        if (!staffStats[id]) {
                            staffStats[id] = { name: s.name, appointments: 0, sales: 0, commission: 0, revenue: 0 };
                        }
                        staffStats[id].sales += 1;
                        if (inv.appointment) staffStats[id].appointments += 1;
                        staffStats[id].revenue += inv.totalAmount;
                        staffStats[id].commission += ((inv as any).commission || apt.commission || 0);
                    }
                });
                data = Object.entries(staffStats).map(([id, stats]: [string, any]) => ({ _id: id, ...stats })).sort((a: any, b: any) => b.revenue - a.revenue);
                break;

            case "customers":
                // Top Customer by Spending
                const customerInvoices = await Invoice.find({
                    date: { $gte: start, $lte: end },
                    status: { $nin: ['cancelled', 'voided'] }
                }).populate('customer').lean();
                
                const customerStats: any = {};
                customerInvoices.forEach(inv => {
                    const c: any = inv.customer;
                    if (c) {
                        const id = c._id.toString();
                        if (!customerStats[id]) {
                            customerStats[id] = { name: c.name, phone: c.phone, spending: 0, transactions: 0, date: c.createdAt };
                        }
                        customerStats[id].spending += inv.totalAmount;
                        customerStats[id].transactions += 1;
                    } else {
                        if (!customerStats['walk-in']) {
                            customerStats['walk-in'] = { name: 'Walk-in Customer', phone: '-', spending: 0, transactions: 0 };
                        }
                        customerStats['walk-in'].spending += inv.totalAmount;
                        customerStats['walk-in'].transactions += 1;
                    }
                });
                data = Object.values(customerStats).sort((a: any, b: any) => b.spending - a.spending);
                break;

            case "inventory":
                // Inventory Report
                data = await Product.find({}).sort({ stock: 1 });
                break;

            case "expenses":
                // Expense Report
                data = await Expense.find({
                    date: { $gte: start, $lte: end }
                });
                break;

            case "profit":
                // Profit Report: Revenue vs Expenses vs Payroll vs Purchases - Optimized to Promise.all
                const [revInvoices, expExpenses, payPayroll, purPurchases] = await Promise.all([
                    Invoice.find({ date: { $gte: start, $lte: end }, status: { $nin: ['cancelled', 'voided'] } }).lean(),
                    Expense.find({ date: { $gte: start, $lte: end } }).lean(),
                    Payroll.find({ paidDate: { $gte: start, $lte: end }, status: 'paid' }).lean(),
                    Purchase.find({ date: { $gte: start, $lte: end }, status: { $ne: 'cancelled' } }).lean()
                ]);

                const totalRevenue = revInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
                const totalExpenses = expExpenses.reduce((sum, exp) => sum + exp.amount, 0);
                const totalPayroll = payPayroll.reduce((sum, pay) => sum + pay.totalAmount, 0);
                const totalPurchases = purPurchases.reduce((sum, pur) => sum + pur.totalAmount, 0);

                data = {
                    totalRevenue,
                    totalExpenses,
                    totalPayroll,
                    totalPurchases,
                    netProfit: totalRevenue - totalExpenses - totalPayroll - totalPurchases
                };
                break;

            case "daily":
                // Daily Closing Report
                const dailyInvoices = await Invoice.find({
                    date: { $gte: start, $lte: end },
                    status: { $nin: ['cancelled', 'voided'] }
                }).lean();

                const dailyExpenses = await Expense.find({
                    date: { $gte: start, $lte: end }
                }).lean();

                const payments: any = { Cash: 0, Card: 0, Wallet: 0, Transfer: 0, QRIS: 0 };
                dailyInvoices.forEach(inv => {
                    if (inv.paymentMethods && inv.paymentMethods.length > 0) {
                        inv.paymentMethods.forEach((pm: any) => {
                            if (pm.method) {
                                payments[pm.method] = (payments[pm.method] || 0) + (pm.amount || 0);
                            }
                        });
                    } else if (inv.paymentMethod) {
                        payments[inv.paymentMethod] = (payments[inv.paymentMethod] || 0) + (inv.amountPaid || inv.totalAmount || 0);
                    }
                });

                data = {
                    totalSales: dailyInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0),
                    totalCollected: dailyInvoices.reduce((sum, inv) => sum + (inv.amountPaid || 0), 0),
                    payments,
                    totalExpenses: dailyExpenses.reduce((sum, exp) => sum + exp.amount, 0),
                    invoiceCount: dailyInvoices.length
                };
                break;

            case "wallet":
                const { WalletTransaction } = await getTenantModels(tenantSlug);
                const walletTxs = await WalletTransaction.find({
                    createdAt: { $gte: start, $lte: end }
                }).populate('customer', 'name').lean();

                let totalTopUp = 0;
                let totalUsage = 0;

                walletTxs.forEach((tx: any) => {
                    if (tx.type === 'topup' || tx.type === 'bonus' || tx.type === 'refund') {
                        totalTopUp += tx.amount;
                    } else if (tx.type === 'payment') {
                        totalUsage += tx.amount;
                    }
                });

                data = {
                    totalTopUp,
                    totalUsage,
                    transactions: walletTxs
                };
                break;

            default:
                return NextResponse.json({ success: false, error: "Invalid report type" }, { status: 400 });
        }

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        console.error("Report API Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
