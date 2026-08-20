import crypto from 'crypto';
import { InitiatePaymentInput, InitiatePaymentResult, PaymentProvider, PaymentStatus } from './PaymentProvider';

type SelcomResponse = {
  reference?: string;
  resultcode?: string;
  result?: string;
  message?: string;
  data?: Array<Record<string, unknown>>;
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`SELCOM_NOT_CONFIGURED: missing ${name}`);
  return value;
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

function asDigits(phone: string): string {
  return phone.replace(/^\+/, '');
}

function encodeUrl(url: string): string {
  return Buffer.from(url).toString('base64');
}

function mapStatus(status: unknown): PaymentStatus {
  const normalized = String(status || '').toUpperCase();
  if (['COMPLETED', 'SUCCESS'].includes(normalized)) return 'SUCCESS';
  if (['CANCELLED', 'USERCANCELLED'].includes(normalized)) return 'CANCELLED';
  if (['REJECTED', 'FAILED'].includes(normalized)) return 'FAILED';
  if (['EXPIRED'].includes(normalized)) return 'EXPIRED';
  if (['INPROGRESS', 'PENDING', 'PROCESSING'].includes(normalized)) return 'PROCESSING';
  return 'PENDING';
}

export function assertSelcomConfigured(): void {
  if ((process.env.PAYMENT_PROVIDER || '').toLowerCase() !== 'selcom') return;
  required('SELCOM_VENDOR_ID');
  required('SELCOM_API_KEY');
  required('SELCOM_SECRET_KEY');
  required('SELCOM_CALLBACK_URL');
  required('SELCOM_REDIRECT_URL');
}

export class SelcomPaymentProvider implements PaymentProvider {
  private readonly baseUrl: string;
  private readonly vendor: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;

  constructor() {
    this.baseUrl = normalizeBaseUrl(process.env.SELCOM_BASE_URL || 'https://api.selcom.business');
    this.vendor = required('SELCOM_VENDOR_ID');
    this.apiKey = required('SELCOM_API_KEY');
    this.apiSecret = required('SELCOM_SECRET_KEY');
  }

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    const payload: Record<string, string | number> = {
      vendor: this.vendor,
      order_id: input.orderId,
      buyer_email: `customer-${input.paymentId}@example.invalid`,
      buyer_name: input.phone,
      buyer_phone: asDigits(input.phone),
      amount: input.amount,
      currency: input.currency,
      redirect_url: encodeUrl(input.redirectUrl),
      cancel_url: encodeUrl(input.cancelUrl),
      webhook: encodeUrl(input.callbackUrl),
      no_of_items: 1,
    };

    const response = await this.request('POST', '/v1/checkout/create-order-minimal', payload);
    const first = response.data?.[0] ?? {};
    const paymentUrlRaw = first.payment_gateway_url;
    const paymentUrl = typeof paymentUrlRaw === 'string' ? this.decodeMaybeBase64Url(paymentUrlRaw) : undefined;
    const resultStatus = String(response.result || '').toUpperCase();

    return {
      providerReference: String(response.reference || input.orderId),
      providerOrderId: input.orderId,
      status: resultStatus === 'FAIL' ? 'FAILED' : 'PROCESSING',
      message: response.message || 'Payment request sent',
      paymentUrl,
      raw: response,
    };
  }

  async queryPaymentStatus(orderId: string) {
    const payload = { order_id: orderId };
    const response = await this.request('GET', '/v1/checkout/order-status', payload);
    const first = response.data?.[0] ?? {};
    const status = mapStatus(first.payment_status ?? response.result);
    const amount = first.amount != null ? Number(first.amount) : undefined;
    const currency = first.currency != null ? String(first.currency) : undefined;
    const providerReference = String(first.reference || first.transid || response.reference || orderId);
    return { status, providerReference, amount, currency, raw: response };
  }

  async verifyPayment(orderId: string): Promise<{ status: PaymentStatus }> {
    const status = await this.queryPaymentStatus(orderId);
    return { status: status.status };
  }

  private async request(method: 'GET' | 'POST', path: string, fields: Record<string, string | number>): Promise<SelcomResponse> {
    const headers = this.headers(fields);
    const url = new URL(`${this.baseUrl}${path}`);
    const init: RequestInit = { method, headers };
    if (method === 'GET') {
      Object.entries(fields).forEach(([key, value]) => url.searchParams.set(key, String(value)));
    } else {
      init.body = JSON.stringify(fields);
    }

    const res = await fetch(url, init);
    const text = await res.text();
    let json: SelcomResponse;
    try {
      json = text ? JSON.parse(text) as SelcomResponse : {};
    } catch {
      throw new Error(`SELCOM_BAD_RESPONSE: ${res.status}`);
    }
    if (!res.ok) {
      throw new Error(`SELCOM_HTTP_${res.status}: ${json.message || 'Request failed'}`);
    }
    return json;
  }

  private headers(fields: Record<string, string | number>): Record<string, string> {
    const timestamp = new Date().toISOString();
    const signedFields = Object.keys(fields).join(',');
    const signingString = `timestamp=${timestamp}&${Object.entries(fields).map(([k, v]) => `${k}=${v}`).join('&')}`;
    const digest = crypto.createHmac('sha256', this.apiSecret).update(signingString).digest('base64');
    return {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `SELCOM ${Buffer.from(this.apiKey).toString('base64')}`,
      'Digest-Method': 'HS256',
      Digest: digest,
      Timestamp: timestamp,
      'Signed-Fields': signedFields,
    };
  }

  private decodeMaybeBase64Url(value: string): string {
    if (/^https?:\/\//i.test(value)) return value;
    try {
      const decoded = Buffer.from(value, 'base64').toString('utf8');
      return /^https?:\/\//i.test(decoded) ? decoded : value;
    } catch {
      return value;
    }
  }
}
