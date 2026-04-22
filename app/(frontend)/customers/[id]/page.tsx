"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Star,
  Gift,
  Phone,
  Mail,
  MapPin,
  FileText,
  Package,
  Camera,
  Bell,
  BellOff,
  Edit,
  Trash2,
  Plus,
  Crown,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useSettings } from "@/components/providers/SettingsProvider";
import FormInput, { FormButton } from "@/components/dashboard/FormInput";
import Modal from "@/components/dashboard/Modal";
import ImageUpload from "@/components/dashboard/ImageUpload";

// ── Types ──────────────────────────────────────────────────────────────────

interface Customer {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  preferenceNotes?: string;
  totalPurchases: number;
  loyaltyPoints: number;
  status: string;
  membershipTier: "regular" | "silver" | "gold" | "platinum";
  membershipJoinDate?: string;
  referralCode?: string;
  waNotifEnabled: boolean;
  createdAt: string;
}

interface InvoiceItem {
  name: string;
  price: number;
  quantity: number;
  total: number;
}

interface Invoice {
  _id: string;
  invoiceNumber: string;
  date: string;
  totalAmount: number;
  status: string;
  paymentMethod: string;
  items: InvoiceItem[];
}

interface PackageOrder {
  _id: string;
  createdAt: string;
  status: string;
  packageName?: string;
  totalAmount: number;
}

interface PackageUsage {
  _id: string;
  createdAt: string;
  serviceName: string;
  quantity: number;
}

interface BeforeAfterPhoto {
  _id: string;
  before: string;
  after: string;
  note?: string;
  date: string;
}

interface CustomerPackageItem {
  _id: string;
  packageName: string;
  status: string;
  expiresAt?: string;
  serviceQuotas: {
    service: string;
    serviceName: string;
    totalQuota: number;
    remainingQuota: number;
  }[];
}

// ── Membership config ──────────────────────────────────────────────────────

const MEMBERSHIP_TIERS = {
  regular: {
    label: "Regular",
    color: "text-gray-600",
    bg: "bg-gray-100",
    border: "border-gray-200",
    icon: "⭐",
    minSpend: 0,
  },
  silver: {
    label: "Silver",
    color: "text-slate-600",
    bg: "bg-slate-100",
    border: "border-slate-300",
    icon: "🥈",
    minSpend: 1_000_000,
  },
  gold: {
    label: "Gold",
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-300",
    icon: "🥇",
    minSpend: 5_000_000,
  },
  platinum: {
    label: "Platinum",
    color: "text-purple-700",
    bg: "bg-purple-50",
    border: "border-purple-300",
    icon: "💎",
    minSpend: 15_000_000,
  },
};

// ── Helper ─────────────────────────────────────────────────────────────────

function getAutoTier(
  totalPurchases: number,
): "regular" | "silver" | "gold" | "platinum" {
  if (totalPurchases >= 15_000_000) return "platinum";
  if (totalPurchases >= 5_000_000) return "gold";
  if (totalPurchases >= 1_000_000) return "silver";
  return "regular";
}

