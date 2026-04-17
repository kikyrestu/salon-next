
"use client";

import { useState, useEffect } from "react";
import { Plus, Search, Filter, ShoppingBag, Eye, Calendar, ChevronLeft, ChevronRight, MoreVertical, Trash2, Wallet, X } from "lucide-react";
import Link from "next/link";
import { FormButton } from "@/components/dashboard/FormInput";
import { useSettings } from "@/components/providers/SettingsProvider";
import { formatDate } from "@/lib/dateUtils";

export default function PurchasesPage() {
    const { settings } = useSettings();
    const [purchases, setPurchases] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState<any>({ total: 0, page: 1, limit: 10, pages: 0 });
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

    // Deposit States
    const [showDepositModal, setShowDepositModal] = useState(false);
    const [selectedPurchase, setSelectedPurchase] = useState<any>(null);
    const [depositAmount, setDepositAmount] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("Cash");
    const [depositLoading, setDepositLoading] = useState(false);

    useEffect(() => {
        fetchPurchases();
    }, [page, search, statusFilter]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (activeDropdown && !(event.target as Element).closest('.dropdown-trigger')) {
                setActiveDropdown(null);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [activeDropdown]);

    const fetchPurchases = async () => {
        setLoading(true);
        try {
            const query = new URLSearchParams();
            query.append("page", page.toString());
            query.append("limit", "10");
            if (search) query.append("search", search);
            if (statusFilter !== "all") query.append("status", statusFilter);

            const res = await fetch(`/api/purchases?${query.toString()}`);
            const data = await res.json();
            if (data.success) {
                setPurchases(data.data);
                if (data.pagination) setPagination(data.pagination);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure? Deleting a 'received' purchase will revert product stock levels.")) return;

        try {
            const res = await fetch(`/api/purchases/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                fetchPurchases();
                setActiveDropdown(null);
            } else {
                alert(data.error || "Failed to delete");
            }
        } catch (error) {
            console.error(error);
            alert("Error deleting purchase");
        }
    };

    const handleAddDeposit = async () => {
        if (!selectedPurchase || !depositAmount) return;
        setDepositLoading(true);
        try {
            const res = await fetch("/api/purchases/deposits", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    purchase: selectedPurchase._id,
                    supplier: selectedPurchase.supplier?._id,
                    amount: Number(depositAmount),
                    paymentMethod,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setShowDepositModal(false);
                setDepositAmount("");
                fetchPurchases();
            } else {
                alert(data.error || "Failed to add deposit");
            }
        } catch (error) {
            console.error(error);
            alert("Error adding deposit");
        } finally {
            setDepositLoading(false);
        }
    };

    return (
        <div className="p-6 min-h-screen bg-gray-50 text-black">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
                    <p className="text-gray-500 text-sm">Manage supplier purchases and stock intake</p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
                    <Link
                        href="/purchases/create"
                        className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-all flex justify-center items-center gap-2 shadow-sm font-semibold text-sm w-full sm:w-auto"
                    >
                        <Plus className="w-4 h-4" />
                        New Purchase
                    </Link>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {/* Filters */}
                <div className="p-4 border-b border-gray-200 flex flex-col md:flex-row gap-4 items-center justify-between bg-gray-50/50">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search purchase # or supplier..."
                            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-all text-sm"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5 shadow-sm w-full sm:w-auto">
                            <Filter className="w-4 h-4 text-gray-400 shrink-0" />
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="bg-transparent border-none focus:ring-0 text-sm font-medium text-gray-700 w-full sm:w-auto text-center sm:text-left"
                            >
                                <option value="all">All Status</option>
                                <option value="received">Received</option>
                                <option value="pending">Pending</option>
                                <option value="cancelled">Cancelled</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 hidden md:table">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Purchase #</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Supplier</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Payment</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                            {loading && purchases.length === 0 ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={7} className="px-6 py-4"><div className="h-4 bg-gray-100 rounded"></div></td>
                                    </tr>
                                ))
                            ) : purchases.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                                        <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                        <p>No purchases found</p>
                                    </td>
                                </tr>
                            ) : (
                                purchases.map((purchase) => (
                                    <tr key={purchase._id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm font-bold text-gray-900">{purchase.purchaseNumber}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm font-medium text-gray-700">{purchase.supplier?.name || "Unknown"}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2 text-gray-500">
                                                <Calendar className="w-4 h-4" />
                                                <span className="text-sm">{formatDate(purchase.date, settings.timezone)}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm font-bold text-gray-900">{settings.symbol}{purchase.totalAmount.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`text-[10px] uppercase tracking-widest font-black px-2.5 py-1 rounded-full border ${purchase.status === 'received' ? 'bg-green-50 text-green-700 border-green-200' :
                                                purchase.status === 'pending' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                    'bg-red-50 text-red-700 border-red-200'
                                                }`}>
                                                {purchase.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`text-[10px] uppercase tracking-widest font-black px-2.5 py-1 rounded-full border ${purchase.paymentStatus === 'paid' ? 'bg-green-50 text-green-700 border-green-200' :
                                                purchase.paymentStatus === 'partially_paid' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                    'bg-orange-50 text-orange-700 border-orange-200'
                                                }`}>
                                                {purchase.paymentStatus?.replace('_', ' ') || 'Pending'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                            <div className="relative flex justify-end dropdown-trigger">
                                                <button
                                                    onClick={() => setActiveDropdown(activeDropdown === purchase._id ? null : purchase._id)}
                                                    className="p-2 text-gray-400 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-all"
                                                >
                                                    <MoreVertical className="w-5 h-5" />
                                                </button>
                                                {activeDropdown === purchase._id && (
                                                    <div className="absolute right-0 mt-8 w-48 bg-white border border-gray-100 rounded-xl shadow-xl z-50 py-1 overflow-hidden">
                                                        <Link
                                                            href={`/purchases/${purchase._id}`}
                                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                                        >
                                                            <Eye className="w-4 h-4 text-blue-600" />
                                                            View Details
                                                        </Link>
                                                        {purchase.paymentStatus !== 'paid' && (
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedPurchase(purchase);
                                                                    setShowDepositModal(true);
                                                                    setActiveDropdown(null);
                                                                }}
                                                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                                            >
                                                                <Wallet className="w-4 h-4 text-green-600" />
                                                                Add Deposit
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => handleDelete(purchase._id)}
                                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                            Delete Purchase
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>

                    {/* Mobile Card View (Purchases) */}
                    <div className="md:hidden flex flex-col divide-y divide-gray-100 border-t border-gray-100">
                        {loading && purchases.length === 0 ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="p-4 animate-pulse space-y-3">
                                    <div className="h-4 bg-gray-100 rounded w-1/2"></div>
                                    <div className="h-4 bg-gray-100 rounded w-1/3"></div>
                                </div>
                            ))
                        ) : purchases.length === 0 ? (
                            <div className="p-12 text-center text-gray-500">
                                <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p>No purchases found</p>
                            </div>
                        ) : (
                            purchases.map((purchase) => (
                                <div key={purchase._id} className="p-4 hover:bg-gray-50/50 transition-colors flex flex-col gap-3">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-blue-50 rounded-lg">
                                                <ShoppingBag className="w-4 h-4 text-blue-900" />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-bold text-gray-900">{purchase.purchaseNumber}</h3>
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-gray-50 text-gray-700 border border-gray-200 mt-1">
                                                    {purchase.supplier?.name || "Unknown"}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="relative dropdown-trigger">
                                            <button onClick={() => setActiveDropdown(activeDropdown === purchase._id ? null : purchase._id)} className="p-2 -mr-2 text-gray-400 hover:text-blue-900 rounded-lg">
                                                <MoreVertical className="w-5 h-5" />
                                            </button>
                                            {activeDropdown === purchase._id && (
                                                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-xl z-50 py-1 font-medium">
                                                    <Link href={`/purchases/${purchase._id}`} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                                                        <Eye className="w-4 h-4 text-blue-600" /> View Details
                                                    </Link>
                                                    {purchase.paymentStatus !== 'paid' && (
                                                        <button onClick={() => { setSelectedPurchase(purchase); setShowDepositModal(true); setActiveDropdown(null); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                                                            <Wallet className="w-4 h-4 text-green-600" /> Add Deposit
                                                        </button>
                                                    )}
                                                    <div className="h-px bg-gray-100 my-1" />
                                                    <button onClick={() => handleDelete(purchase._id)} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                                                        <Trash2 className="w-4 h-4" /> Delete Purchase
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-sm pt-1 border-t border-gray-50 mt-1">
                                        <div>
                                            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Date</p>
                                            <div className="flex items-center gap-1.5 font-semibold text-gray-600">
                                                <Calendar className="w-3.5 h-3.5" />
                                                {formatDate(purchase.date, settings.timezone)}
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Status</p>
                                            <span className={`text-[10px] uppercase tracking-widest font-black px-2.5 py-1 rounded-full border ${purchase.status === 'received' ? 'bg-green-50 text-green-700 border-green-200' : purchase.status === 'pending' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                                {purchase.status}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-end pt-2 mt-1">
                                        <div>
                                            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-0.5">Payment</p>
                                            <span className={`text-[10px] uppercase tracking-widest font-black px-2.5 py-1 rounded-full border ${purchase.paymentStatus === 'paid' ? 'bg-green-50 text-green-700 border-green-200' : purchase.paymentStatus === 'partially_paid' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                                                {purchase.paymentStatus?.replace('_', ' ') || 'Pending'}
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-0.5">Total</p>
                                            <span className="text-lg font-black text-gray-900">{settings.symbol}{purchase.totalAmount.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Pagination - Reuse logic from other pages */}
                <div className="px-4 py-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-sm text-gray-500 font-medium text-center sm:text-left">
                        Showing <span className="text-gray-900">{purchases.length}</span> of <span className="text-gray-900">{pagination.total}</span> purchases
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => page > 1 && setPage(page - 1)}
                            disabled={page <= 1}
                            className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-sm font-semibold text-gray-700">Page {page} of {pagination.pages || 1}</span>
                        <button
                            onClick={() => page < pagination.pages && setPage(page + 1)}
                            disabled={page >= pagination.pages}
                            className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Deposit Modal */}
            {showDepositModal && selectedPurchase && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-blue-900 text-white">
                            <div>
                                <h3 className="text-xl font-bold">Add Deposit</h3>
                                <p className="text-blue-200 text-xs mt-1">Order: {selectedPurchase.purchaseNumber}</p>
                            </div>
                            <button onClick={() => setShowDepositModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total Amount</p>
                                    <p className="text-lg font-black text-gray-900">{settings.symbol}{selectedPurchase.totalAmount.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</p>
                                </div>
                                <div className="p-3 bg-red-50 rounded-xl border border-red-100">
                                    <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-1">Due Amount</p>
                                    <p className="text-lg font-black text-red-700">{settings.symbol}{(selectedPurchase.totalAmount - selectedPurchase.paidAmount).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Deposit Amount</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">{settings.symbol}</span>
                                        <input
                                            type="number"
                                            value={depositAmount}
                                            onChange={(e) => setDepositAmount(e.target.value)}
                                            placeholder="0.00"
                                            className="w-full pl-8 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-all font-bold text-lg"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Payment Method</label>
                                    <select
                                        value={paymentMethod}
                                        onChange={(e) => setPaymentMethod(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-all font-semibold text-gray-700"
                                    >
                                        <option value="Cash">Cash</option>
                                        <option value="Card">Bank Transfer / Card</option>
                                        <option value="Check">Check</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-gray-50 border-t border-gray-100 flex flex-col-reverse sm:flex-row gap-3">
                            <button
                                onClick={() => setShowDepositModal(false)}
                                className="w-full sm:w-auto flex-1 px-4 py-3 border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-white transition-all text-center"
                            >
                                Cancel
                            </button>
                            <FormButton
                                onClick={handleAddDeposit}
                                loading={depositLoading}
                                disabled={!depositAmount}
                                className="w-full sm:w-auto flex-[2] py-3 text-center"
                                icon={<Wallet className="w-4 h-4 shrink-0" />}
                            >
                                Confirm Payment
                            </FormButton>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
