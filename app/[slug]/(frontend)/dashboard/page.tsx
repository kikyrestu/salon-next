
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getTenantModels } from '@/lib/tenantDb';
import { getCurrencySymbol } from '@/lib/currency';
import StatCard from '@/components/dashboard/StatCard';
import RecentActivity from '@/components/dashboard/RecentActivity';
import SalesChart from '@/components/dashboard/SalesChart';
import ServiceChart from '@/components/dashboard/ServiceChart';
import AIInsight from '@/components/dashboard/AIInsight';
import { Package, DollarSign, AlertTriangle, Calendar, Users, ShoppingBag } from 'lucide-react';
import { startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, format, startOfMonth } from 'date-fns';

export default async function DashboardPage() {
    const session = await auth();
    const headersList = await headers();
    const tenantSlug = headersList.get('x-store-slug') || 'pusat';

    if (!session) {
        redirect(`/${tenantSlug}/login`);
    }

    const { Product, Invoice, Appointment, Settings } = await getTenantModels(tenantSlug);

    const storeSettings = await Settings.findOne() || { currency: 'IDR' };
    const currencySymbol = getCurrencySymbol(storeSettings.currency);

    // Date Ranges
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());
    const last30Days = startOfDay(subDays(new Date(), 30));

    // 1. Fetch Stats
    // 1. Fetch Stats - Optimized to parallel execution
    const [
        productsCount,
        lowStockItems,
        lowStockCount,
        todaysInvoices,
        appointmentsToday,
        monthInvoices
    ] = await Promise.all([
        Product.countDocuments({ status: "active" }),
        Product.find({
            $expr: { $lte: ["$stock", "$alertQuantity"] },
            status: "active"
        }).limit(5).lean(),
        Product.countDocuments({
            $expr: { $lte: ["$stock", "$alertQuantity"] },
            status: "active"
        }),
        Invoice.find({
            date: { $gte: todayStart, $lte: todayEnd },
            status: "paid"
        }).lean(),
        Appointment.countDocuments({
            date: { $gte: todayStart, $lte: todayEnd },
            status: { $in: ['confirmed', 'completed'] }
        }),
        Invoice.find({
            date: { $gte: last30Days, $lte: todayEnd },
            status: "paid"
        }).lean()
    ]);

    const todaysSales = todaysInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
    const ordersToday = todaysInvoices.length;

    const serviceStats: Record<string, number> = {};
    monthInvoices.forEach(inv => {
        inv.items.forEach((item: any) => {
            if (item.itemModel === 'Service') {
                serviceStats[item.name] = (serviceStats[item.name] || 0) + item.total;
            }
        });
    });

    const serviceChartData = Object.entries(serviceStats)
        .map(([name, revenue]) => ({ name, revenue }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 6);

    // Sales Chart Data (Last 7 Days) - Optimized to single aggregation
    const sevenDaysAgo = startOfDay(subDays(new Date(), 6));
    const salesAggregation = await Invoice.aggregate([
        {
            $match: {
                date: { $gte: sevenDaysAgo, $lte: todayEnd },
                status: "paid"
            }
        },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
                totalSales: { $sum: "$totalAmount" }
            }
        },
        { $sort: { _id: 1 } }
    ]);

    const salesMap = new Map(salesAggregation.map(item => [item._id, item.totalSales]));
    const chartData = [];
    for (let i = 6; i >= 0; i--) {
        const d = subDays(new Date(), i);
        const dateStr = format(d, 'yyyy-MM-dd');
        chartData.push({
            name: format(d, 'EEE'),
            sales: salesMap.get(dateStr) || 0
        });
    }

    // Recent Activity (Mixed: Sales & Appointments)
    const recentInvoices = await Invoice.find().sort({ createdAt: -1 }).limit(5).populate('customer', 'name');
    const formattedActivity = recentInvoices.map(inv => ({
        id: inv._id.toString(),
        type: "sale" as const, // Casting to match component expectations
        product: `Invoice #${inv.invoiceNumber}`,
        quantity: 1,
        time: format(inv.createdAt, 'hh:mm a')
    }));

    return (
        <div className="space-y-6">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                    <p className="text-gray-500">Welcome back, {session.user?.name || 'Admin'}! Here is what's happening today.</p>
                </div>
                <div className="mt-4 md:mt-0">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-900 text-white">
                        {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                </div>
            </div>

            <AIInsight />

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Todays Revenue"
                    value={`${currencySymbol}${todaysSales.toLocaleString()}`}
                    icon={DollarSign}
                    color="green"
                    trendUp={true}
                />
                <StatCard
                    title="Appointments"
                    value={appointmentsToday.toString()}
                    icon={Calendar}
                    color="blue"
                    trend="Today"
                    trendUp={true}
                />
                <StatCard
                    title="Low Stock Items"
                    value={lowStockCount.toString()}
                    icon={AlertTriangle}
                    color="red"
                    trend={lowStockCount > 0 ? "Action Needed" : "Good"}
                    trendUp={lowStockCount === 0}
                />
                <StatCard
                    title="Orders Today"
                    value={ordersToday.toString()}
                    icon={ShoppingBag}
                    color="purple"
                    trend="Today"
                    trendUp={true}
                />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SalesChart data={chartData} />
                <ServiceChart data={serviceChartData} />
            </div>

            {/* Recent Activity Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Activity</h3>
                <RecentActivity activities={formattedActivity} />
            </div>
        </div>
    );
}
