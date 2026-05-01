"use client";

import { useState, useEffect } from "react";
import TenantLink from '@/components/TenantLink';
import { Plus, Search, Users, Edit, Trash2, Shield, Mail, Filter, ChevronLeft, ChevronRight, MoreVertical, FileText } from "lucide-react";
import PermissionGate from "@/components/PermissionGate";

export default function UsersPage() {
    const [users, setUsers] = useState<any[]>([]);
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
        fetchUsers();
    }, [search, page]);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const query = new URLSearchParams({
                search,
                page: page.toString(),
                limit: "10"
            });
            const res = await fetch(`/api/users?${query}`);
            const data = await res.json();
            if (data.success) {
                setUsers(data.data);
                if (data.pagination) setPagination(data.pagination);
            }
        } catch (error) {
            console.error("Error fetching users:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this user?")) return;

        try {
            const res = await fetch(`/api/users/${id}`, {
                method: "DELETE",
            });
            const data = await res.json();

            if (data.success) {
                fetchUsers();
            } else {
                alert(data.error || "Failed to delete user");
            }
        } catch (error) {
            console.error("Error deleting user:", error);
            alert("Error deleting user");
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header Section */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
                        <p className="text-sm text-gray-500">Manage system users and their access levels</p>
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <PermissionGate resource="users" action="create">
                            <TenantLink
                                href="/users/new"
                                className="w-full sm:w-auto px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-all flex justify-center items-center gap-2 shadow-sm font-semibold text-sm"
                            >
                                <Plus className="w-4 h-4 shrink-0" />
                                Create User
                            </TenantLink>
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
                                placeholder="Search users..."
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
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Joined</th>
                                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                                {loading && users.length === 0 ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan={5} className="px-6 py-4"><div className="h-4 bg-gray-100 rounded"></div></td>
                                        </tr>
                                    ))
                                ) : users.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                            <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                            <p>No users found</p>
                                        </td>
                                    </tr>
                                ) : (
                                    users.map((user) => (
                                        <tr key={user._id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
                                                        {user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold text-gray-900">{user.name || "Unnamed User"}</div>
                                                        <div className="text-[10px] text-gray-400">ID: {user._id.slice(-6)}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-1.5 text-sm text-gray-600">
                                                    <Mail className="w-3.5 h-3.5 text-gray-400" />
                                                    {user.email}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {user.role ? (
                                                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${user.role.isSystem
                                                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                                                        : 'bg-blue-50 text-blue-700 border-blue-200'
                                                        }`}>
                                                        <Shield className="w-3 h-3" />
                                                        {user.role.name}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-gray-100 text-gray-600 border border-gray-200">
                                                        No Role Assigned
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {new Date(user.createdAt).toLocaleDateString('en-US', {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric'
                                                })}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                                <div className="relative flex justify-end dropdown-trigger">
                                                    <button
                                                        onClick={() => setActiveDropdown(activeDropdown === user._id ? null : user._id)}
                                                        className="p-2 text-gray-400 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-all"
                                                    >
                                                        <MoreVertical className="w-5 h-5" />
                                                    </button>

                                                    {activeDropdown === user._id && (
                                                        <div className="absolute right-0 mt-10 w-48 bg-white border border-gray-100 rounded-xl shadow-xl z-50 py-1 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 text-left">
                                                            <PermissionGate resource="users" action="edit">
                                                                <TenantLink
                                                                    href={`/users/${user._id}`}
                                                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 transition-colors"
                                                                >
                                                                    <Edit className="w-4 h-4 text-blue-600" />
                                                                    Edit User
                                                                </TenantLink>
                                                            </PermissionGate>
                                                            <div className="h-px bg-gray-100 my-1" />
                                                            <PermissionGate resource="users" action="delete">
                                                                <button
                                                                    onClick={() => {
                                                                        handleDelete(user._id);
                                                                        setActiveDropdown(null);
                                                                    }}
                                                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                    Delete User
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
                        
                        {/* Mobile Card View (Users) */}
                        <div className="md:hidden flex flex-col divide-y divide-gray-100">
                            {loading && users.length === 0 ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <div key={i} className="p-4 animate-pulse space-y-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gray-100"></div>
                                            <div className="flex-1 space-y-2">
                                                <div className="h-4 bg-gray-100 rounded w-1/2"></div>
                                                <div className="h-3 bg-gray-100 rounded w-1/3"></div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : users.length === 0 ? (
                                <div className="p-12 text-center text-gray-500">
                                    <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                    <p>No users found</p>
                                </div>
                            ) : (
                                users.map((user) => (
                                    <div key={user._id} className="p-4 flex flex-col gap-3 relative hover:bg-gray-50/50 transition-colors">
                                        <div className="flex justify-between items-start pr-8">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-sm shrink-0">
                                                    {user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                                                </div>
                                                <div className="flex flex-col gap-0.5">
                                                    <h3 className="text-sm font-bold text-gray-900 leading-tight">{user.name || "Unnamed User"}</h3>
                                                    <div className="text-[10px] text-gray-400">ID: {user._id.slice(-6)}</div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="absolute top-4 right-2 dropdown-trigger">
                                            <button
                                                onClick={() => setActiveDropdown(activeDropdown === user._id ? null : user._id)}
                                                className="p-1.5 text-gray-400 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-all"
                                            >
                                                <MoreVertical className="w-5 h-5 shrink-0" />
                                            </button>
                                            {activeDropdown === user._id && (
                                                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-xl z-50 py-1 overflow-hidden font-medium">
                                                    <PermissionGate resource="users" action="edit">
                                                        <TenantLink href={`/users/${user._id}`} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 transition-colors">
                                                            <Edit className="w-4 h-4 text-blue-600" /> Edit User
                                                        </TenantLink>
                                                    </PermissionGate>
                                                    <div className="h-px bg-gray-100 my-1" />
                                                    <PermissionGate resource="users" action="delete">
                                                        <button onClick={() => { handleDelete(user._id); setActiveDropdown(null); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                                                            <Trash2 className="w-4 h-4" /> Delete User
                                                        </button>
                                                    </PermissionGate>
                                                </div>
                                            )}
                                        </div>
                                        
                                        <div className="flex items-center gap-1.5 text-xs text-gray-600 font-medium bg-gray-50/80 rounded-lg p-3 border border-gray-100 mx-1 mt-1">
                                            <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                                            <span className="truncate">{user.email}</span>
                                        </div>

                                        <div className="flex justify-between items-center mt-2 px-1">
                                            {user.role ? (
                                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${user.role.isSystem
                                                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                                                    : 'bg-blue-50 text-blue-700 border-blue-200'
                                                    }`}>
                                                    <Shield className="w-3 h-3 shrink-0" />
                                                    {user.role.name}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-gray-100 text-gray-600 border border-gray-200">
                                                    No Role
                                                </span>
                                            )}
                                            
                                            <div className="text-[11px] text-gray-400 font-medium">
                                                Joined {new Date(user.createdAt).toLocaleDateString('en-US', {
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
                            Showing <span className="text-gray-900">{users.length}</span> of <span className="text-gray-900">{pagination.total}</span> records
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
