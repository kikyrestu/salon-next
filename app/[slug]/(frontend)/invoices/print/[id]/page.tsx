"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useTenantRouter } from "@/hooks/useTenantRouter";
import { format } from "date-fns";
import { Printer, ArrowLeft, Scissors } from "lucide-react";
import { FormButton } from "@/components/dashboard/FormInput";
import { getCurrencySymbol } from "@/lib/currency";
import { QRCodeSVG } from "qrcode.react";

import { MessageSquare } from "lucide-react";

export default function PrintInvoicePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const id = params.id as string;
    const router = useTenantRouter();
    const [invoice, setInvoice] = useState<any>(null);
    const [settings, setSettings] = useState<any>(null);
    const [deposits, setDeposits] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [sendingWa, setSendingWa] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [invRes, settingsRes, depositsRes] = await Promise.all([
                    fetch(`/api/invoices/${id}`, { headers: { "x-store-slug": slug } }),
                    fetch("/api/settings", { headers: { "x-store-slug": slug } }),
                    fetch(`/api/deposits?invoiceId=${id}`, { headers: { "x-store-slug": slug } })
                ]);
                const invData = await invRes.json();
                const settingsData = await settingsRes.json();
                const depositsData = await depositsRes.json();

                if (invData.success) setInvoice(invData.data);
                if (settingsData.success) setSettings(settingsData.data);
                if (depositsData.success) setDeposits(depositsData.data);
            } catch (error) {
                console.error("Error fetching print data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id]);

    const handlePrint = () => {
        window.print();
    };

    const handleSendWaNota = async () => {
        setSendingWa(true);
        try {
            const res = await fetch(`/api/invoices/${id}/wa-nota`, {
                method: 'POST',
                headers: { "x-store-slug": slug }
            });
            const data = await res.json();
            if (data.success) {
                alert(data.message || "Nota WA berhasil dikirim!");
            } else {
                alert(data.error || "Gagal mengirim Nota WA.");
            }
        } catch (e) {
            console.error(e);
            alert("Terjadi kesalahan saat mengirim Nota WA.");
        } finally {
            setSendingWa(false);
        }
    };

    const handleBluetoothPrint = async () => {
        try {
            if (!(navigator as any).bluetooth) {
                alert("Web Bluetooth API tidak didukung di browser ini. Gunakan Chrome untuk Android/Desktop.");
                return;
            }

            // 1. Fetch formatted receipt binary from server thermal API
            const thermalRes = await fetch(`/api/invoices/${id}/thermal?width=80`, {
                headers: { "x-store-slug": slug },
            });
            if (!thermalRes.ok) {
                const errData = await thermalRes.json().catch(() => ({}));
                throw new Error(errData.error || 'Gagal mengambil data struk dari server');
            }
            const receiptArrayBuffer = await thermalRes.arrayBuffer();
            const receiptBytes = new Uint8Array(receiptArrayBuffer);

            // 2. Connect to Bluetooth printer
            const device = await (navigator as any).bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', '49535343-fe7d-4ae5-8fa9-9fafd205e455']
            });

            if (!device.gatt) throw new Error("Perangkat tidak memiliki GATT server.");
            const server = await device.gatt.connect();

            // 3. Find writable characteristic
            const servicesToTry = ['000018f0-0000-1000-8000-00805f9b34fb', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', '49535343-fe7d-4ae5-8fa9-9fafd205e455'];
            let characteristic: any = null;

            for (const uuid of servicesToTry) {
                try {
                    const svc = await server.getPrimaryService(uuid);
                    const chars = await svc.getCharacteristics();
                    characteristic = chars.find((c: any) => c.properties.write || c.properties.writeWithoutResponse);
                    if (characteristic) break;
                } catch (_) {
                    continue;
                }
            }

            if (!characteristic) throw new Error("Gagal mendapatkan layanan write untuk printer ini.");

            // 4. Send receipt bytes in chunks
            const BATCH_SIZE = 256;
            for (let i = 0; i < receiptBytes.length; i += BATCH_SIZE) {
                const chunk = receiptBytes.slice(i, i + BATCH_SIZE);
                if (characteristic.properties.write) {
                    await characteristic.writeValue(chunk);
                } else {
                    await characteristic.writeValueWithoutResponse(chunk);
                }
                await new Promise(r => setTimeout(r, 20));
            }

            alert("Struk berhasil dikirim ke printer bluetooth!");

        } catch (error: any) {
            console.error("Bluetooth print error:", error);
            if (error.message?.includes('cancelled') || error.message?.includes('User cancelled')) {
                // User cancelled BT dialog, don't show error
                return;
            }
            alert("Error Bluetooth: " + error.message);
        }
    };

    if (loading) return <div className="p-8 text-center">Loading receipt...</div>;
    if (!invoice) return <div className="p-8 text-center text-red-500">Invoice not found</div>;

    const currencySymbol = getCurrencySymbol(settings?.currency || 'IDR');

    return (
        <div className="min-h-screen bg-gray-100 p-4 md:p-8 print:p-0 print:m-0 print:bg-white print:min-h-0 text-black">
            {/* Header / Controls */}
            <div className="max-w-[400px] mx-auto flex justify-between items-center mb-6 print:hidden">
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                </button>
                <div className="flex gap-2">
                    {!searchParams?.get('autoSent') && (
                        <FormButton
                            onClick={handleSendWaNota}
                            icon={<MessageSquare className="w-4 h-4" />}
                            className="bg-green-600 hover:bg-green-700 whitespace-nowrap"
                            disabled={sendingWa}
                        >
                            {sendingWa ? "Mengirim..." : "Kirim WA"}
                        </FormButton>
                    )}
                    <FormButton
                        onClick={handleBluetoothPrint}
                        icon={<Printer className="w-4 h-4" />}
                        className="bg-indigo-600 hover:bg-indigo-700 whitespace-nowrap"
                    >
                        Bluetooth
                    </FormButton>
                    <FormButton
                        onClick={handlePrint}
                        icon={<Printer className="w-4 h-4" />}
                        className="whitespace-nowrap"
                    >
                        Print Receipt
                    </FormButton>
                </div>
            </div>

            {/* Thermal Receipt Content */}
            <div className="max-w-[300px] mx-auto bg-white p-4 shadow-xl print:shadow-none print:max-w-[300px] print:w-full print:p-0 print:m-0 font-mono text-[12px] leading-tight text-black border-t-8 border-gray-900 print:border-t-0">
                {/* Store Header */}
                <div className="text-center mb-2">
                    <div className="text-lg mb-1">{settings?.storeName || "SALON POS"}</div>
                    <div>{settings?.address || "Alamat Toko"}</div>
                    <div>{settings?.phone || "000-000-0000"}</div>
                </div>

                <div className="border-b border-dashed border-black my-2"></div>

                {/* Info Block */}
                <div className="space-y-0.5">
                    <div className="flex"><div className="w-12">No</div><div>: {invoice.invoiceNumber}</div></div>
                    <div className="flex"><div className="w-12">Tgl</div><div>: {format(new Date(invoice.date), "dd/MM/yy HH:mm")}</div></div>
                    <div className="flex"><div className="w-12">Staff</div><div>: {invoice.staff?.name || invoice.staffAssignments?.[0]?.staff?.name || "-"}</div></div>
                    <div className="flex"><div className="w-12">Cust</div><div>: {invoice.customer?.name || "Walk-in"}</div></div>
                </div>

                <div className="border-b border-dashed border-black my-2"></div>

                {/* Items Block */}
                <div className="space-y-2">
                    {invoice.items && invoice.items.map((item: any, idx: number) => {
                        const isBundle = item.name?.match(/\(Bundle:\s*(.+)\)$/);
                        let displayName = item.name;
                        if (isBundle) displayName = `📦 Bundle: ${isBundle[1].trim()}`;
                        return (
                            <div key={idx}>
                                <div>{displayName}</div>
                                <div className="flex justify-between mt-0.5">
                                    <div className="pl-2">{item.quantity} x {currencySymbol}{(item.price || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</div>
                                    <div>{currencySymbol}{(item.total || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</div>
                                </div>
                                {item.discount > 0 && (
                                    <div className="pl-2 text-[10px] italic">
                                        Disc: -{currencySymbol}{item.discount.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="border-b border-dashed border-black my-2"></div>

                {/* Summary Section */}
                <div className="space-y-0.5">
                    <div className="flex justify-between">
                        <span>Subtotal</span>
                        <span>{currencySymbol}{invoice.subtotal.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                    </div>
                    {invoice.discount > 0 && (
                        <div className="flex justify-between">
                            <span>Discount</span>
                            <span>-{currencySymbol}{invoice.discount.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                        </div>
                    )}
                    {settings?.showTaxAndTaxableAmountOnReceipt !== false && invoice.tax > 0 && (
                        <div className="flex justify-between">
                            <span>Tax</span>
                            <span>{currencySymbol}{invoice.tax.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                        </div>
                    )}
                    {invoice.tips > 0 && (
                        <div className="flex justify-between">
                            <span>Tips</span>
                            <span>{currencySymbol}{invoice.tips.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                        </div>
                    )}
                    <div className="flex justify-between font-bold text-sm mt-1">
                        <span>TOTAL</span>
                        <span>{currencySymbol}{invoice.totalAmount.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Bayar</span>
                        <span>{currencySymbol}{invoice.amountPaid.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                    </div>
                    {invoice.loyaltyPointsEarned > 0 && (
                        <div className="flex justify-between">
                            <span>Poin Didapat</span>
                            <span>+{invoice.loyaltyPointsEarned}</span>
                        </div>
                    )}
                </div>

                <div className="border-b border-dashed border-black my-2"></div>

                {/* Staff Recognition */}
                {settings?.showStaffOnReceipt !== false && invoice.staffAssignments && invoice.staffAssignments.length > 0 && (
                    <>
                        <div>
                            <div>Dilayani oleh:</div>
                            {invoice.staffAssignments.map((a: any, i: number) => (
                                <div key={i} className="pl-2">
                                    {a.staff?.name || 'Staff Member'}
                                    {a.tip > 0 && ` (Tip: ${currencySymbol}${a.tip.toLocaleString('id-ID', { maximumFractionDigits: 0 })})`}
                                </div>
                            ))}
                        </div>
                        <div className="border-b border-dashed border-black my-2"></div>
                    </>
                )}

                {/* Payment History */}
                <div className="text-center mb-1">
                    METODE BAYAR: {invoice.paymentMethods && invoice.paymentMethods.length > 1 
                        ? invoice.paymentMethods.map((pm: any) => pm.method).join(', ') 
                        : invoice.paymentMethod || 'Cash'}
                </div>
                
                {deposits && deposits.length > 0 && (
                    <div className="mt-2">
                        <div>RIWAYAT BAYAR</div>
                        {deposits.map((dep: any, idx: number) => (
                            <div key={idx} className="flex justify-between mt-0.5">
                                <div>{format(new Date(dep.date), "dd/MM/yy HH:mm")} {dep.paymentMethod}</div>
                                <div>{currencySymbol}{dep.amount.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="border-b border-dashed border-black my-2"></div>

                {/* Footer Section */}
                <div className="text-center mt-4">
                    <div className="whitespace-pre-wrap">{settings?.receiptFooter || `Thank You for Visiting ${settings?.storeName || 'US'}.`}</div>
                    
                    {invoice.customer?.publicToken && (
                        <div className="mt-4 flex flex-col items-center">
                            <QRCodeSVG 
                                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/${slug}/portal/${invoice.customer.publicToken}/invoice/${invoice._id}`} 
                                size={80} 
                                level={"L"} 
                                includeMargin={false} 
                            />
                        </div>
                    )}
                    <div className="mt-2 text-[10px]">{invoice.invoiceNumber}</div>
                </div>
            </div>

            <style jsx global>{`
                @media print {
                    html, body {
                        background: white !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        min-height: 0 !important;
                        height: auto !important;
                        width: 80mm !important;
                        overflow: visible !important;
                    }
                    .print\\:hidden {
                        display: none !important;
                    }
                    * {
                        page-break-inside: avoid;
                    }
                    table, tr, td, th {
                        page-break-inside: auto;
                    }
                    @page {
                        margin: 0;
                        padding: 0;
                        size: 80mm auto;
                    }
                }
            `}</style>
        </div>
    );
}