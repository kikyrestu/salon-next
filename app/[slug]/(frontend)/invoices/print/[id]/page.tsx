"use client";

import { useState, useEffect } from "react";
import { useParams, } from "next/navigation";
import { useTenantRouter } from "@/hooks/useTenantRouter";
import { format } from "date-fns";
import { Printer, ArrowLeft, Scissors } from "lucide-react";
import { FormButton } from "@/components/dashboard/FormInput";
import { getCurrencySymbol } from "@/lib/currency";

import { MessageSquare } from "lucide-react";

export default function PrintInvoicePage() {
  const params = useParams();
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

            const device = await (navigator as any).bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', '49535343-fe7d-4ae5-8fa9-9fafd205e455']
            });

            if (!device.gatt) throw new Error("Perangkat tidak memiliki GATT server.");
            
            const server = await device.gatt.connect();
            
            // Try to find a working service
            const servicesToTry = ['000018f0-0000-1000-8000-00805f9b34fb', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', '49535343-fe7d-4ae5-8fa9-9fafd205e455'];
            let service;
            let characteristic;

            for (const uuid of servicesToTry) {
                try {
                    service = await server.getPrimaryService(uuid);
                    const characteristics = await service.getCharacteristics();
                    characteristic = characteristics.find((c: any) => c.properties.write || c.properties.writeWithoutResponse);
                    if (characteristic) break;
                } catch (e) {
                    continue;
                }
            }

            if (!characteristic) throw new Error("Gagal mendapatkan layanan/characteristic write untuk printer ini.");

            const encoder = new TextEncoder();
            const commands: Uint8Array[] = [];

            // Initialize printer
            commands.push(new Uint8Array([0x1B, 0x40]));
            
            // Center align & Bold for title
            commands.push(new Uint8Array([0x1B, 0x61, 0x01]));
            commands.push(new Uint8Array([0x1B, 0x45, 0x01]));
            commands.push(encoder.encode((settings?.storeName || 'SALON') + '\n'));
            
            // Normal text
            commands.push(new Uint8Array([0x1B, 0x45, 0x00]));
            commands.push(encoder.encode((settings?.address || '') + '\n'));
            commands.push(encoder.encode('TEL: ' + (settings?.phone || '') + '\n\n'));
            
            // Left align
            commands.push(new Uint8Array([0x1B, 0x61, 0x00]));
            commands.push(encoder.encode(`No: ${invoice.invoiceNumber}\n`));
            commands.push(encoder.encode(`Tgl: ${format(new Date(invoice.date), "dd/MM/yyyy HH:mm")}\n`));
            commands.push(encoder.encode(`Plg: ${invoice.customer?.name || "Walk-in"}\n\n`));

            // Items
            commands.push(encoder.encode('--------------------------------\n'));
            invoice.items.forEach((item: any) => {
                commands.push(encoder.encode(`${item.name}\n`));
                const priceNum = item.total / item.quantity;
                const qtyStr = `${item.quantity}x ${priceNum.toLocaleString('id-ID')}`;
                const totalStr = `${item.total.toLocaleString('id-ID')}`;
                
                // padding to 32 chars
                const spacesCount = Math.max(0, 32 - qtyStr.length - totalStr.length);
                const spaces = ' '.repeat(spacesCount);
                commands.push(encoder.encode(`${qtyStr}${spaces}${totalStr}\n`));
            });
            commands.push(encoder.encode('--------------------------------\n'));

            // Totals, right align
            commands.push(new Uint8Array([0x1B, 0x61, 0x02]));
            commands.push(encoder.encode(`Subtotal: ${invoice.subtotal.toLocaleString('id-ID')}\n`));
            if (invoice.tax > 0) commands.push(encoder.encode(`Pajak: ${invoice.tax.toLocaleString('id-ID')}\n`));
            if (invoice.discount > 0) commands.push(encoder.encode(`Diskon: -${invoice.discount.toLocaleString('id-ID')}\n`));
            
            // Bold Total
            commands.push(new Uint8Array([0x1B, 0x45, 0x01]));
            commands.push(encoder.encode(`Total: ${invoice.totalAmount.toLocaleString('id-ID')}\n`));
            commands.push(new Uint8Array([0x1B, 0x45, 0x00]));
            
            commands.push(encoder.encode(`Dibayar: ${invoice.amountPaid.toLocaleString('id-ID')}\n`));
            const due = invoice.totalAmount - invoice.amountPaid;
            if (due > 0) commands.push(encoder.encode(`Sisa: ${due.toLocaleString('id-ID')}\n`));
            
            // Footer, center align
            commands.push(new Uint8Array([0x1B, 0x61, 0x01]));
            commands.push(encoder.encode('\nTerima Kasih!\n\n\n\n\n'));

            // Cut paper (if supported)
            commands.push(new Uint8Array([0x1D, 0x56, 0x41, 0x00]));

            // Send commands in chunks
            const BATCH_SIZE = 256;
            let totalLen = 0;
            for (const cmd of commands) totalLen += cmd.length;
            const finalBuffer = new Uint8Array(totalLen);
            
            let offset = 0;
            for (const cmd of commands) {
                finalBuffer.set(cmd, offset);
                offset += cmd.length;
            }

            for (let i = 0; i < finalBuffer.length; i += BATCH_SIZE) {
                const chunk = finalBuffer.slice(i, i + BATCH_SIZE);
                if (characteristic.properties.write) {
                    await characteristic.writeValue(chunk);
                } else if (characteristic.properties.writeWithoutResponse) {
                    await characteristic.writeValueWithoutResponse(chunk);
                }
                // small delay
                await new Promise(r => setTimeout(r, 20));
            }
            
            alert("Struk berhasil dikirim ke printer bluetooth!");

        } catch (error: any) {
            console.error("Bluetooth print error:", error);
            alert("Error Bluetooth: " + error.message);
        }
    };

    if (loading) return <div className="p-8 text-center">Loading receipt...</div>;
    if (!invoice) return <div className="p-8 text-center text-red-500">Invoice not found</div>;

    const currencySymbol = getCurrencySymbol(settings?.currency || 'IDR');

    return (
        <div className="min-h-screen bg-gray-100 p-4 md:p-8 print:p-0 print:bg-white text-black">
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
                    <FormButton
                        onClick={handleSendWaNota}
                        icon={<MessageSquare className="w-4 h-4" />}
                        className="bg-green-600 hover:bg-green-700"
                        disabled={sendingWa}
                    >
                        {sendingWa ? "Mengirim..." : "Kirim WA"}
                    </FormButton>
                    <FormButton
                        onClick={handleBluetoothPrint}
                        icon={<Printer className="w-4 h-4" />}
                        className="bg-indigo-600 hover:bg-indigo-700"
                    >
                        Bluetooth
                    </FormButton>
                    <FormButton
                        onClick={handlePrint}
                        icon={<Printer className="w-4 h-4" />}
                    >
                        Print Receipt
                    </FormButton>
                </div>
            </div>

            {/* Thermal Receipt Content */}
            <div className="max-w-[380px] mx-auto bg-white p-6 shadow-xl print:shadow-none print:w-full font-mono text-sm border-t-8 border-blue-900 print:border-t-0">
                {/* Store Header */}
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold uppercase tracking-tighter mb-1">{settings?.storeName || "SALON POS"}</h1>
                    <p className="text-[11px] text-gray-500 uppercase">{settings?.address || "123 Beauty Lane, Salon City"}</p>
                    <p className="text-[11px] text-gray-500">TEL: {settings?.phone || "000-000-0000"}</p>
                    <div className="mt-4 border-y border-dashed border-gray-300 py-2">
                        <p className="font-bold text-lg">TAX RECEIPT</p>
                    </div>
                </div>

                {/* Info Block */}
                <div className="space-y-1 mb-6 text-[12px]">
                    <div className="flex justify-between">
                        <span className="text-gray-500">Receipt No:</span>
                        <span className="font-bold">{invoice.invoiceNumber}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">Date:</span>
                        <span>{format(new Date(invoice.date), "dd/MM/yyyy HH:mm")}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">Customer:</span>
                        <span className="font-bold">{invoice.customer?.name || "Walk-in"}</span>
                    </div>

                    {invoice.referralCode && (
                        <div className="flex justify-between items-start text-xs border-dashed border border-gray-300 p-1 mt-1 bg-gray-50/50">
                            <span className="text-gray-500">Referred By:</span>
                            <span className="font-bold text-right ml-2 break-all">{invoice.customer?.referredBy?.name || "Member VIP"}</span>
                        </div>
                    )}
                    {invoice.appointment && (
                        <div className="flex justify-between">
                            <span className="text-gray-500">Type:</span>
                            <span className="text-indigo-600 font-bold uppercase">Appointment</span>
                        </div>
                    )}
                </div>

                {/* Items Table */}
                <table className="w-full mb-8 border-collapse">
                    <thead>
                        <tr className="border-b-2 border-gray-900 text-xs text-left text-gray-800 uppercase tracking-wider">
                            <th className="py-3 font-bold" style={{ width: '45%' }}>Item Description</th>
                            <th className="py-3 font-bold text-center" style={{ width: '10%' }}>Qty</th>
                            <th className="py-3 font-bold text-right pr-2" style={{ width: '22%' }}>Unit Price</th>
                            <th className="py-3 font-bold text-right" style={{ width: '23%' }}>Subtotal</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {(() => {
                            const renderRows: React.ReactNode[] = [];
                            const bundleGroups: Record<string, { children: any[]; totalPrice: number; totalAmount: number; totalDiscount: number }> = {};
                            const renderOrder: { type: 'normal' | 'bundle'; key: string; item?: any }[] = [];
                            const seenBundles = new Set<string>();

                            invoice.items.forEach((item: any) => {
                                const bundleMatch = item.name?.match(/\(Bundle:\s*(.+)\)$/);
                                if (bundleMatch) {
                                    const bundleName = bundleMatch[1].trim();
                                    if (!bundleGroups[bundleName]) {
                                        bundleGroups[bundleName] = { children: [], totalPrice: 0, totalAmount: 0, totalDiscount: 0 };
                                    }
                                    bundleGroups[bundleName].children.push(item);
                                    bundleGroups[bundleName].totalPrice += (item.price || 0);
                                    bundleGroups[bundleName].totalAmount += (item.total || 0);
                                    bundleGroups[bundleName].totalDiscount += (item.discount || 0);
                                    if (!seenBundles.has(bundleName)) {
                                        seenBundles.add(bundleName);
                                        renderOrder.push({ type: 'bundle', key: bundleName });
                                    }
                                } else {
                                    renderOrder.push({ type: 'normal', key: 'normal', item });
                                }
                            });

                            let globalIdx = 0;
                            renderOrder.forEach((entry) => {
                                if (entry.type === 'normal' && entry.item) {
                                    const item = entry.item;
                                    const rIdx = globalIdx++;
                                    renderRows.push(
                                        <tr key={`n-${rIdx}`} className="text-sm">
                                            <td className="py-4 align-top">
                                                <p className="font-bold text-gray-900">{item.name}</p>
                                                <div className="mt-1 space-y-0.5">
                                                    {item.itemModel === 'Service' && (
                                                        <span className="inline-block px-1.5 py-0.5 bg-purple-50 text-purple-600 text-[9px] font-bold uppercase rounded">Service</span>
                                                    )}
                                                    {item.itemModel === 'Product' && (
                                                        <span className="inline-block px-1.5 py-0.5 bg-green-50 text-green-600 text-[9px] font-bold uppercase rounded">Product</span>
                                                    )}
                                                    {item.itemModel === 'ServicePackage' && (
                                                        <span className="inline-block px-1.5 py-0.5 bg-amber-50 text-amber-600 text-[9px] font-bold uppercase rounded">Package</span>
                                                    )}
                                                    {item.discount > 0 && (
                                                        <p className="text-[10px] text-red-600 font-medium italic">
                                                            * Includes discount of -{currencySymbol}{item.discount.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                                                        </p>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-4 text-center align-top font-medium">{item.quantity}</td>
                                            <td className="py-4 text-right align-top pr-2">{`${currencySymbol}${(item.price || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}`}</td>
                                            <td className="py-4 text-right align-top font-black text-gray-900">{`${currencySymbol}${(item.total || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}`}</td>
                                        </tr>
                                    );
                                } else if (entry.type === 'bundle') {
                                    const group = bundleGroups[entry.key];
                                    const bIdx = globalIdx++;
                                    // Bundle header row
                                    renderRows.push(
                                        <tr key={`bh-${bIdx}`} className="text-sm">
                                            <td className="py-4 align-top">
                                                <p className="font-black text-gray-900">📦 Bundle: {entry.key}</p>
                                                <div className="mt-1 space-y-0.5">
                                                    <span className="inline-block px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[9px] font-bold uppercase rounded">Bundle</span>
                                                    {group.totalDiscount > 0 && (
                                                        <p className="text-[10px] text-red-600 font-medium italic">
                                                            * Includes discount of -{currencySymbol}{group.totalDiscount.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                                                        </p>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-4 text-center align-top font-medium">1</td>
                                            <td className="py-4 text-right align-top pr-2">{`${currencySymbol}${group.totalPrice.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`}</td>
                                            <td className="py-4 text-right align-top font-black text-gray-900">{`${currencySymbol}${group.totalAmount.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`}</td>
                                        </tr>
                                    );
                                    // Bundle children rows (indented)
                                    group.children.forEach((child: any, cIdx: number) => {
                                        const serviceName = child.name.replace(/\s*\(Bundle:.*\)$/, '');
                                        renderRows.push(
                                            <tr key={`bc-${bIdx}-${cIdx}`} className="text-xs text-gray-500 border-0">
                                                <td className="py-1.5 pl-6 align-top">
                                                    <span className="text-gray-400 mr-1">↳</span>
                                                    <span className="font-medium text-gray-700">{serviceName}</span>
                                                    <div className="mt-0.5">
                                                        <span className="inline-block px-1 py-0.5 bg-purple-50 text-purple-500 text-[8px] font-bold uppercase rounded">Service</span>
                                                    </div>
                                                </td>
                                                <td className="py-1.5 text-center align-top">{child.quantity}</td>
                                                <td className="py-1.5 text-right align-top pr-2">{`${currencySymbol}${(child.price || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}`}</td>
                                                <td className="py-1.5 text-right align-top text-gray-400"></td>
                                            </tr>
                                        );
                                    });
                                }
                            });

                            return renderRows;
                        })()}
                    </tbody>
                </table>

                {/* Package Usage Section */}
                {invoice.packageUsage && invoice.packageUsage.length > 0 && (
                    <div className="border-t border-dashed border-gray-400 py-3 mt-4 space-y-2">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Package Usage Detail</p>
                        {invoice.packageUsage.map((pkg: any, idx: number) => (
                            <div key={idx} className="bg-gray-50 p-2 rounded text-[11px] text-gray-700">
                                <div className="flex justify-between font-bold mb-0.5 text-[12px] text-gray-900">
                                    <span>{pkg.itemName}</span>
                                    <span className="text-blue-700 bg-blue-100 px-1 rounded">{pkg.usedQuantity}x Dipakai</span>
                                </div>
                                <div className="flex justify-between text-[10px] text-gray-500">
                                    <span>Paket: {pkg.packageName}</span>
                                    <span>Sisa Kuota: <strong className="text-emerald-700 font-bold bg-emerald-100 px-1 rounded">{pkg.remainingQuota}</strong></span>
                                </div>
                                {pkg.expiryDate && (
                                    <div className="text-[9px] text-gray-400 mt-1">
                                        Berlaku s/d: {new Date(pkg.expiryDate).toLocaleDateString('id-ID')}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Summary Section */}
                <div className="border-t-2 border-gray-900 pt-6 space-y-3 text-sm">
                    <div className="flex justify-between items-center text-gray-600">
                        <span className="font-medium">Gross Subtotal</span>
                        <span className="font-bold">{currencySymbol}{invoice.subtotal.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                    </div>
                    {invoice.discount > 0 && (
                        <div className="flex flex-col text-red-600">
                            <div className="flex justify-between items-center">
                                <span className="font-medium">Total Discount</span>
                                <span className="font-bold">-{currencySymbol}{invoice.discount.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                            </div>
                            {invoice.discountBreakdown && (
                                <div className="ml-2 mt-1 space-y-0.5 border-l border-red-200 pl-2">
                                    {invoice.discountBreakdown.manual > 0 && (
                                        <div className="flex justify-between text-[11px] text-red-500">
                                            <span>Manual ({invoice.discountBreakdown.manualReason || 'Discount'})</span>
                                            <span>-{currencySymbol}{invoice.discountBreakdown.manual.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                                        </div>
                                    )}
                                    {invoice.discountBreakdown.loyalty > 0 && (
                                        <div className="flex justify-between text-[11px] text-red-500">
                                            <span>Loyalty Points</span>
                                            <span>-{currencySymbol}{invoice.discountBreakdown.loyalty.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                                        </div>
                                    )}
                                    {invoice.discountBreakdown.referral > 0 && (
                                        <div className="flex justify-between text-[11px] text-red-500">
                                            <span>Referral Promo</span>
                                            <span>-{currencySymbol}{invoice.discountBreakdown.referral.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                                        </div>
                                    )}
                                    {invoice.discountBreakdown.voucher > 0 && (
                                        <div className="flex justify-between text-[11px] text-red-500">
                                            <span>Voucher</span>
                                            <span>-{currencySymbol}{invoice.discountBreakdown.voucher.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                    {settings?.showTaxAndTaxableAmountOnReceipt !== false && (
                        <>
                            <div className="flex justify-between items-center text-gray-800 border-t border-gray-100 pt-2">
                                <span className="font-medium text-[12px] uppercase tracking-tight">Taxable Amount</span>
                                <span className="font-bold">{currencySymbol}{(invoice.subtotal - invoice.discount).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                            </div>
                            <div className="flex justify-between items-center text-gray-700">
                                <span className="font-medium">GST / Tax ({(invoice.subtotal - invoice.discount) > 0 ? ((invoice.tax / (invoice.subtotal - invoice.discount)) * 100).toFixed(0) : 0}%)</span>
                                <span className="font-bold">{currencySymbol}{invoice.tax.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                            </div>
                        </>
                    )}
                    {invoice.tips > 0 && (
                        <div className="flex justify-between text-indigo-600 font-bold border-t border-indigo-100 pt-1">
                            <span>Tips</span>
                            <span>{currencySymbol}{invoice.tips.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                        </div>
                    )}
                    <div className="flex justify-between pt-4 border-t-2 border-double border-gray-900 text-xl font-black uppercase text-gray-900">
                        <span>Grand Total</span>
                        <span>{currencySymbol}{invoice.totalAmount.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                    </div>

                    {/* Staff Recognition — conditional via settings */}
                    {settings?.showStaffOnReceipt !== false && invoice.staffAssignments && invoice.staffAssignments.length > 0 && (
                        <div className="mt-8 pt-6 border-t border-gray-100">
                            <p className="mb-3 uppercase font-black tracking-widest text-[9px] text-gray-400 border-l-2 border-gray-200 pl-2">Served By</p>
                            <div className="space-y-1.5 px-1 py-1">
                                {invoice.staffAssignments.map((a: any, i: number) => (
                                    <div key={i} className="flex items-center justify-between text-[11px] bg-gray-50/50 p-2 rounded border border-gray-100/50">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 bg-gray-300 rounded-full"></div>
                                            <span className="font-bold text-gray-800 uppercase tracking-tight">{a.staff?.name || 'Staff Member'}</span>
                                        </div>
                                        {a.tip > 0 && (
                                            <span className="px-2 text-indigo-600 font-black italic underline decoration-indigo-200 underline-offset-2">Tip: {currencySymbol}{a.tip.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="flex justify-between text-green-700 font-bold">
                        <span>Net Paid</span>
                        <span>{currencySymbol}{Math.min(invoice.amountPaid, invoice.totalAmount).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                    </div>
                    {invoice.totalAmount - invoice.amountPaid > 0 && (
                        <div className="flex justify-between text-red-600 font-bold border-t border-dashed border-red-100 mt-1 pt-1">
                            <span>Balance Due</span>
                            <span>{currencySymbol}{Math.max(0, invoice.totalAmount - invoice.amountPaid).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                        </div>
                    )}
                </div>

                {/* Payment History */}
                {deposits.length > 0 && (
                    <div className="mt-6 border-t border-gray-100 pt-4">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Payment History</p>
                        <div className="space-y-2">
                            {deposits.map((dep, idx) => (
                                <div key={idx} className="flex justify-between text-[11px]">
                                    <div className="text-gray-500">
                                        <span>{format(new Date(dep.date), "dd/MM/yy HH:mm")}</span>
                                        <span className="mx-2">•</span>
                                        <span className="uppercase">{dep.paymentMethod}</span>
                                    </div>
                                    <span className="font-bold">{currencySymbol}{dep.amount.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Footer Section */}
                <div className="mt-10 text-center space-y-4">
                    <div className="flex flex-col items-center gap-1">
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest">Payment Method</p>
                        {invoice.paymentMethods && invoice.paymentMethods.length > 1 ? (
                            <div className="flex flex-col items-center gap-1">
                                {invoice.paymentMethods.map((pm: any, i: number) => (
                                    <p key={i} className="font-bold text-sm bg-gray-100 px-3 py-1 rounded-full uppercase">
                                        {pm.method}: {currencySymbol}{pm.amount.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                                    </p>
                                ))}
                            </div>
                        ) : (
                            <p className="font-bold text-sm bg-gray-100 px-3 py-1 rounded-full uppercase">{invoice.paymentMethod || 'Cash'}</p>
                        )}
                    </div>

                    <div className="pt-6 relative">
                        <div className="absolute top-0 left-0 w-full border-t border-dashed border-gray-300"></div>
                        <Scissors className="w-4 h-4 text-gray-300 absolute -top-2 left-1/2 -translate-x-1/2 bg-white px-1" />
                        <p className="text-[11px] font-bold text-gray-900 mt-4 leading-relaxed">
                            THANK YOU FOR CHOOSING {settings?.storeName || "US"}!<br />
                            PLEASE VISIT AGAIN.
                        </p>
                        <p className="text-[9px] text-gray-400 mt-2 italic">Prices inclusive of taxes where applicable</p>
                    </div>

                    <div className="pt-4 flex justify-center opacity-20">
                        {/* Placeholder for barcode-like aesthetic */}
                        <div className="flex gap-px h-8 bg-gray-900 w-full max-w-[200px]"></div>
                    </div>
                    <p className="text-[8px] text-gray-300 tracking-[4px] uppercase">{invoice.invoiceNumber}</p>
                </div>
            </div>

            <style jsx global>{`
                @media print {
                    body {
                        background: white !important;
                        margin: 0;
                        padding: 0;
                    }
                    .print\\:hidden {
                        display: none !important;
                    }
                    @page {
                        margin: 0;
                        size: 80mm auto;
                    }
                }
            `}</style>
        </div>
    );
}