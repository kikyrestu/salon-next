"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Edit,
  Trash2,
  Search,
  User,
  Mail,
  Phone,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Package,
  History,
  ExternalLink,
  LayoutDashboard,
  Crown,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Modal from "@/components/dashboard/Modal";
import CustomerForm from "@/components/dashboard/CustomerForm";
import PermissionGate from "@/components/PermissionGate";
import { useSettings } from "@/components/providers/SettingsProvider";

interface CustomerPackageSummary {
  hasPackage: boolean;
  totalPackages: number;
  activePackages: number;
  totalRemainingQuota: number;
  latestPackageName: string;
}

interface InvoiceHistoryItem {
  _id: string;
  invoiceNumber: string;
  date: string;
  totalAmount: number;
  amountPaid: number;
  status: string;
  paymentMethod: string;
  sourceType: string;
}

interface PackageOrderHistoryItem {
  _id: string;
  totalAmount: number;
  status: string;
  paymentMethod?: string;
  paidAt?: string;
  createdAt: string;
  packageSnapshot?: {
    name?: string;
    code?: string;
  };
}

interface PackageUsageHistoryItem {
  _id: string;
  serviceName: string;
  quantity: number;
  usedAt: string;
  note?: string;
  invoice?: {
    _id?: string;
    invoiceNumber?: string;
    date?: string;
  };
}

interface CustomerHistoryResponse {
  invoices: InvoiceHistoryItem[];
  packageOrders: PackageOrderHistoryItem[];
  packageUsage: PackageUsageHistoryItem[];
}

interface InvoicePreviewItem {
  name: string;
  quantity: number;
  price: number;
  total: number;
  discount?: number;
  itemModel?: string;
}

interface InvoicePreviewData {
  _id: string;
  invoiceNumber: string;
  date: string;
  status: string;
  paymentMethod?: string;
  customer?: {
    name?: string;
  };
  items: InvoicePreviewItem[];
  subtotal: number;
  discount: number;
  tax: number;
  tips: number;
  totalAmount: number;
  amountPaid: number;
}

interface DepositPreviewItem {
  _id: string;
  date: string;
  amount: number;
  paymentMethod: string;
}

interface PaginationState {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

interface Customer {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  totalPurchases: number;
  status: string;
  createdAt: string;
  membershipTier?: string;
  membershipExpiry?: string;
  packageSummary?: CustomerPackageSummary;
}

export default function CustomersPage() {
  const { settings } = useSettings();
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationState>({
    total: 0,
    page: 1,
    limit: 10,
    pages: 0,
  });
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyData, setHistoryData] = useState<CustomerHistoryResponse>({
    invoices: [],
    packageOrders: [],
    packageUsage: [],
  });
  const [previewInvoice, setPreviewInvoice] = useState<{
    id: string;
    number?: string;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewInvoiceDetail, setPreviewInvoiceDetail] =
    useState<InvoicePreviewData | null>(null);
  const [previewDeposits, setPreviewDeposits] = useState<DepositPreviewItem[]>(
    [],
  );

  const fetchCustomers = useCallback(
    async (showLoader: boolean = true) => {
      if (showLoader) setLoading(true);
      try {
        const query = new URLSearchParams({
          search,
          page: page.toString(),
          limit: "10",
        });
        const res = await fetch(`/api/customers?${query}`);
        const data = await res.json();
        if (data.success) {
          setCustomers(data.data);
          if (data.pagination) setPagination(data.pagination);
        }
      } catch (error) {
        console.error("Error:", error);
      } finally {
        if (showLoader) setLoading(false);
      }
    },
    [page, search],
  );

