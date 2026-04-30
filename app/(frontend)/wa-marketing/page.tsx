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
  CalendarClock,
  Trash2,
  AlertCircle,
  RefreshCw,
  Zap,
  Plus,
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

interface CampaignQueue {
  _id: string;
  campaignName: string;
  message: string;
  scheduledAt: string;
  status: string;
  targets: any[];
}

interface Service {
  _id: string;
  name: string;
}

interface AutomationRule {
  _id: string;
  name: string;
  category: "daily_report" | "stock_alert" | "membership_expiry" | "package_expiry" | "birthday";
  targetRole: "owner" | "admin" | "customer";
  scheduleTime?: string;
  daysBefore?: number;
  messageTemplate: string;
  isActive: boolean;
  lastRunDate?: string;
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
  const [activeTab, setActiveTab] = useState<"blast" | "history" | "automations">("blast");

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
  const [sendMode, setSendMode] = useState<"now" | "schedule">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [sending, setSending] = useState(false);
  const [blastResult, setBlastResult] = useState<{
    sent: number;
    failed: number;
    total: number;
  } | null>(null);

  // History & Queue
  const [blastLogs, setBlastLogs] = useState<BlastLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [upcomingCampaigns, setUpcomingCampaigns] = useState<CampaignQueue[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);

  // Automations
  const [automations, setAutomations] = useState<AutomationRule[]>([]);
  const [automationsLoading, setAutomationsLoading] = useState(false);
  const [showAddAutomation, setShowAddAutomation] = useState(false);
  const [autoForm, setAutoForm] = useState<Partial<AutomationRule>>({
    name: "",
    category: "daily_report",
    targetRole: "owner",
    scheduleTime: "09:00",
    daysBefore: 0,
    messageTemplate: "",
    isActive: true,
  });

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

  /* ────── Fetch upcoming queue ────── */
  const fetchQueue = useCallback(async () => {
    setQueueLoading(true);
    try {
      const res = await fetch("/api/wa/campaigns");
      const data = await res.json();
      if (data.success) setUpcomingCampaigns(data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setQueueLoading(false);
    }
  }, []);

  /* ────── Fetch automations ────── */
  const fetchAutomations = useCallback(async () => {
    setAutomationsLoading(true);
    try {
      const res = await fetch("/api/wa/automations");
      const data = await res.json();
      if (data.success) setAutomations(data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setAutomationsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "history") {
      fetchHistory();
      fetchQueue();
    }
    if (activeTab === "automations") {
      fetchAutomations();
    }
  }, [activeTab, fetchHistory, fetchQueue, fetchAutomations]);

  /* ────── Send blast ────── */
  const handleBlast = async () => {
    if (!message.trim()) return alert("Pesan tidak boleh kosong");
    if (selectedIds.size === 0) return alert("Pilih minimal 1 customer");

    if (sendMode === "schedule") {
      if (!scheduledAt) return alert("Pilih tanggal & waktu jadwal");
      const scheduleDate = new Date(scheduledAt);
      if (scheduleDate.getTime() < Date.now()) {
         return alert("Jadwal tidak boleh di masa lalu");
      }
      if (!confirm(`Jadwalkan blast untuk ${selectedIds.size} customer pada ${scheduleDate.toLocaleString("id-ID")}?`)) return;
      
      setSending(true);
      try {
        const res = await fetch("/api/wa/campaigns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerIds: Array.from(selectedIds),
            message,
            scheduledAt: scheduleDate.toISOString(),
            campaignName: campaignName || `Campaign ${new Date().toLocaleDateString("id-ID")}`,
            filters: { lastVisitSince, serviceId, membershipTier, birthdayMonth },
          }),
        });
        const data = await res.json();
        if (data.success) {
          alert("Campaign berhasil dijadwalkan!");
          setCampaignName("");
          setMessage("");
          setScheduledAt("");
        } else {
          alert(data.error || "Failed to schedule campaign");
        }
      } catch (err: any) {
        alert(err.message || "Failed to schedule campaign");
      } finally {
        setSending(false);
      }
      return;
    }

