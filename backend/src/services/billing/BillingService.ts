import { randomBytes } from 'crypto';
import { query, queryOne, transaction } from '../../config/database';
import { DeviceCollector, DeviceRow } from '../mikrotik/DeviceCollector';
import { normalizeTanzanianPhone } from '../../utils/phone';
import { MockPaymentProvider } from './MockPaymentProvider';
import { PaymentProvider, PaymentStatus } from './PaymentProvider';
import { SelcomPaymentProvider } from './SelcomPaymentProvider';
import { ConsoleSmsProvider, SmsProvider } from './SmsService';

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateCode(len = 8): string {
  const n = CODE_CHARS.length;
  const limit = Math.floor(256 / n) * n;
  let out = '';
  while (out.length < len) {
    for (const b of randomBytes(len)) {
      if (b < limit) {
        out += CODE_CHARS[b % n];
        if (out.length === len) break;
      }
    }
  }
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}

function durationToHours(value: number, unit: string): number {
  if (unit === 'minutes') return value / 60;
  if (unit === 'days') return value * 24;
  return value;
}

function dataLimitToMb(raw: number | null): number | null {
  return raw && raw > 0 ? Math.floor(raw) : null;
}

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

interface PaymentRow {
  id: number;
  customer_id: number;
  package_id: number;
  amount: string;
  currency: string;
  provider: string;
  provider_reference: string | null;
  provider_order_id: string | null;
  captive_session_id: number | null;
  status: PaymentStatus;
  phone: string;
  raw_provider_status: unknown;
  fulfillment_status: string;
  fulfillment_error: string | null;
}

interface CaptiveSessionRow {
  id: number;
  device_id: number | null;
  hotspot_id: string | null;
  mac_address: string | null;
  ip_address: string | null;
  login_url: string | null;
  original_url: string | null;
  status: string;
  expires_at: string;
}

function configuredPaymentProvider(): string {
  return (process.env.PAYMENT_PROVIDER || 'manual_mixx').toLowerCase();
}

function buildProvider(): PaymentProvider | null {
  const provider = configuredPaymentProvider();
  if (provider === 'selcom') return new SelcomPaymentProvider();
  if (provider === 'manual_mixx') return null;
  if (provider === 'mock' && process.env.NODE_ENV === 'test') return new MockPaymentProvider();
  throw new Error('PAYMENT_PROVIDER_NOT_CONFIGURED: set PAYMENT_PROVIDER=manual_mixx or selcom');
}

function publicPortalBase(): string {
  return (process.env.CUSTOMER_PORTAL_BASE_URL || process.env.SELCOM_REDIRECT_URL || 'https://localhost/portal').replace(/\/+$/, '');
}

function publicApiCallbackUrl(): string {
  if (process.env.SELCOM_CALLBACK_URL) return process.env.SELCOM_CALLBACK_URL;
  const portalBase = new URL(publicPortalBase());
  return `${portalBase.origin}/api/payments/selcom/callback`;
}

function paymentOrderId(paymentId: number): string {
  return `MTM-${paymentId}-${Date.now()}`;
}

function normalizeMac(input?: string): string | null {
  const raw = String(input || '').trim().toLowerCase().replace(/[^0-9a-f]/g, '');
  if (raw.length !== 12) return null;
  return raw.match(/.{1,2}/g)!.join(':');
}

export class BillingService {
  private paymentProvider: PaymentProvider | null;
  private smsProvider: SmsProvider;

  constructor() {
    this.paymentProvider = buildProvider();
    this.smsProvider = new ConsoleSmsProvider();
  }

  async listActivePackages(): Promise<BillingPackage[]> {
    return query<BillingPackage>(
      `SELECT * FROM billing_packages WHERE is_active = TRUE ORDER BY price ASC, id ASC`
    );
  }

  async listPackages(): Promise<BillingPackage[]> {
    return query<BillingPackage>(`SELECT * FROM billing_packages ORDER BY id ASC`);
  }

  async getPackage(id: number): Promise<BillingPackage | null> {
    return queryOne<BillingPackage>(`SELECT * FROM billing_packages WHERE id = $1`, [id]);
  }

