const XENDIT_BASE_URL = process.env.XENDIT_BASE_URL || 'https://api.xendit.co';

export interface CreateXenditInvoicePayload {
  externalId: string;
  amount: number;
  description: string;
  successRedirectUrl?: string;
  failureRedirectUrl?: string;
  paymentMethods?: string[];
}

export interface XenditInvoiceResponse {
  id: string;
  external_id: string;
  amount: number;
  status: string;
  invoice_url: string;
  expiry_date?: string;
}

function getXenditSecretKey(): string {
  const key = process.env.XENDIT_SECRET_KEY;
  if (!key) {
    throw new Error('XENDIT_SECRET_KEY is not configured');
  }
  return key;
}

function getAuthHeader(secretKey: string): string {
  return `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`;
}

export async function createXenditInvoice(payload: CreateXenditInvoicePayload): Promise<XenditInvoiceResponse> {
  const secretKey = getXenditSecretKey();

  const body: Record<string, unknown> = {
    external_id: payload.externalId,
    amount: payload.amount,
    description: payload.description,
    currency: 'IDR',
    invoice_duration: 24 * 60 * 60,
    should_send_email: false,
    payment_methods: payload.paymentMethods && payload.paymentMethods.length > 0 ? payload.paymentMethods : ['QRIS'],
  };

  if (payload.successRedirectUrl) {
    body.success_redirect_url = payload.successRedirectUrl;
  }
  if (payload.failureRedirectUrl) {
    body.failure_redirect_url = payload.failureRedirectUrl;
  }

  const response = await fetch(`${XENDIT_BASE_URL}/v2/invoices`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: getAuthHeader(secretKey),
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    const message = data?.message || 'Failed to create Xendit invoice';
    throw new Error(message);
  }

  return data as XenditInvoiceResponse;
}

export async function getXenditInvoiceById(invoiceId: string): Promise<XenditInvoiceResponse> {
  const secretKey = getXenditSecretKey();

  const response = await fetch(`${XENDIT_BASE_URL}/v2/invoices/${invoiceId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: getAuthHeader(secretKey),
    },
  });

  const data = await response.json();

  if (!response.ok) {
    const message = data?.message || 'Failed to fetch Xendit invoice';
    throw new Error(message);
  }

  return data as XenditInvoiceResponse;
}
