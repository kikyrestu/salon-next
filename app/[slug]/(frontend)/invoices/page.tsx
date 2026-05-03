"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Plus, Trash2, Edit, Eye, FileText, Filter, DollarSign, ChevronLeft, ChevronRight, MoreVertical } from "lucide-react";
import { useSession } from "next-auth/react";
import TenantLink from '@/components/TenantLink';
import Modal from "@/components/dashboard/Modal";
import FormInput, { FormButton } from "@/components/dashboard/FormInput";
import { useSettings } from "@/components/providers/SettingsProvider";
import { formatDate } from "@/lib/dateUtils";

interface Invoice {
    _id: string;
    invoiceNumber: string;
    customer?: {
        _id: string;
        name: string;
        phone: string;
    };
    appointment?: string;
    items: any[];
    subtotal: number;
    tax: number;
    totalAmount: number;
    amountPaid: number;
    tips: number;
    paymentMethod: string;
    status: 'paid' | 'pending' | 'partially_paid' | 'cancelled';
    staff?: {
        _id: string;
        name: string;
    };
    staffAssignments?: {
        staff: {
            _id: string;
            name: string;
        };
        percentage: number;
        commission: number;
    }[];
    commission: number;
    date: string;
    notes?: string;
    createdAt: string;
}

interface PaginationData {
    total: number;
    page: number;
    limit: number;
    pages: number;
}

