"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Crown,
  Search,
  CheckCircle,
  AlertCircle,
  Settings,
  Users,
  ShoppingBag,
  Scissors,
  Package,
  ChevronDown,
  ChevronUp,
  Save,
  BookOpen,
} from "lucide-react";
import { useSettings } from "@/components/providers/SettingsProvider";
import { useTenantRouter } from "@/hooks/useTenantRouter";
import FormInput, { FormSelect } from "@/components/dashboard/FormInput";
import PermissionGate from "@/components/PermissionGate";

interface Customer {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
  membershipTier: string;
  membershipExpiry?: string;
  loyaltyPoints?: number;
}

interface MembershipConfig {
  membershipPrice: number;
  membershipDurationDays: number;
  birthdayVoucherId: string;
  memberDiscountType: "percentage" | "nominal";
  memberDiscountValue: number;
  memberIncludedServices: string[];
  memberIncludedProducts: string[];
  memberIncludedBundles: string[];
}

interface ItemOption {
  _id: string;
  name: string;
  price: number;
  memberPrice?: number;
}

interface Voucher {
  _id: string;
  code: string;
  description?: string;
  isActive: boolean;
}

const DEFAULT_CONFIG: MembershipConfig = {
  membershipPrice: 0,
  membershipDurationDays: 365,
  birthdayVoucherId: "",
  memberDiscountType: "percentage",
  memberDiscountValue: 0,
  memberIncludedServices: [],
  memberIncludedProducts: [],
  memberIncludedBundles: [],
};

