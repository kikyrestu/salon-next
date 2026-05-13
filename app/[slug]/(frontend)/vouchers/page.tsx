"use client";


import { useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Tag,
  ChevronLeft,
  ChevronRight,
  Gift,
  Calendar,
  Hash,
} from "lucide-react";
import Modal from "@/components/dashboard/Modal";
import FormInput, {
  FormSelect,
  FormButton,
} from "@/components/dashboard/FormInput";
import { useSettings } from "@/components/providers/SettingsProvider";
import PermissionGate from "@/components/PermissionGate";

interface Voucher {
  _id: string;
  code: string;
  description?: string;
  discountType: "flat" | "percentage";
  discountValue: number;
  minPurchase: number;
  maxDiscount?: number;
  expiresAt?: string;
  usageLimit: number;
  usedCount: number;
  isActive: boolean;
  createdAt: string;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

const EMPTY_FORM = {
  code: "",
  description: "",
  discountType: "flat" as "flat" | "percentage",
  discountValue: 0,
  minPurchase: 0,
  maxDiscount: "",
  expiresAt: "",
  usageLimit: 1,
  isActive: true,
};

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default function VouchersPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { settings } = useSettings();

  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 20,
    pages: 0,
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<Voucher | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchVouchers = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({
        page: page.toString(),
        limit: "20",
        ...(search ? { search } : {}),
      });
      const res = await fetch(`/api/vouchers?${q}`, { headers: { "x-store-slug": slug } });
      const data = await res.json();
      if (data.success) {
        setVouchers(data.data || []);
        if (data.pagination) setPagination(data.pagination);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    void fetchVouchers();
  }, [fetchVouchers]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  // ── Modal helpers ─────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingVoucher(null);
    setFormData({ ...EMPTY_FORM, code: generateCode() });
    setIsModalOpen(true);
  };

  const openEdit = (v: Voucher) => {
    setEditingVoucher(v);
    setFormData({
      code: v.code,
      description: v.description || "",
      discountType: v.discountType,
      discountValue: v.discountValue,
      minPurchase: v.minPurchase,
      maxDiscount: v.maxDiscount ? String(v.maxDiscount) : "",
      expiresAt: v.expiresAt ? v.expiresAt.slice(0, 10) : "",
      usageLimit: v.usageLimit,
      isActive: v.isActive,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingVoucher(null);
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code.trim()) {
      alert("Kode voucher wajib diisi");
      return;
    }
    if (formData.discountValue <= 0) {
      alert("Nilai diskon harus lebih dari 0");
      return;
    }
    if (
      formData.discountType === "percentage" &&
      formData.discountValue > 100
    ) {
      alert("Diskon persentase tidak boleh melebihi 100%");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        maxDiscount: formData.maxDiscount
          ? Number(formData.maxDiscount)
          : undefined,
        expiresAt: formData.expiresAt || undefined,
      };
      const url = editingVoucher
        ? `/api/vouchers/${editingVoucher._id}`
        : "/api/vouchers";
      const res = await fetch(url, {
        method: editingVoucher ? "PUT" : "POST",
        headers: { "x-store-slug": slug, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        await fetchVouchers();
        closeModal();
      } else {
        alert(data.error || "Gagal menyimpan voucher");
      }
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Delete / Toggle ───────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    if (!confirm("Nonaktifkan voucher ini?")) return;
    const res = await fetch(`/api/vouchers/${id}`, { headers: { "x-store-slug": slug }, method: "DELETE" });
    const data = await res.json();
    if (data.success) void fetchVouchers();
    else alert(data.error || "Gagal menghapus");
  };

  const handleToggleActive = async (v: Voucher) => {
    const res = await fetch(`/api/vouchers/${v._id}`, {
      method: "PUT",
      headers: { "x-store-slug": slug, "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !v.isActive }),
    });
    const data = await res.json();
    if (data.success) void fetchVouchers();
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  const isExpired = (v: Voucher) =>
    !!v.expiresAt && new Date(v.expiresAt) < new Date();

  const usageExhausted = (v: Voucher) =>
    v.usageLimit > 0 && v.usedCount >= v.usageLimit;

  const statusBadge = (v: Voucher) => {
    if (!v.isActive)
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-gray-100 text-gray-500 border border-gray-200">
          Nonaktif
        </span>
      );
    if (isExpired(v))
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-50 text-red-600 border border-red-200">
          Kadaluarsa
        </span>
      );
    if (usageExhausted(v))
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-50 text-amber-600 border border-amber-200">
          Habis
        </span>
      );
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-green-50 text-green-700 border border-green-200">
        Aktif
      </span>
    );
  };

  const discountLabel = (v: Voucher) =>
    v.discountType === "flat"
      ? `${settings.symbol}${v.discountValue.toLocaleString("id-ID")}`
      : `${v.discountValue}%`;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Voucher &amp; Gift Card
            </h1>
            <p className="text-sm text-gray-500">
              Buat dan kelola kode diskon untuk customer
            </p>
          </div>
          <PermissionGate resource="vouchers" action="create">
            <button
              onClick={openCreate}
              className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-all flex items-center gap-2 shadow-sm font-semibold text-sm w-full sm:w-auto justify-center"
            >
              <Plus className="w-4 h-4" />
              Buat Voucher
            </button>
          </PermissionGate>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden text-black">
          {/* Filters */}
          <div className="p-4 border-b border-gray-200 flex flex-col md:flex-row gap-4 items-center justify-between bg-gray-50/50">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Cari kode voucher..."
                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-all text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              onClick={() => setSearch("")}
              className="text-gray-500 hover:text-gray-700 font-medium text-sm px-2 w-full sm:w-auto text-center"
            >
              Reset
            </button>
          </div>

          {/* Table - Desktop */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 hidden md:table">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Kode
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Diskon
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Min. Belanja
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Penggunaan
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Kadaluarsa
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {loading && vouchers.length === 0 ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={7} className="px-6 py-4">
                        <div className="h-4 bg-gray-100 rounded" />
                      </td>
                    </tr>
                  ))
                ) : vouchers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-12 text-center text-gray-500"
                    >
                      <Gift className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p>Belum ada voucher</p>
                    </td>
                  </tr>
                ) : (
                  vouchers.map((v) => (
                    <tr
                      key={v._id}
                      className="hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-blue-50 rounded-lg">
                            <Tag className="w-4 h-4 text-blue-900" />
                          </div>
                          <div>
                            <p className="text-sm font-black text-gray-900 tracking-widest">
                              {v.code}
                            </p>
                            {v.description && (
                              <p className="text-[10px] text-gray-400 truncate max-w-[140px]">
                                {v.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-bold text-blue-900">
                          {discountLabel(v)}
                        </span>
                        {v.discountType === "percentage" && v.maxDiscount && (
                          <p className="text-[10px] text-gray-400">
                            Maks {settings.symbol}
                            {v.maxDiscount.toLocaleString("id-ID")}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {v.minPurchase > 0
                          ? `${settings.symbol}${v.minPurchase.toLocaleString("id-ID")}`
                          : "—"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-700">
                          {v.usedCount}
                          {v.usageLimit > 0 ? ` / ${v.usageLimit}` : " / ∞"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {v.expiresAt ? (
                          <span
                            className={
                              isExpired(v)
                                ? "text-red-600 font-semibold"
                                : "text-gray-600"
                            }
                          >
                            {new Date(v.expiresAt).toLocaleDateString("id-ID")}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {statusBadge(v)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <PermissionGate resource="vouchers" action="edit">
                            <button
                              onClick={() => handleToggleActive(v)}
                              className={`px-2.5 py-1 text-[10px] font-bold rounded border transition-colors ${
                                v.isActive
                                  ? "bg-gray-50 border-gray-200 text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                                  : "bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                              }`}
                            >
                              {v.isActive ? "Nonaktifkan" : "Aktifkan"}
                            </button>
                          </PermissionGate>
                          <PermissionGate resource="vouchers" action="edit">
                            <button
                              onClick={() => openEdit(v)}
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          </PermissionGate>
                          <PermissionGate resource="vouchers" action="delete">
                            <button
                              onClick={() => handleDelete(v._id)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </PermissionGate>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Mobile Card */}
            <div className="md:hidden flex flex-col divide-y divide-gray-100">
              {loading && vouchers.length === 0 ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="p-4 animate-pulse space-y-2">
                    <div className="h-4 bg-gray-100 rounded w-1/3" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                  </div>
                ))
              ) : vouchers.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  <Gift className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>Belum ada voucher</p>
                </div>
              ) : (
                vouchers.map((v) => (
                  <div
                    key={v._id}
                    className="p-4 hover:bg-gray-50/50 transition-colors space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-base font-black text-gray-900 tracking-widest">
                            {v.code}
                          </p>
                          {statusBadge(v)}
                        </div>
                        {v.description && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {v.description}
                          </p>
                        )}
                      </div>
                      <span className="text-base font-black text-blue-900 flex-shrink-0">
                        {discountLabel(v)}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase font-bold mb-0.5">
                          Penggunaan
                        </p>
                        <p className="font-semibold text-gray-700">
                          {v.usedCount}/{v.usageLimit > 0 ? v.usageLimit : "∞"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase font-bold mb-0.5">
                          Min. Beli
                        </p>
                        <p className="font-semibold text-gray-700">
                          {v.minPurchase > 0
                            ? `${settings.symbol}${v.minPurchase.toLocaleString("id-ID")}`
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase font-bold mb-0.5">
                          Exp
                        </p>
                        <p
                          className={`font-semibold ${isExpired(v) ? "text-red-600" : "text-gray-700"}`}
                        >
                          {v.expiresAt
                            ? new Date(v.expiresAt).toLocaleDateString("id-ID")
                            : "—"}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => handleToggleActive(v)}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-colors ${
                          v.isActive
                            ? "bg-gray-50 border-gray-200 text-gray-600 hover:bg-red-50 hover:text-red-600"
                            : "bg-green-50 border-green-200 text-green-700"
                        }`}
                      >
                        {v.isActive ? "Nonaktifkan" : "Aktifkan"}
                      </button>
                      <button
                        onClick={() => openEdit(v)}
                        className="px-3 py-1.5 text-xs font-bold rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors flex items-center gap-1"
                      >
                        <Edit className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        onClick={() => handleDelete(v._id)}
                        className="px-3 py-1.5 text-xs font-bold rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition-colors flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="px-4 py-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-sm text-gray-500 font-medium">
                Showing <span className="text-gray-900">{vouchers.length}</span>{" "}
                of <span className="text-gray-900">{pagination.total}</span>
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => page > 1 && setPage(page - 1)}
                  disabled={page <= 1}
                  className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from(
                  { length: Math.min(5, pagination.pages) },
                  (_, i) => {
                    const pn =
                      pagination.pages <= 5
                        ? i + 1
                        : page <= 3
                          ? i + 1
                          : page >= pagination.pages - 2
                            ? pagination.pages - 4 + i
                            : page - 2 + i;
                    return (
                      <button
                        key={pn}
                        onClick={() => setPage(pn)}
                        className={`w-8 h-8 rounded-lg text-sm font-semibold transition-all ${
                          page === pn
                            ? "bg-blue-900 text-white"
                            : "text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        {pn}
                      </button>
                    );
                  },
                )}
                <button
                  onClick={() => page < pagination.pages && setPage(page + 1)}
                  disabled={page >= pagination.pages}
                  className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal Create/Edit ── */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingVoucher ? "Edit Voucher" : "Buat Voucher Baru"}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Kode */}
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <FormInput
                label="Kode Voucher"
                required
                value={formData.code}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    code: e.target.value.toUpperCase().replace(/\s/g, ""),
                  }))
                }
                placeholder="Contoh: DISKON50K"
              />
            </div>
            <button
              type="button"
              onClick={() =>
                setFormData((p) => ({ ...p, code: generateCode() }))
              }
              className="mb-1 px-3 py-2 text-xs font-bold border border-gray-200 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors flex items-center gap-1 flex-shrink-0"
            >
              <Hash className="w-3.5 h-3.5" /> Generate
            </button>
          </div>

          <FormInput
            label="Deskripsi (opsional)"
            value={formData.description}
            onChange={(e) =>
              setFormData((p) => ({ ...p, description: e.target.value }))
            }
            placeholder="Contoh: Voucher ulang tahun, Gift card, dll."
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormSelect
              label="Tipe Diskon"
              value={formData.discountType}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setFormData((p) => ({
                  ...p,
                  discountType: e.target.value as "flat" | "percentage",
                }))
              }
              options={[
                { value: "flat", label: "Nominal Tetap (Rp)" },
                { value: "percentage", label: "Persentase (%)" },
              ]}
            />
            <FormInput
              label={
                formData.discountType === "flat"
                  ? `Nilai Diskon (${settings.symbol})`
                  : "Nilai Diskon (%)"
              }
              type="number"
              required
              min="0"
              max={formData.discountType === "percentage" ? "100" : undefined}
              value={formData.discountValue}
              onChange={(e) =>
                setFormData((p) => ({
                  ...p,
                  discountValue: parseFloat(e.target.value) || 0,
                }))
              }
            />
          </div>

          {formData.discountType === "percentage" && (
            <FormInput
              label={`Maksimum Diskon (${settings.symbol}) — opsional`}
              type="number"
              min="0"
              value={formData.maxDiscount}
              onChange={(e) =>
                setFormData((p) => ({ ...p, maxDiscount: e.target.value }))
              }
              placeholder="Kosongkan jika tidak ada batas"
            />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput
              label={`Minimum Pembelian (${settings.symbol})`}
              type="number"
              min="0"
              value={formData.minPurchase}
              onChange={(e) =>
                setFormData((p) => ({
                  ...p,
                  minPurchase: parseFloat(e.target.value) || 0,
                }))
              }
            />
            <FormInput
              label="Batas Penggunaan (0 = tidak terbatas)"
              type="number"
              min="0"
              value={formData.usageLimit}
              onChange={(e) =>
                setFormData((p) => ({
                  ...p,
                  usageLimit: parseInt(e.target.value) || 0,
                }))
              }
            />
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Tanggal Kadaluarsa (opsional)
              </label>
              <input
                type="date"
                value={formData.expiresAt}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, expiresAt: e.target.value }))
                }
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
              />
            </div>
          </div>

          {editingVoucher && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, isActive: e.target.checked }))
                  }
                  className="w-4 h-4 accent-blue-900"
                />
                Voucher Aktif
              </label>
              <p className="text-xs text-gray-400">
                Nonaktifkan untuk mencegah penggunaan tanpa menghapus data.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Batal
            </button>
            <FormButton type="submit" loading={submitting} variant="primary">
              {editingVoucher ? "Simpan Perubahan" : "Buat Voucher"}
            </FormButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