export default function InvoicesPage() {
    const { settings } = useSettings();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [pagination, setPagination] = useState<PaginationData>({
        total: 0,
        page: 1,
        limit: 10,
        pages: 0
    });

    const { data: session } = useSession();
    const userRole = (session as any)?.user?.role;
    const isKasir = typeof userRole === 'string'
        ? userRole.toLowerCase() === 'kasir'
        : userRole?.name?.toLowerCase() === 'kasir';

    // Edit Modal State
    const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
    const [editFormData, setEditFormData] = useState({ status: "", notes: "" });
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    // Payment Modal State
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
    const [paymentData, setPaymentData] = useState({ amount: "", method: "Cash", notes: "" });
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    const fetchInvoices = useCallback(async (page = 1, searchQuery = search, status = statusFilter) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: "10",
                search: searchQuery,
                status: status
            });
            const res = await fetch(`/api/invoices?${params.toString()}`);
            const data = await res.json();
            if (data.success) {
                setInvoices(data.data);
                setPagination(data.pagination);
            }
        } catch (error) {
            console.error("Error fetching invoices:", error);
        } finally {
            setLoading(false);
        }
    }, [search, statusFilter]);

    useEffect(() => {
        const delaySearch = setTimeout(() => {
            fetchInvoices(1, search, statusFilter);
        }, 500);
        return () => clearTimeout(delaySearch);
    }, [search, statusFilter, fetchInvoices]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (activeDropdown && !(event.target as Element).closest('.dropdown-trigger')) {
                setActiveDropdown(null);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [activeDropdown]);

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= pagination.pages) {
            fetchInvoices(newPage);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this invoice?")) return;
        try {
            const res = await fetch(`/api/invoices/${id}`, { method: "DELETE" });
            const data = await res.json();
            if (data.success) {
                fetchInvoices(pagination.page);
            }
        } catch (error) {
            console.error("Error deleting invoice:", error);
        }
    };

    const openEditModal = (inv: Invoice) => {
        setEditingInvoice(inv);
        setEditFormData({ status: inv.status, notes: inv.notes || "" });
        setIsEditModalOpen(true);
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingInvoice) return;

        setIsEditing(true);
        try {
            const res = await fetch(`/api/invoices/${editingInvoice._id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editFormData),
            });
            const data = await res.json();
            if (data.success) {
                fetchInvoices(pagination.page);
                setIsEditModalOpen(false);
            } else {
                alert(data.error || "Failed to update invoice");
            }
        } catch (error) {
            console.error("Error editing invoice:", error);
            alert("An error occurred");
        } finally {
            setIsEditing(false);
        }
    };

    const openPaymentModal = (inv: Invoice) => {
        setPayingInvoice(inv);
        const due = (inv.totalAmount || 0) - (inv.amountPaid || 0);
        setPaymentData({ amount: due.toString(), method: "Cash", notes: "" });
        setIsPaymentModalOpen(true);
    };

    const handlePaymentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!payingInvoice) return;

        setSubmitting(true);
        try {
            const res = await fetch("/api/deposits", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    invoice: payingInvoice._id,
                    customer: payingInvoice.customer?._id,
                    amount: parseFloat(paymentData.amount),
                    paymentMethod: paymentData.method,
                    notes: paymentData.notes
                }),
            });
            const data = await res.json();
            if (data.success) {
                fetchInvoices(pagination.page);
                setIsPaymentModalOpen(false);
                alert("Payment recorded successfully!");
            } else {
                alert(data.error || "Failed to record payment");
            }
        } catch (error) {
            console.error("Error recording payment:", error);
            alert("An error occurred");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Invoices & Payments</h1>
                    <p className="text-gray-500 text-sm">Manage billing, track partial payments and dues</p>
                </div>
                <div className="flex items-center gap-3">
                    <TenantLink
                        href="/pos"
                        className="flex items-center gap-2 px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-colors shadow-sm font-medium"
                    >
                        <Plus className="w-4 h-4" />
                        Create Invoice (POS)
                    </TenantLink>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden text-black">
                {/* Filters */}
                <div className="p-4 border-b border-gray-200 flex flex-col md:flex-row gap-4 items-center justify-between bg-gray-50/50">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search by invoice number or customer..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-all text-sm"
                        />
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto text-black">
                        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5 shadow-sm w-full sm:w-auto">
                            <Filter className="w-4 h-4 text-gray-400" />
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="bg-transparent border-none focus:ring-0 text-sm font-medium text-gray-700 w-full sm:w-auto"
                            >
                                <option value="all">All Status</option>
                                <option value="paid">Paid</option>
                                <option value="partially_paid">Partially Paid</option>
                                <option value="pending">Pending</option>
                                <option value="cancelled">Cancelled</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto text-black">
                    <table className="min-w-full divide-y divide-gray-200 hidden md:table">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Invoice / Customer</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Source</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Paid</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Due</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{isKasir ? 'Staff' : 'Staff (Comm)'}</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={8} className="px-6 py-4"><div className="h-4 bg-gray-100 rounded"></div></td>
                                    </tr>
                                ))
                            ) : invoices.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                                        <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                        <p>No invoices found</p>
                                    </td>
                                </tr>
                            ) : (
                                invoices.map((inv) => (
                                    <tr key={inv._id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <div className="p-2 bg-blue-50 rounded-lg">
                                                    <FileText className="w-4 h-4 text-blue-900" />
                                                </div>
                                                <div>
                                                    <span className="text-sm font-bold text-gray-900">{inv.invoiceNumber}</span>
                                                    <div className="text-[10px] text-gray-400 font-medium uppercase">{formatDate(inv.date, settings.timezone)}</div>
                                                    <div className="mt-1 flex flex-col">
                                                        <span className="text-xs font-semibold text-blue-700">{inv.customer?.name || "Walk-in"}</span>
                                                        {inv.customer?.phone && <span className="text-[10px] text-gray-500">{inv.customer.phone}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md border ${inv.appointment ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                }`}>
                                                {inv.appointment ? 'Appointment' : 'POS'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm font-bold text-gray-900">{settings.symbol}{(inv.totalAmount || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm font-bold text-green-600">{settings.symbol}{(inv.amountPaid || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`text-sm font-bold ${((inv.totalAmount || 0) - (inv.amountPaid || 0)) > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                                                {settings.symbol}{((inv.totalAmount || 0) - (inv.amountPaid || 0)).toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`text-[10px] uppercase tracking-widest font-black px-2.5 py-1 rounded-full border ${inv.status === 'paid' ? 'bg-green-50 text-green-700 border-green-200' :
                                                inv.status === 'partially_paid' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                    inv.status === 'pending' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                        'bg-red-50 text-red-700 border-red-200'
                                                }`}>
                                                {inv.status?.replace('_', ' ') || 'N/A'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {inv.staffAssignments && inv.staffAssignments.length > 0 ? (
                                                <div className="space-y-1">
                                                    {inv.staffAssignments.map((assignment: any, idx: number) => (
                                                        <div key={idx} className="flex flex-col">
                                                            <span className="text-xs font-medium text-gray-900 leading-tight">{assignment.staff?.name || "Staff"}</span>
                                                            {!isKasir && <span className="text-[10px] text-green-600 font-bold leading-tight">{settings.symbol}{(assignment.commission || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="text-sm font-medium text-gray-900">{inv.staff?.name || "N/A"}</div>
                                                    {!isKasir && <div className="text-xs text-green-600 font-bold">{settings.symbol}{(inv.commission || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</div>}
                                                </>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                            <div className="relative flex justify-end dropdown-trigger">
                                                <button
                                                    onClick={() => setActiveDropdown(activeDropdown === inv._id ? null : inv._id)}
                                                    className="p-2 text-gray-400 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-all"
                                                >
                                                    <MoreVertical className="w-5 h-5" />
                                                </button>

                                                {activeDropdown === inv._id && (
                                                    <div className="absolute right-0 mt-10 w-48 bg-white border border-gray-100 rounded-xl shadow-xl z-50 py-1 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                                        {((inv.totalAmount || 0) - (inv.amountPaid || 0)) > 0 && (
                                                            <button
                                                                onClick={() => {
                                                                    openPaymentModal(inv);
                                                                    setActiveDropdown(null);
                                                                }}
                                                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-green-600 hover:bg-green-50 transition-colors"
                                                            >
                                                                <DollarSign className="w-4 h-4" />
                                                                Record Payment
                                                            </button>
                                                        )}
                                                        <TenantLink
                                                            href={`/invoices/print/${inv._id}`}
                                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 transition-colors"
                                                            onClick={() => setActiveDropdown(null)}
                                                        >
                                                            <Eye className="w-4 h-4 text-blue-600" />
                                                            View Receipt
                                                        </TenantLink>
                                                        <button
                                                            onClick={() => {
                                                                openEditModal(inv);
                                                                setActiveDropdown(null);
                                                            }}
                                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-amber-50 transition-colors"
                                                        >
                                                            <Edit className="w-4 h-4 text-amber-600" />
                                                            Edit Notes
                                                        </button>
                                                        <div className="h-px bg-gray-100 my-1" />
                                                        <button
                                                            onClick={() => {
                                                                handleDelete(inv._id);
                                                                setActiveDropdown(null);
                                                            }}
                                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                            Delete Invoice
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

                    {/* Mobile Card View */}
                    <div className="md:hidden flex flex-col divide-y divide-gray-100 border-t border-gray-100">
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="p-4 animate-pulse space-y-3">
                                    <div className="h-4 bg-gray-100 rounded w-1/2"></div>
                                    <div className="h-4 bg-gray-100 rounded w-1/3"></div>
                                    <div className="h-10 bg-gray-100 rounded"></div>
                                </div>
                            ))
                        ) : invoices.length === 0 ? (
                            <div className="p-12 text-center text-gray-500">
                                <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p>No invoices found</p>
                            </div>
                        ) : (
                            invoices.map((inv) => (
                                <div key={inv._id} className="p-4 hover:bg-gray-50/50 transition-colors flex flex-col gap-3">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-blue-50 rounded-lg">
                                                <FileText className="w-4 h-4 text-blue-900" />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-bold text-gray-900">{inv.invoiceNumber}</h3>
                                                <p className="text-xs text-gray-500 uppercase font-semibold">{formatDate(inv.date, settings.timezone)}</p>
                                            </div>
                                        </div>
                                        <div className="relative dropdown-trigger">
                                            <button onClick={() => setActiveDropdown(activeDropdown === inv._id ? null : inv._id)} className="p-2 -mr-2 text-gray-400 hover:text-blue-900 rounded-lg">
                                                <MoreVertical className="w-5 h-5" />
                                            </button>
                                            {activeDropdown === inv._id && (
                                                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-xl z-50 py-1">
                                                    {((inv.totalAmount || 0) - (inv.amountPaid || 0)) > 0 && (
                                                        <button
                                                            onClick={() => { openPaymentModal(inv); setActiveDropdown(null); }}
                                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-green-600 hover:bg-green-50"
                                                        >
                                                            <DollarSign className="w-4 h-4" /> Record Payment
                                                        </button>
                                                    )}
                                                    <TenantLink
                                                        href={`/invoices/print/${inv._id}`}
                                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50"
                                                    >
                                                        <Eye className="w-4 h-4 text-blue-600" /> View Receipt
                                                    </TenantLink>
                                                    <button
                                                        onClick={() => { openEditModal(inv); setActiveDropdown(null); }}
                                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-amber-50"
                                                    >
                                                        <Edit className="w-4 h-4 text-amber-600" /> Edit Notes
                                                    </button>
                                                    <div className="h-px bg-gray-100 my-1" />
                                                    <button
                                                        onClick={() => { handleDelete(inv._id); setActiveDropdown(null); }}
                                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                                                    >
                                                        <Trash2 className="w-4 h-4" /> Delete Invoice
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-sm pt-1">
                                        <div>
                                            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Customer</p>
                                            <p className="font-semibold text-gray-900">{inv.customer?.name || "Walk-in"}</p>
                                            {inv.customer?.phone && <p className="text-xs text-gray-500">{inv.customer.phone}</p>}
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Source</p>
                                            <span className={`inline-block text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md border ${inv.appointment ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                                                {inv.appointment ? 'Appointment' : 'POS'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="border border-gray-100 rounded-lg p-3 bg-gray-50/50">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-xs text-gray-500 font-medium">Total</span>
                                            <span className="text-sm font-bold text-gray-900">{settings.symbol}{(inv.totalAmount || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                                        </div>
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-xs text-gray-500 font-medium">Paid</span>
                                            <span className="text-sm font-bold text-green-600">{settings.symbol}{(inv.amountPaid || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                                        </div>
                                        <div className="flex justify-between items-center border-t border-gray-200 pt-1 mt-1">
                                            <span className="text-xs text-gray-700 font-bold uppercase">Due</span>
                                            <span className={`text-sm font-black ${((inv.totalAmount || 0) - (inv.amountPaid || 0)) > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                                                {settings.symbol}{((inv.totalAmount || 0) - (inv.amountPaid || 0)).toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-end pt-2 border-t border-gray-100 mt-1">
                                        <div>
                                            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Staff</p>
                                            {inv.staffAssignments && inv.staffAssignments.length > 0 ? (
                                                <div className="space-y-1">
                                                    {inv.staffAssignments.map((assignment: any, idx: number) => (
                                                        <div key={idx} className="flex items-center gap-1">
                                                            <span className="text-xs font-semibold text-gray-900">{assignment.staff?.name || "Staff"}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-xs font-semibold text-gray-900">{inv.staff?.name || "N/A"}</span>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <span className={`text-[10px] uppercase tracking-widest font-black px-2.5 py-1 rounded-full border ${inv.status === 'paid' ? 'bg-green-50 text-green-700 border-green-200' :
                                                    inv.status === 'partially_paid' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                        inv.status === 'pending' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                            'bg-red-50 text-red-700 border-red-200'
                                                }`}>
                                                {inv.status?.replace('_', ' ') || 'N/A'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Pagination */}
                <div className="px-4 py-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-sm text-gray-500 font-medium text-center sm:text-left">
                        Showing <span className="text-gray-900">{invoices.length}</span> of <span className="text-gray-900">{pagination.total}</span> invoices
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => handlePageChange(pagination.page - 1)}
                            disabled={pagination.page <= 1}
                            className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                                let pageNum;
                                if (pagination.pages <= 5) {
                                    pageNum = i + 1;
                                } else if (pagination.page <= 3) {
                                    pageNum = i + 1;
                                } else if (pagination.page >= pagination.pages - 2) {
                                    pageNum = pagination.pages - 4 + i;
                                } else {
                                    pageNum = pagination.page - 2 + i;
                                }

                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => handlePageChange(pageNum)}
                                        className={`w-8 h-8 rounded-lg text-sm font-semibold transition-all ${pagination.page === pageNum
                                            ? "bg-blue-900 text-white"
                                            : "text-gray-600 hover:bg-gray-100"
                                            }`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                        </div>
                        <button
                            onClick={() => handlePageChange(pagination.page + 1)}
                            disabled={pagination.page >= pagination.pages}
                            className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Record Payment Modal */}
            <Modal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                title={`Record Payment for ${payingInvoice?.invoiceNumber}`}
            >
                <form onSubmit={handlePaymentSubmit} className="space-y-4">
                    <div className="bg-blue-50 p-4 rounded-lg mb-4 flex justify-between items-center text-blue-900">
                        <span className="text-sm font-medium">Total Balance Due</span>
                        <span className="text-xl font-bold">{settings.symbol}{(payingInvoice ? ((payingInvoice.totalAmount || 0) - (payingInvoice.amountPaid || 0)) : 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                    </div>

                    <FormInput
                        label="Payment Amount"
                        type="number"
                        required
                        value={paymentData.amount}
                        onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                        max={payingInvoice ? ((payingInvoice.totalAmount || 0) - (payingInvoice.amountPaid || 0)) : 0}
                    />

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                        <div className="grid grid-cols-3 gap-2">
                            {['Cash', 'Card', 'Wallet'].map(m => (
                                <button
                                    key={m}
                                    type="button"
                                    onClick={() => setPaymentData({ ...paymentData, method: m })}
                                    className={`py-2 px-3 text-sm font-semibold rounded-lg border transition-all ${paymentData.method === m ? 'bg-blue-900 text-white border-blue-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                                >
                                    {m}
                                </button>
                            ))}
                        </div>
                    </div>

                    <FormInput
                        label="Notes (Optional)"
                        value={paymentData.notes}
                        onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                        placeholder="e.g. Received by cashier"
                    />

                    <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={() => setIsPaymentModalOpen(false)}
                            className="w-full sm:w-auto px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-all font-medium text-center border border-gray-200 sm:border-transparent"
                        >
                            Cancel
                        </button>
                        <FormButton
                            type="submit"
                            loading={submitting}
                            variant="success"
                            className="w-full sm:w-auto"
                        >
                            Record {settings.symbol}{parseFloat(paymentData.amount || "0").toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                        </FormButton>
                    </div>
                </form>
            </Modal>

            {/* Edit Modal */}
            <Modal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                title={`Edit Invoice ${editingInvoice?.invoiceNumber}`}
            >
                <form onSubmit={handleEditSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                        <select
                            value={editFormData.status}
                            onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 outline-none transition-all text-black"
                        >
                            <option value="paid">Paid</option>
                            <option value="partially_paid">Partially Paid</option>
                            <option value="pending">Pending</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                        <textarea
                            value={editFormData.notes}
                            onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 outline-none transition-all text-black"
                            rows={3}
                            placeholder="Add invoice notes..."
                        />
                    </div>
                    <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 mt-6">
                        <button
                            type="button"
                            onClick={() => setIsEditModalOpen(false)}
                            className="w-full sm:w-auto px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-all font-medium border border-gray-200 sm:border-transparent"
                        >
                            Cancel
                        </button>
                        <FormButton
                            type="submit"
                            loading={isEditing}
                            className="w-full sm:w-auto"
                        >
                            Save Changes
                        </FormButton>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
