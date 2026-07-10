import { getTenantModels } from "@/lib/tenantDb";
import { NextRequest, NextResponse } from 'next/server';
import { checkPermissionWithSession } from '@/lib/rbac';
import { generateInvoiceNumber } from "@/lib/invoiceNumber";

interface PatchBody {
  paid?: boolean;
  paymentMethod?: string;
}

export async function PATCH(request: NextRequest, props: any) {
  const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
  const { Invoice, PackageOrder, CustomerPackage, Customer, WalletTransaction, CashBalance, CashLog } = await getTenantModels(tenantSlug);
  try {
    // [FIX] Pakai checkPermissionWithSession supaya kita dapat session/userId untuk
    // mencatat siapa yang memproses pembayaran (dibutuhkan oleh CashLog/WalletTransaction).
    const { error: permissionError, session } = await checkPermissionWithSession(request, 'invoices', 'edit');
    if (permissionError) return permissionError;
    const userId = (session as any)?.user?.id;

    const { id } = await props.params;
    const body = (await request.json()) as PatchBody;

    const order = await PackageOrder.findById(id).populate('package');
    if (!order) {
      return NextResponse.json({ success: false, error: 'Package order not found' }, { status: 404 });
    }

    if (!body.paid) {
      order.status = 'pending';
      await order.save();
      return NextResponse.json({ success: true, data: order });
    }

    // Order ini sudah lunas & paketnya sudah aktif sebelumnya — jangan proses ulang
    // potongan wallet / cash drawer (mencegah double-charge kalau PATCH dipanggil lagi).
    const alreadyPaid = order.status === 'paid' && !!order.activatedCustomerPackage;

    const paymentMethod = body.paymentMethod || 'Cash';
    const amount = Number(order.amount || 0);
    const isWalletPayment = paymentMethod.toLowerCase() === 'wallet';
    const isCashPayment = paymentMethod.toLowerCase() === 'cash';

    // --- BUG FIX #1: Validasi & potong saldo e-wallet customer ---
    // Endpoint ini sebelumnya langsung mengaktifkan paket begitu `paid: true` dikirim,
    // TANPA pernah memvalidasi atau memotong walletBalance customer walaupun kasir
    // memilih metode bayar "Wallet" di POS. Akibatnya paket bisa "dibeli" gratis kalau
    // dibayar pakai e-wallet (saldo customer tidak berkurang sama sekali).
    let walletDeducted = false;
    if (!alreadyPaid && isWalletPayment && amount > 0) {
      if (!order.customer) {
        return NextResponse.json({ success: false, error: 'Order paket tidak memiliki data customer.' }, { status: 400 });
      }
      const updatedCustomer = await Customer.findOneAndUpdate(
        { _id: order.customer, walletBalance: { $gte: amount } },
        { $inc: { walletBalance: -amount } },
        { new: true }
      );
      if (!updatedCustomer) {
        const customerDoc = await Customer.findById(order.customer).select('walletBalance');
        return NextResponse.json({
          success: false,
          error: `Saldo e-wallet tidak mencukupi. Saldo saat ini: Rp ${(customerDoc?.walletBalance || 0).toLocaleString('id-ID')}`,
        }, { status: 400 });
      }
      walletDeducted = true;
    }

    let customerPackageId = order.activatedCustomerPackage;

    try {
      if (!customerPackageId) {
        const customerPackage = await CustomerPackage.create({
          customer: order.customer,
          package: order.package,
          packageName: order.packageSnapshot?.name || 'Package',
          order: order._id,
          activatedAt: new Date(),
          ...(order.packageSnapshot?.validityDays ? { expiresAt: new Date(Date.now() + order.packageSnapshot.validityDays * 24 * 60 * 60 * 1000) } : {}),
          status: 'active',
          serviceQuotas: (order.packageSnapshot?.items || []).map((item: { service: import('mongoose').Types.ObjectId; serviceName: string; quota: number }) => ({
            service: item.service,
            serviceName: item.serviceName,
            totalQuota: Number(item.quota || 0),
            usedQuota: 0,
            remainingQuota: Number(item.quota || 0),
          })),
        });
        customerPackageId = customerPackage._id;
      }

      order.status = 'paid';
      order.activatedCustomerPackage = customerPackageId;
      await order.save();
    } catch (activationError) {
      // Rollback potongan wallet kalau aktivasi paket gagal, supaya saldo customer
      // tidak hilang percuma tanpa paket yang aktif.
      if (walletDeducted) {
        await Customer.findByIdAndUpdate(order.customer, { $inc: { walletBalance: amount } });
      }
      throw activationError;
    }

    // Generate Invoice for this package purchase so it appears in reports, receipts, and customer history
    let createdInvoice = null;
    try {
      const packageName = order.packageSnapshot?.name || 'Package';
      const packageCode = order.packageSnapshot?.code || '';

      // Get commission info from the package if available
      const pkg = order.package as any;
      const commissionType = pkg?.commissionType || 'fixed';
      const commissionValue = Number(pkg?.commissionValue || 0);
      let commissionAmount = 0;
      if (commissionType === 'percentage') {
        commissionAmount = Math.round(amount * commissionValue / 100);
      } else {
        commissionAmount = commissionValue;
      }

      const invoiceNumber = await generateInvoiceNumber(tenantSlug);

      // [BUG FIX] Sebelumnya commissionAmount cuma disimpen di field flat
      // `invoice.commission` tanpa ada info staff-nya sama sekali. Report Staff
      // Performance & Payroll sama-sama nyari staff lewat item.sellingBy /
      // item.staffAssignments / invoice.staffAssignments / invoice.staff — semua
      // itu kosong untuk invoice pembelian paket, jadi komisinya nggak pernah
      // ke-attribute ke staff manapun. Fix: taruh juga di item.sellingBy +
      // item.sellingCommission (field yang sama yang dipakai Product/Service),
      // biar konsisten kebaca sama report & payroll tanpa perlu ubah logic lain.
      const sellingByStaffId = order.sellingBy || undefined;

      createdInvoice = await Invoice.create({
        invoiceNumber,
        customer: order.customer,
        items: [{
          item: typeof order.package === 'object' && order.package?._id ? order.package._id : order.package,
          // [BUG FIX #2] itemModel sebelumnya di-hardcode "Service" dengan komentar
          // "Invoice only supports Service/Product" — padahal skema Invoice (models/Invoice.ts)
          // sudah mendukung "ServicePackage" di enum itemModel. Karena field `item` di atas
          // adalah ID dokumen ServicePackage, menyimpannya sebagai itemModel "Service" membuat
          // populate/refPath (items.itemModel) salah arah ke koleksi Service, bukan
          // ServicePackage — bisa bikin data item paket gagal ter-populate di laporan/riwayat.
          itemModel: 'ServicePackage',
          name: `Paket: ${packageName}${packageCode ? ` (${packageCode})` : ''}`,
          price: order.packageSnapshot?.price || amount,
          quantity: 1,
          discount: order.discount || 0,
          total: amount,
          sellingBy: sellingByStaffId,
          sellingCommission: sellingByStaffId ? commissionAmount : 0,
        }],
        subtotal: order.packageSnapshot?.price || amount,
        tax: 0,
        discount: order.discount || 0,
        totalAmount: amount,
        amountPaid: amount,
        tips: 0,
        paymentMethod,
        paymentMethods: [{ method: paymentMethod, amount }],
        status: 'paid',
        commission: commissionAmount,
        sourceType: 'package_purchase',
        notes: `Pembelian Paket ${packageName} (Order: ${order.orderNumber})`,
        date: new Date(),
      });
    } catch (invoiceError) {
      console.error('[PackageOrder] Failed to create invoice for package purchase:', invoiceError);
      // Don't fail the entire operation if invoice creation fails
    }

    // --- BUG FIX #3: Catat transaksi wallet & CASH DRAWER ---
    // Ini akar masalah utamanya: endpoint ini membuat Invoice langsung lewat
    // Invoice.create() di atas, sehingga BYPASS semua efek samping yang biasanya
    // jalan di app/api/invoices/route.ts — termasuk blok "CASH DRAWER INTEGRATION"
    // yang menambah CashBalance.kasirBalance + mencatat CashLog setiap ada
    // pembayaran cash. Akibatnya: transaksi PAKET yang dibayar tunai tidak pernah
    // masuk ke saldo laci kasir. Efek nyatanya kerasa pas tutup kasir (session
    // close di /api/cash-drawer/session): expectedEndingCash dihitung dari
    // CashBalance.kasirBalance, jadi selalu lebih kecil dari uang fisik yang
    // sebenarnya diterima kasir setiap kali ada penjualan paket cash -> laci kasir
    // "gak ketemu"/selisih terus.
    if (!alreadyPaid && walletDeducted) {
      const custAfter = await Customer.findById(order.customer).select('walletBalance');
      await WalletTransaction.create({
        customer: order.customer,
        type: 'payment',
        amount,
        balanceAfter: custAfter?.walletBalance || 0,
        description: `Pembayaran Paket ${order.orderNumber}`,
        invoice: createdInvoice?._id,
        performedBy: userId,
      });
    }

    if (!alreadyPaid && isCashPayment && amount > 0) {
      const balance = await CashBalance.findOneAndUpdate(
        {},
        { $inc: { kasirBalance: amount }, $set: { lastUpdatedAt: new Date() } },
        { new: true, upsert: true }
      );

      await CashLog.create({
        type: 'sale',
        amount,
        sourceLocation: 'customer',
        destinationLocation: 'kasir',
        performedBy: userId,
        description: `Pembayaran Paket ${order.orderNumber}${createdInvoice ? ` (Invoice ${createdInvoice.invoiceNumber})` : ''}`,
        ...(createdInvoice ? { referenceModel: 'Invoice', referenceId: createdInvoice._id } : {}),
        balanceAfter: {
          kasir: balance.kasirBalance,
          brankas: balance.brankasBalance,
          bank: balance.bankBalance,
        },
      });
    }

    return NextResponse.json({ success: true, data: order, invoice: createdInvoice });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update package order';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}