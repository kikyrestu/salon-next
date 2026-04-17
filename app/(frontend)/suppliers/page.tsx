"use client";

import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Search, Truck, Phone, Mail, MapPin, MoreVertical, ChevronLeft, ChevronRight, Filter, FileText } from "lucide-react";
import Modal from "@/components/dashboard/Modal";
import FormInput, { FormSelect, FormButton } from "@/components/dashboard/FormInput";
import PermissionGate from "@/components/PermissionGate";

interface Supplier {
    _id: string;
    name: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    address?: string;
    status: string;
}

export default function SuppliersPage() {
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState<any>({ total: 0, page: 1, limit: 10, pages: 0 });
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (activeDropdown && !(event.target as Element).closest('.dropdown-trigger')) {
                setActiveDropdown(null);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [activeDropdown]);

    const [formData, setFormData] = useState({
        name: "",
        contactPerson: "",
        email: "",
        phone: "",
        address: "",
        status: "active",
    });

    useEffect(() => {
        fetchSuppliers();
    }, [search, page]);

    const fetchSuppliers = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/suppliers?search=${search}&page=${page}&limit=10`);
            const data = await res.json();
            if (data.success) {
                setSuppliers(data.data);
                if (data.pagination) setPagination(data.pagination);
            }
        } catch (error) {
            console.error("Error:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const url = editingSupplier ? `/api/suppliers/${editingSupplier._id}` : "/api/suppliers";
            const res = await fetch(url, {
                method: editingSupplier ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });
            const data = await res.json();
            if (data.success) {
                fetchSuppliers();
                closeModal();
            } else {
                alert(data.error || "Something went wrong");
            }
        } catch (error) {
            console.error(error);
            alert("An error occurred");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this supplier?")) return;
        const res = await fetch(`/api/suppliers/${id}`, { method: "DELETE" });
        if ((await res.json()).success) fetchSuppliers();
    };

    const openModal = (supplier?: Supplier) => {
        if (supplier) {
            setEditingSupplier(supplier);
            setFormData({
                name: supplier.name,
                contactPerson: supplier.contactPerson || "",
                email: supplier.email || "",
                phone: supplier.phone || "",
                address: supplier.address || "",
                status: supplier.status,
            });
        } else {
            setEditingSupplier(null);
            setFormData({ name: "", contactPerson: "", email: "", phone: "", address: "", status: "active" });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingSupplier(null);
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header Section */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Supplier Management</h1>
                        <p className="text-sm text-gray-500">Manage your product suppliers and vendors</p>
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <PermissionGate resource="suppliers" action="create">
                            <button
                                onClick={() => openModal()}
                                className="w-full sm:w-auto px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-all flex justify-center items-center gap-2 shadow-sm font-semibold text-sm"
                            >
                                <Plus className="w-4 h-4 shrink-0" />
                                Add Supplier
                            </button>
                        </PermissionGate>
                    </div>
                </div>

                {/* Main Card */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden text-black">
                    {/* Filters Bar */}
                    <div className="p-4 border-b border-gray-200 flex flex-col md:flex-row gap-4 items-center justify-between bg-gray-50/50">
                        <div className="relative w-full md:w-96">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Search by name, email or phone..."
                                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-all text-sm"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <button
                                onClick={() => { setSearch(""); setPage(1); }}
                                className="text-gray-500 hover:text-gray-700 font-medium text-sm px-2"
                            >
                                Reset
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 hidden md:table">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Supplier</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact Info</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Address</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                                {loading && suppliers.length === 0 ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan={5} className="px-6 py-4"><div className="h-4 bg-gray-100 rounded"></div></td>
                                        </tr>
                                    ))
                                ) : suppliers.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                            <Truck className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                            <p>No suppliers found</p>
                                        </td>
                                    </tr>
                                ) : (
                                    suppliers.map((supplier) => (
                                        <tr key={supplier._id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-orange-50 rounded-lg">
                                                        <Truck className="w-4 h-4 text-orange-600" />
                                                    </div>
                                                    <div>
                                                        <span className="text-sm font-bold text-gray-900">{supplier.name}</span>
                                                        <div className="text-[10px] text-gray-400 font-medium uppercase">{supplier.contactPerson || "N/A"}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="space-y-1">
                                                    {supplier.email ? (
                                                        <div className="flex items-center gap-1.5 text-xs text-gray-600">
                                                            <Mail className="w-3 h-3 text-gray-400" />
                                                            <span className="truncate max-w-[150px]">{supplier.email}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-gray-400 italic">No email</span>
                                                    )}
                                                    {supplier.phone && (
                                                        <div className="flex items-center gap-1.5 text-xs text-gray-600">
                                                            <Phone className="w-3 h-3 text-gray-400" />
                                                            {supplier.phone}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {supplier.address ? (
                                                    <div className="flex items-center gap-1.5 text-xs text-gray-600 max-w-[200px]">
                                                        <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                                        <span className="truncate">{supplier.address}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-gray-400 italic">No address</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${supplier.status === "active"
                                                    ? "bg-green-50 text-green-700 border-green-200"
                                                    : "bg-gray-50 text-gray-600 border-gray-200"
                                                    }`}>
                                                    {supplier.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                                <div className="relative flex justify-end dropdown-trigger">
                                                    <button
                                                        onClick={() => setActiveDropdown(activeDropdown === supplier._id ? null : supplier._id)}
                                                        className="p-2 text-gray-400 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-all"
                                                    >
                                                        <MoreVertical className="w-5 h-5" />
                                                    </button>

                                                    {activeDropdown === supplier._id && (
                                                        <div className="absolute right-0 mt-10 w-48 bg-white border border-gray-100 rounded-xl shadow-xl z-50 py-1 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 text-left">
                                                            <PermissionGate resource="suppliers" action="edit">
                                                                <button
                                                                    onClick={() => {
                                                                        openModal(supplier);
                                                                        setActiveDropdown(null);
                                                                    }}
                                                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 transition-colors"
                                                                >
                                                                    <Edit className="w-4 h-4 text-blue-600" />
                                                                    Edit Details
                                                                </button>
                                                            </PermissionGate>
                                                            <div className="h-px bg-gray-100 my-1" />
                                                            <PermissionGate resource="suppliers" action="delete">
                                                                <button
                                                                    onClick={() => {
                                                                        handleDelete(supplier._id);
                                                                        setActiveDropdown(null);
                                                                    }}
                                                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                    Delete Supplier
                                                                </button>
                                                            </PermissionGate>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>

                        {/* Mobile Card View (Suppliers) */}
                        <div className="md:hidden flex flex-col divide-y divide-gray-100">
                            {loading && suppliers.length === 0 ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <div key={i} className="p-4 animate-pulse space-y-3">
                                        <div className="h-4 bg-gray-100 rounded w-1/2"></div>
                                        <div className="h-4 bg-gray-100 rounded w-1/3"></div>
                                    </div>
                                ))
                            ) : suppliers.length === 0 ? (
                                <div className="p-12 text-center text-gray-500">
                                    <Truck className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                    <p>No suppliers found</p>
                                </div>
                            ) : (
                                suppliers.map((supplier) => (
                                    <div key={supplier._id} className="p-4 flex flex-col gap-3 relative hover:bg-gray-50/50 transition-colors">
                                        <div className="flex justify-between items-start pr-8">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center shrink-0">
                                                    <Truck className="w-5 h-5 text-orange-600" />
                                                </div>
                                                <div>
                                                    <h3 className="text-sm font-bold text-gray-900 leading-tight">{supplier.name}</h3>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className={`inline-flex items-center px-2 rounded-[4px] text-[9px] font-bold uppercase tracking-wide border ${supplier.status === "active"
                                                            ? "bg-green-50 text-green-700 border-green-200"
                                                            : "bg-gray-50 text-gray-600 border-gray-200"
                                                            }`}>
                                                            {supplier.status}
                                                        </span>
                                                        <span className="text-[10px] text-gray-400 font-medium uppercase">{supplier.contactPerson || "N/A"}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="absolute top-4 right-2 dropdown-trigger">
                                            <button
                                                onClick={() => setActiveDropdown(activeDropdown === supplier._id ? null : supplier._id)}
                                                className="p-1.5 text-gray-400 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-all"
                                            >
                                                <MoreVertical className="w-5 h-5 shrink-0" />
                                            </button>
                                            {activeDropdown === supplier._id && (
                                                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-xl z-50 py-1 overflow-hidden font-medium">
                                                    <PermissionGate resource="suppliers" action="edit">
                                                        <button onClick={() => { openModal(supplier); setActiveDropdown(null); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 transition-colors">
                                                            <Edit className="w-4 h-4 text-blue-600" /> Edit Details
                                                        </button>
                                                    </PermissionGate>
                                                    <div className="h-px bg-gray-100 my-1" />
                                                    <PermissionGate resource="suppliers" action="delete">
                                                        <button onClick={() => { handleDelete(supplier._id); setActiveDropdown(null); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                                                            <Trash2 className="w-4 h-4" /> Delete Supplier
                                                        </button>
                                                    </PermissionGate>
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-1.5 bg-gray-50/50 p-3 rounded-lg border border-gray-100 mt-1">
                                            {supplier.phone && (
                                                <div className="flex items-center gap-2 text-xs text-gray-600">
                                                    <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                                    {supplier.phone}
                                                </div>
                                            )}
                                            {supplier.email ? (
                                                <div className="flex items-center gap-2 text-xs text-gray-600">
                                                    <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                                    <span className="truncate">{supplier.email}</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 text-xs text-gray-400 italic">
                                                    <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                                    No email provided
                                                </div>
                                            )}
                                            {supplier.address ? (
                                                <div className="flex items-start gap-2 text-xs text-gray-600 mt-1.5 pt-1.5 border-t border-gray-100">
                                                    <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                                                    <span className="line-clamp-2">{supplier.address}</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 text-xs text-gray-400 italic mt-1.5 pt-1.5 border-t border-gray-100">
                                                    <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                                    No address provided
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Pagination */}
                    <div className="px-4 py-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-sm text-gray-500 font-medium text-center sm:text-left">
                            Showing <span className="text-gray-900">{suppliers.length}</span> of <span className="text-gray-900">{pagination.total}</span> suppliers
                        </div>
                        <div className="flex items-center justify-center gap-2 w-full sm:w-auto">
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
            </div>

            <Modal isOpen={isModalOpen} onClose={closeModal} title={editingSupplier ? "Edit Supplier" : "Add New Supplier"}>
                <form onSubmit={handleSubmit}>
                    <FormInput label="Name" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Enter supplier name" />
                    <FormInput label="Contact Person" value={formData.contactPerson} onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })} placeholder="Enter contact person name" />
                    <FormInput label="Email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="Enter email address" />
                    <FormInput label="Phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="Enter phone number" />
                    <FormInput label="Address" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} placeholder="Enter address" />
                    <FormSelect
                        label="Status"
                        required
                        value={formData.status}
                        onChange={(e: any) => setFormData({ ...formData, status: e.target.value })}
                        options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]}
                    />
                    <div className="flex flex-col-reverse sm:flex-row justify-end sm:space-x-3 gap-3 sm:gap-0 mt-6">
                        <button type="button" onClick={closeModal} className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-bold transition-colors text-center">Cancel</button>
                        <FormButton type="submit" loading={submitting} className="w-full sm:w-auto text-center justify-center">
                            {editingSupplier ? "Update Supplier" : "Create Supplier"}
                        </FormButton>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