  async createPackage(data: Partial<BillingPackage>): Promise<BillingPackage> {
    const row = await queryOne<BillingPackage>(
      `INSERT INTO billing_packages
       (name, description, price, currency, duration, duration_unit, data_limit_mb,
        speed_download, speed_upload, device_limit, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        data.name,
        data.description ?? null,
        data.price,
        data.currency ?? 'TZS',
        data.duration,
        data.duration_unit ?? 'hours',
        data.data_limit_mb ?? null,
        data.speed_download ?? null,
        data.speed_upload ?? null,
        data.device_limit ?? 1,
        data.is_active ?? true,
      ]
    );
    if (!row) throw new Error('Package creation failed');
    return row;
  }

  async createCaptiveSession(input: {
    deviceId?: number;
    hotspotId?: string;
    macAddress?: string;
    ipAddress?: string;
    loginUrl?: string;
    originalUrl?: string;
  }): Promise<Record<string, unknown>> {
    const mac = normalizeMac(input.macAddress);
    const ip = String(input.ipAddress || '').trim() || null;
    if (!input.deviceId || !mac || !ip) {
      throw new Error('deviceId, mac, and ip are required for automatic activation');
    }
    const row = await queryOne<Record<string, unknown>>(
      `INSERT INTO billing_captive_sessions
       (device_id, hotspot_id, mac_address, ip_address, login_url, original_url, status)
       VALUES ($1,$2,$3,$4,$5,$6,'PENDING')
       RETURNING *`,
      [
        input.deviceId,
        input.hotspotId || null,
        mac,
        ip,
        input.loginUrl || null,
        input.originalUrl || null,
      ]
    );
    if (!row) throw new Error('Could not create captive session');
    return row;
  }

  async createPurchase(input: {
    packageId: number;
    phone: string;
    manualPaymentReference?: string;
    captiveSessionId?: number;
    deviceId?: number;
    macAddress?: string;
    ipAddress?: string;
  }): Promise<{ paymentId: number; status: string; voucherCode: string | null; message: string; paymentUrl?: string }> {
    const phone = normalizeTanzanianPhone(input.phone);
    if (!phone) throw new Error('Enter a valid Tanzanian phone number');

    const pkg = await this.getPackage(input.packageId);
    if (!pkg || !pkg.is_active) throw new Error('Package not found or inactive');
    const captive = await this.resolveCaptiveSession(input);
    if (!captive) throw new Error('Captive session required. Reopen the portal from the WiFi login page.');

    const result = await transaction(async (client) => {
      const customer = await client.query<{ id: number }>(
        `INSERT INTO billing_customers (phone)
         VALUES ($1)
         ON CONFLICT (phone) DO UPDATE SET updated_at = NOW()
         RETURNING id`,
        [phone]
      );
      const customerId = customer.rows[0].id;
      const payment = await client.query<{ id: number }>(
        `INSERT INTO billing_payments
         (customer_id, package_id, amount, currency, provider, captive_session_id, status, phone, fulfillment_status)
         VALUES ($1,$2,$3,$4,$5,$6,'PENDING',$7,'PENDING')
         RETURNING id`,
        [customerId, pkg.id, pkg.price, pkg.currency, configuredPaymentProvider(), captive.id, phone]
      );
      await client.query(`UPDATE billing_captive_sessions SET payment_id = $1, updated_at = NOW() WHERE id = $2`, [
        payment.rows[0].id,
        captive.id,
      ]);
      return { customerId, paymentId: payment.rows[0].id };
    });

    if (configuredPaymentProvider() === 'manual_mixx') {
      await query(
        `UPDATE billing_payments
         SET provider_reference = $1,
             raw_provider_status = $2,
             updated_at = NOW()
         WHERE id = $3`,
        [
          input.manualPaymentReference?.trim() || null,
          JSON.stringify({
            method: 'manual_mixx',
            merchant_number: process.env.MIXX_MERCHANT_NUMBER || '',
            customer_reference: input.manualPaymentReference?.trim() || null,
          }),
          result.paymentId,
        ]
      );
      return {
        paymentId: result.paymentId,
        status: 'PENDING',
        voucherCode: null,
        message: 'Manual Mixx payment submitted. Waiting for admin approval.',
      };
    }

    if (!this.paymentProvider) throw new Error('PAYMENT_PROVIDER_NOT_CONFIGURED');

    const orderId = paymentOrderId(result.paymentId);
    const base = publicPortalBase();
    const initiated = await this.paymentProvider.initiatePayment({
      paymentId: result.paymentId,
      orderId,
      amount: Number(pkg.price),
      currency: pkg.currency,
      phone,
      packageName: pkg.name,
      callbackUrl: publicApiCallbackUrl(),
      redirectUrl: process.env.SELCOM_REDIRECT_URL || `${base}/payment/pending?paymentId=${result.paymentId}`,
      cancelUrl: `${base}/payment/failed?paymentId=${result.paymentId}`,
    });

    await query(
      `UPDATE billing_payments
       SET provider_reference = $1,
           provider_order_id = $2,
           status = $3,
           raw_provider_status = $4,
           updated_at = NOW(),
           confirmed_at = CASE WHEN $3 = 'SUCCESS' THEN NOW() ELSE confirmed_at END,
           failed_at = CASE WHEN $3 IN ('FAILED','CANCELLED','EXPIRED') THEN NOW() ELSE failed_at END
       WHERE id = $5`,
      [initiated.providerReference, initiated.providerOrderId, initiated.status, JSON.stringify(initiated.raw ?? null), result.paymentId]
    );

    let voucherCode: string | null = null;
    if (initiated.status === 'SUCCESS') {
      const fulfilled = await this.fulfillPaidPayment(result.paymentId);
      voucherCode = fulfilled.voucherCode;
    }

    return {
      paymentId: result.paymentId,
      status: initiated.status,
      voucherCode,
      message: initiated.message,
      paymentUrl: initiated.paymentUrl,
    };
  }

  private async activatePaidAccess(input: {
    customerId: number;
    package: BillingPackage;
    paymentId: number;
    phone: string;
    captiveSession: CaptiveSessionRow;
  }): Promise<{ sessionId: number; voucherCode: string | null }> {
    const durationHours = durationToHours(input.package.duration, input.package.duration_unit);
    const expiresAtSql = `${durationHours} hours`;
    const speed = input.package.speed_download && input.package.speed_upload
      ? `${input.package.speed_download}/${input.package.speed_upload}`
      : null;
    const dataLimitMb = dataLimitToMb(input.package.data_limit_mb);

    const session = await queryOne<{ id: number }>(
      `INSERT INTO billing_sessions
       (customer_id, package_id, payment_id, device_id, captive_session_id, voucher_code, phone, mac_address, ip_address,
        started_at, expires_at, data_limit_mb, speed_download, speed_upload, device_limit, status, activation_status)
       VALUES ($1,$2,$3,$4,$5,NULL,$6,$7,$8,NOW(),NOW() + ($9)::interval,$10,$11,$12,$13,'ACTIVATING','ACTIVATING')
       RETURNING id`,
      [
        input.customerId,
        input.package.id,
        input.paymentId,
        input.captiveSession.device_id,
        input.captiveSession.id,
        input.phone,
        input.captiveSession.mac_address,
        input.captiveSession.ip_address,
        expiresAtSql,
        dataLimitMb,
        input.package.speed_download,
        input.package.speed_upload,
        input.package.device_limit,
      ]
    );
    if (!session) throw new Error('Could not create paid session');

    if (!input.captiveSession.device_id || !input.captiveSession.mac_address || !input.captiveSession.ip_address) {
      throw new Error('Captive session is missing router, MAC, or IP');
    }

    const device = await queryOne<DeviceRow>(`SELECT * FROM devices WHERE id = $1`, [input.captiveSession.device_id]);
    if (!device) throw new Error('Hotspot router not found');

    const collector = new DeviceCollector(device);
    try {
      await collector.connect();
      const profileName = `paid-${input.package.id}`;
      if (speed) {
        const profiles = await collector.getHotspotUserProfiles();
        if (!profiles.some((p) => p['name'] === profileName)) {
          await collector.addHotspotUserProfile({ name: profileName, 'rate-limit': speed });
        }
      }
      const auth = await collector.authorizePaidHotspotClient({
        macAddress: input.captiveSession.mac_address,
        ipAddress: input.captiveSession.ip_address,
        profileName,
        rateLimit: speed,
        comment: `paid portal payment ${input.paymentId} ${input.phone}`,
      });
      await query(
        `UPDATE billing_sessions
         SET status = 'ACTIVE', activation_status = 'ACTIVE', router_binding_id = $1,
             queue_name = $2, updated_at = NOW()
         WHERE id = $3`,
        [auth.bindingId, auth.queueName, session.id]
      );
      await query(
        `UPDATE billing_captive_sessions
         SET status = 'ACTIVE', activated_at = NOW(), session_id = $1, updated_at = NOW()
         WHERE id = $2`,
        [session.id, input.captiveSession.id]
      );
      return { sessionId: session.id, voucherCode: null };
    } finally {
      collector.disconnect();
    }
  }

  async getPayment(id: number): Promise<Record<string, unknown> | null> {
    return queryOne(
      `SELECT p.*, bp.name AS package_name, cs.mac_address, cs.ip_address, cs.device_id AS router_id
       FROM billing_payments p
       JOIN billing_packages bp ON bp.id = p.package_id
       LEFT JOIN billing_captive_sessions cs ON cs.id = p.captive_session_id
       WHERE p.id = $1`,
      [id]
    );
  }

  async getPaymentStatus(id: number, refresh = true): Promise<Record<string, unknown> | null> {
    const payment = await this.getPaymentForUpdateFree(id);
    if (!payment) return null;
    if (refresh && payment.provider_order_id && ['PENDING', 'PROCESSING'].includes(payment.status)) {
      await this.refreshPaymentFromProvider(id);
    } else if (refresh && payment.status === 'SUCCESS' && payment.fulfillment_status !== 'FULFILLED') {
      await this.fulfillPaidPayment(id).catch(() => {});
    }
    const row = await queryOne<Record<string, unknown>>(
      `SELECT p.*, bp.name AS package_name, bp.duration, bp.duration_unit, bp.speed_download, bp.speed_upload,
              s.voucher_code, s.expires_at, s.started_at, s.status AS session_status,
              s.activation_status, s.activation_error, s.mac_address, s.ip_address, s.device_id
       FROM billing_payments p
       JOIN billing_packages bp ON bp.id = p.package_id
       LEFT JOIN billing_sessions s ON s.payment_id = p.id
       WHERE p.id = $1`,
      [id]
    );
    return row;
  }

  async refreshPaymentFromProvider(id: number): Promise<Record<string, unknown> | null> {
    const payment = await this.getPaymentForUpdateFree(id);
    if (!payment || !payment.provider_order_id) return payment ? { ...payment } : null;
    if (!this.paymentProvider) return this.getPaymentStatus(id, false);
    const providerStatus = await this.paymentProvider.queryPaymentStatus(payment.provider_order_id);
    await this.applyProviderStatus(id, providerStatus);
    if (providerStatus.status === 'SUCCESS') {
      await this.fulfillPaidPayment(id).catch(() => {});
    }
    return this.getPaymentStatus(id, false);
  }

  async retryPaymentActivation(id: number): Promise<Record<string, unknown> | null> {
    const payment = await this.getPaymentForUpdateFree(id);
    if (!payment) return null;
    if (payment.status !== 'SUCCESS') throw new Error('Payment is not successful');
    await this.fulfillPaidPayment(id);
    return this.getPaymentStatus(id, false);
  }

  async approveManualPayment(id: number): Promise<Record<string, unknown> | null> {
    const payment = await this.getPaymentForUpdateFree(id);
    if (!payment) return null;
    if (payment.provider !== 'manual_mixx') throw new Error('Payment is not a manual Mixx payment');
    if (!['PENDING', 'PROCESSING'].includes(payment.status)) throw new Error('Payment is not pending approval');
    await query(
      `UPDATE billing_payments
       SET status = 'SUCCESS', confirmed_at = NOW(), updated_at = NOW(),
           raw_provider_status = COALESCE(raw_provider_status, '{}'::jsonb) || $1::jsonb
       WHERE id = $2`,
      [JSON.stringify({ admin_approved: true, approved_at: new Date().toISOString() }), id]
    );
    await this.fulfillPaidPayment(id).catch(() => {});
    return this.getPaymentStatus(id, false);
  }

  async rejectManualPayment(id: number): Promise<Record<string, unknown> | null> {
    const payment = await this.getPaymentForUpdateFree(id);
    if (!payment) return null;
    if (payment.provider !== 'manual_mixx') throw new Error('Payment is not a manual Mixx payment');
    if (!['PENDING', 'PROCESSING'].includes(payment.status)) throw new Error('Payment is not pending approval');
    await query(
      `UPDATE billing_payments
       SET status = 'FAILED', failed_at = NOW(), fulfillment_status = 'FAILED',
           fulfillment_error = 'Manual Mixx payment rejected by admin', updated_at = NOW()
       WHERE id = $1`,
      [id]
    );
    return this.getPaymentStatus(id, false);
  }

  async handleSelcomCallback(body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    const orderId = String(body.order_id || body.orderid || body.orderId || '');
    if (!orderId) throw new Error('Missing Selcom order_id');
    const payment = await queryOne<PaymentRow>(
      `SELECT * FROM billing_payments WHERE provider = 'selcom' AND provider_order_id = $1`,
      [orderId]
    );
    if (!payment) throw new Error('Unknown Selcom order');
    return this.refreshPaymentFromProvider(payment.id);
  }

  private async getPaymentForUpdateFree(id: number): Promise<PaymentRow | null> {
    return queryOne<PaymentRow>(`SELECT * FROM billing_payments WHERE id = $1`, [id]);
  }

  private async resolveCaptiveSession(input: {
    captiveSessionId?: number;
    deviceId?: number;
    macAddress?: string;
    ipAddress?: string;
  }): Promise<CaptiveSessionRow | null> {
    if (input.captiveSessionId) {
      return queryOne<CaptiveSessionRow>(
        `SELECT * FROM billing_captive_sessions
         WHERE id = $1 AND status IN ('PENDING','PAYING') AND expires_at > NOW()`,
        [input.captiveSessionId]
      );
    }
    const mac = normalizeMac(input.macAddress);
    const ip = String(input.ipAddress || '').trim();
    if (!input.deviceId || !mac || !ip) return null;
    const row = await this.createCaptiveSession({
      deviceId: input.deviceId,
      macAddress: mac,
      ipAddress: ip,
    });
    return row as unknown as CaptiveSessionRow;
  }

  private async applyProviderStatus(id: number, providerStatus: {
    status: PaymentStatus;
    providerReference?: string;
    amount?: number;
    currency?: string;
    raw?: unknown;
  }): Promise<void> {
    const payment = await this.getPaymentForUpdateFree(id);
    if (!payment) throw new Error('Payment not found');
    if (providerStatus.amount != null && Number(payment.amount) !== Number(providerStatus.amount)) {
      await query(
        `UPDATE billing_payments
         SET status = 'FAILED', failed_at = NOW(), fulfillment_status = 'FAILED',
             fulfillment_error = 'Selcom amount mismatch', raw_provider_status = $1, updated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify(providerStatus.raw ?? null), id]
      );
      throw new Error('Selcom amount mismatch');
    }
    if (providerStatus.currency && payment.currency !== providerStatus.currency) {
      await query(
        `UPDATE billing_payments
         SET status = 'FAILED', failed_at = NOW(), fulfillment_status = 'FAILED',
             fulfillment_error = 'Selcom currency mismatch', raw_provider_status = $1, updated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify(providerStatus.raw ?? null), id]
      );
      throw new Error('Selcom currency mismatch');
    }
    await query(
      `UPDATE billing_payments
       SET status = $1,
           provider_reference = COALESCE($2, provider_reference),
           raw_provider_status = $3,
           updated_at = NOW(),
           confirmed_at = CASE WHEN $1 = 'SUCCESS' THEN COALESCE(confirmed_at, NOW()) ELSE confirmed_at END,
           failed_at = CASE WHEN $1 IN ('FAILED','CANCELLED','EXPIRED') THEN COALESCE(failed_at, NOW()) ELSE failed_at END
       WHERE id = $4`,
      [providerStatus.status, providerStatus.providerReference ?? null, JSON.stringify(providerStatus.raw ?? null), id]
    );
  }

  private async fulfillPaidPayment(id: number, device?: {
    deviceId?: number;
    macAddress?: string;
    ipAddress?: string;
  }): Promise<{ voucherCode: string | null }> {
    const existing = await queryOne<{ voucher_code: string | null; activation_status: string }>(
      `SELECT voucher_code, activation_status FROM billing_sessions WHERE payment_id = $1`,
      [id]
    );
    if (existing?.activation_status === 'ACTIVE') return { voucherCode: existing.voucher_code };

    const payment = await queryOne<PaymentRow>(`SELECT * FROM billing_payments WHERE id = $1`, [id]);
    if (!payment) throw new Error('Payment not found');
    if (payment.status !== 'SUCCESS') throw new Error('Payment is not successful');

    const pkg = await this.getPackage(payment.package_id);
    if (!pkg) throw new Error('Package not found');
    const captive = payment.captive_session_id
      ? await queryOne<CaptiveSessionRow>(`SELECT * FROM billing_captive_sessions WHERE id = $1`, [payment.captive_session_id])
      : await this.resolveCaptiveSession(device || {});
    if (!captive) throw new Error('Captive session missing for paid activation');

    try {
      const activated = await this.activatePaidAccess({
        customerId: payment.customer_id,
        package: pkg,
        paymentId: payment.id,
        phone: payment.phone,
        captiveSession: captive,
      });
      await query(
        `UPDATE billing_payments SET fulfillment_status = 'FULFILLED', fulfilled_at = NOW(), fulfillment_error = NULL, updated_at = NOW() WHERE id = $1`,
        [id]
      );
      return { voucherCode: activated.voucherCode };
    } catch (err) {
      await query(
        `UPDATE billing_payments SET fulfillment_status = 'FULFILLMENT_PENDING', fulfillment_error = $1, updated_at = NOW() WHERE id = $2`,
        [(err as Error).message, id]
      );
      await query(
        `UPDATE billing_sessions
         SET status = 'FAILED', activation_status = 'FAILED', activation_error = $1, updated_at = NOW()
         WHERE payment_id = $2`,
        [(err as Error).message, id]
      );
      throw err;
    }
  }

  async getSessionByPhone(phoneInput: string): Promise<Record<string, unknown> | null> {
    const phone = normalizeTanzanianPhone(phoneInput);
    if (!phone) return null;
    return queryOne(
      `SELECT s.*, bp.name AS package_name, bp.currency, bp.price
       FROM billing_sessions s
       JOIN billing_packages bp ON bp.id = s.package_id
       WHERE s.phone = $1
       ORDER BY s.created_at DESC
       LIMIT 1`,
      [phone]
    );
  }

  async verifyVoucher(codeInput: string, phoneInput?: string): Promise<Record<string, unknown> | null> {
    const code = String(codeInput || '').trim().toUpperCase();
    if (!/^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(code)) throw new Error('Invalid voucher format');
    const phone = phoneInput ? normalizeTanzanianPhone(phoneInput) : null;
    const session = await queryOne(
      `SELECT s.*, bp.name AS package_name
       FROM billing_sessions s
       JOIN billing_packages bp ON bp.id = s.package_id
       WHERE s.voucher_code = $1
       ORDER BY s.created_at DESC
       LIMIT 1`,
      [code]
    );
    if (session && phone) {
      await query(`UPDATE billing_sessions SET phone = COALESCE(phone, $1) WHERE voucher_code = $2`, [phone, code]);
    }
    return session;
  }

  async adminStats(): Promise<Record<string, unknown>> {
    const row = await queryOne<Record<string, unknown>>(
      `SELECT
        COALESCE(SUM(amount) FILTER (WHERE status = 'SUCCESS' AND created_at::date = CURRENT_DATE), 0) AS today_revenue,
        COUNT(*) FILTER (WHERE status = 'SUCCESS' AND created_at::date = CURRENT_DATE) AS successful_today,
        COUNT(*) FILTER (WHERE status = 'FAILED' AND created_at::date = CURRENT_DATE) AS failed_today
       FROM billing_payments`
    );
    const active = await queryOne<{ count: string }>(
      `SELECT COUNT(*) FROM billing_sessions WHERE status = 'ACTIVE' AND expires_at > NOW()`
    );
    return { ...(row ?? {}), active_paid_customers: Number(active?.count ?? 0) };
  }

  async expirePaidSessions(): Promise<void> {
    const rows = await query<{
      id: number;
      device_id: number | null;
      router_binding_id: string | null;
      queue_name: string | null;
    }>(
      `SELECT id, device_id, router_binding_id, queue_name
       FROM billing_sessions
       WHERE status = 'ACTIVE' AND expires_at IS NOT NULL AND expires_at <= NOW()
       LIMIT 50`
    );
    for (const row of rows) {
      try {
        if (row.device_id) {
          const device = await queryOne<DeviceRow>(`SELECT * FROM devices WHERE id = $1`, [row.device_id]);
          if (device) {
            const collector = new DeviceCollector(device);
            try {
              await collector.connect();
              await collector.deauthorizePaidHotspotClient({
                bindingId: row.router_binding_id,
                queueName: row.queue_name,
              });
            } finally {
              collector.disconnect();
            }
          }
        }
        await query(
          `UPDATE billing_sessions
           SET status = 'EXPIRED', activation_status = 'EXPIRED', updated_at = NOW()
           WHERE id = $1`,
          [row.id]
        );
      } catch (err) {
        await query(
          `UPDATE billing_sessions
           SET activation_error = $1, updated_at = NOW()
           WHERE id = $2`,
          [(err as Error).message, row.id]
        );
      }
    }
  }
}

export const billingService = new BillingService();
