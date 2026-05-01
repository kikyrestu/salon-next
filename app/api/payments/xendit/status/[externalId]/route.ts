import { getTenantModels } from "@/lib/tenantDb";
import { NextRequest, NextResponse } from 'next/server';
import { checkPermission } from '@/lib/rbac';
import { getXenditInvoiceById } from '@/lib/xendit';






function mapXenditStatus(status?: string): 'pending' | 'paid' | 'failed' | 'expired' {
  const normalized = (status || '').toUpperCase();
  if (normalized === 'PAID' || normalized === 'SETTLED' || normalized === 'SUCCEEDED') return 'paid';
  if (normalized === 'EXPIRED') return 'expired';
  if (normalized === 'FAILED') return 'failed';
  return 'pending';
}

export async function GET(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { Deposit, Invoice, PaymentTransaction, PackageOrder, CustomerPackage } = await getTenantModels(tenantSlug);

  try {
    const permissionError = await checkPermission(request, 'invoices', 'view');
    if (permissionError) return permissionError;

    

    const { externalId } = await props.params;
    const transaction = await PaymentTransaction.findOne({ externalId });

    if (!transaction) {
      return NextResponse.json({ success: false, error: 'Transaction not found' }, { status: 404 });
    }

    // Fallback sync: query Xendit directly so invoice can be updated even if webhook is delayed.
    if (transaction.status !== 'paid' && transaction.xenditInvoiceId) {
      try {
        const liveInvoice = await getXenditInvoiceById(transaction.xenditInvoiceId);
        const mappedStatus = mapXenditStatus(liveInvoice.status);

        transaction.status = mappedStatus;
        transaction.lastWebhookPayload = {
          source: 'manual-status-sync',
          xenditInvoiceId: liveInvoice.id,
          status: liveInvoice.status,
          amount: liveInvoice.amount,
        };

        if (mappedStatus === 'paid') {
          const amount = Number(liveInvoice.amount || transaction.amount);
          transaction.paidAmount = amount;
          transaction.paidAt = new Date();

          if (transaction.sourceType === 'invoice' && transaction.sourceId) {
            const invoice = await Invoice.findById(transaction.sourceId);

            if (invoice) {
              const externalRef = `xendit:${liveInvoice.id || transaction.xenditInvoiceId || transaction.externalId}`;
              const existingDeposit = await Deposit.findOne({ externalRef });

              if (!existingDeposit) {
                await Deposit.create({
                  invoice: invoice._id,
                  customer: transaction.customer || invoice.customer,
                  amount,
                  paymentMethod: 'QRIS',
                  notes: `Xendit payment ${liveInvoice.id}`,
                  provider: 'xendit',
                  externalRef,
                  metadata: {
                    externalId: transaction.externalId,
                    xenditInvoiceId: liveInvoice.id,
                    source: 'status-sync',
                  },
                });
              }

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
                  serviceQuotas: (order.packageSnapshot?.items || []).map((item: { service: unknown; serviceName: string; quota: number }) => ({
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
        }

        await transaction.save();
      } catch {
        // Ignore fallback sync errors so status endpoint remains available.
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        externalId: transaction.externalId,
        status: transaction.status,
        amount: transaction.amount,
        paidAmount: transaction.paidAmount || 0,
        checkoutUrl: transaction.checkoutUrl,
        sourceType: transaction.sourceType,
        sourceId: transaction.sourceId,
        paymentMethod: transaction.paymentMethod,
        paidAt: transaction.paidAt,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to get status';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
