
"use client";

import { useState, useEffect } from "react";
import { Plus, Search, Archive, User, Calendar, History, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import Modal from "@/components/dashboard/Modal";
import FormInput, { FormSelect, FormButton } from "@/components/dashboard/FormInput";
import { format } from "date-fns";

export default function UsageLogsPage() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState<any>({ total: 0, page: 1, limit: 10, pages: 0 });

    const [isvModalOpen, setIsModalOpen] = useState(false);
    const [products, setProducts] = useState<any[]>([]);
    const [staffList, setStaffList] = useState<any[]>([]);
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        product: "",
        quantity: 1,
        reason: "Service",
        staff: "",
        notes: ""
    });

    useEffect(() => {
        fetchLogs();
    }, [page, search]);

    useEffect(() => {
        // Fetch products and staff for the modal
        const fetchResources = async () => {
            const [prodRes, staffRes] = await Promise.all([
                fetch('/api/products?limit=100'),
                fetch('/api/staff?limit=100')
            ]);
            const prodData = await prodRes.json();
            const staffData = await staffRes.json();

            if (prodData.success) setProducts(prodData.data);
            if (staffData.success) setStaffList(staffData.data);
        };
        fetchResources();
    }, []);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const query = new URLSearchParams();
            query.append("page", page.toString());
            query.append("limit", "10");
            if (search) query.append("search", search);

            const res = await fetch(`/api/usage-logs?${query.toString()}`);
            const data = await res.json();
            if (data.success) {
                setLogs(data.data);
                if (data.pagination) setPagination(data.pagination);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure? Deleting this log will REVERT the product stock.")) return;

        try {
            const res = await fetch(`/api/usage-logs/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                fetchLogs();
            } else {
                alert(data.error || "Failed to delete");
            }
        } catch (error) {
            console.error(error);
            alert("Error deleting usage log");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await fetch('/api/usage-logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await res.json();
            if (data.success) {
                fetchLogs();
                setIsModalOpen(false);
                setFormData({ product: "", quantity: 1, reason: "Service", staff: "", notes: "" });
            } else {
                alert(data.error || "Failed to add log");
            }
        } catch (error) {
            console.error(error);
            alert("Error adding usage log");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="p-6 min-h-screen bg-gray-50 text-black">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Product Usage Logs</h1>
                    <p className="text-gray-500 text-sm">Track internal consumption, damages, and service usage</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-all flex items-center justify-center gap-2 shadow-sm font-semibold text-sm w-full md:w-auto"
                >
                    <Plus className="w-4 h-4 shrink-0" />
                    Record Usage
                </button>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-200 bg-gray-50/50">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search by product..."
                            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-all text-sm"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 hidden md:table">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Product</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Quantity</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Reason</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Staff</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Notes</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                            {loading && logs.length === 0 ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={6} className="px-6 py-4"><div className="h-4 bg-gray-100 rounded"></div></td>
                                    </tr>
                                ))
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                        <History className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                        <p>No usage logs found</p>
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log._id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2 text-gray-500">
                                                <Calendar className="w-4 h-4" />
                                                <span className="text-sm">{format(new Date(log.date), "MMM dd, yyyy")}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 bg-purple-50 rounded-lg">
                                                    <Archive className="w-3.5 h-3.5 text-purple-600" />
                                                </div>
                                                <div>
                                                    <span className="text-sm font-bold text-gray-900">{log.product?.name || "Unknown Product"}</span>
                                                    <div className="text-[10px] text-gray-400">{log.product?.sku}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm font-bold text-red-600">-{log.quantity}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                {log.reason}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {log.staff ? (
                                                <div className="flex items-center gap-2 text-sm text-gray-700">
                                                    <User className="w-3.5 h-3.5" />
                                                    {log.staff.name}
                                                </div>
                                            ) : (
                                                <span className="text-sm text-gray-400">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm text-gray-500 truncate max-w-xs block">{log.notes || "-"}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                            <button
                                                onClick={() => handleDelete(log._id)}
                                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors inline-flex items-center gap-1 font-medium"
                                                title="Delete Log & Revert Stock"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                <span className="sr-only">Delete</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>

                    {/* Mobile Card View (Logs) */}
                    <div className="md:hidden flex flex-col divide-y divide-gray-100 mt-2">
                        {loading && logs.length === 0 ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="p-4 animate-pulse space-y-3">
                                    <div className="h-4 bg-gray-100 rounded w-1/2"></div>
                                    <div className="h-4 bg-gray-100 rounded w-1/3"></div>
                                </div>
                            ))
                        ) : logs.length === 0 ? (
                            <div className="p-12 text-center text-gray-500">
                                <History className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p>No usage logs found</p>
                            </div>
                        ) : (
                            logs.map((log) => (
                                <div key={log._id} className="p-4 flex flex-col gap-3 relative hover:bg-gray-50/50 transition-colors">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3 pr-10">
                                            <div className="bg-purple-50 rounded-lg shrink-0 w-10 h-10 flex items-center justify-center">
                                                <Archive className="w-5 h-5 text-purple-600" />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-bold text-gray-900 leading-tight">{log.product?.name || "Unknown Product"}</h3>
                                                <p className="text-[10px] text-gray-400 font-medium tracking-wide mt-0.5">#{log.product?.sku || log.product?._id?.toString().slice(-6) || "N/A"}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleDelete(log._id)}
                                            className="absolute top-4 right-4 p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors inline-flex items-center justify-center bg-white border border-gray-100 shadow-sm"
                                        >
                                            <Trash2 className="w-4 h-4 shrink-0" />
                                        </button>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-2 text-sm bg-gray-50/80 rounded-xl p-3 border border-gray-100 mt-1">
                                        <div>
                                            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Reason</p>
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-white text-gray-800 border border-gray-200">
                                                {log.reason}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Quantity</p>
                                            <span className="text-sm font-black text-red-600">-{log.quantity}</span>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center justify-between text-xs pt-1">
                                        <div className="flex items-center gap-1.5 font-semibold text-gray-600">
                                            <Calendar className="w-3.5 h-3.5" />
                                            {format(new Date(log.date), "MMM dd, yyyy")}
                                        </div>
                                        {log.staff ? (
                                            <div className="flex items-center gap-1.5 font-semibold text-gray-600">
                                                <User className="w-3.5 h-3.5" />
                                                <span className="truncate max-w-[100px]">{log.staff.name}</span>
                                            </div>
                                        ) : (
                                            <span className="font-medium text-gray-400 border border-dashed border-gray-300 rounded px-1.5 py-0.5 text-[10px]">NO STAFF</span>
                                        )}
                                    </div>
                                    {log.notes && (
                                        <div className="text-[10px] text-gray-500 bg-amber-50/50 p-2 rounded border border-amber-100 italic">
                                            Notes: {log.notes}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Pagination */}
                <div className="px-4 py-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-sm text-gray-500 font-medium text-center sm:text-left">
                        Showing <span className="text-gray-900">{logs.length}</span> of <span className="text-gray-900">{pagination.total}</span> usage logs
                    </div>
                    <div className="flex items-center gap-2 justify-center w-full sm:w-auto">
                        <button
                            onClick={() => page > 1 && setPage(page - 1)}
                            disabled={page <= 1}
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
                                        onClick={() => setPage(pageNum)}
                                        className={`w-8 h-8 rounded-lg text-sm font-semibold transition-all ${page === pageNum
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
                            onClick={() => page < pagination.pages && setPage(page + 1)}
                            disabled={page >= pagination.pages}
                            className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            <Modal isOpen={isvModalOpen} onClose={() => setIsModalOpen(false)} title="Record Product Usage">
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <FormSelect
                            label="Product"
                            required
                            value={formData.product}
                            onChange={(e: any) => setFormData({ ...formData, product: e.target.value })}
                            options={products.map(p => ({ value: p._id, label: `${p.name} (Stock: ${p.stock})` }))}
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormInput
                                label="Quantity"
                                type="number"
                                min={1}
                                required
                                value={formData.quantity}
                                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
                            />
                            <FormSelect
                                label="Reason"
                                value={formData.reason}
                                onChange={(e: any) => setFormData({ ...formData, reason: e.target.value })}
                                options={[
                                    { value: "Service", label: "Service Usage" },
                                    { value: "Damaged", label: "Damaged / Spoiled" },
                                    { value: "Expired", label: "Expired" },
                                    { value: "Internal Use", label: "Internal Use" },
                                    { value: "Theft", label: "Theft / Loss" },
                                    { value: "Other", label: "Other" }
                                ]}
                            />
                        </div>
                        <FormSelect
                            label="Staff Member (Optional)"
                            value={formData.staff}
                            onChange={(e: any) => setFormData({ ...formData, staff: e.target.value })}
                            options={[{ value: "", label: "Select Staff..." }, ...staffList.map(s => ({ value: s._id, label: s.name }))]}
                        />
                        <FormInput
                            label="Notes"
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="Additional details..."
                        />
                    </div>
                    <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 mt-6">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-center font-bold" disabled={submitting}>Cancel</button>
                        <FormButton type="submit" loading={submitting} className="w-full sm:w-auto text-center justify-center">Save Record</FormButton>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
