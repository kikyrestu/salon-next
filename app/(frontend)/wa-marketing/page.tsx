"use client";

import { useState, useEffect, useCallback } from "react";
import {
  MessageSquare,
  Send,
  Users,
  Filter,
  Calendar,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  History,
  Megaphone,
  Search,
  Crown,
  Phone,
  Clock,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CustomerTarget {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  membershipTier: string;
  waNotifEnabled?: boolean;
}

interface BlastLog {
  _id: string;
  campaignName: string;
  message: string;
  targetCount: number;
  sentCount: number;
  failedCount: number;
  sentBy?: { name: string };
  createdAt: string;
}

interface Service {
  _id: string;
  name: string;
}

/* ------------------------------------------------------------------ */
/*  Tier config                                                        */
/* ------------------------------------------------------------------ */

const MEMBERSHIP_TIERS = [
  { value: "", label: "All Tiers" },
  { value: "regular", label: "Regular" },
  { value: "silver", label: "Silver" },
  { value: "gold", label: "Gold" },
  { value: "platinum", label: "Platinum" },
  { value: "premium", label: "Premium" },
];

const TIER_COLORS: Record<string, string> = {
  regular: "bg-gray-100 text-gray-700",
  silver: "bg-gray-200 text-gray-800",
  gold: "bg-amber-100 text-amber-800",
  platinum: "bg-violet-100 text-violet-800",
  premium: "bg-pink-100 text-pink-800",
};

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

export default function WAMarketingPage() {
  // Tab state
  const [activeTab, setActiveTab] = useState<"blast" | "history">("blast");

  // Filters
  const [lastVisitSince, setLastVisitSince] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [membershipTier, setMembershipTier] = useState("");
  const [birthdayMonth, setBirthdayMonth] = useState("");
  const [showFilters, setShowFilters] = useState(true);

  // Target list
  const [targets, setTargets] = useState<CustomerTarget[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  // Blast form
  const [campaignName, setCampaignName] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [blastResult, setBlastResult] = useState<{
    sent: number;
    failed: number;
    total: number;
  } | null>(null);

  // History
  const [blastLogs, setBlastLogs] = useState<BlastLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Services dropdown
  const [services, setServices] = useState<Service[]>([]);

  /* ────── Load services ────── */
  useEffect(() => {
    fetch("/api/services?limit=200")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setServices(d.data || []);
      })
      .catch(console.error);
  }, []);

  /* ────── Fetch targets ────── */
  const fetchTargets = useCallback(async () => {
    setLoading(true);
    setBlastResult(null);
    try {
      const params = new URLSearchParams();
      if (lastVisitSince) params.set("lastVisitSince", lastVisitSince);
      if (serviceId) params.set("serviceId", serviceId);
      if (membershipTier) params.set("membershipTier", membershipTier);
      if (birthdayMonth) params.set("birthdayMonth", birthdayMonth);

      const res = await fetch(`/api/wa/blast-targets?${params}`);
      const data = await res.json();
      if (data.success) {
        setTargets(data.data || []);
        setSelectedIds(
          new Set((data.data || []).map((c: CustomerTarget) => c._id))
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [lastVisitSince, serviceId, membershipTier, birthdayMonth]);

  /* ────── Fetch blast history ────── */
  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/wa/blast-logs?limit=20");
      const data = await res.json();
      if (data.success) setBlastLogs(data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "history") fetchHistory();
  }, [activeTab, fetchHistory]);

  /* ────── Send blast ────── */
  const handleBlast = async () => {
    if (!message.trim()) return alert("Pesan tidak boleh kosong");
    if (selectedIds.size === 0) return alert("Pilih minimal 1 customer");
    if (
      !confirm(`Kirim WA blast ke ${selectedIds.size} customer? Lanjutkan?`)
    )
      return;

    setSending(true);
    setBlastResult(null);
    try {
      const res = await fetch("/api/wa/blast-targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerIds: Array.from(selectedIds),
          message,
          campaignName:
            campaignName ||
            `Blast ${new Date().toLocaleDateString("id-ID")}`,
          filters: { lastVisitSince, serviceId, membershipTier, birthdayMonth },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setBlastResult(data);
      } else {
        alert(data.error || "Blast failed");
      }
    } catch (err: any) {
      alert(err.message || "Blast failed");
    } finally {
      setSending(false);
    }
  };

  /* ────── Select / Deselect ────── */
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === targets.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(targets.map((t) => t._id)));
    }
  };

  const enabledTargets = targets.filter((t) => t.waNotifEnabled !== false);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* ────── Header ────── */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-green-500 to-emerald-700 rounded-xl shadow-lg shadow-green-500/20">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            WA Marketing
          </h1>
          <p className="text-sm text-gray-500 mt-1.5 ml-[52px]">
            Blast WA marketing & automated notifications to your customers
          </p>
        </div>

        {/* ────── Tabs ────── */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab("blast")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
              activeTab === "blast"
                ? "bg-white text-green-800 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Megaphone className="w-4 h-4" />
            Blast Campaign
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
              activeTab === "history"
                ? "bg-white text-green-800 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <History className="w-4 h-4" />
            Blast History
          </button>
        </div>

        {/* ────── BLAST TAB ────── */}
        {activeTab === "blast" && (
          <div className="space-y-5">
            {/* Filters */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="w-full px-6 py-4 flex items-center justify-between border-b border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors"
              >
                <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Filter className="w-4 h-4 text-green-600" />
                  Filter Target Customer
                </h2>
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 transition-transform ${
                    showFilters ? "rotate-180" : ""
                  }`}
                />
              </button>
              {showFilters && (
                <div className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                        Kunjungan Terakhir Sejak
                      </label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="date"
                          value={lastVisitSince}
                          onChange={(e) => setLastVisitSince(e.target.value)}
                          className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                        Pernah Pakai Service
                      </label>
                      <select
                        value={serviceId}
                        onChange={(e) => setServiceId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
                      >
                        <option value="">Semua Service</option>
                        {services.map((s) => (
                          <option key={s._id} value={s._id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                        Membership Tier
                      </label>
                      <select
                        value={membershipTier}
                        onChange={(e) => setMembershipTier(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
                      >
                        {MEMBERSHIP_TIERS.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                        Bulan Ulang Tahun
                      </label>
                      <select
                        value={birthdayMonth}
                        onChange={(e) => setBirthdayMonth(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
                      >
                        <option value="">Semua Bulan</option>
                        {[
                          "Jan",
                          "Feb",
                          "Mar",
                          "Apr",
                          "May",
                          "Jun",
                          "Jul",
                          "Aug",
                          "Sep",
                          "Oct",
                          "Nov",
                          "Dec",
                        ].map((m, i) => (
                          <option key={i + 1} value={i + 1}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={fetchTargets}
                      disabled={loading}
                      className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 shadow-sm"
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                      Cari Customer
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Target list */}
            {targets.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-green-600" />
                    <h2 className="text-sm font-bold text-gray-900">
                      Target Customer
                    </h2>
                    <span className="text-xs bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded-full">
                      {selectedIds.size} / {targets.length} dipilih
                    </span>
                  </div>
                  <button
                    onClick={selectAll}
                    className="text-xs font-semibold text-green-700 hover:text-green-800"
                  >
                    {selectedIds.size === targets.length
                      ? "Unselect All"
                      : "Select All"}
                  </button>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
                  {targets.map((target) => {
                    const isSelected = selectedIds.has(target._id);
                    const disabled = target.waNotifEnabled === false;
                    return (
                      <div
                        key={target._id}
                        onClick={() => !disabled && toggleSelect(target._id)}
                        className={`flex items-center gap-3 px-6 py-3 cursor-pointer transition-colors ${
                          disabled
                            ? "opacity-40 cursor-not-allowed"
                            : isSelected
                            ? "bg-green-50/50"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={disabled}
                          onChange={() => {}}
                          className="w-4 h-4 rounded text-green-600 focus:ring-green-500"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {target.name}
                          </p>
                          <p className="text-xs text-gray-400 flex items-center gap-1.5">
                            <Phone className="w-3 h-3" />
                            {target.phone}
                          </p>
                        </div>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                            TIER_COLORS[target.membershipTier] ||
                            "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {target.membershipTier}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Message composer */}
            {targets.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                  <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <Send className="w-4 h-4 text-green-600" />
                    Compose Message
                  </h2>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      Campaign Name (opsional)
                    </label>
                    <input
                      type="text"
                      value={campaignName}
                      onChange={(e) => setCampaignName(e.target.value)}
                      placeholder="e.g. Promo Lebaran 2025"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      Message{" "}
                      <span className="text-gray-400 font-normal">
                        — gunakan {"{{nama_customer}}"} untuk personalisasi
                      </span>
                    </label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={5}
                      placeholder={`Halo {{nama_customer}}, kami punya promo spesial untuk Anda!`}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <p className="text-xs text-gray-500">
                      Akan mengirim ke{" "}
                      <span className="font-bold text-gray-900">
                        {selectedIds.size}
                      </span>{" "}
                      customer
                    </p>
                    <button
                      onClick={handleBlast}
                      disabled={
                        sending || selectedIds.size === 0 || !message.trim()
                      }
                      className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 transition-colors disabled:opacity-50 shadow-sm"
                    >
                      {sending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                      {sending ? "Sending..." : "Kirim Blast WA"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Blast result */}
            {blastResult && (
              <div
                className={`bg-white rounded-xl border shadow-sm overflow-hidden ${
                  blastResult.failed > 0
                    ? "border-amber-200"
                    : "border-green-200"
                }`}
              >
                <div
                  className={`px-6 py-4 ${
                    blastResult.failed > 0
                      ? "bg-amber-50 border-b border-amber-100"
                      : "bg-green-50 border-b border-green-100"
                  }`}
                >
                  <h2 className="text-sm font-bold flex items-center gap-2">
                    {blastResult.failed > 0 ? (
                      <>
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                        <span className="text-amber-800">
                          Partially Sent
                        </span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                        <span className="text-green-800">
                          Blast Sent Successfully!
                        </span>
                      </>
                    )}
                  </h2>
                </div>
                <div className="p-6 grid grid-cols-3 gap-4">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-gray-900">
                      {blastResult.total}
                    </p>
                    <p className="text-xs text-gray-500 font-medium">
                      Total Target
                    </p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-green-700">
                      {blastResult.sent}
                    </p>
                    <p className="text-xs text-green-600 font-medium">
                      Sent
                    </p>
                  </div>
                  <div
                    className={`rounded-lg p-3 text-center ${
                      blastResult.failed > 0 ? "bg-red-50" : "bg-gray-50"
                    }`}
                  >
                    <p
                      className={`text-2xl font-bold ${
                        blastResult.failed > 0 ? "text-red-700" : "text-gray-400"
                      }`}
                    >
                      {blastResult.failed}
                    </p>
                    <p
                      className={`text-xs font-medium ${
                        blastResult.failed > 0 ? "text-red-600" : "text-gray-400"
                      }`}
                    >
                      Failed
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ────── HISTORY TAB ────── */}
        {activeTab === "history" && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <History className="w-4 h-4 text-green-600" />
                Blast History
              </h2>
            </div>
            {historyLoading ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="w-6 h-6 animate-spin text-green-500" />
              </div>
            ) : blastLogs.length === 0 ? (
              <div className="p-12 text-center text-gray-400 text-sm">
                Belum ada blast yang dikirim
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {blastLogs.map((log) => (
                  <div
                    key={log._id}
                    className="px-6 py-4 hover:bg-gray-50/50 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">
                          {log.campaignName}
                        </p>
                        <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">
                          {log.message}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center gap-1.5 text-xs">
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                          <span className="font-bold text-green-700">
                            {log.sentCount}
                          </span>
                        </div>
                        {log.failedCount > 0 && (
                          <div className="flex items-center gap-1.5 text-xs">
                            <XCircle className="w-3.5 h-3.5 text-red-400" />
                            <span className="font-bold text-red-600">
                              {log.failedCount}
                            </span>
                          </div>
                        )}
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(log.createdAt).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
