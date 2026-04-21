"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, QrCode, RefreshCw } from "lucide-react";
import SearchableSelect from "@/components/dashboard/SearchableSelect";
import Modal from "@/components/dashboard/Modal";
import { FormButton } from "@/components/dashboard/FormInput";
import ImageUpload from "@/components/dashboard/ImageUpload";
import { useSettings } from "@/components/providers/SettingsProvider";

interface ServiceItem {
  _id: string;
  name: string;
  price: number;
}

interface CustomerItem {
  _id: string;
  name: string;
  phone?: string;
}

interface ServicePackageItem {
  service: string;
  serviceName: string;
  quota: number;
}

interface ServicePackage {
  _id: string;
  name: string;
  code: string;
  description?: string;
  price: number;
  isActive: boolean;
  items: ServicePackageItem[];
}

interface PackageOrder {
  _id: string;
  orderNumber: string;
  amount: number;
  status: string;
  customer?: { _id: string; name: string; phone?: string };
  package?: { _id: string; name: string; code: string };
  createdAt: string;
}

interface QrisSession {
  externalId: string;
  checkoutUrl: string;
  status: string;
  sourceId?: string;
}

export default function PackagesPage() {
  const { settings } = useSettings();

  const [services, setServices] = useState<ServiceItem[]>([]);
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [orders, setOrders] = useState<PackageOrder[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formImage, setFormImage] = useState("");
  const [formPrice, setFormPrice] = useState<number | string>("");
  const [formDescription, setFormDescription] = useState("");
  const [formItems, setFormItems] = useState<Array<{ serviceId: string; quota: number | string }>>([]);

  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [selectedPackage, setSelectedPackage] = useState("");
  const [processingOrder, setProcessingOrder] = useState(false);

  const [qrisSession, setQrisSession] = useState<QrisSession | null>(null);
  const [isQrisModalOpen, setIsQrisModalOpen] = useState(false);
  const [checkingQris, setCheckingQris] = useState(false);

  const activePackages = useMemo(() => packages.filter((pkg) => pkg.isActive), [packages]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [serviceRes, customerRes, packageRes, orderRes] = await Promise.all([
        fetch("/api/services?limit=1000"),
        fetch("/api/customers?limit=1000"),
        fetch("/api/service-packages"),
        fetch("/api/package-orders"),
      ]);

      const serviceData = await serviceRes.json();
      const customerData = await customerRes.json();
      const packageData = await packageRes.json();
      const orderData = await orderRes.json();

      if (serviceData.success) setServices(serviceData.data || []);
      if (customerData.success) setCustomers(customerData.data || []);
      if (packageData.success) setPackages(packageData.data || []);
      if (orderData.success) setOrders(orderData.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const addFormItem = () => {
    setFormItems((prev) => [...prev, { serviceId: "", quota: 1 }]);
  };

  const removeFormItem = (index: number) => {
    setFormItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const updateFormItem = (index: number, patch: Partial<{ serviceId: string; quota: number | string }>) => {
    setFormItems((prev) => prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  };

  const resetForm = () => {
    setFormName("");
    setFormCode("");
    setFormImage("");
    setFormPrice("");
    setFormDescription("");
    setFormItems([]);
  };

  const createPackage = async () => {
    if (!formName || !formCode || Number(formPrice) <= 0 || formItems.length === 0) {
      alert("Lengkapi nama, kode, harga, dan item package");
      return;
    }

    const hasInvalidItem = formItems.some((item) => !item.serviceId || Number(item.quota) <= 0);
    if (hasInvalidItem) {
      alert("Semua item package harus punya service dan quota > 0");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/service-packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          code: formCode,
          description: formDescription,
          price: Number(formPrice),
          items: formItems.map((item) => ({ service: item.serviceId, quota: Number(item.quota) })),
        }),
      });

      const data = await res.json();
      if (!data.success) {
        alert(data.error || "Gagal membuat package");
        return;
      }

      resetForm();
      setIsModalOpen(false);
      await loadData();
    } catch (error) {
      console.error(error);
      alert("Gagal membuat package");
    } finally {
      setSaving(false);
    }
  };

  const createPackageOrder = async () => {
    if (!selectedCustomer || !selectedPackage) {
      alert("Pilih customer dan package dulu");
      return;
    }

    setProcessingOrder(true);
    try {
      const orderRes = await fetch("/api/package-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: selectedCustomer, packageId: selectedPackage }),
      });
      const orderData = await orderRes.json();

      if (!orderData.success || !orderData.data?.order) {
        alert(orderData.error || "Gagal membuat order package");
        return;
      }

      const paymentPayload = orderData.data.payment;
      const qrisRes = await fetch("/api/payments/xendit/create-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: paymentPayload.sourceType,
          sourceId: paymentPayload.sourceId,
          amount: paymentPayload.amount,
          customer: paymentPayload.customer,
          description: paymentPayload.description,
        }),
      });

      const qrisData = await qrisRes.json();
      if (!qrisData.success || !qrisData.data) {
        alert(qrisData.error || "Gagal membuat QRIS package");
        return;
      }

      setQrisSession({
        externalId: qrisData.data.externalId,
        checkoutUrl: qrisData.data.checkoutUrl,
        status: qrisData.data.status || "pending",
        sourceId: paymentPayload.sourceId,
      });
      setIsQrisModalOpen(true);
      await loadData();
    } catch (error) {
      console.error(error);
      alert("Gagal memproses order package");
    } finally {
      setProcessingOrder(false);
    }
  };

  const checkQrisStatus = async () => {
    if (!qrisSession?.externalId) return;

    setCheckingQris(true);
    try {
      const res = await fetch(`/api/payments/xendit/status/${qrisSession.externalId}`);
      const data = await res.json();

      if (!data.success || !data.data) {
        alert(data.error || "Gagal cek status QRIS");
        return;
      }

      setQrisSession((prev) => (prev ? { ...prev, status: data.data.status } : prev));
      if (data.data.status === "paid") {
        alert("Pembayaran sukses, paket customer sudah aktif lewat webhook/status sync");
        await loadData();
      }
    } catch (error) {
      console.error(error);
      alert("Gagal cek status QRIS");
    } finally {
      setCheckingQris(false);
    }
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
          <h1 className="text-2xl font-bold text-gray-900">Packages</h1>
          <p className="text-sm text-gray-500">Master package kuota + penjualan package via QRIS Xendit</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800"
        >
          <Plus className="w-4 h-4" />
          Buat Package
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <h2 className="font-bold text-gray-900">Jual Package via QRIS</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <SearchableSelect
            placeholder="Pilih customer"
            value={selectedCustomer}
            onChange={(val) => setSelectedCustomer(val)}
            options={customers.map((c) => ({ value: c._id, label: `${c.name}${c.phone ? ` (${c.phone})` : ""}` }))}
          />
          <SearchableSelect
            placeholder="Pilih package"
            value={selectedPackage}
            onChange={(val) => setSelectedPackage(val)}
            options={activePackages.map((pkg) => ({ value: pkg._id, label: `${pkg.name} - ${settings.symbol}${pkg.price}` }))}
          />
          <FormButton onClick={createPackageOrder} loading={processingOrder} variant="success" icon={<QrCode className="w-4 h-4" />}>
            Buat QRIS Package
          </FormButton>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="font-bold text-gray-900 mb-3">Master Package</h3>
          <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
            {packages.length === 0 && <p className="text-sm text-gray-500">Belum ada package.</p>}
            {packages.map((pkg) => (
              <div key={pkg._id} className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900">{pkg.name}</p>
                    <p className="text-xs text-gray-500">{pkg.code}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${pkg.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {pkg.isActive ? "active" : "inactive"}
                  </span>
                </div>
                <p className="text-sm font-bold text-blue-900 mt-2">{settings.symbol}{pkg.price}</p>
                <div className="mt-2 space-y-1">
                  {pkg.items.map((item, idx) => (
                    <p key={idx} className="text-xs text-gray-700">- {item.serviceName}: {item.quota}x</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-900">Order Package</h3>
            <button onClick={loadData} className="inline-flex items-center gap-1 text-xs text-blue-700">
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>
          <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
            {orders.length === 0 && <p className="text-sm text-gray-500">Belum ada order package.</p>}
            {orders.map((order) => (
              <div key={order._id} className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-gray-900 text-sm">{order.orderNumber}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${order.status === "paid" ? "bg-green-100 text-green-700" : order.status === "pending" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                    {order.status}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">{order.customer?.name || "-"} • {order.package?.name || "-"}</p>
                <p className="text-sm font-bold text-blue-900 mt-1">{settings.symbol}{order.amount}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Buat Master Package">
        <div className="space-y-3">
          <ImageUpload 
            label="Package Image" 
            value={formImage} 
            onChange={(url) => setFormImage(url)} 
          />
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="Nama package"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
          />
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="Kode package (mis: HAIR10X)"
            value={formCode}
            onChange={(e) => setFormCode(e.target.value)}
          />
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="Harga package"
            type="number"
            min="0"
            value={formPrice}
            onChange={(e) => setFormPrice(e.target.value)}
          />
          <textarea
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="Deskripsi"
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
          />

          <div className="space-y-2">
            {formItems.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-8">
                  <SearchableSelect
                    placeholder="Pilih service"
                    value={item.serviceId}
                    onChange={(val) => updateFormItem(idx, { serviceId: val })}
                    options={services.map((svc) => ({ value: svc._id, label: `${svc.name} (${settings.symbol}${svc.price})` }))}
                  />
                </div>
                <input
                  className="col-span-3 border border-gray-300 rounded-lg px-2 py-2 text-sm"
                  type="number"
                  min="1"
                  value={item.quota}
                  onChange={(e) => updateFormItem(idx, { quota: e.target.value })}
                />
                <button className="col-span-1 text-xs text-red-600" onClick={() => removeFormItem(idx)}>x</button>
              </div>
            ))}
          </div>

          <button onClick={addFormItem} className="text-sm text-blue-700 font-semibold">+ tambah service kuota</button>

          <div className="pt-2">
            <FormButton onClick={createPackage} loading={saving} variant="success">Simpan Package</FormButton>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isQrisModalOpen} onClose={() => setIsQrisModalOpen(false)} title="QRIS Package Order">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Status: <span className="font-bold uppercase text-gray-900">{qrisSession?.status || "pending"}</span></p>
          <p className="text-xs text-gray-500 break-all">External ID: {qrisSession?.externalId || "-"}</p>

          {qrisSession?.checkoutUrl && (
            <a
              href={qrisSession.checkoutUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-900 text-white text-sm font-semibold hover:bg-blue-800"
            >
              Buka Checkout QRIS
            </a>
          )}

          <div>
            <FormButton onClick={checkQrisStatus} loading={checkingQris} variant="secondary">Cek Status QRIS</FormButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
