import { Router, Request, Response } from 'express';
import { billingService } from '../services/billing/BillingService';
import { rateLimitRedis } from '../middleware/rateLimitRedis';

const router = Router();

router.get('/packages', async (_req: Request, res: Response) => {
  res.json(await billingService.listActivePackages());
});

router.get('/packages/:id', async (req: Request, res: Response) => {
  const pkg = await billingService.getPackage(parseInt(req.params.id, 10));
  if (!pkg || !pkg.is_active) return res.status(404).json({ error: 'Package not found' });
  return res.json(pkg);
});

router.post(
  '/sessions',
  rateLimitRedis({ windowSec: 60, max: 30, keyPrefix: 'portal-captive-session', allMethods: true }),
  async (req: Request, res: Response) => {
    try {
      const { deviceId, routerId, hotspotId, mac, ip, loginUrl, originalUrl } = req.body as {
        deviceId?: number; routerId?: number; hotspotId?: string; mac?: string; ip?: string; loginUrl?: string; originalUrl?: string;
      };
      const session = await billingService.createCaptiveSession({
        deviceId: deviceId || routerId,
        hotspotId,
        macAddress: mac,
        ipAddress: ip,
        loginUrl,
        originalUrl,
      });
      return res.status(201).json(session);
    } catch (err) {
      return res.status(400).json({ error: (err as Error).message });
    }
  }
);

router.post(
  '/checkout',
  rateLimitRedis({ windowSec: 60, max: 10, keyPrefix: 'portal-checkout', allMethods: true }),
  async (req: Request, res: Response) => {
    try {
      const { packageId, phone, manualPaymentReference, captiveSessionId, deviceId, mac, ip } = req.body as {
        packageId?: number; phone?: string; manualPaymentReference?: string; captiveSessionId?: number; deviceId?: number; mac?: string; ip?: string;
      };
      if (!packageId || !phone) return res.status(400).json({ error: 'packageId and phone are required' });
      const result = await billingService.createPurchase({
        packageId,
        phone,
        manualPaymentReference,
        captiveSessionId,
        deviceId,
        macAddress: mac,
        ipAddress: ip,
      });
      return res.status(201).json(result);
    } catch (err) {
      return res.status(400).json({ error: (err as Error).message });
    }
  }
);

router.get('/payments/:id', async (req: Request, res: Response) => {
  const payment = await billingService.getPayment(parseInt(req.params.id, 10));
  if (!payment) return res.status(404).json({ error: 'Payment not found' });
  return res.json(payment);
});

router.post(
  '/voucher',
  rateLimitRedis({ windowSec: 60, max: 8, keyPrefix: 'portal-voucher', allMethods: true }),
  async (req: Request, res: Response) => {
    try {
      const { code, phone } = req.body as { code?: string; phone?: string };
      if (!code) return res.status(400).json({ error: 'Voucher code is required' });
      const session = await billingService.verifyVoucher(code, phone);
      if (!session) return res.status(404).json({ error: 'Voucher not found' });
      return res.json(session);
    } catch (err) {
      return res.status(400).json({ error: (err as Error).message });
    }
  }
);

router.get('/status', async (req: Request, res: Response) => {
  const phone = String(req.query.phone || '');
  if (!phone) return res.status(400).json({ error: 'phone is required' });
  const session = await billingService.getSessionByPhone(phone);
  if (!session) return res.status(404).json({ error: 'No session found' });
  return res.json(session);
});

export default router;
