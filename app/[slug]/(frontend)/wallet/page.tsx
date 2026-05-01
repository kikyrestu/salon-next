"use client";

import { useState, useEffect, useCallback } from "react";
import { Wallet, Plus, ArrowUpCircle, ArrowDownCircle, Search, RefreshCw } from "lucide-react";
import FormInput, { FormSelect, FormButton } from "@/components/dashboard/FormInput";
import SearchableSelect from "@/components/dashboard/SearchableSelect";
import Modal from "@/components/dashboard/Modal";
import { useSettings } from "@/components/providers/SettingsProvider";
import PermissionGate from "@/components/PermissionGate";

interface CustomerItem {
  _id: string;
  name: string;
  phone?: string;
  walletBalance: number;
  membershipTier?: string;
}

interface WalletTx {
  _id: string;
  type: 'topup' | 'bonus' | 'payment' | 'refund';
  amount: number;
  balanceAfter: number;
  description: string;
  topupMethod?: string;
  bonusPercent?: number;
  bonusAmount?: number;
  invoice?: { invoiceNumber: string };
  performedBy?: { name: string };
  createdAt: string;
}

export default function WalletPage() {
  const { settings } = useSettings();
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [walletsWithBalance, setWalletsWithBalance] = useState<CustomerItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Top-up modal
  const [isTopupModalOpen, setIsTopupModalOpen] = useState(false);
  const [topupCustomerId, setTopupCustomerId] = useState("");
  const [topupAmount, setTopupAmount] = useState<number | string>("");
  const [topupMethod, setTopupMethod] = useState("Cash");
  const [topupSaving, setTopupSaving] = useState(false);
  const [topupResult, setTopupResult] = useState<{
    topupAmount: number;
    bonusAmount: number;
    bonusPercent: number;
    totalCredited: number;
    newBalance: number;
  } | null>(null);

  // History modal
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyCustomer, setHistoryCustomer] = useState<CustomerItem | null>(null);
  const [historyTxs, setHistoryTxs] = useState<WalletTx[]>([]);
  const [historyBalance, setHistoryBalance] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Search
  const [search, setSearch] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [custRes, walletRes] = await Promise.all([
        fetch("/api/customers?limit=5000"),
        fetch("/api/wallet"),
      ]);
      const custData = await custRes.json();
      const walletData = await walletRes.json();

      if (custData.success) setCustomers(custData.data || []);
      if (walletData.success) setWalletsWithBalance(walletData.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleTopup = async () => {
    if (!topupCustomerId || !topupAmount || Number(topupAmount) <= 0) {
      alert("Pilih customer dan isi nominal top-up");
      return;
    }

    setTopupSaving(true);
    try {
      const res = await fetch("/api/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: topupCustomerId,
          amount: Number(topupAmount),
          type: "topup",
          paymentMethod: topupMethod,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.error || "Gagal top-up");
        return;
      }

      setTopupResult(data.data);
      await loadData();
    } catch (error) {
      console.error(error);
      alert("Gagal top-up wallet");
    } finally {
      setTopupSaving(false);
    }
  };

  const openHistory = async (customer: CustomerItem) => {
    setHistoryCustomer(customer);
    setIsHistoryOpen(true);
    setHistoryLoading(true);

    try {
      const res = await fetch(`/api/wallet?customerId=${customer._id}&limit=100`);
      const data = await res.json();
      if (data.success) {
        setHistoryTxs(data.data.transactions || []);
        setHistoryBalance(data.data.balance || 0);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const resetTopup = () => {
    setTopupCustomerId("");
    setTopupAmount("");
    setTopupMethod("Cash");
    setTopupResult(null);
  };

  const filteredWallets = walletsWithBalance.filter(
    (w) =>
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      (w.phone && w.phone.includes(search))
  );

  const totalWalletBalance = walletsWithBalance.reduce(
    (sum, w) => sum + (w.walletBalance || 0),
    0
  );

  if (loading) {
    return (
      <div className="p-6 text-gray-700">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-900 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 text-black">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">E-Wallet</h1>
          <p className="text-sm text-gray-500">
            Top-up saldo customer, lihat history transaksi wallet
          </p>
        </div>
        <div className="flex gap-2">
          <FormButton onClick={loadData} variant="secondary" icon={<RefreshCw className="w-4 h-4" />}>
            Refresh
          </FormButton>
          <PermissionGate resource="customers" action="edit">
            <FormButton
              onClick={() => { resetTopup(); setIsTopupModalOpen(true); }}
              icon={<Plus className="w-4 h-4" />}
            >
              Top-Up Wallet
            </FormButton>
          </PermissionGate>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <Wallet className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Total Saldo Wallet</p>
              <p className="text-xl font-bold text-gray-900">
                {settings.symbol}{totalWalletBalance.toLocaleString("id-ID", { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <ArrowUpCircle className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Customer dengan Wallet</p>
              <p className="text-xl font-bold text-gray-900">{walletsWithBalance.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <ArrowDownCircle className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Total Customer</p>
              <p className="text-xl font-bold text-gray-900">{customers.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Wallet List */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900">Customer Wallets</h3>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari nama / telepon..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent text-gray-900 bg-white"
            />
          </div>
        </div>

        {filteredWallets.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">
            Belum ada customer dengan saldo wallet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs text-gray-500 uppercase">
                  <th className="text-left py-3 px-2">Customer</th>
                  <th className="text-left py-3 px-2">Telepon</th>
                  <th className="text-left py-3 px-2">Tier</th>
                  <th className="text-right py-3 px-2">Saldo</th>
                  <th className="text-center py-3 px-2">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredWallets.map((w) => (
                  <tr key={w._id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-2 font-semibold text-gray-900">{w.name}</td>
                    <td className="py-3 px-2 text-gray-600">{w.phone || "-"}</td>
                    <td className="py-3 px-2">
                      <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 font-semibold capitalize">
                        {w.membershipTier || "regular"}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right font-bold text-green-700">
                      {settings.symbol}{(w.walletBalance || 0).toLocaleString("id-ID", { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-3 px-2 text-center">
                      <button
                        onClick={() => openHistory(w)}
                        className="text-xs text-blue-700 font-bold hover:underline"
                      >
                        History
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Top-Up Modal */}
      <Modal
        isOpen={isTopupModalOpen}
        onClose={() => { setIsTopupModalOpen(false); resetTopup(); }}
        title="Top-Up Wallet Customer"
      >
        {topupResult ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center space-y-2">
              <p className="text-green-700 font-bold text-lg">Top-Up Berhasil! ✅</p>
              <div className="text-sm text-gray-700 space-y-1">
                <p>Top-up: <span className="font-bold">{settings.symbol}{topupResult.topupAmount.toLocaleString("id-ID")}</span></p>
                {topupResult.bonusAmount > 0 && (
                  <p className="text-green-600">
                    Bonus {topupResult.bonusPercent}%: <span className="font-bold">+{settings.symbol}{topupResult.bonusAmount.toLocaleString("id-ID")}</span>
                  </p>
                )}
                <p className="text-base font-bold border-t border-green-200 pt-2 mt-2">
                  Total masuk: {settings.symbol}{topupResult.totalCredited.toLocaleString("id-ID")}
                </p>
                <p className="text-xs text-gray-500">
                  Saldo baru: {settings.symbol}{topupResult.newBalance.toLocaleString("id-ID")}
                </p>
              </div>
            </div>
            <FormButton onClick={() => { setIsTopupModalOpen(false); resetTopup(); }} variant="secondary">
              Tutup
            </FormButton>
          </div>
        ) : (
          <div className="space-y-4">
            <SearchableSelect
              placeholder="Pilih customer..."
              value={topupCustomerId}
              onChange={(val) => setTopupCustomerId(val)}
              options={customers.map((c) => ({
                value: c._id,
                label: `${c.name}${c.phone ? ` (${c.phone})` : ""} — Saldo: ${settings.symbol}${(c.walletBalance || 0).toLocaleString("id-ID")}`,
              }))}
            />
            <FormInput
              label="Nominal Top-Up"
              type="number"
              min="0"
              value={topupAmount}
              onChange={(e) => setTopupAmount(e.target.value)}
              placeholder="Contoh: 500000"
            />
            <FormSelect
              label="Metode Pembayaran"
              value={topupMethod}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTopupMethod(e.target.value)}
              options={[
                { value: "Cash", label: "Cash" },
                { value: "Transfer", label: "Transfer" },
                { value: "Debit", label: "Debit" },
                { value: "QRIS", label: "QRIS" },
              ]}
            />
            <p className="text-xs text-gray-400">
              Bonus otomatis dihitung berdasarkan tier di Settings → Wallet Bonus Tiers
            </p>
            <FormButton onClick={handleTopup} loading={topupSaving} variant="success">
              Proses Top-Up
            </FormButton>
          </div>
        )}
      </Modal>

      {/* History Modal */}
      <Modal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        title={`Wallet History — ${historyCustomer?.name || ""}`}
      >
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between">
            <span className="text-sm font-medium text-green-700">Saldo saat ini</span>
            <span className="text-lg font-bold text-green-700">
              {settings.symbol}{historyBalance.toLocaleString("id-ID", { maximumFractionDigits: 0 })}
            </span>
          </div>

          {historyLoading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-900 border-t-transparent mx-auto" />
            </div>
          ) : historyTxs.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">Belum ada transaksi wallet.</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {historyTxs.map((tx) => (
                <div
                  key={tx._id}
                  className={`border rounded-lg p-3 ${
                    tx.type === "topup" || tx.type === "refund"
                      ? "border-green-200 bg-green-50/50"
                      : "border-red-200 bg-red-50/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {(tx.type === "topup" || tx.type === "refund") ? (
                        <ArrowUpCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <ArrowDownCircle className="w-4 h-4 text-red-600" />
                      )}
                      <span className="text-xs font-bold uppercase text-gray-600">
                        {tx.type === "topup" ? "Top-Up" : tx.type === "payment" ? "Pembayaran" : tx.type === "refund" ? "Refund" : tx.type}
                      </span>
                    </div>
                    <span
                      className={`font-bold text-sm ${
                        tx.amount >= 0 ? "text-green-700" : "text-red-700"
                      }`}
                    >
                      {tx.amount >= 0 ? "+" : ""}{settings.symbol}{Math.abs(tx.amount).toLocaleString("id-ID", { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">{tx.description}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-gray-400">
                      {new Date(tx.createdAt).toLocaleString("id-ID")}
                      {tx.performedBy?.name ? ` • ${tx.performedBy.name}` : ""}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      Saldo: {settings.symbol}{tx.balanceAfter.toLocaleString("id-ID", { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
