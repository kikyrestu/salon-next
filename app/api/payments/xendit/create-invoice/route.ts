import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/lib/mongodb';
import { checkPermission } from '@/lib/rbac';
import { createXenditInvoice } from '@/lib/xendit';
import Invoice from '@/models/Invoice';
import PaymentTransaction from '@/models/PaymentTransaction';
import PackageOrder from '@/models/PackageOrder';
import mongoose from 'mongoose';

function makeExternalId(): string {
  return `xdt-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

export async function POST(request: NextRequest) {
  try {
    const permissionError = await checkPermission(request, 'invoices', 'create');
    if (permissionError) return permissionError;

    await connectToDB();

    const body = await request.json();
    const {
      invoiceId,
      sourceType,
      sourceId,
      amount,
      customer,
      description,
      successRedirectUrl,
      failureRedirectUrl,
      paymentMethods,
    } = body;

    let finalAmount = Number(amount || 0);
    let sourceDocId = undefined;
    let finalSourceType: 'invoice' | 'package_order' = 'package_order';
    let customerId = customer;
    let defaultDescription = 'Pembayaran Salon via Xendit';

    if (invoiceId) {
      if (!mongoose.Types.ObjectId.isValid(invoiceId)) {
        return NextResponse.json({ success: false, error: 'Invoice ID is invalid' }, { status: 400 });
      }

      const invoice = await Invoice.findById(invoiceId);
      if (!invoice) {
        return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 });
      }

      finalAmount = Number(invoice.totalAmount) - Number(invoice.amountPaid || 0);
      sourceDocId = invoice._id;
      finalSourceType = 'invoice';
      customerId = customerId || invoice.customer;
      defaultDescription = `Pembayaran ${invoice.invoiceNumber}`;

      if (finalAmount <= 0) {
        return NextResponse.json({ success: false, error: 'Invoice already fully paid' }, { status: 400 });
      }

      invoice.status = 'pending';
      invoice.paymentMethod = 'QRIS';
      await invoice.save();
    }

    if (!invoiceId && sourceType === 'package_order') {
      if (!sourceId || !mongoose.Types.ObjectId.isValid(sourceId)) {
        return NextResponse.json({ success: false, error: 'sourceId is required for package_order' }, { status: 400 });
      }

      const order = await PackageOrder.findById(sourceId);
      if (!order) {
        return NextResponse.json({ success: false, error: 'Package order not found' }, { status: 404 });
      }

      finalAmount = Number(order.amount || 0);
      sourceDocId = order._id;
      customerId = customerId || order.customer;
      finalSourceType = 'package_order';
      defaultDescription = `Pembelian Paket ${order.orderNumber}`;
    }

    if (finalAmount <= 0) {
      return NextResponse.json({ success: false, error: 'Amount must be greater than zero' }, { status: 400 });
    }

    const externalId = makeExternalId();
    const xenditInvoice = await createXenditInvoice({
      externalId,
      amount: finalAmount,
      description: description || defaultDescription,
      successRedirectUrl,
      failureRedirectUrl,
      paymentMethods,
    });

    const transaction = await PaymentTransaction.create({
      provider: 'xendit',
      sourceType: finalSourceType,
      sourceId: sourceDocId,
      customer: customerId,
      externalId,
      xenditInvoiceId: xenditInvoice.id,
      amount: finalAmount,
      currency: 'IDR',
      status: 'pending',
      checkoutUrl: xenditInvoice.invoice_url,
      paymentMethod: 'QRIS',
    });

    if (finalSourceType === 'package_order' && sourceDocId) {
      await PackageOrder.findByIdAndUpdate(sourceDocId, {
        paymentTransaction: transaction._id,
        status: 'pending',
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        externalId,
        xenditInvoiceId: xenditInvoice.id,
        amount: finalAmount,
        checkoutUrl: xenditInvoice.invoice_url,
        status: transaction.status,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create payment';
    console.error('XENDIT_CREATE_INVOICE_ERROR:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