  useEffect(() => {
    void fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCustomer(null);
  };

  const openModal = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
    } else {
      setEditingCustomer(null);
    }
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this customer?")) return;
    const res = await fetch(`/api/customers/${id}`, { method: "DELETE" });
    if ((await res.json()).success) void fetchCustomers();
  };

  const openHistoryModal = async (customer: Customer) => {
    setHistoryCustomer(customer);
    setIsHistoryModalOpen(true);
    setHistoryLoading(true);
    setHistoryData({ invoices: [], packageOrders: [], packageUsage: [] });

    try {
      const res = await fetch(`/api/customers/${customer._id}/history`);
      const data = await res.json();
      if (data.success) {
        setHistoryData({
          invoices: data.data?.invoices || [],
          packageOrders: data.data?.packageOrders || [],
          packageUsage: data.data?.packageUsage || [],
        });
      }
    } catch (error) {
      console.error("Error loading customer history:", error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const closeHistoryModal = () => {
    setIsHistoryModalOpen(false);
    setHistoryCustomer(null);
    setHistoryData({ invoices: [], packageOrders: [], packageUsage: [] });
    closeInvoicePreview();
  };

  const openInvoicePreview = async (
    invoiceId?: string,
    invoiceNumber?: string,
  ) => {
    if (!invoiceId) return;
    setPreviewInvoice({ id: invoiceId, number: invoiceNumber });
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewInvoiceDetail(null);
    setPreviewDeposits([]);

    try {
      const [invoiceRes, depositsRes] = await Promise.all([
        fetch(`/api/invoices/${invoiceId}`),
        fetch(`/api/deposits?invoiceId=${invoiceId}`),
      ]);

      const invoiceData = await invoiceRes.json();
      const depositsData = await depositsRes.json();

      if (!invoiceData.success) {
        throw new Error(invoiceData.error || "Gagal memuat invoice");
      }

      setPreviewInvoiceDetail(invoiceData.data as InvoicePreviewData);
      if (depositsData.success && Array.isArray(depositsData.data)) {
        setPreviewDeposits(depositsData.data as DepositPreviewItem[]);
      }
    } catch (error) {
      console.error("Error loading invoice preview:", error);
      setPreviewError(
        error instanceof Error ? error.message : "Gagal memuat preview invoice",
      );
    } finally {
      setPreviewLoading(false);
    }
  };

  const closeInvoicePreview = () => {
    setPreviewInvoice(null);
    setPreviewLoading(false);
    setPreviewError(null);
    setPreviewInvoiceDetail(null);
    setPreviewDeposits([]);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Customer Management
            </h1>
            <p className="text-sm text-gray-500">
              Manage your customer database and history
            </p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <PermissionGate resource="customers" action="create">
              <button
                onClick={() => openModal()}
                className="w-full sm:w-auto px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-all flex justify-center items-center gap-2 shadow-sm font-semibold text-sm"
              >
                <Plus className="w-4 h-4 shrink-0" />
                Add Customer
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
                onClick={() => {
                  setSearch("");
                  setPage(1);
                }}
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
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Total Purchases
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Paket
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Join Date
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {loading && customers.length === 0 ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={7} className="px-6 py-4">
                        <div className="h-4 bg-gray-100 rounded"></div>
                      </td>
                    </tr>
                  ))
                ) : customers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-12 text-center text-gray-500"
                    >
                      <User className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p>No customers found</p>
                    </td>
                  </tr>
                ) : (
                  customers.map((customer) => (
                    <tr
                      key={customer._id}
                      className="hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-50 rounded-lg">
                            <User className="w-4 h-4 text-blue-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-gray-900">
                                {customer.name}
                              </span>
                              {customer.membershipTier === "premium" && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wide border bg-gradient-to-r from-yellow-400/20 to-amber-400/20 text-amber-700 border-amber-300 shadow-sm">
                                  <Crown className="w-3 h-3 fill-amber-400 text-amber-500" />
                                  Premium
                                  {customer.membershipExpiry && (
                                    <span className="text-[9px] font-semibold text-amber-600 ml-0.5">
                                      s/d {new Date(customer.membershipExpiry).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "2-digit" })}
                                    </span>
                                  )}
                                </span>
                              )}
                              {customer.packageSummary?.hasPackage && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border bg-amber-50 text-amber-700 border-amber-200">
                                  <Package className="w-3 h-3" />
                                  Paket
                                </span>
                              )}
                            </div>
                            {customer.address && (
                              <div
                                className="text-[10px] text-gray-400 font-medium truncate max-w-[150px]"
                                title={customer.address}
                              >
                                {customer.address}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-1">
                          {customer.email ? (
                            <div className="flex items-center gap-1.5 text-xs text-gray-600">
                              <Mail className="w-3 h-3 text-gray-400" />
                              <span className="truncate max-w-[150px]">
                                {customer.email}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 italic">
                              No email
                            </span>
                          )}
                          {customer.phone && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-600">
                              <Phone className="w-3 h-3 text-gray-400" />
                              {customer.phone}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-bold text-gray-900">
                          {settings.symbol}
                          {customer.totalPurchases.toLocaleString("id-ID", {
                            maximumFractionDigits: 0,
                          })}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {customer.packageSummary?.hasPackage ? (
                          <div className="space-y-0.5">
                            <div className="text-xs font-bold text-amber-700">
                              Aktif: {customer.packageSummary.activePackages}{" "}
                              paket
                            </div>
                            <div className="text-[11px] text-gray-600">
                              Sisa kuota:{" "}
                              <span className="font-bold text-gray-900">
                                {customer.packageSummary.totalRemainingQuota}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">
                            Belum ada paket
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${
                            customer.status === "active"
                              ? "bg-green-50 text-green-700 border-green-200"
                              : "bg-gray-50 text-gray-600 border-gray-200"
                          }`}
                        >
                          {customer.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(customer.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <div className="relative flex justify-end dropdown-trigger">
                          <button
                            onClick={() =>
                              setActiveDropdown(
                                activeDropdown === customer._id
                                  ? null
                                  : customer._id,
                              )
                            }
                            className="p-2 text-gray-400 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-all"
                          >
                            <MoreVertical className="w-5 h-5" />
                          </button>

                          {activeDropdown === customer._id && (
                            <div className="absolute right-0 mt-10 w-56 bg-white border border-gray-100 rounded-xl shadow-xl z-50 py-1 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 text-left">
                              <button
                                onClick={() => {
                                  router.push(`/customers/${customer._id}`);
                                  setActiveDropdown(null);
                                }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 transition-colors"
                              >
                                <LayoutDashboard className="w-4 h-4 text-blue-700" />
                                Customer Dashboard
                              </button>
                              <PermissionGate
                                resource="customers"
                                action="edit"
                              >
                                <button
                                  onClick={() => {
                                    void openHistoryModal(customer);
                                    setActiveDropdown(null);
                                  }}
                                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-amber-50 transition-colors"
                                >
                                  <History className="w-4 h-4 text-amber-600" />
                                  View History
                                </button>
                              </PermissionGate>
                              <PermissionGate
                                resource="customers"
                                action="edit"
                              >
                                <button
                                  onClick={() => {
                                    openModal(customer);
                                    setActiveDropdown(null);
                                  }}
                                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 transition-colors"
                                >
                                  <Edit className="w-4 h-4 text-blue-600" />
                                  Edit Details
                                </button>
                              </PermissionGate>
                              <div className="h-px bg-gray-100 my-1" />
                              <PermissionGate
                                resource="customers"
                                action="delete"
                              >
                                <button
                                  onClick={() => {
                                    handleDelete(customer._id);
                                    setActiveDropdown(null);
                                  }}
                                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Delete Customer
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

            {/* Mobile Card View (Customers) */}
            <div className="md:hidden flex flex-col divide-y divide-gray-100">
              {loading && customers.length === 0 ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="p-4 animate-pulse space-y-3">
                    <div className="h-4 bg-gray-100 rounded w-1/2"></div>
                    <div className="h-4 bg-gray-100 rounded w-1/3"></div>
                  </div>
                ))
              ) : customers.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  <User className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>No customers found</p>
                </div>
              ) : (
                customers.map((customer) => (
                  <div
                    key={customer._id}
                    className="p-4 flex flex-col gap-3 relative hover:bg-gray-50/50 transition-colors"
                  >
                    <div className="flex justify-between items-start pr-8">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                          <User className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-gray-900 leading-tight">
                            {customer.name}
                          </h3>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {customer.membershipTier === "premium" && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] text-[9px] font-black uppercase tracking-wide border bg-gradient-to-r from-yellow-400/20 to-amber-400/20 text-amber-700 border-amber-300">
                                <Crown className="w-2.5 h-2.5 fill-amber-400 text-amber-500" /> Premium
                              </span>
                            )}
                            {customer.packageSummary?.hasPackage && (
                              <span className="inline-flex items-center gap-1 px-2 rounded-[4px] text-[9px] font-bold uppercase tracking-wide border bg-amber-50 text-amber-700 border-amber-200">
                                <Package className="w-2.5 h-2.5" /> Paket
                              </span>
                            )}
                            <span
                              className={`inline-flex items-center px-2 rounded-[4px] text-[9px] font-bold uppercase tracking-wide border ${
                                customer.status === "active"
                                  ? "bg-green-50 text-green-700 border-green-200"
                                  : "bg-gray-50 text-gray-600 border-gray-200"
                              }`}
                            >
                              {customer.status}
                            </span>
                            <span className="text-[10px] text-gray-400 font-medium">
                              Joined{" "}
                              {new Date(
                                customer.createdAt,
                              ).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="absolute top-4 right-2 dropdown-trigger">
                      <button
                        onClick={() =>
                          setActiveDropdown(
                            activeDropdown === customer._id
                              ? null
                              : customer._id,
                          )
                        }
                        className="p-1.5 text-gray-400 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-all"
                      >
                        <MoreVertical className="w-5 h-5 shrink-0" />
                      </button>
                      {activeDropdown === customer._id && (
                        <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-xl z-50 py-1 overflow-hidden font-medium">
                          <button
                            onClick={() => {
                              router.push(`/customers/${customer._id}`);
                              setActiveDropdown(null);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 transition-colors"
                          >
                            <LayoutDashboard className="w-4 h-4 text-blue-700" />{" "}
                            Customer Dashboard
                          </button>
                          <PermissionGate resource="customers" action="edit">
                            <button
                              onClick={() => {
                                void openHistoryModal(customer);
                                setActiveDropdown(null);
                              }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-amber-50 transition-colors"
                            >
                              <History className="w-4 h-4 text-amber-600" />{" "}
                              View History
                            </button>
                          </PermissionGate>
                          <PermissionGate resource="customers" action="edit">
                            <button
                              onClick={() => {
                                openModal(customer);
                                setActiveDropdown(null);
                              }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 transition-colors"
                            >
                              <Edit className="w-4 h-4 text-blue-600" /> Edit
                              Details
                            </button>
                          </PermissionGate>
                          <div className="h-px bg-gray-100 my-1" />
                          <PermissionGate resource="customers" action="delete">
                            <button
                              onClick={() => {
                                handleDelete(customer._id);
                                setActiveDropdown(null);
                              }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" /> Delete Customer
                            </button>
                          </PermissionGate>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1 bg-gray-50/50 p-3 rounded-lg border border-gray-100 mt-1">
                      {customer.phone && (
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          {customer.phone}
                        </div>
                      )}
                      {customer.email ? (
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span className="truncate">{customer.email}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic flex items-center gap-2">
                          <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          No email provided
                        </span>
                      )}
                      {customer.address && (
                        <div className="text-[10px] text-gray-500 pt-1.5 mt-1.5 border-t border-gray-100 line-clamp-2">
                          {customer.address}
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between items-center text-sm pt-1 mt-1 border-t border-gray-50">
                      <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">
                        Total Purchases
                      </p>
                      <span className="font-black text-blue-900">
                        {settings.symbol}
                        {customer.totalPurchases.toLocaleString("id-ID", {
                          maximumFractionDigits: 0,
                        })}
                      </span>
                    </div>
                    {customer.packageSummary?.hasPackage && (
                      <div className="flex justify-between items-center text-sm pt-1 mt-1 border-t border-gray-50">
                        <p className="text-[10px] text-amber-600 uppercase font-bold tracking-wider">
                          Sisa Kuota Paket
                        </p>
                        <span className="font-black text-amber-700">
                          {customer.packageSummary.totalRemainingQuota}
                        </span>
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
              Showing <span className="text-gray-900">{customers.length}</span>{" "}
              of <span className="text-gray-900">{pagination.total}</span>{" "}
              customers
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
                {Array.from(
                  { length: Math.min(5, pagination.pages) },
                  (_, i) => {
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
                        className={`w-8 h-8 rounded-lg text-sm font-semibold transition-all ${
                          page === pageNum
                            ? "bg-blue-900 text-white"
                            : "text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  },
                )}
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

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingCustomer ? "Edit Customer" : "Add New Customer"}
      >
        <CustomerForm
          initialData={editingCustomer}
          onSuccess={(newCustomer) => {
            closeModal();

            if (!editingCustomer?._id) {
              setCustomers((prev) => [newCustomer, ...prev].slice(0, 10));
              setPagination((prev) => ({
                ...prev,
                total: prev.total + 1,
              }));
            }

            void fetchCustomers(false);
          }}
          onCancel={closeModal}
        />
      </Modal>

      <Modal
        isOpen={isHistoryModalOpen}
        onClose={closeHistoryModal}
        title={
          historyCustomer
            ? `History Customer - ${historyCustomer.name}`
            : "History Customer"
        }
      >
        <div className="space-y-5 text-black max-h-[75vh] overflow-y-auto pr-1">
          {historyLoading ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-4 bg-gray-100 rounded" />
              <div className="h-4 bg-gray-100 rounded" />
              <div className="h-4 bg-gray-100 rounded" />
            </div>
          ) : (
            <>
              <section className="space-y-2">
                <h3 className="text-sm font-bold text-gray-900">
                  Transaksi Invoice Terbaru
                </h3>
                {historyData.invoices.length === 0 ? (
                  <p className="text-xs text-gray-500">
                    Belum ada transaksi invoice.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {historyData.invoices.map((inv) => (
                      <div
                        key={inv._id}
                        className="text-xs border border-gray-200 rounded-lg p-2 bg-gray-50"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              void openInvoicePreview(
                                inv._id,
                                inv.invoiceNumber,
                              );
                            }}
                            className="inline-flex items-center gap-1 font-bold text-blue-700 hover:text-blue-900 hover:underline"
                          >
                            {inv.invoiceNumber}
                            <ExternalLink className="w-3 h-3" />
                          </button>
                          <span className="text-gray-500">
                            {new Date(inv.date || inv._id).toLocaleDateString(
                              "id-ID",
                            )}
                          </span>
                        </div>
                        <div className="mt-1 text-gray-600">
                          {settings.symbol}
                          {Number(inv.totalAmount || 0).toLocaleString(
                            "id-ID",
                            { maximumFractionDigits: 0 },
                          )}{" "}
                          • {inv.status} • {inv.paymentMethod}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-gray-900">
                  Riwayat Beli Paket
                </h3>
                {historyData.packageOrders.length === 0 ? (
                  <p className="text-xs text-gray-500">
                    Belum ada pembelian paket.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {historyData.packageOrders.map((order) => (
                      <div
                        key={order._id}
                        className="text-xs border border-amber-200 rounded-lg p-2 bg-amber-50"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-amber-900">
                            {order.packageSnapshot?.name || "Paket"}
                          </span>
                          <span className="text-amber-700">{order.status}</span>
                        </div>
                        <div className="mt-1 text-amber-800">
                          {settings.symbol}
                          {Number(order.totalAmount || 0).toLocaleString(
                            "id-ID",
                            { maximumFractionDigits: 0 },
                          )}
                          {order.paymentMethod
                            ? ` • ${order.paymentMethod}`
                            : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-gray-900">
                  Riwayat Pemakaian Paket
                </h3>
                {historyData.packageUsage.length === 0 ? (
                  <p className="text-xs text-gray-500">
                    Belum ada pemakaian paket.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {historyData.packageUsage.map((usage) => (
                      <div
                        key={usage._id}
                        className="text-xs border border-blue-200 rounded-lg p-2 bg-blue-50"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-blue-900">
                            {usage.serviceName}
                          </span>
                          <span className="text-blue-700">
                            -{usage.quantity} kuota
                          </span>
                        </div>
                        <div className="mt-1 text-blue-800">
                          {new Date(usage.usedAt).toLocaleDateString("id-ID")}
                          {usage.invoice?.invoiceNumber ? (
                            <>
                              {" • "}
                              <button
                                type="button"
                                onClick={() => {
                                  void openInvoicePreview(
                                    usage.invoice?._id,
                                    usage.invoice?.invoiceNumber,
                                  );
                                }}
                                className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:text-blue-900 hover:underline"
                              >
                                {usage.invoice.invoiceNumber}
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            </>
                          ) : (
                            ""
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={!!previewInvoice}
        onClose={closeInvoicePreview}
        title={
          previewInvoice?.number
            ? `Preview Invoice - ${previewInvoice.number}`
            : "Preview Invoice"
        }
        size="xl"
      >
        <div className="space-y-4 text-black max-h-[75vh] overflow-y-auto pr-1">
          {previewLoading ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-4 bg-gray-100 rounded" />
              <div className="h-4 bg-gray-100 rounded" />
              <div className="h-4 bg-gray-100 rounded" />
              <div className="h-28 bg-gray-100 rounded" />
            </div>
          ) : previewError ? (
            <div className="space-y-3">
              <p className="text-sm text-red-600">{previewError}</p>
              {previewInvoice?.id && (
                <a
                  href={`/invoices/print/${previewInvoice.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200"
                >
                  Buka halaman invoice
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          ) : previewInvoiceDetail ? (
            <>
              <section className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="border border-gray-200 rounded-lg p-2 bg-gray-50">
                  <p className="text-gray-500">Invoice</p>
                  <p className="font-bold text-gray-900">
                    {previewInvoiceDetail.invoiceNumber}
                  </p>
                </div>
                <div className="border border-gray-200 rounded-lg p-2 bg-gray-50">
                  <p className="text-gray-500">Tanggal</p>
                  <p className="font-bold text-gray-900">
                    {new Date(previewInvoiceDetail.date).toLocaleString(
                      "id-ID",
                    )}
                  </p>
                </div>
                <div className="border border-gray-200 rounded-lg p-2 bg-gray-50">
                  <p className="text-gray-500">Customer</p>
                  <p className="font-bold text-gray-900">
                    {previewInvoiceDetail.customer?.name || "Walk-in"}
                  </p>
                </div>
                <div className="border border-gray-200 rounded-lg p-2 bg-gray-50">
                  <p className="text-gray-500">Status / Payment</p>
                  <p className="font-bold text-gray-900">
                    {previewInvoiceDetail.status} •{" "}
                    {previewInvoiceDetail.paymentMethod || "-"}
                  </p>
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-gray-900">
                  Item Invoice
                </h3>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-gray-50 text-[11px] font-bold text-gray-600 uppercase tracking-wide">
                    <div className="col-span-6">Item</div>
                    <div className="col-span-2 text-right">Qty</div>
                    <div className="col-span-2 text-right">Harga</div>
                    <div className="col-span-2 text-right">Total</div>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {previewInvoiceDetail.items.map((item, index) => (
                      <div
                        key={`${item.name}-${index}`}
                        className="grid grid-cols-12 gap-2 px-3 py-2 text-xs"
                      >
                        <div className="col-span-6 font-semibold text-gray-900">
                          {item.name}
                        </div>
                        <div className="col-span-2 text-right text-gray-700">
                          {item.quantity}
                        </div>
                        <div className="col-span-2 text-right text-gray-700">
                          {settings.symbol}
                          {Number(item.price || 0).toLocaleString("id-ID", {
                            maximumFractionDigits: 0,
                          })}
                        </div>
                        <div className="col-span-2 text-right font-bold text-gray-900">
                          {settings.symbol}
                          {Number(item.total || 0).toLocaleString("id-ID", {
                            maximumFractionDigits: 0,
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="border border-gray-200 rounded-lg p-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-semibold">
                      {settings.symbol}
                      {Number(
                        previewInvoiceDetail.subtotal || 0,
                      ).toLocaleString("id-ID", { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Diskon</span>
                    <span className="font-semibold">
                      -{settings.symbol}
                      {Number(
                        previewInvoiceDetail.discount || 0,
                      ).toLocaleString("id-ID", { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tax</span>
                    <span className="font-semibold">
                      {settings.symbol}
                      {Number(previewInvoiceDetail.tax || 0).toLocaleString(
                        "id-ID",
                        { maximumFractionDigits: 0 },
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tips</span>
                    <span className="font-semibold">
                      {settings.symbol}
                      {Number(previewInvoiceDetail.tips || 0).toLocaleString(
                        "id-ID",
                        { maximumFractionDigits: 0 },
                      )}
                    </span>
                  </div>
                  <div className="h-px bg-gray-200 my-1" />
                  <div className="flex justify-between text-sm">
                    <span className="font-bold text-gray-900">Grand Total</span>
                    <span className="font-black text-gray-900">
                      {settings.symbol}
                      {Number(
                        previewInvoiceDetail.totalAmount || 0,
                      ).toLocaleString("id-ID", { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Dibayar</span>
                    <span className="font-bold text-green-700">
                      {settings.symbol}
                      {Number(
                        previewInvoiceDetail.amountPaid || 0,
                      ).toLocaleString("id-ID", { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
                <div className="border border-gray-200 rounded-lg p-2">
                  <h4 className="font-bold text-gray-900 mb-1">
                    Riwayat Pembayaran
                  </h4>
                  {previewDeposits.length === 0 ? (
                    <p className="text-gray-500">
                      Tidak ada deposit/pembayaran terpisah.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {previewDeposits.map((dep) => (
                        <div
                          key={dep._id}
                          className="flex items-center justify-between text-[11px] border border-gray-100 rounded p-1.5"
                        >
                          <span className="text-gray-600">
                            {new Date(dep.date).toLocaleString("id-ID")} •{" "}
                            {dep.paymentMethod}
                          </span>
                          <span className="font-bold text-gray-900">
                            {settings.symbol}
                            {Number(dep.amount || 0).toLocaleString("id-ID", {
                              maximumFractionDigits: 0,
                            })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {previewInvoice?.id && (
                <a
                  href={`/invoices/print/${previewInvoice.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200"
                >
                  Buka halaman invoice
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-500">
              Data invoice tidak tersedia.
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
