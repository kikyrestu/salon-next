import { NextResponse } from 'next/server';
import { getTenantModels } from '@/lib/tenantDb';
import { checkPermissionWithSession } from '@/lib/rbac';
import { sendWhatsApp } from '@/lib/fonnte';

export async function POST(
  request: Request,
  props: any
) {
  try {
    const { params } = props;
    const tenantSlug = (request as any).headers?.get?.('x-store-slug') || 'pusat';
    const { error: permissionError, session } = await checkPermissionWithSession(request as any, 'invoices', 'view');
    if (permissionError) return permissionError;
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    const { Invoice, Settings } = await getTenantModels(tenantSlug);
    
    const invoice = await Invoice.findById(params.id).populate('customer');
    if (!invoice) {
      return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 });
    }

    const settings = await Settings.findOne();
    if (!settings) {
      return NextResponse.json({ success: false, error: 'Settings not found' }, { status: 400 });
    }

    if (!settings.fonnteToken) {
      return NextResponse.json({ success: false, error: 'Fonnte token not configured' }, { status: 400 });
    }

    const customerName = invoice.customer?.name || 'Pelanggan';
    const storeName = settings.storeName || 'Salon';
    const invoiceNumber = invoice.invoiceNumber;
    const totalAmount = new Intl.NumberFormat('id-ID', { style: 'currency', currency: settings.currency || 'IDR' }).format(invoice.totalAmount);
    const paymentMethod = invoice.paymentMethods?.map((pm: any) => pm.method).join(', ') || invoice.paymentMethod || 'Unknown';

    let message = settings.waNotaTemplate || 'Halo {customer_name}, terima kasih telah berkunjung ke {store_name}. Berikut adalah nota transaksi Anda: {invoice_number} sebesar {total_amount}.';
    message = message.replace(/{customer_name}/g, customerName)
                     .replace(/{store_name}/g, storeName)
                     .replace(/{invoice_number}/g, invoiceNumber)
                     .replace(/{total_amount}/g, totalAmount)
                     .replace(/{payment_method}/g, paymentMethod);

    let sentToCustomer = false;
    let sentToAdmin = false;

    // Send to customer
    if (invoice.customer?.phone) {
      let finalMessage = message;
      if (invoice.customer.publicToken) {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${request.headers.get('host') || 'kikyrestu.vercel.app'}`;
        finalMessage += `\n\n📱 Lihat riwayat kunjungan Anda:\n${baseUrl}/${tenantSlug}/portal/${invoice.customer.publicToken}`;
      }
      const result = await sendWhatsApp(invoice.customer.phone, finalMessage, settings.fonnteToken);
      if (result.success) sentToCustomer = true;
    }

    // Send to admin
    if (settings.waAdminNumber) {
      const adminPrefix = settings.waAdminNotaPrefix || '[NOTIFIKASI ADMIN]';
      const adminMessage = `${adminPrefix}\n\n${message}`;
      const result = await sendWhatsApp(settings.waAdminNumber, adminMessage, settings.fonnteToken);
      if (result.success) sentToAdmin = true;
    }

    if (!sentToCustomer && !sentToAdmin) {
      return NextResponse.json({ success: false, error: 'Gagal mengirim WA ke customer dan admin' }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Nota WA berhasil dikirim${sentToCustomer ? ' ke customer' : ''}${sentToCustomer && sentToAdmin ? ' dan ' : ''}${sentToAdmin ? ' ke admin' : ''}` 
    });

  } catch (error: any) {
    console.error('Error sending WA Nota:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
