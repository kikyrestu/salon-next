"use client";

import { useState, useEffect } from "react";
import { Crown, Search, CheckCircle, AlertCircle } from "lucide-react";
import { useSettings } from "@/components/providers/SettingsProvider";
import { useRouter } from "next/navigation";

interface Customer {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
  membershipTier: string;
  membershipExpiry?: string;
}

interface MembershipSettings {
  membershipPrice: number;
  membershipDurationDays: number;
}

export default function MembershipPage() {
  const { settings } = useSettings();
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [memberSettings, setMemberSettings] = useState<MembershipSettings>({
    membershipPrice: 0,
    membershipDurationDays: 365,
  });
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [message, setMessage] = useState<{ type: string; text: string }>({
    type: "",
    text: "",
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (search.length >= 2) {
      const timer = setTimeout(() => fetchCustomers(), 300);
      return () => clearTimeout(timer);
    } else {
      setCustomers([]);
    }
  }, [search]);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      if (data.success) {
        setMemberSettings({
          membershipPrice: data.data.membershipPrice || 0,
          membershipDurationDays: data.data.membershipDurationDays || 365,
        });
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    }
  };

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/customers?search=${encodeURIComponent(search)}&limit=10`);
      const data = await res.json();
      if (data.success) setCustomers(data.data || []);
    } catch (error) {
      console.error("Error fetching customers:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!selectedCustomer) return;
    if (memberSettings.membershipPrice <= 0) {
      setMessage({ type: "error", text: "Harga membership belum diatur di Settings." });
      return;
    }

    setPurchasing(true);
    setMessage({ type: "", text: "" });

    try {
      const res = await fetch("/api/membership/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomer._id,
          paymentMethod,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setMessage({
          type: "success",
          text: `${selectedCustomer.name} berhasil menjadi Premium Member!`,
        });
        setSelectedCustomer(null);
        setSearch("");
        setCustomers([]);

        // Redirect to invoice if available
        if (data.data?.invoiceId) {
          setTimeout(() => {
            router.push(`/invoices/print/${data.data.invoiceId}`);
          }, 1500);
        }
      } else {
        setMessage({ type: "error", text: data.error || "Gagal memproses membership." });
      }
    } catch (error) {
      console.error("Error:", error);
      setMessage({ type: "error", text: "Terjadi kesalahan." });
    } finally {
      setPurchasing(false);
    }
  };

  const isPremiumActive = (customer: Customer) =>
    customer.membershipTier === "premium" &&
    !!customer.membershipExpiry &&
    new Date(customer.membershipExpiry) > new Date();

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-xl">
              <Crown className="w-6 h-6 text-amber-600" />
            </div>
            Premium Membership
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Jual membership premium ke customer
          </p>
        </div>

        {/* Membership Info Card */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-6 shadow-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-amber-600 font-semibold uppercase tracking-wider">
                Harga
              </p>
              <p className="text-xl font-black text-amber-900">
                {settings.symbol}
                {memberSettings.membershipPrice.toLocaleString("id-ID")}
              </p>
            </div>
            <div>
              <p className="text-xs text-amber-600 font-semibold uppercase tracking-wider">
                Masa Berlaku
              </p>
              <p className="text-xl font-black text-amber-900">
                {memberSettings.membershipDurationDays} hari
              </p>
            </div>
          </div>
          {memberSettings.membershipPrice <= 0 && (
            <div className="mt-3 flex items-center gap-2 text-red-600 text-sm font-medium">
              <AlertCircle className="w-4 h-4" />
              Harga membership belum diatur. Silahkan set di halaman Settings.
            </div>
          )}
        </div>

        {message.text && (
          <div
            className={`p-4 rounded-xl text-sm font-medium flex items-center gap-2 ${
              message.type === "success"
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle className="w-5 h-5 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0" />
            )}
            {message.text}
          </div>
        )}

        {/* Customer Search */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-3">
            Pilih Customer
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Cari nama / phone customer..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelectedCustomer(null);
              }}
            />
          </div>

          {/* Customer Results */}
          {loading && (
            <div className="mt-3 text-sm text-gray-500 text-center py-4">
              Mencari...
            </div>
          )}

          {!loading && customers.length > 0 && !selectedCustomer && (
            <div className="mt-3 border border-gray-100 rounded-lg overflow-hidden max-h-60 overflow-y-auto divide-y divide-gray-50">
              {customers.map((c) => (
                <button
                  key={c._id}
                  onClick={() => {
                    setSelectedCustomer(c);
                    setSearch(c.name);
                    setCustomers([]);
                  }}
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

          {/* Selected Customer */}
          {selectedCustomer && (
            <div className="mt-4 border border-amber-200 bg-amber-50/50 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-gray-900">
                    {selectedCustomer.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {selectedCustomer.phone || selectedCustomer.email}
                  </p>
                </div>
                {isPremiumActive(selectedCustomer) && (
                  <div className="text-xs font-bold px-3 py-1 bg-amber-100 text-amber-700 rounded-full border border-amber-200">
                    ✨ Sudah Premium s/d{" "}
                    {new Date(
                      selectedCustomer.membershipExpiry!
                    ).toLocaleDateString("id-ID")}
                  </div>
                )}
              </div>

              {/* Payment Method */}
              <div className="mt-4">
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  Metode Pembayaran
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                >
                  <option value="cash">Cash</option>
                  <option value="transfer">Transfer Bank</option>
                  <option value="qris">QRIS</option>
                  <option value="debit">Debit Card</option>
                  <option value="credit_card">Credit Card</option>
                </select>
              </div>

              {/* Purchase Button */}
              <button
                onClick={handlePurchase}
                disabled={purchasing || isPremiumActive(selectedCustomer)}
                className="w-full mt-4 px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold text-sm hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Crown className="w-5 h-5" />
                {purchasing
                  ? "Memproses..."
                  : isPremiumActive(selectedCustomer)
                  ? "Sudah Premium Member"
                  : `Beli Membership — ${settings.symbol}${memberSettings.membershipPrice.toLocaleString("id-ID")}`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
