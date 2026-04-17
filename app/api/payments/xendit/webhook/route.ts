import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectToDB } from '@/lib/mongodb';
import Deposit from '@/models/Deposit';
import Invoice from '@/models/Invoice';
import PaymentTransaction from '@/models/PaymentTransaction';
import PackageOrder from '@/models/PackageOrder';
import CustomerPackage from '@/models/CustomerPackage';

function mapXenditStatus(status?: string): 'pending' | 'paid' | 'failed' | 'expired' {
  const normalized = (status || '').toUpperCase();

  if (normalized === 'PAID' || normalized === 'SETTLED' || normalized === 'SUCCEEDED') return 'paid';
  if (normalized === 'EXPIRED') return 'expired';
  if (normalized === 'FAILED') return 'failed';
  return 'pending';
}

function getRecordValue(record: Record<string, unknown>, key: string): unknown {
  return record[key];
}

function normalizeWebhookPayload(payload: Record<string, unknown>) {
  const data = payload?.data && typeof payload.data === 'object'
    ? (payload.data as Record<string, unknown>)
    : payload;

  const externalId =
    getRecordValue(payload, 'external_id') ||
    getRecordValue(data, 'external_id') ||
    getRecordValue(payload, 'reference_id') ||
    getRecordValue(data, 'reference_id');

  const gatewayId =
    getRecordValue(payload, 'id') ||
    getRecordValue(data, 'id') ||
    getRecordValue(data, 'qr_id');

  const status = getRecordValue(payload, 'status') || getRecordValue(data, 'status');
  const paidAmount =
    getRecordValue(payload, 'paid_amount') ??
    getRecordValue(data, 'paid_amount') ??
    getRecordValue(data, 'amount');
  const paidAt =
    getRecordValue(payload, 'paid_at') ||
    getRecordValue(data, 'paid_at') ||
    getRecordValue(data, 'created') ||
    getRecordValue(payload, 'created');

  const paymentDetail = getRecordValue(data, 'payment_detail');
  const paymentDetailSource =
    paymentDetail && typeof paymentDetail === 'object'
      ? (paymentDetail as Record<string, unknown>).source
      : undefined;

  const paymentMethod =
    getRecordValue(payload, 'payment_method') ||
    getRecordValue(payload, 'payment_channel') ||
    getRecordValue(data, 'channel_code') ||
    paymentDetailSource;

  return {
    event: String(getRecordValue(payload, 'event') || 'unknown'),
    externalId: externalId ? String(externalId) : undefined,
    gatewayId: gatewayId ? String(gatewayId) : undefined,
    status: status ? String(status) : undefined,
    paidAmount,
    paidAt: paidAt ? String(paidAt) : undefined,
    paymentMethod: paymentMethod ? String(paymentMethod) : undefined,
  };
}

export async function POST(request: NextRequest) {
  try {
    const callbackToken = request.headers.get('x-callback-token');
    const expectedToken = process.env.XENDIT_WEBHOOK_TOKEN;

    if (!expectedToken) {
      return NextResponse.json({ success: false, error: 'Webhook token not configured' }, { status: 500 });
    }

    if (!callbackToken || callbackToken !== expectedToken) {
      return NextResponse.json({ success: false, error: 'Invalid callback token' }, { status: 401 });
    }

    await connectToDB();

    const payload = (await request.json()) as Record<string, unknown>;
    const normalized = normalizeWebhookPayload(payload);
    const externalId = normalized.externalId;

    if (!externalId) {
      return NextResponse.json({ success: false, error: 'Missing transaction reference (external_id/reference_id)' }, { status: 400 });
    }

    let transaction = await PaymentTransaction.findOne({ externalId });
    if (!transaction && normalized.gatewayId) {
      transaction = await PaymentTransaction.findOne({ xenditInvoiceId: normalized.gatewayId });
    }

    if (!transaction) {
      return NextResponse.json({ success: true, ignored: true, message: 'Transaction not found' });
    }

    const eventKey = `${normalized.event}:${normalized.gatewayId || 'no-id'}:${normalized.status || 'no-status'}:${normalized.paidAmount || 0}`;
    if (transaction.processedEventKeys.includes(eventKey)) {
      return NextResponse.json({ success: true, alreadyProcessed: true });
    }

    const mappedStatus = mapXenditStatus(normalized.status);

    transaction.status = mappedStatus;
    transaction.lastWebhookPayload = payload;
    transaction.processedEventKeys.push(eventKey);
    transaction.xenditInvoiceId = normalized.gatewayId || transaction.xenditInvoiceId;
    transaction.paymentMethod = normalized.paymentMethod || transaction.paymentMethod;

    if (mappedStatus === 'paid') {
      transaction.paidAmount = Number(normalized.paidAmount || transaction.amount);
      transaction.paidAt = normalized.paidAt ? new Date(normalized.paidAt) : new Date();

      if (transaction.sourceType === 'invoice' && transaction.sourceId) {
        const invoice = await Invoice.findById(transaction.sourceId);

        if (invoice) {
          const externalRef = `xendit:${normalized.gatewayId || transaction.xenditInvoiceId || externalId}`;
          const existingDeposit = await Deposit.findOne({ externalRef });

          const amount = Number(normalized.paidAmount || transaction.amount);

          if (!existingDeposit) {

            await Deposit.create({
              invoice: invoice._id,
              customer: transaction.customer || invoice.customer,
              amount,
              paymentMethod: 'QRIS',
              notes: `Xendit payment ${normalized.gatewayId || ''}`,
              provider: 'xendit',
              externalRef,
              metadata: {
                externalId,
                xenditInvoiceId: normalized.gatewayId || transaction.xenditInvoiceId,
                event: normalized.event,
              },
            });
          }

          // Always recompute invoice paid amount from deposits to self-heal inconsistent states.
          const depositAgg = await Deposit.aggregate([
            { $match: { invoice: invoice._id } },
            { $group: { _id: '$invoice', totalPaid: { $sum: '$amount' } } },
          ]);

          const totalPaid = Number(depositAgg[0]?.totalPaid || 0);
          invoice.amountPaid = totalPaid;

          if (totalPaid >= Number(invoice.totalAmount || 0)) {
            invoice.status = 'paid';
          } else if (totalPaid > 0) {
            invoice.status = 'partially_paid';
          } else {
            invoice.status = 'pending';
          }

          invoice.paymentMethod = 'QRIS';
          await invoice.save();
        }
      }

      if (transaction.sourceType === 'package_order' && transaction.sourceId) {
        const order = await PackageOrder.findById(transaction.sourceId);
        if (order) {
          let customerPackageId = order.activatedCustomerPackage;

          if (!customerPackageId) {
            const customerPackage = await CustomerPackage.create({
              customer: order.customer,
              package: order.package,
              packageName: order.packageSnapshot?.name || 'Package',
              order: order._id,
              activatedAt: new Date(),
              status: 'active',
              serviceQuotas: (order.packageSnapshot?.items || []).map((item: { service: mongoose.Types.ObjectId; serviceName: string; quota: number }) => ({
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
        }
      }
    } else if (transaction.sourceType === 'package_order' && transaction.sourceId) {
      const order = await PackageOrder.findById(transaction.sourceId);
      if (order) {
        if (mappedStatus === 'failed') order.status = 'failed';
        if (mappedStatus === 'expired') order.status = 'expired';
        await order.save();
      }
    }

    await transaction.save();

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Webhook processing failed';
    console.error('XENDIT_WEBHOOK_ERROR:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
