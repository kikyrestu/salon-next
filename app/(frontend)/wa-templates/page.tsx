"use client";

import { useEffect, useMemo, useState } from "react";
import { Edit, Plus, Search, Trash2, MessageSquareText, Phone, ChevronLeft, ChevronRight } from "lucide-react";
import Modal from "@/components/dashboard/Modal";
import FormInput, { FormButton, FormSelect, FormTextArea } from "@/components/dashboard/FormInput";
import PermissionGate from "@/components/PermissionGate";

interface WaTemplate {
    _id: string;
    name: string;
    message: string;
    templateType?: 'greeting' | 'follow_up';
    isGreetingEnabled?: boolean;
    createdAt: string;
}

interface FollowUpPhoneRow {
    phoneNumber: string;
    isActive: boolean;
    totalSessions: number;
    pendingCount: number;
    sentCount: number;
    failedCount: number;
    lastScheduledAt?: string;
    firstCreatedAt?: string;
}

const SAMPLE_VALUES: Record<string, string> = {
    nama_customer: "Rani Putri",
    nama_service: "Hair Spa",
};

const renderPreview = (message: string) => {
    return message.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key: string) => SAMPLE_VALUES[key] || "");
};

export default function WaTemplatesPage() {
    const [templates, setTemplates] = useState<WaTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [activeTab, setActiveTab] = useState<"templates" | "followup-sessions">("templates");

    const [followUpRows, setFollowUpRows] = useState<FollowUpPhoneRow[]>([]);
    const [followUpLoading, setFollowUpLoading] = useState(false);
    const [followUpSearch, setFollowUpSearch] = useState("");
    const [followUpPage, setFollowUpPage] = useState(1);
    const [followUpLimit, setFollowUpLimit] = useState(5);
    const [followUpPagination, setFollowUpPagination] = useState({ total: 0, page: 1, limit: 5, pages: 1 });

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<WaTemplate | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        name: "",
        message: "",
        templateType: "follow_up",
        isGreetingEnabled: false,
    });

    const previewMessage = useMemo(() => renderPreview(formData.message), [formData.message]);
    const activeGreetingTemplate = useMemo(
        () => templates.find((template) => template.isGreetingEnabled && (template.templateType === 'greeting' || !template.templateType)),
        [templates]
    );

    useEffect(() => {
        if (activeTab === "templates") {
            fetchTemplates();
        }
    }, []);

    const fetchTemplates = async () => {
        setLoading(true);
        try {
            const query = new URLSearchParams();
            if (search.trim()) query.append("search", search.trim());

            const res = await fetch(`/api/wa/templates?${query.toString()}`);
            const data = await res.json();
            if (data.success) {
                setTemplates(data.data || []);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab !== "templates") return;

        const timer = setTimeout(() => {
            fetchTemplates();
        }, 300);

        return () => clearTimeout(timer);
    }, [search, activeTab]);

    const fetchFollowUpSessions = async () => {
        setFollowUpLoading(true);
        try {
            const query = new URLSearchParams();
            query.append("page", String(followUpPage));
            query.append("limit", String(followUpLimit));
            if (followUpSearch.trim()) query.append("search", followUpSearch.trim());

            const res = await fetch(`/api/wa/follow-up-sessions?${query.toString()}`);
            const data = await res.json();
            if (data.success) {
                setFollowUpRows(data.data || []);
                if (data.pagination) {
                    setFollowUpPagination(data.pagination);
                }
            }
        } finally {
            setFollowUpLoading(false);
        }
    };

    const handleToggleFollowUpStatus = async (row: FollowUpPhoneRow) => {
        const res = await fetch('/api/wa/follow-up-sessions', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phoneNumber: row.phoneNumber,
                isActive: !row.isActive,
            }),
        });

        const data = await res.json();
        if (!data.success) {
            alert(data.error || 'Gagal update status nomor follow-up');
            return;
        }

        setFollowUpRows((prev) =>
            prev.map((item) =>
                item.phoneNumber === row.phoneNumber
                    ? { ...item, isActive: !item.isActive }
                    : item
            )
        );
    };

    useEffect(() => {
        if (activeTab !== "followup-sessions") return;

        const timer = setTimeout(() => {
            fetchFollowUpSessions();
        }, 300);

        return () => clearTimeout(timer);
    }, [activeTab, followUpPage, followUpLimit, followUpSearch]);

    const openModal = (template?: WaTemplate) => {
        if (template) {
            setEditingTemplate(template);
            setFormData({
                name: template.name,
                message: template.message,
                templateType: template.templateType || (template.isGreetingEnabled ? 'greeting' : 'follow_up'),
                isGreetingEnabled: Boolean(template.isGreetingEnabled),
            });
        } else {
            setEditingTemplate(null);
            setFormData({
                name: "",
                message: "Halo {{nama_customer}}, terima kasih sudah menggunakan layanan {{nama_service}} di salon kami.",
                templateType: "follow_up",
                isGreetingEnabled: false,
            });
        }

        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingTemplate(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const url = editingTemplate ? `/api/wa/templates/${editingTemplate._id}` : "/api/wa/templates";
            const method = editingTemplate ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...formData,
                    isGreetingEnabled: formData.templateType === 'greeting' ? formData.isGreetingEnabled : false,
                }),
            });

            const data = await res.json();
            if (!data.success) {
                alert(data.error || "Gagal menyimpan template");
                return;
            }

            closeModal();
            await fetchTemplates();
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Hapus template ini?")) return;

        const res = await fetch(`/api/wa/templates/${id}`, { method: "DELETE" });
        const data = await res.json();
        if (!data.success) {
            alert(data.error || "Gagal menghapus template");
            return;
        }

        await fetchTemplates();
    };

    const handleToggleGreeting = async (template: WaTemplate) => {
        const res = await fetch(`/api/wa/templates/${template._id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: template.name,
                message: template.message,
                templateType: 'greeting',
                isGreetingEnabled: !template.isGreetingEnabled,
            }),
        });

        const data = await res.json();
        if (!data.success) {
            alert(data.error || "Gagal update status greeting");
            return;
        }

        await fetchTemplates();

        if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("wa-greeting-status-changed"));
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Manajemen Template WA</h1>
                    <p className="text-sm text-gray-500">Kelola template pesan follow up WhatsApp untuk automasi Fonnte.</p>
                </div>
                <PermissionGate resource="services" action="create">
                    <button
                        onClick={() => openModal()}
                        className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-all flex items-center gap-2 font-semibold"
                    >
                        <Plus className="w-4 h-4" />
                        Template Baru
                    </button>
                </PermissionGate>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-2">
                <div className="inline-flex w-full sm:w-auto rounded-lg border border-gray-200 overflow-hidden">
                    <button
                        type="button"
                        onClick={() => setActiveTab("templates")}
                        className={`px-4 py-2 text-sm font-semibold ${activeTab === "templates" ? "bg-blue-900 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
                    >
                        Template WA
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setActiveTab("followup-sessions");
                            setFollowUpPage(1);
                        }}
                        className={`px-4 py-2 text-sm font-semibold ${activeTab === "followup-sessions" ? "bg-blue-900 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
                    >
                        Nomor Follow Up
                    </button>
                </div>
            </div>

            {activeTab === "templates" && (
                <>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                {activeGreetingTemplate ? (
                    <div className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                        <span className="font-semibold">Greeting aktif saat ini:</span> {activeGreetingTemplate.name}
                    </div>
                ) : (
                    <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        Belum ada template greeting yang aktif. Aktifkan salah satu template untuk auto greeting.
                    </div>
                )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Cari template..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
                    />
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-8 text-sm text-gray-500">Memuat template...</div>
                ) : templates.length === 0 ? (
                    <div className="p-10 text-center text-gray-500">
                        <MessageSquareText className="w-10 h-10 mx-auto mb-2 opacity-40" />
                        Belum ada template WA.
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {templates.map((template) => (
                            <div key={template._id} className="p-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                <div className="space-y-2 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="font-semibold text-gray-900">{template.name}</h3>
                                        <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full border ${template.templateType === 'greeting' || (!template.templateType && template.isGreetingEnabled)
                                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                                            : 'bg-purple-50 text-purple-700 border-purple-200'
                                            }`}>
                                            {template.templateType === 'greeting' || (!template.templateType && template.isGreetingEnabled) ? 'Greeting' : 'Follow Up'}
                                        </span>
                                        {template.isGreetingEnabled && (
                                            <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                Greeting Active
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{template.message}</p>
                                    <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-2">
                                        <div className="font-semibold text-gray-700 mb-1">Preview:</div>
                                        {renderPreview(template.message)}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    {(template.templateType === 'greeting' || (!template.templateType && template.isGreetingEnabled)) && (
                                        <PermissionGate resource="services" action="edit">
                                            <button
                                                onClick={() => handleToggleGreeting(template)}
                                                className={`px-3 py-2 border rounded-lg text-sm flex items-center gap-1 ${template.isGreetingEnabled
                                                        ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                                        : "border-gray-300 text-gray-700 hover:bg-gray-50"
                                                    }`}
                                            >
                                                <MessageSquareText className="w-4 h-4" /> {template.isGreetingEnabled ? "ON Greeting" : "OFF Greeting"}
                                            </button>
                                        </PermissionGate>
                                    )}
                                    <PermissionGate resource="services" action="edit">
                                        <button
                                            onClick={() => openModal(template)}
                                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-1"
                                        >
                                            <Edit className="w-4 h-4" /> Edit
                                        </button>
                                    </PermissionGate>
                                    <PermissionGate resource="services" action="delete">
                                        <button
                                            onClick={() => handleDelete(template._id)}
                                            className="px-3 py-2 border border-red-200 rounded-lg text-sm text-red-600 hover:bg-red-50 flex items-center gap-1"
                                        >
                                            <Trash2 className="w-4 h-4" /> Hapus
                                        </button>
                                    </PermissionGate>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
                </>
            )}

            {activeTab === "followup-sessions" && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-gray-200 bg-gray-50/50 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="relative max-w-md w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                value={followUpSearch}
                                onChange={(e) => {
                                    setFollowUpPage(1);
                                    setFollowUpSearch(e.target.value);
                                }}
                                placeholder="Cari nomor..."
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
                            />
                        </div>

                        <div className="flex items-center gap-2 text-sm">
                            <span className="text-gray-600">Tampilkan</span>
                            <select
                                value={followUpLimit}
                                onChange={(e) => {
                                    setFollowUpPage(1);
                                    setFollowUpLimit(parseInt(e.target.value));
                                }}
                                className="border border-gray-300 rounded-lg px-2 py-1.5"
                            >
                                <option value={5}>5</option>
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                            </select>
                            <span className="text-gray-600">data</span>
                        </div>
                    </div>

                    {followUpLoading ? (
                        <div className="p-8 text-sm text-gray-500">Memuat nomor follow-up...</div>
                    ) : followUpRows.length === 0 ? (
                        <div className="p-10 text-center text-gray-500">
                            <Phone className="w-10 h-10 mx-auto mb-2 opacity-40" />
                            Belum ada nomor pada sesi follow-up.
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Nomor</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Sesi</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Pending</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Sent</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Failed</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Terakhir Dijadwalkan</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-100">
                                        {followUpRows.map((row) => (
                                            <tr key={row.phoneNumber} className="hover:bg-gray-50/50">
                                                <td className="px-4 py-3 text-sm font-semibold text-gray-900">{row.phoneNumber}</td>
                                                <td className="px-4 py-3 text-sm">
                                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold border ${row.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                                                        {row.isActive ? 'ACTIVE' : 'INACTIVE'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-700">{row.totalSessions}</td>
                                                <td className="px-4 py-3 text-sm text-amber-700 font-semibold">{row.pendingCount}</td>
                                                <td className="px-4 py-3 text-sm text-emerald-700 font-semibold">{row.sentCount}</td>
                                                <td className="px-4 py-3 text-sm text-red-700 font-semibold">{row.failedCount}</td>
                                                <td className="px-4 py-3 text-sm text-gray-600">
                                                    {row.lastScheduledAt ? new Date(row.lastScheduledAt).toLocaleString('id-ID') : '-'}
                                                </td>
                                                <td className="px-4 py-3 text-sm">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggleFollowUpStatus(row)}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${row.isActive ? 'border-gray-300 text-gray-700 hover:bg-gray-100' : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'}`}
                                                    >
                                                        {row.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex flex-col sm:flex-row items-center justify-between gap-3">
                                <div className="text-sm text-gray-600">
                                    Total nomor: <span className="font-semibold text-gray-900">{followUpPagination.total}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setFollowUpPage((prev) => Math.max(1, prev - 1))}
                                        disabled={followUpPagination.page <= 1}
                                        className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <span className="text-sm text-gray-700">
                                        Halaman {followUpPagination.page} / {followUpPagination.pages}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setFollowUpPage((prev) => Math.min(followUpPagination.pages, prev + 1))}
                                        disabled={followUpPagination.page >= followUpPagination.pages}
                                        className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            <Modal isOpen={isModalOpen} onClose={closeModal} title={editingTemplate ? "Edit Template WA" : "Tambah Template WA"}>
                <form onSubmit={handleSubmit}>
                    <FormInput
                        label="Nama Template"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Contoh: Follow Up 3 Hari"
                    />
                    <FormTextArea
                        label="Isi Pesan"
                        required
                        rows={5}
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        placeholder="Gunakan variabel: {{nama_customer}}, {{nama_service}}"
                    />
                    <FormSelect
                        label="Tipe Template"
                        value={formData.templateType}
                        onChange={(e: any) => setFormData({
                            ...formData,
                            templateType: e.target.value,
                            isGreetingEnabled: e.target.value === 'greeting' ? formData.isGreetingEnabled : false,
                        })}
                        options={[
                            { value: "follow_up", label: "Follow Up" },
                            { value: "greeting", label: "Greeting" },
                        ]}
                    />
                    {formData.templateType === 'greeting' && (
                        <label className="flex items-center gap-2 text-sm text-gray-700 mb-4">
                            <input
                                type="checkbox"
                                checked={formData.isGreetingEnabled}
                                onChange={(e) => setFormData({ ...formData, isGreetingEnabled: e.target.checked })}
                            />
                            Gunakan template ini sebagai auto greeting (ON)
                        </label>
                    )}
                    <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
                        <div className="font-semibold text-gray-700 mb-1">Preview dengan data contoh:</div>
                        <div className="whitespace-pre-wrap">{previewMessage}</div>
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                        <button
                            type="button"
                            onClick={closeModal}
                            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                        >
                            Batal
                        </button>
                        <FormButton type="submit" loading={submitting}>
                            {editingTemplate ? "Update" : "Simpan"}
                        </FormButton>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
