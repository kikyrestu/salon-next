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
import { useRouter } from "next/navigation";
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
  loyaltyPointPerSpend: number;
  loyaltyPointValue: number;
  referralRewardPoints: number;
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
  loyaltyPointPerSpend: 0,
  loyaltyPointValue: 0,
  referralRewardPoints: 0,
  birthdayVoucherId: "",
  memberDiscountType: "percentage",
  memberDiscountValue: 0,
  memberIncludedServices: [],
  memberIncludedProducts: [],
  memberIncludedBundles: [],
};

export default function MembershipPage() {
  const { settings } = useSettings();
  const router = useRouter();

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
          loyaltyPointPerSpend: d.loyaltyPointPerSpend || 0,
          loyaltyPointValue: d.loyaltyPointValue || 0,
          referralRewardPoints: d.referralRewardPoints || 0,
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
        fetch("/api/services?limit=999"),
        fetch("/api/products?limit=999"),
        fetch("/api/service-bundles?limit=999"),
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
      const res = await fetch("/api/vouchers?limit=999");
      const data = await res.json();
      if (data.success) setVouchers((data.data || []).filter((v: Voucher) => v.isActive));
    } catch (err) {
      console.error("Error fetching vouchers:", err);
    }
  };

  const fetchCustomers = async () => {
    setCustomerLoading(true);
    try {
      const res = await fetch(`/api/customers?search=${encodeURIComponent(customerSearch)}&limit=10`);
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
      const res = await fetch("/api/customers?limit=999&membership=premium");
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

        {/* ══════════════════ Section 1: Config ══════════════════ */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-amber-600" />
            Pengaturan Membership
          </h2>

          {configLoading ? (
            <div className="py-8 text-center text-gray-400 text-sm">Memuat...</div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <FormInput
                  label="Harga Membership (Rp)"
                  type="number"
                  value={config.membershipPrice.toString()}
                  onChange={(e) => setConfig({ ...config, membershipPrice: parseFloat(e.target.value) || 0 })}
                  min="0"
                  placeholder="500000"
                />
                <FormInput
                  label="Masa Berlaku (Hari)"
                  type="number"
                  value={config.membershipDurationDays.toString()}
                  onChange={(e) => setConfig({ ...config, membershipDurationDays: parseInt(e.target.value) || 365 })}
                  min="1"
                  placeholder="365"
                />
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Voucher Birthday (Opsional)</label>
                  <select
                    value={config.birthdayVoucherId}
                    onChange={(e) => setConfig({ ...config, birthdayVoucherId: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-400 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-sm"
                  >
                    <option value="">— Tidak ada —</option>
                    {vouchers.map((v) => (
                      <option key={v._id} value={v._id}>
                        {v.code} {v.description ? `- ${v.description}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Discount Settings */}
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
                <h3 className="text-sm font-bold text-amber-900">💰 Diskon Default Member</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormSelect
                    label="Tipe Diskon"
                    value={config.memberDiscountType}
                    onChange={(e: any) => setConfig({ ...config, memberDiscountType: e.target.value })}
                    options={[
                      { value: "percentage", label: "Persentase (%)" },
                      { value: "nominal", label: "Nominal (Rp)" },
                    ]}
                  />
                  <FormInput
                    label={config.memberDiscountType === "percentage" ? "Nilai Diskon (%)" : "Nilai Diskon (Rp)"}
                    type="number"
                    value={config.memberDiscountValue.toString()}
                    onChange={(e) => setConfig({ ...config, memberDiscountValue: parseFloat(e.target.value) || 0 })}
                    min="0"
                    max={config.memberDiscountType === "percentage" ? "100" : undefined}
                    placeholder={config.memberDiscountType === "percentage" ? "10" : "20000"}
                  />
                </div>
                <p className="text-[11px] text-amber-700">
                  Diskon ini berlaku untuk semua item yang dicentang di bawah. Item dengan &quot;Harga Member&quot; khusus di master data akan menggunakan harga override-nya.
                </p>
              </div>

              {/* Loyalty Settings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormInput
                  label="Loyalty: Poin per Spending (Rp)"
                  type="number"
                  value={config.loyaltyPointPerSpend.toString()}
                  onChange={(e) => setConfig({ ...config, loyaltyPointPerSpend: parseFloat(e.target.value) || 0 })}
                  min="0"
                  placeholder="100000 = tiap Rp100.000 = 1 poin"
                />
                <FormInput
                  label="Referral: Bonus Poin"
                  type="number"
                  value={(config.referralRewardPoints || 0).toString()}
                  onChange={(e) => setConfig({ ...config, referralRewardPoints: parseFloat(e.target.value) || 0 })}
                  min="0"
                  placeholder="Misal: 50 poin"
                />
                <FormInput
                  label="Loyalty: Nilai 1 Poin (Rp)"
                  type="number"
                  value={config.loyaltyPointValue.toString()}
                  onChange={(e) => setConfig({ ...config, loyaltyPointValue: parseFloat(e.target.value) || 0 })}
                  min="0"
                  placeholder="1000 = 1 poin = Rp1.000"
                />
              </div>

              {/* Save button */}
              <div className="flex items-center gap-3">
                <PermissionGate resource="membership" action="edit">
                  <button
                    onClick={handleSaveConfig}
                    disabled={configSaving}
                    className="px-6 py-2.5 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-colors flex items-center gap-2 font-bold text-sm disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {configSaving ? "Menyimpan..." : "Simpan Pengaturan"}
                  </button>
                </PermissionGate>
                {configMsg.text && (
                  <span className={`text-sm font-medium ${configMsg.type === "success" ? "text-green-600" : "text-red-600"}`}>
                    {configMsg.type === "success" ? "✅" : "❌"} {configMsg.text}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ══════════════════ Section 2: Checklist ══════════════════ */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            Item yang Termasuk Benefit Member
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            Centang item yang akan mendapat diskon otomatis saat customer premium checkout di POS. Jangan lupa klik &quot;Simpan Pengaturan&quot; di atas setelah selesai.
          </p>

          {/* Tabs */}
          <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1">
            {([
              { key: "services", label: "Services", icon: Scissors, count: allServices.length },
              { key: "products", label: "Products", icon: ShoppingBag, count: allProducts.length },
              { key: "bundles", label: "Bundles", icon: Package, count: allBundles.length },
            ] as const).map((tab) => (
              <button
                key={tab.key}
                onClick={() => { setChecklistTab(tab.key); setChecklistSearch(""); }}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold transition-colors ${
                  checklistTab === tab.key
                    ? "bg-white text-blue-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>

          {/* Search + Select All */}
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Cari item..."
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                value={checklistSearch}
                onChange={(e) => setChecklistSearch(e.target.value)}
              />
            </div>
            <button
              onClick={() => selectAllItems(checklistTab)}
              className="px-3 py-2 text-[11px] font-bold border border-green-200 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
            >
              Pilih Semua
            </button>
            <button
              onClick={() => deselectAllItems(checklistTab)}
              className="px-3 py-2 text-[11px] font-bold border border-gray-200 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Hapus Semua
            </button>
          </div>

          {/* Checklist */}
          <div className="max-h-72 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-50">
            {filteredChecklistItems.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-sm">Tidak ada item</div>
            ) : (
              filteredChecklistItems.map((item) => {
                const isChecked = currentIncluded.includes(item._id);
                return (
                  <label
                    key={item._id}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${isChecked ? "bg-green-50/50" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleItem(checklistTab, item._id)}
                      className="w-4 h-4 accent-green-600 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold truncate ${isChecked ? "text-gray-900" : "text-gray-600"}`}>
                        {item.name}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        Harga: {settings.symbol}{item.price?.toLocaleString("id-ID")}
                        {item.memberPrice && item.memberPrice > 0 && (
                          <span className="ml-2 text-amber-600 font-bold">
                            Override: {settings.symbol}{item.memberPrice.toLocaleString("id-ID")}
                          </span>
                        )}
                      </p>
                    </div>
                    {isChecked && (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-green-100 text-green-700 rounded-full border border-green-200">
                        ✅ Aktif
                      </span>
                    )}
                  </label>
                );
              })
            )}
          </div>

          <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
            <span>✅ Terpilih: <strong className="text-gray-900">{currentIncluded.length}</strong> / {currentItems.length}</span>
          </div>
        </div>

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
