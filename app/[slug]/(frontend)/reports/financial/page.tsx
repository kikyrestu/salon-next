
"use client";


import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { DollarSign, TrendingUp, TrendingDown, ShoppingBag, CreditCard, Calendar, RefreshCcw } from "lucide-react";
import { FormButton } from "@/components/dashboard/FormInput";
import { useSettings } from "@/components/providers/SettingsProvider";
import { getMonthDateRangeInTimezone } from "@/lib/dateUtils";

export default function FinancialReportPage() {
  const params = useParams();
  const slug = params.slug as string;
    const { settings } = useSettings();
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState(() => getMonthDateRangeInTimezone(settings.timezone || "UTC"));
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setDateRange(getMonthDateRangeInTimezone(settings.timezone || "UTC"));
    }, [settings.timezone]);

    useEffect(() => {
        fetchReport();
    }, [dateRange]);

    const fetchReport = async () => {
        setLoading(true);
        setError(null);
        try {
            const query = new URLSearchParams(dateRange);
            const res = await fetch(`/api/reports/financial?${query.toString()}`, { headers: { "x-store-slug": slug } });
            const json = await res.json();
            if (json.success) {
                setData(json.data);
            } else {
                setError(json.error || "Failed to fetch financial data");
            }
        } catch (error: any) {
            console.error(error);
            setError(error.message || "An unexpected error occurred");
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount: number) => {
        const val = amount || 0;
        return `${settings.symbol}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    return (
        <div className="p-6 min-h-screen bg-gray-50 text-black">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Financial Report</h1>
                        <p className="text-gray-500 text-sm">Overview of income, expenses, and profitability</p>
                        <p className="text-xs text-blue-700 mt-1">Timezone: {settings.timezone}</p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 bg-white p-3 rounded-xl shadow-md border-2 border-gray-300">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-700 uppercase px-2">From</span>
                            <input
                                type="date"
                                value={dateRange.startDate}
                                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                                className="border-2 border-gray-400 bg-white rounded-lg text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 py-2 px-3"
                            />
                        </div>
                        <div className="hidden sm:block w-px bg-gray-300" />
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-700 uppercase px-2">To</span>
                            <input
                                type="date"
                                value={dateRange.endDate}
                                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                                className="border-2 border-gray-400 bg-white rounded-lg text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 py-2 px-3"
                            />
                        </div>
                        <div className="hidden sm:block w-px bg-gray-300" />
                        <FormButton
                            onClick={fetchReport}
                            loading={loading}
                            variant="ghost"
                            className="p-2.5"
                            title="Refresh Data"
                        >
                            <RefreshCcw className="w-5 h-5" />
                        </FormButton>
                    </div>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>
                        ))}
                    </div>
                ) : data ? (
                    <div className="space-y-6">
                        {/* Primary Metrics */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Net Profit */}
                            <div className="bg-gradient-to-br from-blue-900 to-blue-800 rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                    <TrendingUp className="w-24 h-24" />
                                </div>
                                <div className="relative z-10">
                                    <p className="text-blue-200 font-medium mb-1">Net Profit</p>
                                    <h3 className="text-3xl font-bold mb-4">{formatCurrency(data.netProfit)}</h3>
                                    <div className="flex items-center gap-2 text-sm bg-white/10 w-fit px-3 py-1 rounded-full backdrop-blur-sm">
                                        <span>Sales - (Purchases + Expenses)</span>
                                    </div>
                                </div>
                            </div>

                            {/* Sales Revenue */}
                            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm relative overflow-hidden group hover:border-blue-900/30 transition-all">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 bg-emerald-50 rounded-xl group-hover:bg-emerald-100 transition-colors">
                                        <DollarSign className="w-6 h-6 text-emerald-600" />
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Sales</p>
                                        <p className="text-sm font-medium text-emerald-600">Collected: {formatCurrency(data.sales.totalCollected)}</p>
                                    </div>
                                </div>
                                <h3 className="text-2xl font-bold text-gray-900 mb-1">{formatCurrency(data.sales.totalSales)}</h3>
                                <p className="text-sm text-gray-500">{data.sales.count} Invoices</p>
                            </div>

                            {/* Cash Flow */}
                            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm relative overflow-hidden group hover:border-blue-900/30 transition-all">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 bg-indigo-50 rounded-xl group-hover:bg-indigo-100 transition-colors">
                                        <CreditCard className="w-6 h-6 text-indigo-600" />
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Cash Flow</p>
                                    </div>
                                </div>
                                <h3 className={`text-2xl font-bold mb-1 ${data.cashFlow >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                                    {formatCurrency(data.cashFlow)}
                                </h3>
                                <p className="text-sm text-gray-500">Actual Cash In - Out</p>
                            </div>
                        </div>

                        <h2 className="text-lg font-bold text-gray-900 pt-4">Expense Breakdown</h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Purchases */}
                            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm relative overflow-hidden group hover:border-orange-200 transition-all">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 bg-orange-50 rounded-xl group-hover:bg-orange-100 transition-colors">
                                        <ShoppingBag className="w-6 h-6 text-orange-600" />
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Inventory Purchases</p>
                                    </div>
                                </div>
                                <div className="flex justify-between items-end">
                                    <div>
                                        <h3 className="text-2xl font-bold text-gray-900 mb-1">{formatCurrency(data.purchases.totalPurchases)}</h3>
                                        <p className="text-sm text-gray-500">{data.purchases.count} Orders</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-medium text-gray-600">Paid: {formatCurrency(data.purchases.totalPaid)}</p>
                                        <p className="text-xs text-red-500">Due: {formatCurrency(data.purchases.totalPurchases - data.purchases.totalPaid)}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Operational Expenses */}
                            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm relative overflow-hidden group hover:border-red-200 transition-all">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 bg-red-50 rounded-xl group-hover:bg-red-100 transition-colors">
                                        <TrendingDown className="w-6 h-6 text-red-600" />
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Operational Expenses</p>
                                    </div>
                                </div>
                                <h3 className="text-2xl font-bold text-gray-900 mb-1">{formatCurrency(data.expenses.totalExpenses)}</h3>
                                <p className="text-sm text-gray-500">{data.expenses.count} Records</p>
                            </div>
                        </div>
                    </div>
                ) : error ? (
                    <div className="bg-red-50 text-red-600 p-8 rounded-xl border border-red-200 flex flex-col items-center justify-center space-y-4">
                        <div className="text-lg font-semibold">{error}</div>
                        <button onClick={fetchReport} className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium">
                            Try Again
                        </button>
                    </div>
                ) : (
                    <div className="text-center py-20 text-gray-500">
                        No financial data available for this period.
                    </div>
                )}
            </div>
        </div>
    );
}
