import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getTenantModels } from "@/lib/tenantDb";
import { format } from "date-fns";
import {
    Shield,
    Clock,
    User as UserIcon,
    Globe,
    Info,
    Search,
    RefreshCcw,
    Filter,
    ChevronLeft,
    ChevronRight,
    MoreVertical,
    Activity
} from "lucide-react";
import TenantLink from '@/components/TenantLink';
import ActivityLogFilters from "./ActivityLogFilters";

interface PageProps {
    searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function ActivityLogPage({ searchParams }: PageProps) {
    const session = await auth();
    const headersList = await headers();
    const tenantSlug = headersList.get('x-store-slug') || 'pusat';
    if (!session) redirect(`/${tenantSlug}/login`);

    // Permission check
    const role = (session.user as any).role?.name || (session.user as any).role;
    const permissions = (session.user as any).permissions;
    const isSuperAdmin = role === "Super Admin";

    if (!isSuperAdmin && permissions?.activityLogs?.view === "none") {
        return (
            <div className="p-8 text-center text-red-500 font-bold bg-red-50 rounded-xl border border-red-200 m-6">
                Access Denied: You do not have permission to view activity logs.
            </div>
        );
    }

    const { ActivityLog, User } = await getTenantModels(tenantSlug);

    const sParams = await searchParams;

    // Query parameters
    const page = parseInt(sParams.page || "1");
    const limit = 10;
    const skip = (page - 1) * limit;
    const search = sParams.search || "";

    // Build query
    let query: any = {};
    if (search) {
        query.$or = [
            { action: { $regex: search, $options: "i" } },
            { resource: { $regex: search, $options: "i" } },
            { details: { $regex: search, $options: "i" } },
            { ip: { $regex: search, $options: "i" } }
        ];
    }

    // Fetch data
    const [logs, total] = await Promise.all([
        ActivityLog.find(query)
            .populate("user", "name email")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        ActivityLog.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limit);

    // Helpers
    const getActionBadge = (action: string) => {
        const base = "text-[10px] uppercase tracking-widest font-black px-2.5 py-1 rounded-full border ";
        switch (action) {
            case 'create': return base + "bg-green-50 text-green-700 border-green-200";
            case 'delete': return base + "bg-red-50 text-red-700 border-red-200";
            case 'update': return base + "bg-amber-50 text-amber-700 border-amber-200";
            case 'login': return base + "bg-indigo-50 text-indigo-700 border-indigo-200";
            case 'logout': return base + "bg-slate-50 text-slate-700 border-slate-200";
            default: return base + "bg-blue-50 text-blue-700 border-blue-200";
        }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Security Audit Logs</h1>
                    <p className="text-gray-500 text-sm">Monitor system activity and user actions for security auditing.</p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <TenantLink
                        href="/reports/activity-log"
                        className="w-full sm:w-auto flex justify-center items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm font-medium text-sm"
                    >
                        <RefreshCcw className="w-4 h-4 shrink-0" />
                        Refresh
                    </TenantLink>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden text-black">
                {/* Search & Filters */}
                <ActivityLogFilters initialSearch={search} />

                {/* Table */}
                <div className="overflow-x-auto text-black">
                    <table className="min-w-full divide-y divide-gray-200 hidden md:table">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Timestamp / Event</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">User / Identity</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Resource</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">IP / Terminal</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Details</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                        <Activity className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                        <p>No activity logs found</p>
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log: any) => (
                                    <tr key={log._id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <div className="p-2 bg-blue-50 rounded-lg text-blue-900">
                                                    <Clock className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold text-gray-900">{format(new Date(log.createdAt), "MMM dd, yyyy")}</div>
                                                    <div className="text-[10px] text-gray-400 font-medium uppercase">{format(new Date(log.createdAt), "hh:mm:ss a")}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-blue-900 flex items-center justify-center text-white text-xs font-bold">
                                                    {log.user?.name?.[0] || <UserIcon className="w-4 h-4" />}
                                                </div>
                                                <div>
                                                    <div className="text-xs font-bold text-gray-900">{log.user?.name || "System"}</div>
                                                    <div className="text-[10px] text-gray-500">{log.user?.email || "internal@system"}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={getActionBadge(log.action)}>
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-xs font-bold text-blue-900 px-2 py-0.5 rounded-md bg-blue-50 border border-blue-100 uppercase tracking-wider">
                                                {log.resource}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-1.5 text-xs font-mono text-gray-600">
                                                <Globe className="w-3 h-3 text-gray-400" />
                                                {log.ip || "0.0.0.0"}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 max-w-xs">
                                            <div className="flex items-start gap-2">
                                                <Info className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                                                <p className="text-xs text-gray-600 truncate" title={log.details}>
                                                    {log.details || "No additional information"}
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>

                    {/* Mobile Card View (Activity Logs) */}
                    <div className="md:hidden flex flex-col divide-y divide-gray-100">
                        {logs.length === 0 ? (
                            <div className="p-12 text-center text-gray-500">
                                <Activity className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p>No activity logs found</p>
                            </div>
                        ) : (
                            logs.map((log: any) => (
                                <div key={log._id} className="p-4 flex flex-col gap-3 hover:bg-gray-50/50 transition-colors">
                                    <div className="flex justify-between items-start pr-2">
                                        <div className="flex items-start gap-3">
                                            <div className="w-8 h-8 rounded-full bg-blue-900 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm mt-0.5">
                                                {log.user?.name?.[0] || <UserIcon className="w-4 h-4" />}
                                            </div>
                                            <div className="flex flex-col gap-0.5">
                                                <h3 className="text-sm font-bold text-gray-900 leading-tight">
                                                    {log.user?.name || "System"}
                                                </h3>
                                                <p className="text-[10px] text-gray-500">{log.user?.email || "internal@system"}</p>
                                                <div className="flex items-center gap-1.5 text-[10px] font-medium text-gray-400 mt-0.5">
                                                    <Clock className="w-3 h-3 text-gray-300 shrink-0" />
                                                    {format(new Date(log.createdAt), "MMM dd, yyyy · hh:mm a")}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                                            <span className={getActionBadge(log.action)}>
                                                {log.action}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 mt-1">
                                        <div className="flex flex-wrap items-center gap-2 mb-2">
                                            <span className="text-[10px] font-bold text-blue-900 px-2 py-0.5 rounded-md bg-white border border-blue-100 uppercase tracking-wider shadow-sm shrink-0">
                                                {log.resource}
                                            </span>
                                            
                                            <div className="flex items-center gap-1 text-[10px] font-mono text-gray-500 bg-white px-2 py-0.5 rounded-md border border-gray-100 shadow-sm shrink-0 ml-auto leading-normal">
                                                <Globe className="w-3 h-3 text-gray-400 shrink-0" />
                                                {log.ip || "0.0.0.0"}
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-start gap-2">
                                            <Info className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                                            <p className="text-xs text-gray-600 line-clamp-3">
                                                {log.details || "No additional information"}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Pagination bar - Match Invoice Page */}
                <div className="px-4 py-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-sm text-gray-500 font-medium text-center sm:text-left">
                        Showing <span className="text-gray-900">{logs.length}</span> of <span className="text-gray-900">{total}</span> records
                    </div>
                    <div className="flex items-center justify-center gap-2 w-full sm:w-auto">
                        <TenantLink
                            href={{ query: { ...sParams, page: (page - 1).toString() } }}
                            className={`p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-all ${page <= 1 ? "opacity-50 cursor-not-allowed pointer-events-none" : ""}`}
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </TenantLink>

                        <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum;
                                if (totalPages <= 5) pageNum = i + 1;
                                else if (page <= 3) pageNum = i + 1;
                                else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                                else pageNum = page - 2 + i;

                                return (
                                    <TenantLink
                                        key={pageNum}
                                        href={{ query: { ...sParams, page: pageNum.toString() } }}
                                        className={`w-8 h-8 rounded-lg text-sm font-semibold flex items-center justify-center transition-all ${page === pageNum
                                            ? "bg-blue-900 text-white"
                                            : "text-gray-600 hover:bg-gray-100 bg-white border border-gray-200"
                                            }`}
                                    >
                                        {pageNum}
                                    </TenantLink>
                                );
                            })}
                        </div>

                        <TenantLink
                            href={{ query: { ...sParams, page: (page + 1).toString() } }}
                            className={`p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-all ${page >= totalPages ? "opacity-50 cursor-not-allowed pointer-events-none" : ""}`}
                        >
                            <ChevronRight className="w-4 h-4" />
                        </TenantLink>
                    </div>
                </div>
            </div>
        </div>
    );
}
