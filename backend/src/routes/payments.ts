import { Router, Request, Response } from 'express';
import { billingService } from '../services/billing/BillingService';
import { rateLimitRedis } from '../middleware/rateLimitRedis';

const router = Router();

router.post(
  '/selcom/callback',
  rateLimitRedis({ windowSec: 60, max: 120, keyPrefix: 'selcom-callback', allMethods: true }),
  async (req: Request, res: Response) => {
    try {
      const payment = await billingService.handleSelcomCallback(req.body as Record<string, unknown>);
      return res.json({ ok: true, payment });
    } catch (err) {
      return res.status(400).json({ ok: false, error: (err as Error).message });
    }
  }
);

router.get(
  '/:id/status',
  rateLimitRedis({ windowSec: 60, max: 30, keyPrefix: 'payment-status', allMethods: true }),
  async (req: Request, res: Response) => {
    const payment = await billingService.getPaymentStatus(parseInt(req.params.id, 10));
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    return res.json(payment);
  }
);

export default router;
