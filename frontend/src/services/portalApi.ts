import axios from 'axios';
import { API_BASE_URL } from '../config';

const portal = axios.create({ baseURL: API_BASE_URL, timeout: 30_000 });

export interface BillingPackage {
  id: number;
  name: string;
  description: string | null;
  price: string;
  currency: string;
  duration: number;
  duration_unit: 'minutes' | 'hours' | 'days';
  data_limit_mb: number | null;
  speed_download: string | null;
  speed_upload: string | null;
  device_limit: number;
  is_active: boolean;
}

export interface CheckoutResult {
  paymentId: number;
  status: string;
  voucherCode: string | null;
  message: string;
  paymentUrl?: string;
}

export interface CaptiveSession {
  id: number;
  device_id: number;
  mac_address: string;
  ip_address: string;
  status: string;
}

export interface PaymentStatus {
  id: number;
  status: string;
  package_name: string;
  amount: string;
  currency: string;
  voucher_code: string | null;
  speed_download: string | null;
  speed_upload: string | null;
  duration: number;
  duration_unit: string;
  expires_at: string | null;
  fulfillment_status?: string;
  fulfillment_error?: string | null;
  session_status?: string;
  activation_status?: string;
  activation_error?: string | null;
  mac_address?: string | null;
  ip_address?: string | null;
  started_at?: string | null;
}

export const portalApi = {
  packages: () => portal.get<BillingPackage[]>('/portal/packages'),
  package: (id: number) => portal.get<BillingPackage>(`/portal/packages/${id}`),
  createSession: (data: {
    deviceId?: number; routerId?: number; hotspotId?: string; mac?: string; ip?: string; loginUrl?: string; originalUrl?: string;
  }) => portal.post<CaptiveSession>('/portal/sessions', data),
  checkout: (data: {
    packageId: number; phone: string; manualPaymentReference?: string; captiveSessionId?: number; deviceId?: number; mac?: string; ip?: string;
  }) =>
    portal.post<CheckoutResult>('/portal/checkout', data, { timeout: 90_000 }),
  payment: (id: number) => portal.get('/portal/payments/' + id),
  paymentStatus: (id: number) => portal.get<PaymentStatus>(`/payments/${id}/status`),
  voucher: (code: string, phone?: string) => portal.post('/portal/voucher', { code, phone }),
  status: (phone: string) => portal.get('/portal/status', { params: { phone } }),
};

export const formatMoney = (value: string | number, currency = 'TZS') =>
  new Intl.NumberFormat('en-TZ', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value));

export const formatPackageLimit = (pkg: BillingPackage) => {
  const data = pkg.data_limit_mb ? `${pkg.data_limit_mb >= 1024 ? `${pkg.data_limit_mb / 1024} GB` : `${pkg.data_limit_mb} MB`}` : 'Unlimited data';
  const speed = pkg.speed_download ? `${pkg.speed_download} speed` : 'Best effort';
  return `${speed} · ${data} · ${pkg.device_limit} device${pkg.device_limit === 1 ? '' : 's'}`;
};
