import { NextResponse } from 'next/server';
import { getTenantModels } from '@/lib/tenantDb';
import { checkPermissionWithSession } from '@/lib/rbac';
import { sendWhatsApp } from '@/lib/fonnte';
import { decryptFonnteToken } from '@/lib/encryption';
import { normalizeIndonesianPhone } from '@/lib/phone';
import crypto from 'crypto';

export async function POST(
  request: Request,
  props: any
) {
  try {
    const { id } = await props.params;
    const tenantSlug = request.headers?.get?.('x-store-slug') || 'pusat';
    const { error: permissionError, session } = await checkPermissionWithSession(request as any, 'invoices', 'view');
    if (permissionError) return permissionError;
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    const { Invoice, Settings, ShortLink } = await getTenantModels(tenantSlug);
    
    const { Customer } = await getTenantModels(tenantSlug);
    const invoice = await Invoice.findById(id).populate('customer');
    if (!invoice) {
      return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 });
    }

    if (invoice.customer && !invoice.customer.publicToken) {
      const { randomUUID } = require('crypto');
      invoice.customer.publicToken = randomUUID();
      await Customer.updateOne({ _id: invoice.customer._id }, { publicToken: invoice.customer.publicToken });
    }

    const settings: any = await Settings.findOne();
    if (!settings) {
      return NextResponse.json({ success: false, error: 'Settings not found' }, { status: 400 });
    }

    if (!settings.fonnteToken) {
      return NextResponse.json({ success: false, error: 'Fonnte token not configured. Silakan isi token Fonnte di Settings.' }, { status: 400 });
    }

    // Decrypt fonnte token before using
    const fonnteToken = decryptFonnteToken(String(settings.fonnteToken).trim());
    if (!fonnteToken) {
      return NextResponse.json({ success: false, error: 'Gagal decrypt token Fonnte. Re-save token di Settings.' }, { status: 500 });
    }

    const formatRupiah = (num: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: settings.currency || 'IDR' }).format(num || 0);

    const customerName = invoice.customer?.name || 'Pelanggan';
    const storeName = settings.storeName || 'Salon';
    const storeAddress = settings.storeAddress || '';
    const invoiceNumber = invoice.invoiceNumber;
    const dateStr = new Date(invoice.createdAt || new Date()).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).replace(/\./g, ':');
    const showStaff = settings.showStaffOnReceipt !== false;
    const staffName = showStaff
        ? (invoice.staff?.name || invoice.staffAssignments?.[0]?.staff?.name || 'Kasir')
        : '';
    
    const subtotal = formatRupiah(invoice.subtotal);
    const discount = formatRupiah(invoice.discount);
    const totalAmount = formatRupiah(invoice.totalAmount);
    const amountPaid = formatRupiah(invoice.amountPaid);
    const changeAmount = formatRupiah(Math.max(0, (invoice.amountPaid || 0) - invoice.totalAmount));
    
    const paymentMethod = invoice.paymentMethods?.map((pm: any) => pm.method).join(', ') || invoice.paymentMethod || 'Unknown';
    const receiptFooter = settings.receiptFooter || '';

    let itemsText = '';
    if (invoice.items && Array.isArray(invoice.items)) {
      itemsText = invoice.items.map((item: any) => {
        return `${item.quantity}x ${item.name}\n   ${formatRupiah(item.price * item.quantity)}`;
      }).join('\n');
    }

    let message = settings.waNotaTemplate || 'Halo {customer_name}, terima kasih telah berkunjung ke {store_name}. Berikut adalah nota transaksi Anda: {invoice_number} sebesar {total_amount}.';
    
    // Support both {single} and {{double}} brace placeholders
    message = message
      .replace(/\{\{?customer_name\}?\}/g, customerName)
      .replace(/\{\{?customerName\}?\}/g, customerName)
      .replace(/\{\{?store_name\}?\}/g, storeName)
      .replace(/\{\{?storeName\}?\}/g, storeName)
      .replace(/\{\{?store_address\}?\}/g, storeAddress)
      .replace(/\{\{?storeAddress\}?\}/g, storeAddress)
      .replace(/\{\{?invoice_number\}?\}/g, invoiceNumber)
      .replace(/\{\{?invoiceNumber\}?\}/g, invoiceNumber)
      .replace(/\{\{?date\}?\}/g, dateStr)
      .replace(/\{\{?staff_name\}?\}/g, staffName)
      .replace(/\{\{?staffName\}?\}/g, staffName)
      .replace(/\{\{?items\}?\}/g, itemsText)
      .replace(/\{\{?subtotal\}?\}/g, subtotal)
      .replace(/\{\{?discount\}?\}/g, discount)
      .replace(/\{\{?total_amount\}?\}/g, totalAmount)
      .replace(/\{\{?total\}?\}/g, totalAmount)
      .replace(/\{\{?amount_paid\}?\}/g, amountPaid)
      .replace(/\{\{?amountPaid\}?\}/g, amountPaid)
      .replace(/\{\{?change\}?\}/g, changeAmount)
      .replace(/\{\{?payment_method\}?\}/g, paymentMethod)
      .replace(/\{\{?receipt_footer\}?\}/g, receiptFooter)
      .replace(/\{\{?receiptFooter\}?\}/g, receiptFooter);

    // Clean up empty staff lines when showStaffOnReceipt is off
    if (!showStaff) {
      message = message.replace(/^.*(?:Kasir|Staff|staff_name|staffName).*:\s*\n?/gm, '');
    }

    let sentToCustomer = false;
    let sentToAdmin = false;

    // Send to customer
    if (invoice.customer?.phone) {
      const phone = normalizeIndonesianPhone(invoice.customer.phone);
      if (phone) {
        let finalMessage = message;
        if (invoice.customer.publicToken) {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || `https://${request.headers.get('host') || 'kikyrestu.vercel.app'}`;
          const targetUrl = `${baseUrl}/${tenantSlug}/portal/${invoice.customer.publicToken}/invoice/${invoice._id}`;
          const historyUrl = `${baseUrl}/${tenantSlug}/portal/${invoice.customer.publicToken}`;
          
          let shortCode = '';
          let historyShortCode = '';
          let attempts = 0;
          
          while (!shortCode && attempts < 5) {
            const code = crypto.randomBytes(3).toString('hex');
            const exists = await ShortLink.findOne({ code });
            if (!exists) shortCode = code;
            attempts++;
          }

          attempts = 0;
          while (!historyShortCode && attempts < 5) {
            const code = crypto.randomBytes(3).toString('hex');
            const exists = await ShortLink.findOne({ code });
            if (!exists) historyShortCode = code;
            attempts++;
          }
          
          if (shortCode) {
            await ShortLink.create({ code: shortCode, targetUrl });
            finalMessage += `\n\n🧾 *Lihat Nota Digital Anda:*\n${baseUrl}/${tenantSlug}/r/${shortCode}`;
          } else {
            finalMessage += `\n\n🧾 *Lihat Nota Digital Anda:*\n${targetUrl}`;
          }

          if (historyShortCode) {
            await ShortLink.create({ code: historyShortCode, targetUrl: historyUrl });
            finalMessage += `\n\n👤 *Lihat Riwayat Transaksi & Sisa Paket:*\n${baseUrl}/${tenantSlug}/r/${historyShortCode}`;
          } else {
            finalMessage += `\n\n👤 *Lihat Riwayat Transaksi & Sisa Paket:*\n${historyUrl}`;
          }
        }
        const result = await sendWhatsApp(phone, finalMessage, fonnteToken);
        if (result.success) sentToCustomer = true;
        else console.error('[WA Nota] Customer send failed:', result.error);
      }
    }

    // Send to admin (only if it's a different number from customer to avoid double-sending during testing)
    if (settings.waAdminNumber) {
      const adminPhone = normalizeIndonesianPhone(settings.waAdminNumber);
      const customerPhone = invoice.customer?.phone ? normalizeIndonesianPhone(invoice.customer.phone) : null;
      
      if (adminPhone && adminPhone !== customerPhone) {
        const adminPrefix = settings.waAdminNotaPrefix || '[NOTIFIKASI ADMIN]';
        const adminMessage = `${adminPrefix}\n\n${message}`;
        const result = await sendWhatsApp(adminPhone, adminMessage, fonnteToken);
        if (result.success) sentToAdmin = true;
        else console.error('[WA Nota] Admin send failed:', result.error);
      } else if (adminPhone === customerPhone) {
        sentToAdmin = true; // Mark as sent to avoid error response
      }
    }

    if (!sentToCustomer && !sentToAdmin) {
      return NextResponse.json({ success: false, error: 'Gagal mengirim WA. Pastikan nomor HP customer/admin valid dan token Fonnte aktif.' }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Nota WA berhasil dikirim${sentToCustomer ? ' ke customer' : ''}${sentToCustomer && sentToAdmin ? ' dan' : ''}${sentToAdmin ? ' ke admin' : ''}` 
    });

  } catch (error: any) {
    console.error('Error sending WA Nota:', error);
    return NextResponse.json({ success: false, error: error.message || 'Gagal mengirim WA Nota' }, { status: 500 });
  }
}
