"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Edit, Scissors } from "lucide-react";
import SearchableSelect from "@/components/dashboard/SearchableSelect";
import Modal from "@/components/dashboard/Modal";
import { FormButton } from "@/components/dashboard/FormInput";
import ImageUpload from "@/components/dashboard/ImageUpload";
import { useSettings } from "@/components/providers/SettingsProvider";
import PermissionGate from "@/components/PermissionGate";

interface ServiceItem {
  _id: string;
  name: string;
  price: number;
  duration: number;
  commissionType?: "percentage" | "fixed";
  commissionValue?: number;
}

interface BundleService {
  service: string | { _id: string; name: string; price: number; duration: number; commissionType?: string; commissionValue?: number };
  serviceName: string;
  servicePrice: number;
  duration: number;
  commissionType?: "percentage" | "fixed";
  commissionValue?: number;
}

interface ServiceBundle {
  _id: string;
  name: string;
  description?: string;
  price: number;
  image?: string;
  isActive: boolean;
  services: BundleService[];
}

interface FormServiceItem {
  serviceId: string;
  serviceName: string;
  servicePrice: number;
  duration: number;
  commissionType: "percentage" | "fixed";
  commissionValue: number | string;
}

export default function BundlesPage() {
  const { settings } = useSettings();

  const [services, setServices] = useState<ServiceItem[]>([]);
  const [bundles, setBundles] = useState<ServiceBundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBundle, setEditingBundle] = useState<ServiceBundle | null>(null);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPrice, setFormPrice] = useState<number | string>("");
  const [formImage, setFormImage] = useState("");
  const [formServices, setFormServices] = useState<FormServiceItem[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [serviceRes, bundleRes] = await Promise.all([
        fetch("/api/services/bundle-list"),
        fetch("/api/service-bundles"),
      ]);

      const serviceData = await serviceRes.json();
      const bundleData = await bundleRes.json();

      if (serviceData.success) setServices(serviceData.data || []);
      if (bundleData.success) setBundles(bundleData.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setFormName("");
    setFormDescription("");
    setFormPrice("");
    setFormImage("");
    setFormServices([]);
    setEditingBundle(null);
  };

  const addServiceItem = () => {
    setFormServices((prev) => [
      ...prev,
      { serviceId: "", serviceName: "", servicePrice: 0, duration: 0, commissionType: "fixed", commissionValue: 0 },
    ]);
  };

  const removeServiceItem = (index: number) => {
    setFormServices((prev) => prev.filter((_, idx) => idx !== index));
  };

  const updateServiceItem = (index: number, patch: Partial<FormServiceItem>) => {
    setFormServices((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const updated = { ...item, ...patch };

        // Auto-fill service details when service is selected
        if (patch.serviceId) {
          const svc = services.find((s) => s._id === patch.serviceId);
          if (svc) {
            updated.serviceName = svc.name;
            updated.servicePrice = svc.price;
            updated.duration = svc.duration;
            updated.commissionType = (svc.commissionType as "percentage" | "fixed") || "fixed";
            updated.commissionValue = svc.commissionValue || 0;
          }
        }

        return updated;
      })
    );
  };

  const calculateOriginalTotal = () => {
    return formServices.reduce((sum, s) => sum + (Number(s.servicePrice) || 0), 0);
  };

  const saveBundle = async () => {
    if (!formName || formServices.length === 0) {
      alert("Lengkapi nama bundle dan minimal 1 service");
      return;
    }

    const hasInvalidItem = formServices.some((item) => !item.serviceId);
    if (hasInvalidItem) {
      alert("Semua item harus punya service yang dipilih");
      return;
    }

    setSaving(true);
    try {
      const url = editingBundle
        ? `/api/service-bundles/${editingBundle._id}`
        : "/api/service-bundles";

      const res = await fetch(url, {
        method: editingBundle ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          description: formDescription,
          price: Number(formPrice || 0),
          image: formImage || undefined,
          services: formServices.map((s) => ({
            service: s.serviceId,
            serviceName: s.serviceName,
            servicePrice: Number(s.servicePrice),
            duration: Number(s.duration),
            commissionType: s.commissionType,
            commissionValue: Number(s.commissionValue || 0),
          })),
        }),
      });

      const data = await res.json();
      if (!data.success) {
        alert(data.error || "Gagal menyimpan bundle");
        return;
      }

      resetForm();
      setIsModalOpen(false);
      await loadData();
    } catch (error) {
      console.error(error);
      alert("Gagal menyimpan bundle");
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (bundle: ServiceBundle) => {
    setEditingBundle(bundle);
    setFormName(bundle.name);
    setFormDescription(bundle.description || "");
    setFormPrice(bundle.price);
    setFormImage(bundle.image || "");
    setFormServices(
      bundle.services.map((s) => {
        const svcId = typeof s.service === "object" ? s.service._id : s.service;
        return {
          serviceId: svcId,
          serviceName: s.serviceName,
          servicePrice: s.servicePrice,
          duration: s.duration,
          commissionType: (s.commissionType as "percentage" | "fixed") || "fixed",
          commissionValue: s.commissionValue || 0,
        };
      })
    );
    setIsModalOpen(true);
  };

  const handleDelete = async (bundle: ServiceBundle) => {
    if (!confirm(`Hapus bundle "${bundle.name}"?`)) return;
    const res = await fetch(`/api/service-bundles/${bundle._id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) loadData();
    else alert(data.error || "Gagal hapus bundle");
  };

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
          <h1 className="text-2xl font-bold text-gray-900">Bundling</h1>
          <p className="text-sm text-gray-500">
            Kelola paket bundling jasa — gabungan beberapa service dengan harga spesial
          </p>
        </div>
        <PermissionGate resource="bundles" action="create">
          <button
            onClick={() => {
              resetForm();
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800"
          >
            <Plus className="w-4 h-4" />
            Buat Bundle
          </button>
        </PermissionGate>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {bundles.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">
            <Scissors className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>Belum ada bundle. Buat bundle pertama!</p>
          </div>
        )}
        {bundles.map((bundle) => {
          const originalTotal = bundle.services.reduce((sum, s) => sum + s.servicePrice, 0);
          const savings = originalTotal - bundle.price;

          return (
            <div
              key={bundle._id}
              className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow"
            >
              {bundle.image && (
                <img
                  src={bundle.image}
                  alt={bundle.name}
                  className="w-full h-32 object-cover rounded-lg mb-3"
                />
              )}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-gray-900">{bundle.name}</h3>
                  {bundle.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{bundle.description}</p>
                  )}
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 shrink-0">
                  {bundle.services.length} service
                </span>
              </div>

              <div className="mt-3 flex items-baseline gap-2">
                <p className="text-lg font-black text-blue-900">
                  {settings.symbol}{bundle.price.toLocaleString("id-ID")}
                </p>
                {savings > 0 && (
                  <p className="text-xs text-gray-400 line-through">
                    {settings.symbol}{originalTotal.toLocaleString("id-ID")}
                  </p>
                )}
                {savings > 0 && (
                  <span className="text-[10px] bg-red-50 text-red-600 font-bold px-1.5 py-0.5 rounded-full">
                    Hemat {settings.symbol}{savings.toLocaleString("id-ID")}
                  </span>
                )}
              </div>

              <div className="mt-3 space-y-1.5">
                {bundle.services.map((svc, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <span className="text-gray-700">
                      <span className="inline-block w-1.5 h-1.5 bg-blue-400 rounded-full mr-1.5"></span>
                      {svc.serviceName}
                    </span>
                    <div className="flex items-center gap-2 text-gray-400">
                      <span>{svc.duration}m</span>
                      {(svc.commissionValue || 0) > 0 && (
                        <span className="text-green-600 font-semibold">
                          {svc.commissionType === "percentage"
                            ? `${svc.commissionValue}%`
                            : `${settings.symbol}${(svc.commissionValue || 0).toLocaleString("id-ID")}`}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center gap-2 border-t border-gray-100 pt-3">
                <PermissionGate resource="bundles" action="edit">
                  <button
                    onClick={() => openEditModal(bundle)}
                    className="inline-flex items-center gap-1.5 text-xs text-blue-700 font-bold hover:underline"
                  >
                    <Edit className="w-3 h-3" />
                    Edit
                  </button>
                </PermissionGate>
                <PermissionGate resource="bundles" action="delete">
                  <button
                    onClick={() => handleDelete(bundle)}
                    className="inline-flex items-center gap-1.5 text-xs text-red-600 font-bold hover:underline"
                  >
                    <Trash2 className="w-3 h-3" />
                    Hapus
                  </button>
                </PermissionGate>
              </div>
            </div>
          );
        })}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          resetForm();
        }}
        title={editingBundle ? "Edit Bundle" : "Buat Bundle"}
      >
        <div className="space-y-4">
          <ImageUpload label="Bundle Image" value={formImage} onChange={(url) => setFormImage(url)} />

          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="Nama bundle (mis: Paket Potong + Creambath)"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
          />

          <textarea
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="Deskripsi (opsional)"
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            rows={2}
          />

          {/* Services list */}
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2 block">
              Daftar Service dalam Bundle
            </label>
            <div className="space-y-3">
              {formServices.map((item, idx) => (
                <div key={idx} className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <SearchableSelect
                        placeholder="Pilih service"
                        value={item.serviceId}
                        onChange={(val) => updateServiceItem(idx, { serviceId: val })}
                        options={services.map((svc) => ({
                          value: svc._id,
                          label: `${svc.name} (${settings.symbol}${svc.price.toLocaleString("id-ID")})`,
                        }))}
                      />
                    </div>
                    <button
                      onClick={() => removeServiceItem(idx)}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {item.serviceId && (
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <label className="text-gray-500 font-medium block mb-0.5">Harga</label>
                        <p className="font-bold text-gray-900">
                          {settings.symbol}{Number(item.servicePrice).toLocaleString("id-ID")}
                        </p>
                      </div>
                      <div>
                        <label className="text-gray-500 font-medium block mb-0.5">Durasi</label>
                        <p className="font-bold text-gray-900">{item.duration} menit</p>
                      </div>
                      <div>
                        <label className="text-gray-500 font-medium block mb-0.5">Komisi</label>
                        <div className="flex items-center gap-1">
                          <select
                            className="border border-gray-200 rounded px-1 py-0.5 text-xs"
                            value={item.commissionType}
                            onChange={(e) =>
                              updateServiceItem(idx, { commissionType: e.target.value as "percentage" | "fixed" })
                            }
                          >
                            <option value="fixed">Rp</option>
                            <option value="percentage">%</option>
                          </select>
                          <input
                            className="border border-gray-200 rounded px-1 py-0.5 text-xs w-16"
                            type="number"
                            min="0"
                            value={item.commissionValue}
                            onChange={(e) => updateServiceItem(idx, { commissionValue: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={addServiceItem}
              className="mt-2 text-sm text-blue-700 font-semibold hover:underline"
            >
              + Tambah Service
            </button>
          </div>

          {/* Bundle price with savings preview */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-blue-800">Harga Bundle</label>
              {formServices.length > 0 && (
                <span className="text-xs text-gray-500">
                  Total satuan: {settings.symbol}{calculateOriginalTotal().toLocaleString("id-ID")}
                </span>
              )}
            </div>
            <input
              className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm font-bold"
              placeholder="Harga bundling spesial"
              type="number"
              min="0"
              value={formPrice}
              onChange={(e) => setFormPrice(e.target.value)}
            />
            {Number(formPrice) > 0 && calculateOriginalTotal() > Number(formPrice) && (
              <p className="text-xs text-green-600 font-bold mt-1">
                Customer hemat {settings.symbol}
                {(calculateOriginalTotal() - Number(formPrice)).toLocaleString("id-ID")}!
              </p>
            )}
          </div>

          <div className="pt-2">
            <FormButton onClick={saveBundle} loading={saving} variant="success">
              {editingBundle ? "Update Bundle" : "Simpan Bundle"}
            </FormButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
