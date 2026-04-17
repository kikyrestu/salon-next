"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Search, Shield, Edit, Trash2, Key, Filter, ChevronLeft, ChevronRight, MoreVertical, FileText, Clock } from "lucide-react";
import PermissionGate from "@/components/PermissionGate";

export default function RolesPage() {
    const [roles, setRoles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState<any>({ total: 0, page: 1, limit: 10, pages: 0 });
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (activeDropdown && !(event.target as Element).closest('.dropdown-trigger')) {
                setActiveDropdown(null);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [activeDropdown]);

    useEffect(() => {
        fetchRoles();
    }, [search, page]);

    const fetchRoles = async () => {
        setLoading(true);
        try {
            const query = new URLSearchParams({
                search,
                page: page.toString(),
                limit: "10"
            });
            const res = await fetch(`/api/roles?${query}`);
            const data = await res.json();
            if (data.success) {
                setRoles(data.data);
                if (data.pagination) setPagination(data.pagination);
            }
        } catch (error) {
            console.error("Error fetching roles:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this role?")) return;

        try {
            const res = await fetch(`/api/roles/${id}`, {
                method: "DELETE",
            });
            const data = await res.json();

            if (data.success) {
                fetchRoles();
            } else {
                alert(data.error || "Failed to delete role");
            }
        } catch (error) {
            console.error("Error deleting role:", error);
            alert("Error deleting role");
        }
    };

    // Count permissions for a role
    const countPermissions = (role: any) => {
        let count = 0;
        if (role.permissions) {
            Object.values(role.permissions).forEach((perm: any) => {
                if (perm.view === 'all' || perm.view === 'own' || perm.view === true) count++;
                if (perm.create) count++;
                if (perm.edit) count++;
                if (perm.delete) count++;
            });
        }
        return count;
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header Section */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Roles & Permissions</h1>
                        <p className="text-sm text-gray-500">Manage user access levels and permissions</p>
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto">

                        <PermissionGate resource="roles" action="create">
                            <Link
                                href="/roles/new"
                                className="w-full sm:w-auto px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-all flex justify-center items-center gap-2 shadow-sm font-semibold text-sm"
                            >
                                <Plus className="w-4 h-4 shrink-0" />
                                Create Role
                            </Link>
                        </PermissionGate>
                    </div>
                </div>

                {/* Main Card */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden text-black">
                    {/* Filters Bar */}
                    <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row gap-4 items-center justify-between bg-gray-50/50">
                        <div className="relative w-full md:w-96">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Search roles..."
                                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-all text-sm"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            <button
                                onClick={() => { setSearch(""); setPage(1); }}
                                className="w-full sm:w-auto text-gray-500 hover:text-gray-700 font-medium text-sm px-4 py-2 bg-gray-100 sm:bg-transparent rounded-lg sm:rounded-none transition-colors"
                            >
                                Reset Filters
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 hidden md:table">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Permissions</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Updated</th>
                                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                                {loading && roles.length === 0 ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan={5} className="px-6 py-4"><div className="h-4 bg-gray-100 rounded"></div></td>
                                        </tr>
                                    ))
                                ) : roles.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                            <Shield className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                            <p>No roles found</p>
                                        </td>
                                    </tr>
                                ) : (
                                    roles.map((role) => (
                                        <tr key={role._id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${role.isSystem ? 'bg-purple-100' : 'bg-blue-100'}`}>
                                                        <Shield className={`w-4 h-4 ${role.isSystem ? 'text-purple-600' : 'text-blue-600'}`} />
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-semibold text-gray-900">{role.name}</div>
                                                        {role.isSystem && (
                                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-100">
                                                                System Default
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-sm text-gray-600 max-w-xs truncate block">
                                                    {role.description || "No description"}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-green-50 text-green-700 border border-green-200">
                                                    <Key className="w-3 h-3" />
                                                    {countPermissions(role)} permissions
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {new Date(role.updatedAt).toLocaleDateString('en-US', {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric'
                                                })}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                                <div className="relative flex justify-end dropdown-trigger">
                                                    <button
                                                        onClick={() => setActiveDropdown(activeDropdown === role._id ? null : role._id)}
                                                        className="p-2 text-gray-400 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-all"
                                                    >
                                                        <MoreVertical className="w-5 h-5" />
                                                    </button>

                                                    {activeDropdown === role._id && (
                                                        <div className="absolute right-0 mt-10 w-48 bg-white border border-gray-100 rounded-xl shadow-xl z-50 py-1 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 text-left">
                                                            <PermissionGate resource="roles" action="edit">
                                                                <Link
                                                                    href={`/roles/${role._id}`}
                                                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 transition-colors"
                                                                >
                                                                    <Edit className="w-4 h-4 text-blue-600" />
                                                                    Edit Role
                                                                </Link>
                                                            </PermissionGate>
                                                            {!role.isSystem && (
                                                                <>
                                                                    <div className="h-px bg-gray-100 my-1" />
                                                                    <PermissionGate resource="roles" action="delete">
                                                                        <button
                                                                            onClick={() => {
                                                                                handleDelete(role._id);
                                                                                setActiveDropdown(null);
                                                                            }}
                                                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                                                        >
                                                                            <Trash2 className="w-4 h-4" />
                                                                            Delete Role
                                                                        </button>
                                                                    </PermissionGate>
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>

                        {/* Mobile Card View (Roles) */}
                        <div className="md:hidden flex flex-col divide-y divide-gray-100">
                            {loading && roles.length === 0 ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <div key={i} className="p-4 animate-pulse space-y-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-gray-100"></div>
                                            <div className="flex-1 space-y-2">
                                                <div className="h-4 bg-gray-100 rounded w-1/2"></div>
                                                <div className="h-3 bg-gray-100 rounded w-1/3"></div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : roles.length === 0 ? (
                                <div className="p-12 text-center text-gray-500">
                                    <Shield className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                    <p>No roles found</p>
                                </div>
                            ) : (
                                roles.map((role) => (
                                    <div key={role._id} className="p-4 flex flex-col gap-3 relative hover:bg-gray-50/50 transition-colors">
                                        <div className="flex justify-between items-start pr-8">
                                            <div className="flex items-start gap-3">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${role.isSystem ? 'bg-purple-100' : 'bg-blue-100'}`}>
                                                    <Shield className={`w-4 h-4 ${role.isSystem ? 'text-purple-600' : 'text-blue-600'}`} />
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <h3 className="text-sm font-bold text-gray-900 leading-tight">{role.name}</h3>
                                                        {role.isSystem && (
                                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-100">
                                                                System Default
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-xs text-gray-600 line-clamp-2 pr-4 text-left">
                                                        {role.description || "No description"}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="absolute top-4 right-2 dropdown-trigger">
                                            <button
                                                onClick={() => setActiveDropdown(activeDropdown === role._id ? null : role._id)}
                                                className="p-1.5 text-gray-400 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-all"
                                            >
                                                <MoreVertical className="w-5 h-5 shrink-0" />
                                            </button>
                                            {activeDropdown === role._id && (
                                                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-xl z-50 py-1 overflow-hidden font-medium">
                                                    <PermissionGate resource="roles" action="edit">
                                                        <Link href={`/roles/${role._id}`} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 transition-colors">
                                                            <Edit className="w-4 h-4 text-blue-600" /> Edit Role
                                                        </Link>
                                                    </PermissionGate>
                                                    {!role.isSystem && (
                                                        <>
                                                            <div className="h-px bg-gray-100 my-1" />
                                                            <PermissionGate resource="roles" action="delete">
                                                                <button onClick={() => { handleDelete(role._id); setActiveDropdown(null); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                                                                    <Trash2 className="w-4 h-4" /> Delete Role
                                                                </button>
                                                            </PermissionGate>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex justify-between items-center mt-1">
                                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-green-50 text-green-700 border border-green-200">
                                                <Key className="w-3 h-3 shrink-0" />
                                                {countPermissions(role)} permissions
                                            </span>
                                            
                                            <div className="text-[11px] text-gray-400 font-medium">
                                                Updated {new Date(role.updatedAt).toLocaleDateString('en-US', {
                                                    year: 'numeric', month: 'short', day: 'numeric'
                                                })}
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
                            Showing <span className="text-gray-900">{roles.length}</span> of <span className="text-gray-900">{pagination.total}</span> records
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
        </div>
    );
}