    // Manual Send Now
    if (
      !confirm(
        `PERINGATAN: Mengirim sekarang (Manual) akan memakan waktu lama (3 detik/pesan). JANGAN tutup halaman ini selama proses berjalan. Lanjutkan kirim ke ${selectedIds.size} customer?`
      )
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

  const cancelCampaign = async (id: string) => {
    if (!confirm("Batalkan jadwal campaign ini?")) return;
    try {
      const res = await fetch(`/api/wa/campaigns?id=${id}`, { method: "DELETE" });
      if (res.ok) fetchQueue();
    } catch (e) {
      console.error(e);
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
          <button
            onClick={() => setActiveTab("automations")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
              activeTab === "automations"
                ? "bg-white text-indigo-800 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Zap className="w-4 h-4" />
            Automations
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
                          className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                    />
                  </div>
                  <div className="pt-2 border-t border-gray-100 flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                      <div className="flex bg-gray-100 p-1 rounded-lg">
                        <button
                          onClick={() => setSendMode("now")}
                          className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
                            sendMode === "now"
                              ? "bg-white text-green-700 shadow-sm"
                              : "text-gray-500 hover:text-gray-700"
                          }`}
                        >
                          Kirim Sekarang
                        </button>
                        <button
                          onClick={() => setSendMode("schedule")}
                          className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
                            sendMode === "schedule"
                              ? "bg-white text-green-700 shadow-sm"
                              : "text-gray-500 hover:text-gray-700"
                          }`}
                        >
                          Jadwalkan
                        </button>
                      </div>
                      
                      {sendMode === "schedule" && (
                        <input
                          type="datetime-local"
                          value={scheduledAt}
                          onChange={(e) => setScheduledAt(e.target.value)}
                          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-green-500 outline-none"
                        />
                      )}
                    </div>
                    
                    {sendMode === "now" && (
                      <div className="bg-amber-50 text-amber-800 text-xs p-3 rounded-lg flex items-start gap-2 border border-amber-200">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <p>
                          <strong>Kirim Sekarang (Manual)</strong> memakan waktu lama (3 detik per pesan) dan <strong>wajib membiarkan browser tetap terbuka</strong> sampai selesai. Untuk audiens besar, gunakan mode Jadwalkan.
                        </p>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
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
                          sending || selectedIds.size === 0 || !message.trim() || (sendMode === "schedule" && !scheduledAt)
                        }
                        className={`flex items-center gap-2 px-6 py-2.5 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50 shadow-sm ${
                          sendMode === "schedule" ? "bg-indigo-600 hover:bg-indigo-700" : "bg-green-600 hover:bg-green-700"
                        }`}
                      >
                        {sending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : sendMode === "schedule" ? (
                          <CalendarClock className="w-4 h-4" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        {sending ? "Processing..." : sendMode === "schedule" ? "Jadwalkan Campaign" : "Kirim Blast Manual"}
                      </button>
                    </div>
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
          <div className="space-y-8">
            {/* Upcoming Campaigns Queue */}
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden border-indigo-100">
              <div className="p-4 bg-indigo-50/50 border-b border-indigo-100 flex items-center justify-between">
                <h2 className="text-sm font-bold text-indigo-900 flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-indigo-600" />
                  Upcoming Campaigns (Antrean)
                </h2>
                <button
                  onClick={fetchQueue}
                  className="text-indigo-600 hover:text-indigo-800"
                  title="Refresh Queue"
                >
                  <RefreshCw className={`w-4 h-4 ${queueLoading ? "animate-spin" : ""}`} />
                </button>
              </div>

              {upcomingCampaigns.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <CalendarClock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">Tidak ada antrean campaign yang dijadwalkan.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {upcomingCampaigns.map((camp) => {
                    const sentCount = camp.targets.filter(t => t.status === "sent").length;
                    const failedCount = camp.targets.filter(t => t.status === "failed").length;
                    const total = camp.targets.length;
                    const progress = total > 0 ? Math.round(((sentCount + failedCount) / total) * 100) : 0;

                    return (
                      <div key={camp._id} className="p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <h3 className="font-bold text-gray-900 text-sm">
                              {camp.campaignName}
                            </h3>
                            <div className="flex items-center gap-3 text-xs text-gray-500">
                              <span className="flex items-center gap-1 font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                                <Calendar className="w-3.5 h-3.5" />
                                {new Date(camp.scheduledAt).toLocaleString("id-ID")}
                              </span>
                              <span>
                                Target: <strong>{total}</strong> nomor
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 line-clamp-1 italic max-w-lg mt-1">
                              "{camp.message}"
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            {camp.status === "processing" ? (
                              <div className="text-right">
                                <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded animate-pulse">
                                  Processing
                                </span>
                                <div className="text-[10px] text-gray-500 mt-1">
                                  Progress: {progress}% ({sentCount}/{total})
                                </div>
                              </div>
                            ) : (
                              <div className="text-right flex items-center gap-3">
                                <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                                  Pending
                                </span>
                                <button
                                  onClick={() => cancelCampaign(camp._id)}
                                  className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Batalkan Jadwal"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        {camp.status === "processing" && (
                          <div className="w-full bg-gray-100 rounded-full h-1.5 mt-3 overflow-hidden">
                            <div className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Past History */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <History className="w-4 h-4 text-green-600" />
                  Past Blast History
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
          </div>
        )}

        {/* ────── AUTOMATIONS TAB ────── */}
        {activeTab === "automations" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-indigo-50 border border-indigo-100 p-4 rounded-xl">
              <div>
                <h2 className="text-indigo-900 font-bold flex items-center gap-2">
                  <Zap className="w-5 h-5 text-indigo-600" />
                  Automated WA Rules
                </h2>
                <p className="text-xs text-indigo-700 mt-1">Sistem akan mengeksekusi aturan ini secara otomatis di background.</p>
              </div>
              <button
                onClick={() => setShowAddAutomation(!showAddAutomation)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors shadow-sm"
              >
                {showAddAutomation ? <XCircle className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {showAddAutomation ? "Batal" : "Tambah Aturan"}
              </button>
            </div>

            {showAddAutomation && (
              <div className="bg-white p-6 rounded-xl border border-indigo-200 shadow-lg mb-6">
                <h3 className="font-bold text-gray-900 mb-4 border-b pb-2">Buat Aturan Automasi Baru</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Nama Aturan</label>
                    <input
                      type="text"
                      value={autoForm.name}
                      onChange={(e) => setAutoForm({ ...autoForm, name: e.target.value })}
                      placeholder="e.g. Laporan Harian Malam"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Kategori</label>
                    <select
                      value={autoForm.category}
                      onChange={(e) => setAutoForm({ ...autoForm, category: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="daily_report">Laporan Harian (Daily Report)</option>
                      <option value="stock_alert">Peringatan Stok (Stock Alert)</option>
                      <option value="membership_expiry">Membership Kedaluwarsa</option>
                      <option value="package_expiry">Paket Servis Kedaluwarsa</option>
                      <option value="birthday">Promo Ulang Tahun</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Target Role</label>
                    <select
                      value={autoForm.targetRole}
                      onChange={(e) => setAutoForm({ ...autoForm, targetRole: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="owner">Owner (BOS)</option>
                      <option value="admin">Admin</option>
                      <option value="customer">Customer Terkait</option>
                    </select>
                  </div>
                  {(autoForm.category === "daily_report" || autoForm.category === "stock_alert" || autoForm.category === "birthday") && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Jam Eksekusi Harian</label>
                      <input
                        type="time"
                        value={autoForm.scheduleTime}
                        onChange={(e) => setAutoForm({ ...autoForm, scheduleTime: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  )}
                  {(autoForm.category === "membership_expiry" || autoForm.category === "package_expiry") && (
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Kirim H- Berapa?</label>
                        <input
                          type="number"
                          value={autoForm.daysBefore}
                          onChange={(e) => setAutoForm({ ...autoForm, daysBefore: parseInt(e.target.value) || 0 })}
                          min="0"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Jam Eksekusi</label>
                        <input
                          type="time"
                          value={autoForm.scheduleTime}
                          onChange={(e) => setAutoForm({ ...autoForm, scheduleTime: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Pesan Template</label>
                  <p className="text-[10px] text-gray-500 mb-2">Gunakan {"{{nama_customer}}"} untuk nama pelanggan (jika target customer), {"{{total_revenue}}"} untuk report harian, {"{{items}}"} untuk list stok.</p>
                  <textarea
                    value={autoForm.messageTemplate}
                    onChange={(e) => setAutoForm({ ...autoForm, messageTemplate: e.target.value })}
                    rows={4}
                    placeholder="Contoh: Halo Boss, total pemasukan salon hari ini adalah Rp {{total_revenue}}"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={async () => {
                      if (!autoForm.name || !autoForm.messageTemplate) return alert("Nama dan Template harus diisi");
                      try {
                        const res = await fetch("/api/wa/automations", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(autoForm),
                        });
                        if (res.ok) {
                          setShowAddAutomation(false);
                          setAutoForm({ ...autoForm, name: "", messageTemplate: "" });
                          fetchAutomations();
                        } else alert("Gagal menyimpan");
                      } catch (e) { console.error(e); }
                    }}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors shadow-sm"
                  >
                    Simpan Aturan
                  </button>
                </div>
              </div>
            )}

            {automationsLoading ? (
              <div className="flex justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              </div>
            ) : automations.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-xl border border-gray-200 shadow-sm">
                <Zap className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">Belum ada aturan automasi yang aktif.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {automations.map((rule) => (
                  <div key={rule._id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col h-full relative group">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-bold text-gray-900 text-sm">{rule.name}</h3>
                        <span className="inline-block mt-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-bold rounded uppercase">
                          {rule.category.replace('_', ' ')}
                        </span>
                      </div>
                      <button
                        onClick={async () => {
                          const res = await fetch(`/api/wa/automations/${rule._id}`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ isActive: !rule.isActive }),
                          });
                          if (res.ok) fetchAutomations();
                        }}
                        className={`w-10 h-5 rounded-full relative transition-colors ${rule.isActive ? 'bg-indigo-500' : 'bg-gray-300'}`}
                      >
                        <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] transition-all ${rule.isActive ? 'left-[22px]' : 'left-[3px]'}`} />
                      </button>
                    </div>
                    
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-3 bg-gray-50 p-2 rounded-lg">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{rule.scheduleTime || "Setiap Jam"}</span>
                      <span className="mx-1 text-gray-300">•</span>
                      <Users className="w-3.5 h-3.5" />
                      <span className="capitalize">{rule.targetRole}</span>
                      {rule.daysBefore !== undefined && rule.daysBefore > 0 && (
                        <>
                          <span className="mx-1 text-gray-300">•</span>
                          <span>H-{rule.daysBefore}</span>
                        </>
                      )}
                    </div>
                    
                    <p className="text-xs text-gray-600 line-clamp-3 italic flex-1 bg-gray-50/50 p-2 rounded border border-gray-100">
                      "{rule.messageTemplate}"
                    </p>
                    
                    <button
                      onClick={async () => {
                        if (confirm("Hapus aturan ini?")) {
                          await fetch(`/api/wa/automations/${rule._id}`, { method: "DELETE" });
                          fetchAutomations();
                        }
                      }}
                      className="absolute bottom-4 right-4 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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
