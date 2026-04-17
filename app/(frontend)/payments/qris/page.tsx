"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FormButton } from "@/components/dashboard/FormInput";

interface CreatePaymentResponse {
  success: boolean;
  error?: string;
  data?: {
    externalId: string;
    xenditInvoiceId: string;
    amount: number;
    checkoutUrl: string;
    status: string;
  };
}

interface PaymentStatusResponse {
  success: boolean;
  error?: string;
  data?: {
    externalId: string;
    status: string;
    amount: number;
    paidAmount: number;
    checkoutUrl: string;
    paymentMethod?: string;
    paidAt?: string;
  };
}

export default function QrisXenditPage() {
  const searchParams = useSearchParams();
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState<number | string>("");
  const [description, setDescription] = useState("Pembayaran via QRIS");
  const [externalId, setExternalId] = useState("");
  const [checkoutUrl, setCheckoutUrl] = useState("");
  const [status, setStatus] = useState("-");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const externalIdParam = searchParams.get("externalId");
    const checkoutUrlParam = searchParams.get("checkoutUrl");
    const invoiceIdParam = searchParams.get("invoiceId");

    if (externalIdParam) {
      setExternalId(externalIdParam);
    }
    if (checkoutUrlParam) {
      setCheckoutUrl(checkoutUrlParam);
    }
    if (invoiceIdParam) {
      setInvoiceId(invoiceIdParam);
    }
  }, [searchParams]);

  const displayAmount = useMemo(() => {
    const value = typeof amount === "string" ? Number(amount || 0) : amount;
    return Number.isFinite(value) ? value : 0;
  }, [amount]);

  const createPayment = async () => {
    if (!invoiceId && displayAmount <= 0) {
      alert("Isi Invoice ID atau Amount terlebih dahulu");
      return;
    }

    if (invoiceId.trim() && !/^[a-fA-F0-9]{24}$/.test(invoiceId.trim())) {
      alert("Format Invoice ID tidak valid (harus 24 karakter hex)");
      return;
    }

    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        description,
      };

      if (invoiceId.trim()) {
        payload.invoiceId = invoiceId.trim();
      }
      if (displayAmount > 0) {
        payload.amount = displayAmount;
      }

      const res = await fetch("/api/payments/xendit/create-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as CreatePaymentResponse;
      if (!data.success || !data.data) {
        alert(data.error || "Gagal membuat pembayaran QRIS");
        return;
      }

      setExternalId(data.data.externalId);
      setCheckoutUrl(data.data.checkoutUrl);
      setStatus(data.data.status);
    } catch (error) {
      console.error(error);
      alert("Terjadi error saat membuat payment");
    } finally {
      setLoading(false);
    }
  };

  const checkStatus = async () => {
    if (!externalId) {
      alert("Buat payment dulu");
      return;
    }

    setChecking(true);
    try {
      const res = await fetch(`/api/payments/xendit/status/${externalId}`);
      const data = (await res.json()) as PaymentStatusResponse;

      if (!data.success || !data.data) {
        alert(data.error || "Gagal cek status");
        return;
      }

      setStatus(data.data.status);
    } catch (error) {
      console.error(error);
      alert("Gagal cek status pembayaran");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">QRIS</h1>
        <p className="text-sm text-gray-600 mt-1">
          Halaman ini untuk buat pembayaran QRIS, buka checkout, lalu cek status webhook.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-6 space-y-4">
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Invoice ID (opsional)</label>
          <input
            value={invoiceId}
            onChange={(e) => setInvoiceId(e.target.value)}
            placeholder="Contoh: 67f9..."
            className="mt-1 w-full border border-gray-300 bg-white text-black rounded-lg px-3 py-2 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-900"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Amount (opsional jika isi Invoice ID)</label>
          <input
            type="number"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Contoh: 150000"
            className="mt-1 w-full border border-gray-300 bg-white text-black rounded-lg px-3 py-2 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-900"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full border border-gray-300 bg-white text-black rounded-lg px-3 py-2 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-900"
          />
        </div>

        <FormButton onClick={createPayment} loading={loading} className="w-full" variant="primary">
          Buat Pembayaran QRIS
        </FormButton>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-6 space-y-3">
        <div className="text-sm"><span className="font-semibold">External ID:</span> {externalId || "-"}</div>
        <div className="text-sm"><span className="font-semibold">Status:</span> {status}</div>

        {checkoutUrl && (
          <a
            href={checkoutUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-900 text-white text-sm font-semibold hover:bg-blue-800"
          >
            Buka Checkout QRIS
          </a>
        )}

        <div>
          <FormButton onClick={checkStatus} loading={checking} variant="secondary">
            Cek Status
          </FormButton>
        </div>
      </div>
    </div>
  );
}