function fmt(
  n: number,
  symbol: string,
  fractionDigits: number = 0,
): string {
  return `${symbol}${n.toLocaleString("id-ID", { maximumFractionDigits: fractionDigits })}`;
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ── Component ──────────────────────────────────────────────────────────────

export default function CustomerDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const { settings } = useSettings();
  const customerId = params?.id as string;

  // Data state
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [packageOrders, setPackageOrders] = useState<PackageOrder[]>([]);
  const [packageUsage, setPackageUsage] = useState<PackageUsage[]>([]);
  const [activePackages, setActivePackages] = useState<CustomerPackageItem[]>(
    [],
  );
  const [photos, setPhotos] = useState<BeforeAfterPhoto[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "invoices" | "packages" | "photos" | "notes"
  >("invoices");
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Edit notes modal
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [notesForm, setNotesForm] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  // Photo modal
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [photoForm, setPhotoForm] = useState({
    before: "",
    after: "",
    note: "",
  });
  const [savingPhoto, setSavingPhoto] = useState(false);

  // Membership modal
  const [isMembershipModalOpen, setIsMembershipModalOpen] = useState(false);
  const [membershipForm, setMembershipForm] = useState<
    "regular" | "silver" | "gold" | "platinum"
  >("regular");
  const [savingMembership, setSavingMembership] = useState(false);

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchCustomer = useCallback(async () => {
    const res = await fetch(`/api/customers/${customerId}`);
    const data = await res.json();
    if (data.success) {
      setCustomer(data.data);
      setNotesForm(data.data.preferenceNotes || "");
      setMembershipForm(data.data.membershipTier || "regular");
    }
  }, [customerId]);

  const fetchHistory = useCallback(async () => {
    const res = await fetch(`/api/customers/${customerId}/history`);
    const data = await res.json();
    if (data.success) {
      setInvoices(data.data.invoices || []);
      setPackageOrders(data.data.packageOrders || []);
      setPackageUsage(data.data.packageUsage || []);
    }
  }, [customerId]);

  const fetchPackages = useCallback(async () => {
    const res = await fetch(
      `/api/customer-packages?customerId=${customerId}&status=active`,
    );
    const data = await res.json();
    if (data.success) setActivePackages(data.data || []);
  }, [customerId]);

  const fetchPhotos = useCallback(async () => {
    const res = await fetch(`/api/customers/${customerId}/photos`);
    const data = await res.json();
    if (data.success) setPhotos(data.data || []);
  }, [customerId]);

  useEffect(() => {
    if (!customerId) return;
    setLoading(true);
    Promise.all([
      fetchCustomer(),
      fetchHistory(),
      fetchPackages(),
      fetchPhotos(),
    ]).finally(() => setLoading(false));
  }, [customerId, fetchCustomer, fetchHistory, fetchPackages, fetchPhotos]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const toggleWaNotif = async () => {
    if (!customer) return;
    const newVal = !customer.waNotifEnabled;
    const res = await fetch(`/api/customers/${customerId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ waNotifEnabled: newVal }),
    });
    const data = await res.json();
    if (data.success) setCustomer((prev) => prev ? { ...prev, waNotifEnabled: newVal } : prev);
  };

  const saveNotes = async () => {
    setSavingNotes(true);
    try {
      const res = await fetch(`/api/customers/${customerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferenceNotes: notesForm }),
      });
      const data = await res.json();
      if (data.success) {
        setCustomer((prev) => prev ? { ...prev, preferenceNotes: notesForm } : prev);
        setIsNotesModalOpen(false);
      } else {
        alert(data.error || "Gagal menyimpan catatan");
      }
    } finally {
      setSavingNotes(false);
    }
  };

  const saveMembership = async () => {
    setSavingMembership(true);
    try {
      const res = await fetch(`/api/customers/${customerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membershipTier: membershipForm }),
      });
      const data = await res.json();
      if (data.success) {
        setCustomer((prev) => prev ? { ...prev, membershipTier: membershipForm } : prev);
        setIsMembershipModalOpen(false);
      } else {
        alert(data.error || "Gagal update membership");
      }
    } finally {
      setSavingMembership(false);
    }
  };

  const savePhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoForm.before || !photoForm.after) {
      alert("Foto before dan after wajib diisi");
      return;
    }
    setSavingPhoto(true);
    try {
      const res = await fetch(`/api/customers/${customerId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(photoForm),
      });
      const data = await res.json();
      if (data.success) {
        await fetchPhotos();
        setPhotoForm({ before: "", after: "", note: "" });
        setIsPhotoModalOpen(false);
      } else {
        alert(data.error || "Gagal menyimpan foto");
      }
    } finally {
      setSavingPhoto(false);
    }
  };

  const deletePhoto = async (photoId: string) => {
    if (!confirm("Hapus foto ini?")) return;
    await fetch(`/api/customers/${customerId}/photos?photoId=${photoId}`, {
      method: "DELETE",
    });
    setPhotos((prev) => prev.filter((p) => p._id !== photoId));
  };

  const copyReferral = () => {
    if (!customer?.referralCode) return;
    navigator.clipboard.writeText(customer.referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Derived ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-900 border-t-transparent"></div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Customer tidak ditemukan</p>
          <button
            onClick={() => router.push("/customers")}
            className="px-4 py-2 bg-blue-900 text-white rounded-lg text-sm font-semibold"
          >
            Kembali
          </button>
        </div>
      </div>
    );
  }

  const tier = MEMBERSHIP_TIERS[customer.membershipTier] || MEMBERSHIP_TIERS.regular;
  const autoTier = getAutoTier(customer.totalPurchases);
  const totalRemainingQuota = activePackages.reduce(
    (sum, pkg) =>
      sum +
      pkg.serviceQuotas.reduce((s, q) => s + q.remainingQuota, 0),
    0,
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">

        {/* ── Back ── */}
        <button
          onClick={() => router.push("/customers")}
          className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Customers
        </button>

        {/* ── Header Card ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div className="w-14 h-14 rounded-full bg-blue-900 flex items-center justify-center text-white text-xl font-black flex-shrink-0">
                {customer.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-xl font-black text-gray-900">
                  {customer.name}
                </h1>
                <div className="flex flex-wrap gap-2 mt-1">
                  {customer.email && (
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Mail className="w-3 h-3" />
                      {customer.email}
                    </span>
                  )}
                  {customer.phone && (
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Phone className="w-3 h-3" />
                      {customer.phone}
                    </span>
                  )}
                  {customer.address && (
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <MapPin className="w-3 h-3" />
                      {customer.address}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-gray-400 mt-1">
                  Member sejak {fmtDate(customer.createdAt)}
                </p>
              </div>
            </div>

            {/* WA Opt-in toggle */}
            <button
              onClick={toggleWaNotif}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors ${
                customer.waNotifEnabled
                  ? "bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                  : "bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200"
              }`}
              title="Toggle WA Notification"
            >
              {customer.waNotifEnabled ? (
                <Bell className="w-3.5 h-3.5" />
              ) : (
                <BellOff className="w-3.5 h-3.5" />
              )}
              WA Notif {customer.waNotifEnabled ? "ON" : "OFF"}
            </button>
          </div>

          {/* ── Stats Row ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            {/* Membership */}
            <button
              onClick={() => setIsMembershipModalOpen(true)}
              className={`rounded-lg border p-3 text-left hover:opacity-80 transition-opacity ${tier.bg} ${tier.border}`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Crown className={`w-3.5 h-3.5 ${tier.color}`} />
                <span className={`text-[10px] font-bold uppercase ${tier.color}`}>
                  Membership
                </span>
              </div>
              <p className={`text-base font-black ${tier.color}`}>
                {tier.icon} {tier.label}
              </p>
              {autoTier !== customer.membershipTier && (
                <p className="text-[9px] text-gray-400 mt-0.5">
                  Auto: {MEMBERSHIP_TIERS[autoTier].label}
                </p>
              )}
            </button>

            {/* Loyalty Points */}
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Star className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-[10px] font-bold uppercase text-amber-700">
                  Loyalty Points
                </span>
              </div>
              <p className="text-base font-black text-amber-800">
                {customer.loyaltyPoints.toLocaleString("id-ID")} pts
              </p>
            </div>

            {/* Total Spending */}
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <FileText className="w-3.5 h-3.5 text-blue-700" />
                <span className="text-[10px] font-bold uppercase text-blue-700">
                  Total Belanja
                </span>
              </div>
              <p className="text-sm font-black text-blue-900">
                {fmt(customer.totalPurchases, settings.symbol)}
              </p>
            </div>

            {/* Paket Sisa */}
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Package className="w-3.5 h-3.5 text-purple-700" />
                <span className="text-[10px] font-bold uppercase text-purple-700">
                  Sisa Paket
                </span>
              </div>
              <p className="text-base font-black text-purple-900">
                {totalRemainingQuota} sesi
              </p>
              <p className="text-[9px] text-purple-500 mt-0.5">
                {activePackages.length} paket aktif
              </p>
            </div>
          </div>

          {/* Referral Code */}
          {customer.referralCode && (
            <div className="mt-3 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              <Gift className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="text-xs text-gray-500">Kode Referral:</span>
              <span className="text-sm font-black text-gray-900 tracking-widest">
                {customer.referralCode}
              </span>
              <button
                onClick={copyReferral}
                className="ml-auto p-1 text-gray-400 hover:text-gray-700 transition-colors"
                title="Copy kode"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-green-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          )}
        </div>

        {/* ── Active Packages ── */}
        {activePackages.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h2 className="text-sm font-black text-gray-900 mb-3 flex items-center gap-2">
              <Package className="w-4 h-4 text-purple-600" />
              Paket Aktif ({activePackages.length})
            </h2>
            <div className="space-y-2">
              {activePackages.map((pkg) => (
                <div
                  key={pkg._id}
                  className="rounded-lg border border-purple-100 bg-purple-50 px-3 py-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-purple-900">
                      {pkg.packageName}
                    </span>
                    {pkg.expiresAt && (
                      <span className="text-[10px] text-purple-500">
                        Exp: {fmtDate(pkg.expiresAt)}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    {pkg.serviceQuotas.map((q, i) => (
                      <span
                        key={i}
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                          q.remainingQuota > 0
                            ? "bg-white border-purple-200 text-purple-700"
                            : "bg-gray-100 border-gray-200 text-gray-400 line-through"
                        }`}
                      >
                        {q.serviceName}: {q.remainingQuota}/{q.totalQuota}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Tab Content ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          {/* Tabs */}
          <div className="flex border-b border-gray-200 px-4 pt-1">
            {(
              [
                { id: "invoices", label: "Riwayat Invoice", count: invoices.length },
                { id: "packages", label: "Riwayat Paket", count: packageOrders.length },
                { id: "photos", label: "Before & After", count: photos.length },
                { id: "notes", label: "Catatan Preferensi", count: null },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-3 pt-2 px-3 text-xs font-bold transition-colors border-b-2 mr-2 ${
                  activeTab === tab.id
                    ? "border-blue-900 text-blue-900"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
                {tab.count !== null && (
                  <span
                    className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                      activeTab === tab.id
                        ? "bg-blue-900 text-white"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-4">

            {/* ── Invoices Tab ── */}
            {activeTab === "invoices" && (
              <div className="space-y-2">
                {invoices.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">
                    <FileText className="w-10 h-10 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">Belum ada transaksi</p>
                  </div>
                ) : (
                  invoices.map((inv) => (
                    <div
                      key={inv._id}
                      className="border border-gray-200 rounded-lg overflow-hidden"
                    >
                      <button
                        onClick={() =>
                          setExpandedInvoice(
                            expandedInvoice === inv._id ? null : inv._id,
                          )
                        }
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                      >
                        <div>
                          <p className="text-sm font-bold text-gray-900">
                            {inv.invoiceNumber}
                          </p>
                          <p className="text-xs text-gray-500">
                            {fmtDate(inv.date)} · {inv.paymentMethod}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-sm font-black text-blue-900">
                              {fmt(inv.totalAmount, settings.symbol)}
                            </p>
                            <span
                              className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                                inv.status === "paid"
                                  ? "bg-green-100 text-green-700"
                                  : inv.status === "pending"
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {inv.status}
                            </span>
                          </div>
                          {expandedInvoice === inv._id ? (
                            <ChevronUp className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                      </button>
                      {expandedInvoice === inv._id && (
                        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 space-y-1">
                          {(inv.items || []).map((item, i) => (
                            <div
                              key={i}
                              className="flex justify-between text-xs text-gray-600"
                            >
                              <span className="truncate flex-1">
                                {item.name}{" "}
                                {item.quantity > 1 && (
                                  <span className="text-gray-400">
                                    ×{item.quantity}
                                  </span>
                                )}
                              </span>
                              <span className="font-semibold ml-2 flex-shrink-0">
                                {fmt(item.total, settings.symbol)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── Packages Tab ── */}
            {activeTab === "packages" && (
              <div className="space-y-3">
                {packageOrders.length === 0 && packageUsage.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">
                    <Package className="w-10 h-10 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">Belum ada pembelian atau penggunaan paket</p>
                  </div>
                ) : (
                  <>
                    {packageOrders.length > 0 && (
                      <div>
                        <h3 className="text-xs font-black text-gray-500 uppercase tracking-wider mb-2">
                          Pembelian Paket
                        </h3>
                        <div className="space-y-1.5">
                          {packageOrders.map((po) => (
                            <div
                              key={po._id}
                              className="flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2"
                            >
                              <div>
                                <p className="text-sm font-semibold text-gray-800">
                                  {po.packageName || "Paket"}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {fmtDate(po.createdAt)}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold text-blue-900">
                                  {fmt(po.totalAmount, settings.symbol)}
                                </p>
                                <span
                                  className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                                    po.status === "paid"
                                      ? "bg-green-100 text-green-700"
                                      : "bg-amber-100 text-amber-700"
                                  }`}
                                >
                                  {po.status}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {packageUsage.length > 0 && (
                      <div>
                        <h3 className="text-xs font-black text-gray-500 uppercase tracking-wider mb-2 mt-4">
                          Riwayat Penggunaan
                        </h3>
                        <div className="space-y-1.5">
                          {packageUsage.map((u) => (
                            <div
                              key={u._id}
                              className="flex items-center justify-between border border-gray-100 rounded-lg px-3 py-2 bg-gray-50"
                            >
                              <div>
                                <p className="text-sm font-semibold text-gray-800">
                                  {u.serviceName}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {fmtDate(u.createdAt)}
                                </p>
                              </div>
                              <span className="text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
                                ×{u.quantity}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── Before & After Tab ── */}
            {activeTab === "photos" && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-gray-500">
                    {photos.length} foto tersimpan
                  </p>
                  <button
                    onClick={() => setIsPhotoModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-900 text-white text-xs font-bold rounded-lg hover:bg-blue-800 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tambah Foto
                  </button>
                </div>

                {photos.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">
                    <Camera className="w-10 h-10 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">Belum ada foto before & after</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {photos.map((photo) => (
                      <div
                        key={photo._id}
                        className="border border-gray-200 rounded-xl overflow-hidden"
                      >
                        <div className="grid grid-cols-2">
                          <div className="relative">
                            <img
                              src={photo.before}
                              alt="Before"
                              className="w-full aspect-square object-cover"
                            />
                            <span className="absolute bottom-1 left-1 text-[9px] font-black bg-black/50 text-white px-1.5 py-0.5 rounded">
                              BEFORE
                            </span>
                          </div>
                          <div className="relative">
                            <img
                              src={photo.after}
                              alt="After"
                              className="w-full aspect-square object-cover"
                            />
                            <span className="absolute bottom-1 right-1 text-[9px] font-black bg-blue-900/80 text-white px-1.5 py-0.5 rounded">
                              AFTER
                            </span>
                          </div>
                        </div>
                        <div className="px-3 py-2 flex items-center justify-between">
                          <div>
                            <p className="text-[10px] text-gray-500">
                              {fmtDate(photo.date)}
                            </p>
                            {photo.note && (
                              <p className="text-xs text-gray-700 font-medium">
                                {photo.note}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => deletePhoto(photo._id)}
                            className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Notes Tab ── */}
            {activeTab === "notes" && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-gray-500 font-semibold">
                    Catatan preferensi & kebiasaan customer
                  </p>
                  <button
                    onClick={() => {
                      setNotesForm(customer.preferenceNotes || "");
                      setIsNotesModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Edit className="w-3.5 h-3.5" /> Edit Catatan
                  </button>
                </div>
                {customer.preferenceNotes ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <p className="text-sm text-amber-900 whitespace-pre-wrap leading-relaxed">
                      {customer.preferenceNotes}
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-10 text-gray-400">
                    <FileText className="w-10 h-10 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">Belum ada catatan preferensi</p>
                    <button
                      onClick={() => setIsNotesModalOpen(true)}
                      className="mt-2 text-xs font-semibold text-blue-900 hover:underline"
                    >
                      + Tambah catatan
                    </button>
                  </div>
                )}

                {/* General notes */}
                {customer.notes && (
                  <div className="mt-3 border border-gray-200 rounded-lg p-3">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">
                      Catatan Umum
                    </p>
                    <p className="text-sm text-gray-700">{customer.notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Notes Modal ── */}
      <Modal
        isOpen={isNotesModalOpen}
        onClose={() => setIsNotesModalOpen(false)}
        title="Edit Catatan Preferensi"
      >
        <div className="space-y-4">
          <textarea
            value={notesForm}
            onChange={(e) => setNotesForm(e.target.value)}
            rows={6}
            placeholder="Contoh: Suka warna natural, alergi bahan kimia tertentu, prefer stylist A, dll..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 resize-none"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsNotesModalOpen(false)}
              className="px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Batal
            </button>
            <FormButton
              onClick={saveNotes}
              loading={savingNotes}
              variant="primary"
            >
              Simpan
            </FormButton>
          </div>
        </div>
      </Modal>

      {/* ── Membership Modal ── */}
      <Modal
        isOpen={isMembershipModalOpen}
        onClose={() => setIsMembershipModalOpen(false)}
        title="Update Membership Tier"
      >
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            Total belanja: {fmt(customer.totalPurchases, settings.symbol)} · Tier otomatis:{" "}
            <span className="font-bold">{MEMBERSHIP_TIERS[autoTier].label}</span>
          </p>
          <div className="space-y-2">
            {(
              ["regular", "silver", "gold", "platinum"] as const
            ).map((t) => {
              const info = MEMBERSHIP_TIERS[t];
              return (
                <button
                  key={t}
                  onClick={() => setMembershipForm(t)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                    membershipForm === t
                      ? `${info.bg} ${info.border} ring-2 ring-blue-900`
                      : `${info.bg} ${info.border} hover:opacity-80`
                  }`}
                >
                  <span className="text-xl">{info.icon}</span>
                  <div>
                    <p className={`text-sm font-black ${info.color}`}>
                      {info.label}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      Min. belanja: {fmt(info.minSpend, settings.symbol)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setIsMembershipModalOpen(false)}
              className="px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Batal
            </button>
            <FormButton
              onClick={saveMembership}
              loading={savingMembership}
              variant="primary"
            >
              Simpan
            </FormButton>
          </div>
        </div>
      </Modal>

      {/* ── Photo Modal ── */}
      <Modal
        isOpen={isPhotoModalOpen}
        onClose={() => setIsPhotoModalOpen(false)}
        title="Tambah Foto Before & After"
        size="lg"
      >
        <form onSubmit={savePhoto} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Foto Before <span className="text-red-500">*</span>
              </label>
              <ImageUpload
                label=""
                value={photoForm.before}
                onChange={(url) =>
                  setPhotoForm((prev) => ({ ...prev, before: url }))
                }
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Foto After <span className="text-red-500">*</span>
              </label>
              <ImageUpload
                label=""
                value={photoForm.after}
                onChange={(url) =>
                  setPhotoForm((prev) => ({ ...prev, after: url }))
                }
              />
            </div>
          </div>
          <FormInput
            label="Keterangan (opsional)"
            value={photoForm.note}
            onChange={(e) =>
              setPhotoForm((prev) => ({ ...prev, note: e.target.value }))
            }
            placeholder="Contoh: Haircut + Color session"
          />
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsPhotoModalOpen(false)}
              className="px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Batal
            </button>
            <FormButton type="submit" loading={savingPhoto} variant="primary">
              Simpan Foto
            </FormButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