export default function MembershipPage() {
  const { settings } = useSettings();
  const router = useTenantRouter();

  // Config state
  const [config, setConfig] = useState<MembershipConfig>(DEFAULT_CONFIG);
  const [configLoading, setConfigLoading] = useState(true);
  const [configSaving, setConfigSaving] = useState(false);
  const [configMsg, setConfigMsg] = useState<{ type: string; text: string }>({ type: "", text: "" });

  // Checklist data
  const [allServices, setAllServices] = useState<ItemOption[]>([]);
  const [allProducts, setAllProducts] = useState<ItemOption[]>([]);
  const [allBundles, setAllBundles] = useState<ItemOption[]>([]);
  const [checklistTab, setChecklistTab] = useState<"services" | "products" | "bundles">("services");
  const [checklistSearch, setChecklistSearch] = useState("");

  // Voucher dropdown
  const [vouchers, setVouchers] = useState<Voucher[]>([]);

  // Purchase state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [purchaseMsg, setPurchaseMsg] = useState<{ type: string; text: string }>({ type: "", text: "" });

  // Active members
  const [activeMembers, setActiveMembers] = useState<Customer[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  // UI sections
  const [showGuide, setShowGuide] = useState(false);

  // ── Fetch All Data ──────────────────────────────────────────
  useEffect(() => {
    fetchConfig();
    fetchAllItems();
    fetchVouchers();
    fetchActiveMembers();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchCustomers(), 300);
    return () => clearTimeout(timer);
  }, [customerSearch]);

  const fetchConfig = async () => {
    setConfigLoading(true);
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      if (data.success) {
        const d = data.data;
        setConfig({
          membershipPrice: d.membershipPrice || 0,
          membershipDurationDays: d.membershipDurationDays || 365,
          birthdayVoucherId: d.birthdayVoucherId || "",
          memberDiscountType: d.memberDiscountType || "percentage",
          memberDiscountValue: d.memberDiscountValue || 0,
          memberIncludedServices: d.memberIncludedServices || [],
          memberIncludedProducts: d.memberIncludedProducts || [],
          memberIncludedBundles: d.memberIncludedBundles || [],
        });
      }
    } catch (err) {
      console.error("Error fetching config:", err);
    } finally {
      setConfigLoading(false);
    }
  };

  const fetchAllItems = async () => {
    try {
      const [sRes, pRes, bRes] = await Promise.all([
        fetch("/api/services?limit=0"),
        fetch("/api/products?limit=0"),
        fetch("/api/service-bundles?limit=0"),
      ]);
      const [sData, pData, bData] = await Promise.all([sRes.json(), pRes.json(), bRes.json()]);
      if (sData.success) setAllServices((sData.data || []).map((s: any) => ({ _id: s._id, name: s.name, price: s.price, memberPrice: s.memberPrice })));
      if (pData.success) setAllProducts((pData.data || []).map((p: any) => ({ _id: p._id, name: p.name, price: p.price, memberPrice: p.memberPrice })));
      if (bData.success) setAllBundles((bData.data || []).map((b: any) => ({ _id: b._id, name: b.name, price: b.price })));
    } catch (err) {
      console.error("Error fetching items:", err);
    }
  };

  const fetchVouchers = async () => {
    try {
      const res = await fetch("/api/vouchers?limit=0");
      const data = await res.json();
      if (data.success) setVouchers((data.data || []).filter((v: Voucher) => v.isActive));
    } catch (err) {
      console.error("Error fetching vouchers:", err);
    }
  };

  const fetchCustomers = async () => {
    setCustomerLoading(true);
    try {
      const res = await fetch(`/api/customers?search=${encodeURIComponent(customerSearch)}&limit=0`);
      const data = await res.json();
      if (data.success) setCustomers(data.data || []);
    } catch (err) {
      console.error("Error fetching customers:", err);
    } finally {
      setCustomerLoading(false);
    }
  };

  const fetchActiveMembers = async () => {
    setMembersLoading(true);
    try {
      const res = await fetch("/api/customers?limit=0&membership=premium");
      const data = await res.json();
      if (data.success) {
        const premiums = (data.data || []).filter(
          (c: Customer) => c.membershipTier === "premium" && c.membershipExpiry
        );
        setActiveMembers(premiums);
      }
    } catch (err) {
      console.error("Error fetching members:", err);
    } finally {
      setMembersLoading(false);
    }
  };

  // ── Save Config ────────────────────────────────────────────────
  const handleSaveConfig = async () => {
    setConfigSaving(true);
    setConfigMsg({ type: "", text: "" });
    try {
      const payload: any = { ...config };
      if (payload.birthdayVoucherId === "") payload.birthdayVoucherId = null;

      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setConfigMsg({ type: "success", text: "Pengaturan membership berhasil disimpan!" });
      } else {
        setConfigMsg({ type: "error", text: data.error || "Gagal menyimpan" });
      }
    } catch (err) {
      setConfigMsg({ type: "error", text: "Terjadi kesalahan" });
    } finally {
      setConfigSaving(false);
      setTimeout(() => setConfigMsg({ type: "", text: "" }), 3000);
    }
  };

  // ── Checklist Toggles ────────────────────────────────────────
  const toggleItem = (type: "services" | "products" | "bundles", id: string) => {
    const key = type === "services" ? "memberIncludedServices" : type === "products" ? "memberIncludedProducts" : "memberIncludedBundles";
    setConfig((prev) => {
      const arr = prev[key] as string[];
      const newArr = arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];
      return { ...prev, [key]: newArr };
    });
  };

  const selectAllItems = (type: "services" | "products" | "bundles") => {
    const items = type === "services" ? allServices : type === "products" ? allProducts : allBundles;
    const key = type === "services" ? "memberIncludedServices" : type === "products" ? "memberIncludedProducts" : "memberIncludedBundles";
    setConfig((prev) => ({ ...prev, [key]: items.map((i) => i._id) }));
  };

  const deselectAllItems = (type: "services" | "products" | "bundles") => {
    const key = type === "services" ? "memberIncludedServices" : type === "products" ? "memberIncludedProducts" : "memberIncludedBundles";
    setConfig((prev) => ({ ...prev, [key]: [] }));
  };

  // ── Purchase ───────────────────────────────────────────────
  const handlePurchase = async () => {
    if (!selectedCustomer) return;
    if (config.membershipPrice <= 0) {
      setPurchaseMsg({ type: "error", text: "Harga membership belum diatur." });
      return;
    }
    setPurchasing(true);
    setPurchaseMsg({ type: "", text: "" });
    try {
      const res = await fetch("/api/membership/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: selectedCustomer._id, paymentMethod }),
      });
      const data = await res.json();
      if (data.success) {
        setPurchaseMsg({ type: "success", text: `${selectedCustomer.name} berhasil menjadi Premium Member!` });
        setSelectedCustomer(null);
        setCustomerSearch("");
        fetchActiveMembers();
        if (data.data?.invoiceId) {
          setTimeout(() => router.push(`/invoices/print/${data.data.invoiceId}`), 1500);
        }
      } else {
        setPurchaseMsg({ type: "error", text: data.error || "Gagal memproses." });
      }
    } catch (err) {
      setPurchaseMsg({ type: "error", text: "Terjadi kesalahan." });
    } finally {
      setPurchasing(false);
    }
  };

  const isPremiumActive = (c: Customer) =>
    c.membershipTier === "premium" && !!c.membershipExpiry && new Date(c.membershipExpiry) > new Date();

  const isExpiringSoon = (c: Customer) => {
    if (!c.membershipExpiry) return false;
    const diff = new Date(c.membershipExpiry).getTime() - Date.now();
    return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
  };

  // ── Filtered checklist items ────────────────────────────────
  const currentItems = checklistTab === "services" ? allServices : checklistTab === "products" ? allProducts : allBundles;
  const currentIncluded = checklistTab === "services" ? config.memberIncludedServices : checklistTab === "products" ? config.memberIncludedProducts : config.memberIncludedBundles;
  const filteredChecklistItems = currentItems.filter((i) => i.name.toLowerCase().includes(checklistSearch.toLowerCase()));

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-xl">
              <Crown className="w-6 h-6 text-amber-600" />
            </div>
            Premium Membership
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Kelola pengaturan, benefit, dan penjualan membership premium
          </p>
        </div>

        {/* Guide Section */}
        <button
          onClick={() => setShowGuide(!showGuide)}
          className="w-full text-left bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between hover:bg-blue-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-bold text-blue-900">📖 Panduan Setup Membership</span>
          </div>
          {showGuide ? <ChevronUp className="w-4 h-4 text-blue-600" /> : <ChevronDown className="w-4 h-4 text-blue-600" />}
        </button>
        {showGuide && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-3 -mt-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { step: "1", title: "Isi Pengaturan", desc: "Set harga, durasi, dan diskon default di section bawah" },
                { step: "2", title: "Centang Item", desc: "Pilih service/product/bundle mana yang masuk benefit member" },
                { step: "3", title: "Jual Membership", desc: "Cari customer dan klik beli untuk jadikan Premium Member" },
                { step: "4", title: "POS Otomatis", desc: "Di POS, harga member otomatis berlaku saat pilih customer premium" },
              ].map((s) => (
                <div key={s.step} className="flex gap-3 items-start">
                  <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black flex-shrink-0">{s.step}</div>
                  <div>
                    <p className="text-sm font-bold text-blue-900">{s.title}</p>
                    <p className="text-xs text-blue-700">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}


        {/* ══════════════════ Section 3: Purchase ══════════════════ */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-600" />
            Jual Membership ke Customer
          </h2>

          {config.membershipPrice <= 0 && (
            <div className="mb-4 flex items-center gap-2 text-red-600 text-sm font-medium bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertCircle className="w-4 h-4" />
              Harga membership belum diatur. Isi dulu di pengaturan di atas.
            </div>
          )}

          {/* Info banner */}
          <div className="mb-4 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <p className="text-[10px] text-amber-600 font-semibold uppercase">Harga</p>
                <p className="text-lg font-black text-amber-900">{settings.symbol}{config.membershipPrice.toLocaleString("id-ID")}</p>
              </div>
              <div>
                <p className="text-[10px] text-amber-600 font-semibold uppercase">Masa Berlaku</p>
                <p className="text-lg font-black text-amber-900">{config.membershipDurationDays} hari</p>
              </div>
              <div>
                <p className="text-[10px] text-amber-600 font-semibold uppercase">Diskon</p>
                <p className="text-lg font-black text-amber-900">
                  {config.memberDiscountValue > 0
                    ? config.memberDiscountType === "percentage"
                      ? `${config.memberDiscountValue}%`
                      : `${settings.symbol}${config.memberDiscountValue.toLocaleString("id-ID")}`
                    : "—"}
                </p>
              </div>
            </div>
          </div>

          {purchaseMsg.text && (
            <div className={`mb-4 p-3 rounded-xl text-sm font-medium flex items-center gap-2 ${purchaseMsg.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
              {purchaseMsg.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {purchaseMsg.text}
            </div>
          )}

          {/* Customer Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Cari nama / phone customer..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm"
              value={customerSearch}
              onChange={(e) => { setCustomerSearch(e.target.value); setSelectedCustomer(null); }}
            />
          </div>

          {customerLoading && <div className="text-sm text-gray-500 text-center py-3">Mencari...</div>}

          {!customerLoading && customers.length > 0 && !selectedCustomer && (
            <div className="border border-gray-100 rounded-lg overflow-hidden max-h-48 overflow-y-auto divide-y divide-gray-50 mb-3">
              {customers.map((c) => (
                <button
                  key={c._id}
                  onClick={() => { setSelectedCustomer(c); setCustomerSearch(c.name); setCustomers([]); }}
                  className="w-full text-left px-4 py-3 hover:bg-amber-50 transition-colors flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-bold text-gray-900">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.phone || c.email || "No contact"}</p>
                  </div>
                  {isPremiumActive(c) && (
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full border border-amber-200 uppercase">
                      Premium
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {selectedCustomer && (
            <div className="border border-amber-200 bg-amber-50/50 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-gray-900">{selectedCustomer.name}</p>
                  <p className="text-xs text-gray-500">{selectedCustomer.phone || selectedCustomer.email}</p>
                </div>
                {isPremiumActive(selectedCustomer) && (
                  <div className="text-xs font-bold px-3 py-1 bg-amber-100 text-amber-700 rounded-full border border-amber-200">
                    ✨ Premium s/d {new Date(selectedCustomer.membershipExpiry!).toLocaleDateString("id-ID")}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Metode Pembayaran</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-semibold"
                >
                  <option value="Cash">Cash</option>
                  <option value="Transfer">Transfer Bank</option>
                  <option value="QRIS">QRIS</option>
                  <option value="Debit">Debit Card</option>
                  <option value="Credit Card">Credit Card</option>
                </select>
              </div>

              <button
                onClick={handlePurchase}
                disabled={purchasing || isPremiumActive(selectedCustomer) || config.membershipPrice <= 0}
                className="w-full px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold text-sm hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Crown className="w-5 h-5" />
                {purchasing
                  ? "Memproses..."
                  : isPremiumActive(selectedCustomer)
                  ? "Sudah Premium Member"
                  : `Beli Membership — ${settings.symbol}${config.membershipPrice.toLocaleString("id-ID")}`}
              </button>
            </div>
          )}
        </div>

        {/* ══════════════════ Section 4: Active Members ══════════════════ */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-600" />
            Daftar Premium Member ({activeMembers.length})
          </h2>

          {membersLoading ? (
            <div className="py-8 text-center text-gray-400 text-sm">Memuat...</div>
          ) : activeMembers.length === 0 ? (
            <div className="py-8 text-center text-gray-400">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p className="text-sm">Belum ada premium member</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Nama</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Phone</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Expired</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Poin</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {activeMembers.map((m) => {
                    const expired = m.membershipExpiry ? new Date(m.membershipExpiry) < new Date() : true;
                    const expiringSoon = isExpiringSoon(m);
                    return (
                      <tr key={m._id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 text-sm font-bold text-gray-900">{m.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{m.phone || "—"}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {m.membershipExpiry ? new Date(m.membershipExpiry).toLocaleDateString("id-ID") : "—"}
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-amber-700">{(m.loyaltyPoints || 0).toLocaleString("id-ID")}</td>
                        <td className="px-4 py-3">
                          {expired ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-50 text-red-600 border border-red-200">Expired</span>
                          ) : expiringSoon ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-50 text-amber-600 border border-amber-200">Segera Expired</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-green-50 text-green-700 border border-green-200">Aktif</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
