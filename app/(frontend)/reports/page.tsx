
"use client";

import { useState, useEffect } from "react";
import {
    BarChart3,
    DollarSign,
    TrendingUp,
    Calendar,
    Download,
    Users,
    Package,
    ShoppingBag,
    Scissors,
    UserPlus,
    FileText,
    PieChart,
    ChevronRight,
    Search,
    Filter,
    ArrowUpRight,
    ArrowDownRight,
    Shield
} from "lucide-react";
import { format, subMonths, isValid } from "date-fns";
import SearchableSelect from "@/components/dashboard/SearchableSelect";
import StatCard from "@/components/dashboard/StatCard";
import { useSettings } from "@/components/providers/SettingsProvider";
import { getCurrentDateInTimezone, getMonthDateRangeInTimezone } from "@/lib/dateUtils";

type ReportType = 'summary' | 'sales' | 'services' | 'staff' | 'customers' | 'inventory' | 'expenses' | 'profit' | 'daily' | 'activity-log';

export default function ReportsPage() {
    const { settings } = useSettings();
    const [activeTab, setActiveTab] = useState<ReportType>('sales');
    const [loading, setLoading] = useState(true);
    const [reportData, setReportData] = useState<any>(null);
    const [dateRange, setDateRange] = useState(() => {
        const range = getMonthDateRangeInTimezone(settings.timezone || "UTC");
        return { start: range.startDate, end: range.endDate };
    });

    useEffect(() => {
        const range = getMonthDateRangeInTimezone(settings.timezone || "UTC");
        setDateRange({ start: range.startDate, end: range.endDate });
    }, [settings.timezone]);

    const reportTabs: { id: ReportType, label: string, icon: any }[] = [
        { id: 'sales', label: 'Sales Report', icon: FileText },
        { id: 'services', label: 'Service Analytics', icon: Scissors },
        { id: 'staff', label: 'Staff Performance', icon: Users },
        { id: 'expenses', label: 'Expense Tracking', icon: ShoppingBag },
        { id: 'profit', label: 'Profit & Loss', icon: TrendingUp },
        { id: 'activity-log', label: 'System Audit', icon: Shield },
    ];

    useEffect(() => {
        fetchData();
    }, [activeTab, dateRange]);

    const fetchData = async () => {
        setLoading(true);
        // Clear previous report data to avoid mapping errors during transition
        setReportData(null);
        try {
            if (activeTab === 'summary') {
                const [invoicesRes, expensesRes, appointmentsRes, customersRes, productsRes, purchasesRes] = await Promise.all([
                    fetch(`/api/invoices?startDate=${dateRange.start}&endDate=${dateRange.end}`),
                    fetch(`/api/expenses?startDate=${dateRange.start}&endDate=${dateRange.end}`),
                    fetch(`/api/appointments?start=${dateRange.start}&end=${dateRange.end}`),
                    fetch('/api/customers'),
                    fetch('/api/products'),
                    fetch(`/api/purchases?startDate=${dateRange.start}&endDate=${dateRange.end}`)
                ]);

                const [invoicesData, expensesData, appointmentsData, customersData, productsData, purchasesData] = await Promise.all([
                    invoicesRes.json(),
                    expensesRes.json(),
                    appointmentsRes.json(),
                    customersRes.json(),
                    productsRes.json(),
                    purchasesRes.json()
                ]);

                const revenue = invoicesData.success ? invoicesData.data.reduce((sum: number, inv: any) => sum + (inv.totalAmount || 0), 0) : 0;
                const expenses = expensesData.success ? expensesData.data.reduce((sum: number, exp: any) => sum + (exp.amount || 0), 0) : 0;
                const purchases = purchasesData.success ? purchasesData.data.reduce((sum: number, pur: any) => sum + (pur.totalAmount || 0), 0) : 0;
                const lowStock = productsData.success ? productsData.data.filter((p: any) => p.stock <= p.alertQuantity).length : 0;

                setReportData({
                    totalRevenue: revenue,
                    totalExpenses: expenses,
                    totalPurchases: purchases,
                    netProfit: revenue - expenses - purchases,
                    totalAppointments: appointmentsData.success ? appointmentsData.data.length : 0,
                    totalCustomers: customersData.success ? customersData.data.length : 0,
                    totalProducts: productsData.success ? productsData.data.length : 0,
                    lowStockCount: lowStock
                });
            } else {
                const res = await fetch(`/api/reports?type=${activeTab}&startDate=${dateRange.start}&endDate=${dateRange.end}`);
                const data = await res.json();
                if (data.success) {
                    setReportData(data.data);
                }
            }
        } catch (error) {
            console.error("Error fetching report data:", error);
        } finally {
            setLoading(false);
        }
    };

    const setPresetRange = (preset: 'thisMonth' | 'lastMonth' | 'last3Months' | 'today') => {
        const now = new Date();
        let start, end;

        switch (preset) {
            case 'today':
                start = getCurrentDateInTimezone(settings.timezone || "UTC", now);
                end = start;
                break;
            case 'thisMonth':
                ({ startDate: start, endDate: end } = getMonthDateRangeInTimezone(settings.timezone || "UTC", now));
                break;
            case 'lastMonth':
                const lastMonth = subMonths(now, 1);
                ({ startDate: start, endDate: end } = getMonthDateRangeInTimezone(settings.timezone || "UTC", lastMonth));
                break;
            case 'last3Months':
                start = getMonthDateRangeInTimezone(settings.timezone || "UTC", subMonths(now, 2)).startDate;
                end = getMonthDateRangeInTimezone(settings.timezone || "UTC", now).endDate;
                break;
        }

        setDateRange({
            start,
            end
        });
    };

    const formatCurrency = (val: any) => {
        const num = parseFloat(val);
        return isNaN(num) ? `${settings.symbol}0` : `${settings.symbol}${num.toLocaleString()}`;
    };

    const formatSafeDate = (date: any, formatStr: string = "dd MMM yyyy") => {
        if (!date) return "N/A";
        const d = new Date(date);
        return isValid(d) ? format(d, formatStr) : "Invalid Date";
    };

    const renderSummary = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Total Revenue"
                    value={formatCurrency(reportData?.totalRevenue)}
                    icon={DollarSign}
                    color="green"
                    trend="Revenue"
                    trendUp={true}
                />
                <StatCard
                    title="Total Expenses"
                    value={formatCurrency(reportData?.totalExpenses)}
                    icon={TrendingUp}
                    color="red"
                    trend="Outgoings"
                    trendUp={false}
                />
                <StatCard
                    title="Net Profit"
                    value={formatCurrency(reportData?.netProfit)}
                    icon={BarChart3}
                    color="blue"
                    trend="Earnings"
                    trendUp={reportData?.netProfit >= 0}
                />
                <StatCard
                    title="Appointments"
                    value={reportData?.totalAppointments || 0}
                    icon={Calendar}
                    color="purple"
                    trend="Bookings"
                    trendUp={true}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-gray-900">Platform Growth</h3>
                        <Users className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className="flex items-end gap-2">
                        <span className="text-3xl font-bold">{reportData?.totalCustomers || 0}</span>
                        <span className="text-sm text-gray-500 mb-1">Total Customers</span>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-gray-900">Inventory Status</h3>
                        <Package className="w-5 h-5 text-orange-600" />
                    </div>
                    <div className="flex items-end gap-2">
                        <span className="text-3xl font-bold">{reportData?.totalProducts || 0}</span>
                        <span className={`text-sm mb-1 ${reportData?.lowStockCount > 0 ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                            {reportData?.lowStockCount > 0 ? `${reportData?.lowStockCount} Low Stock` : 'Healthy Stock'}
                        </span>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-gray-900">Profit Margin</h3>
                        <TrendingUp className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-3xl font-bold">
                            {reportData?.totalRevenue > 0
                                ? ((reportData.netProfit / reportData.totalRevenue) * 100).toFixed(1)
                                : 0}%
                        </span>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-blue-600"
                                style={{ width: `${Math.min(Math.max((reportData?.netProfit / reportData?.totalRevenue) * 100 || 0, 0), 100)}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderTable = (headers: string[], rows: any[]) => (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden w-full relative">
            <div className="overflow-x-auto w-full max-w-[100vw] sm:max-w-none">
                <table className="min-w-full text-left whitespace-nowrap">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                            {headers.map((h, i) => (
                                <th key={i} className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-tight">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {rows.map((row, i) => (
                            <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                                {Object.values(row).map((val: any, j) => (
                                    <td key={j} className="px-6 py-4 text-sm font-medium text-gray-700">
                                        {val}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {rows.length === 0 && !loading && (
                <div className="py-20 text-center text-gray-400">
                    <p className="text-sm font-bold">No data record available for this range</p>
                </div>
            )}
        </div>
    );

    const renderContent = () => {
        if (loading) return (
            <div className="flex flex-col items-center justify-center py-40">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-900 border-t-transparent shadow-sm"></div>
                <p className="mt-4 text-sm font-bold text-gray-500 uppercase tracking-widest">Generating Your Report...</p>
            </div>
        );

        if (!reportData) return null;

        switch (activeTab) {
            case 'summary':
                return renderSummary();
            case 'sales':
                if (!Array.isArray(reportData)) return null;
                const salesSummary = reportData.reduce((acc: any, inv: any) => ({
                    count: acc.count + 1,
                    total: acc.total + (inv.totalAmount || 0),
                    received: acc.received + (inv.amountPaid || 0),
                }), { count: 0, total: 0, received: 0 });

                return (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                                <p className="text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest mb-1 truncate">Total Sales</p>
                                <p className="text-lg sm:text-xl font-black text-gray-900 truncate">{salesSummary.count}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm border-l-4 border-l-blue-600">
                                <p className="text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest mb-1 truncate">Total Amount</p>
                                <p className="text-lg sm:text-xl font-black text-blue-900 truncate">{formatCurrency(salesSummary.total)}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm border-l-4 border-l-green-600">
                                <p className="text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest mb-1 truncate">Total Received</p>
                                <p className="text-lg sm:text-xl font-black text-green-900 truncate">{formatCurrency(salesSummary.received)}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm border-l-4 border-l-orange-600">
                                <p className="text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest mb-1 truncate">Total Balance</p>
                                <p className="text-lg sm:text-xl font-black text-orange-900 truncate">{formatCurrency(salesSummary.total - salesSummary.received)}</p>
                            </div>
                        </div>
                        {renderTable(
                            ['Invoice #', 'Date', 'Customer', 'Member', 'Total', 'Paid', 'Status'],
                            reportData.map((inv: any) => ({
                                inv: inv.invoiceNumber,
                                date: formatSafeDate(inv.date),
                                customer: inv.customer?.name || 'Walk-in',
                                staff: inv.staff?.name || 'N/A',
                                total: formatCurrency(inv.totalAmount),
                                paid: formatCurrency(inv.amountPaid),
                                status: <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${inv.status === 'paid' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                    }`}>{inv.status?.replace('_', ' ') || 'N/A'}</span>
                            }))
                        )}
                    </div>
                );
            case 'services':
                if (!Array.isArray(reportData)) return null;
                return renderTable(
                    ['Service Name', 'Total Frequency', 'Revenue Amount'],
                    reportData.map((s: any) => ({
                        name: s.name,
                        count: s.count,
                        revenue: formatCurrency(s.revenue)
                    }))
                );
            case 'staff':
                if (!Array.isArray(reportData)) return null;
                return renderTable(
                    ['Staff Member', 'Sale Count', 'Revenue Contribution', 'Total Commission'],
                    reportData.map((s: any) => ({
                        name: s.name,
                        sales: s.sales,
                        revenue: formatCurrency(s.revenue),
                        comm: formatCurrency(s.commission)
                    }))
                );
            case 'customers':
                if (!Array.isArray(reportData)) return null;
                return renderTable(
                    ['Client Name', 'Contact Information', 'Joined Date'],
                    reportData.map((c: any) => ({
                        name: c.name,
                        phone: c.phone || 'N/A',
                        date: formatSafeDate(c.createdAt)
                    }))
                );
            case 'inventory':
                if (!Array.isArray(reportData)) return null;
                return renderTable(
                    ['Asset Name', 'SKU Identity', 'Stock Level', 'Minimum Limit', 'Retail Price'],
                    reportData.map((p: any) => ({
                        name: p.name,
                        sku: p.sku || 'N/A',
                        stock: <span className={p.stock <= p.alertQuantity ? 'text-red-600 font-black' : ''}>{p.stock}</span>,
                        alert: p.alertQuantity,
                        price: formatCurrency(p.price)
                    }))
                );
            case 'expenses':
                if (!Array.isArray(reportData)) return null;
                return renderTable(
                    ['Type / Category', 'Transaction Date', 'Expenditure', 'Title'],
                    reportData.map((e: any) => ({
                        cat: e.category,
                        date: formatSafeDate(e.date),
                        amount: <span className="text-red-600">-{formatCurrency(e.amount)}</span>,
                        title: e.title
                    }))
                );
            case 'profit':
                return (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="bg-white p-5 sm:p-8 rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
                            <h3 className="text-xl font-bold text-gray-900 mb-8 border-b pb-4">Profit & Loss Statement</h3>
                            <div className="space-y-6">
                                <div className="flex justify-between items-center group">
                                    <span className="text-gray-500 font-bold uppercase text-[10px] sm:text-xs tracking-widest">Gross Revenue</span>
                                    <span className="text-xl sm:text-2xl font-black text-green-600 break-all">{formatCurrency(reportData?.totalRevenue)}</span>
                                </div>
                                <div className="flex justify-between items-center group">
                                    <span className="text-gray-500 font-bold uppercase text-[10px] sm:text-xs tracking-widest">Business Expenses</span>
                                    <span className="text-xl sm:text-2xl font-black text-red-600 break-all">-{formatCurrency(reportData?.totalExpenses)}</span>
                                </div>
                                <div className="flex justify-between items-center group">
                                    <span className="text-gray-500 font-bold uppercase text-[10px] sm:text-xs tracking-widest">Staff Payroll</span>
                                    <span className="text-xl sm:text-2xl font-black text-orange-600 break-all">-{formatCurrency(reportData?.totalPayroll)}</span>
                                </div>
                                <div className="flex justify-between items-center group">
                                    <span className="text-gray-500 font-bold uppercase text-[10px] sm:text-xs tracking-widest">Stock Purchases</span>
                                    <span className="text-xl sm:text-2xl font-black text-amber-600 break-all">-{formatCurrency(reportData?.totalPurchases)}</span>
                                </div>
                                <div className="pt-6 sm:pt-8 mt-6 sm:mt-8 border-t-2 border-dashed border-gray-100">
                                    <div className="flex flex-col sm:flex-row justify-between items-center p-6 bg-blue-900 rounded-2xl text-white shadow-xl gap-4 sm:gap-0">
                                        <div className="text-center sm:text-left">
                                            <span className="text-xs font-bold uppercase tracking-[0.2em] opacity-80">Final Net Profit</span>
                                            <p className="text-3xl sm:text-4xl font-black mt-1 break-all">{formatCurrency(reportData?.netProfit)}</p>
                                        </div>
                                        <div className="p-4 bg-white/10 rounded-2xl shrink-0">
                                            {reportData?.netProfit >= 0 ? <ArrowUpRight className="w-10 h-10" /> : <ArrowDownRight className="w-10 h-10" />}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-gray-900 p-8 rounded-xl shadow-lg text-white flex flex-col justify-center items-center text-center">
                            <TrendingUp className="w-16 h-16 text-blue-400 mb-6 animate-pulse" />
                            <h4 className="text-xl font-bold mb-2">Growth Forecast</h4>
                            <p className="text-gray-400 text-sm">Our AI models are processing your salon's patterns to provide next month's projections.</p>
                        </div>
                    </div>
                );
            case 'daily':
                return (
                    <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-gray-100 shadow-2xl p-5 sm:p-10">
                        <div className="text-center mb-8 sm:mb-10 pb-6 sm:pb-8 border-b border-gray-50">
                            <div className="inline-flex p-3 bg-blue-50 rounded-2xl mb-4">
                                <PieChart className="w-8 h-8 text-blue-900" />
                            </div>
                            <h3 className="text-2xl sm:text-3xl font-black text-gray-900">Daily Reconciliation</h3>
                            <p className="text-blue-600 font-bold text-[11px] sm:text-sm tracking-tight mt-2">
                                Period: {formatSafeDate(dateRange.start, "EEEE, MMMM dd, yyyy")}
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-8 sm:mb-10">
                            <div className="p-5 sm:p-6 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col items-center sm:items-start text-center sm:text-left">
                                <span className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] block mb-2">Gross Sales Value</span>
                                <span className="text-3xl sm:text-4xl font-black text-gray-900 font-mono break-all">{formatCurrency(reportData.totalSales)}</span>
                            </div>
                            <div className="p-5 sm:p-6 bg-green-50 rounded-2xl border border-green-100 flex flex-col items-center sm:items-start text-center sm:text-left">
                                <span className="text-[9px] sm:text-[10px] font-black text-green-600/60 uppercase tracking-[0.2em] block mb-2">Liquid Cash Collected</span>
                                <span className="text-3xl sm:text-4xl font-black text-green-700 font-mono break-all">{formatCurrency(reportData.totalCollected)}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-8 sm:mb-10">
                            {Object.entries(reportData.payments || {}).map(([method, amount]: any) => (
                                <div key={method} className="bg-white border rounded-xl p-3 sm:p-4 text-center">
                                    <span className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase block mb-1">{method}</span>
                                    <span className="text-lg sm:text-xl font-black text-gray-900 break-all">{formatCurrency(amount)}</span>
                                </div>
                            ))}
                        </div>

                        <div className="flex flex-col sm:flex-row items-center justify-between p-5 sm:p-6 bg-red-50 rounded-2xl border border-red-100 gap-4 sm:gap-0">
                            <div className="text-center sm:text-left w-full sm:w-auto">
                                <span className="text-[10px] sm:text-xs font-bold text-red-600 uppercase block mb-1">Today's Outflow (Expenses)</span>
                                <span className="text-xl sm:text-2xl font-black text-red-700 break-all">-{formatCurrency(reportData.totalExpenses)}</span>
                            </div>
                            <div className="text-center sm:text-right w-full sm:w-auto border-t sm:border-t-0 border-red-200/50 pt-4 sm:pt-0">
                                <span className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase block mb-1">Billings Count</span>
                                <span className="text-xl sm:text-2xl font-black text-gray-900 break-all">{reportData.invoiceCount || 0}</span>
                            </div>
                        </div>
                    </div>
                );
            case 'activity-log':
                return (
                    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
                        <Shield className="w-16 h-16 text-blue-900 mb-4" />
                        <h3 className="text-xl font-bold text-gray-900">System Activity Audit</h3>
                        <p className="text-gray-500 max-w-md text-center mt-2 mb-8">
                            Detailed logs of all user actions, security events, and system changes are stored in the dedicated audit module.
                        </p>
                        <a
                            href="/reports/activity-log"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-900 text-white rounded-xl font-bold shadow-lg hover:bg-blue-800 transition-all"
                        >
                            <FileText className="w-5 h-5" />
                            Access Security Logs
                        </a>
                    </div>
                );
        }
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC]">
            {/* Top Bar Navigation */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between py-4 sm:py-6 gap-6">
                        <div className="text-center sm:text-left">
                            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Financial Reports</h1>
                            <p className="text-sm text-gray-500 font-medium">Business health analytics and performance tracking</p>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
                            <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-xl border border-gray-200 w-full sm:w-auto justify-center">
                                <button onClick={() => setPresetRange('thisMonth')} className="px-4 py-2 text-xs font-bold rounded-lg hover:bg-white hover:shadow-sm transition-all flex-1 sm:flex-none">Month</button>
                                <button onClick={() => setPresetRange('last3Months')} className="px-4 py-2 text-xs font-bold rounded-lg hover:bg-white hover:shadow-sm transition-all flex-1 sm:flex-none">Quarter</button>
                                {activeTab === 'daily' && <button onClick={() => setPresetRange('today')} className="px-4 py-2 text-xs font-bold rounded-lg bg-white shadow-sm transition-all flex-1 sm:flex-none">Today</button>}
                            </div>

                            <div className="flex justify-center items-center gap-2 bg-white px-3 py-2 rounded-xl border border-gray-200 shadow-sm w-full sm:w-auto">
                                <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                                <input
                                    type="date"
                                    value={dateRange.start}
                                    onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                                    className="border-none text-xs font-bold p-0 focus:ring-0 w-28 bg-transparent"
                                />
                                {activeTab !== 'daily' && (
                                    <>
                                        <span className="text-gray-200 font-bold px-1">/</span>
                                        <input
                                            type="date"
                                            value={dateRange.end}
                                            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                                            className="border-none text-xs font-bold p-0 focus:ring-0 w-28 bg-transparent"
                                        />
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tab Strip */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex overflow-x-auto no-scrollbar gap-8">
                        {reportTabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`pb-4 text-sm font-bold whitespace-nowrap transition-all border-b-2 ${activeTab === tab.id
                                    ? 'text-blue-900 border-blue-900'
                                    : 'text-gray-400 border-transparent hover:text-gray-600'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {renderContent()}
            </main>
        </div>
    );
}

