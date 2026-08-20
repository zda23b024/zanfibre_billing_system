import { Router, Request, Response } from 'express';
import { query, queryOne } from '../config/database';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { billingService } from '../services/billing/BillingService';

const router = Router();
router.use(requireAuth);

router.get('/stats', async (_req: Request, res: Response) => {
  res.json(await billingService.adminStats());
});

router.get('/packages', async (_req: Request, res: Response) => {
  res.json(await billingService.listPackages());
});

router.post('/packages', requireAdmin, async (req: Request, res: Response) => {
  try {
    const pkg = await billingService.createPackage(req.body);
    res.status(201).json(pkg);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.put('/packages/:id', requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const existing = await queryOne(`SELECT id FROM billing_packages WHERE id = $1`, [id]);
  if (!existing) return res.status(404).json({ error: 'Package not found' });
  const data = req.body as Record<string, unknown>;
  await query(
    `UPDATE billing_packages SET
      name = COALESCE($1, name),
      description = COALESCE($2, description),
      price = COALESCE($3, price),
      currency = COALESCE($4, currency),
      duration = COALESCE($5, duration),
      duration_unit = COALESCE($6, duration_unit),
      data_limit_mb = $7,
      speed_download = $8,
      speed_upload = $9,
      device_limit = COALESCE($10, device_limit),
      is_active = COALESCE($11, is_active),
      updated_at = NOW()
     WHERE id = $12`,
    [
      data.name ?? null,
      data.description ?? null,
      data.price ?? null,
      data.currency ?? null,
      data.duration ?? null,
      data.duration_unit ?? null,
      data.data_limit_mb ?? null,
      data.speed_download ?? null,
      data.speed_upload ?? null,
      data.device_limit ?? null,
      data.is_active ?? null,
      id,
    ]
  );
  return res.json(await billingService.getPackage(id));
});

router.get('/customers', async (_req: Request, res: Response) => {
  const rows = await query(
    `SELECT c.*, COUNT(s.id) AS session_count
     FROM billing_customers c
     LEFT JOIN billing_sessions s ON s.customer_id = c.id
     GROUP BY c.id
     ORDER BY c.created_at DESC`
  );
  res.json(rows);
});

router.get('/payments', async (_req: Request, res: Response) => {
  const rows = await query(
    `SELECT p.*, c.phone AS customer_phone, bp.name AS package_name,
            cs.mac_address, cs.ip_address, cs.device_id AS router_id,
            d.name AS router_name
     FROM billing_payments p
     JOIN billing_customers c ON c.id = p.customer_id
     JOIN billing_packages bp ON bp.id = p.package_id
     LEFT JOIN billing_captive_sessions cs ON cs.id = p.captive_session_id
     LEFT JOIN devices d ON d.id = cs.device_id
     ORDER BY p.created_at DESC
     LIMIT 200`
  );
  res.json(rows);
});

router.post('/payments/:id/refresh', requireAdmin, async (req: Request, res: Response) => {
  try {
    const payment = await billingService.refreshPaymentFromProvider(parseInt(req.params.id, 10));
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    return res.json(payment);
  } catch (err) {
    return res.status(400).json({ error: (err as Error).message });
  }
});

router.post('/payments/:id/retry-activation', requireAdmin, async (req: Request, res: Response) => {
  try {
    const payment = await billingService.retryPaymentActivation(parseInt(req.params.id, 10));
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    return res.json(payment);
  } catch (err) {
    return res.status(400).json({ error: (err as Error).message });
  }
});

router.post('/payments/:id/approve-manual', requireAdmin, async (req: Request, res: Response) => {
  try {
    const payment = await billingService.approveManualPayment(parseInt(req.params.id, 10));
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    return res.json(payment);
  } catch (err) {
    return res.status(400).json({ error: (err as Error).message });
  }
});

router.post('/payments/:id/reject-manual', requireAdmin, async (req: Request, res: Response) => {
  try {
    const payment = await billingService.rejectManualPayment(parseInt(req.params.id, 10));
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    return res.json(payment);
  } catch (err) {
    return res.status(400).json({ error: (err as Error).message });
  }
});

router.get('/sessions', async (_req: Request, res: Response) => {
  const rows = await query(
    `SELECT s.*, bp.name AS package_name, d.name AS device_name
     FROM billing_sessions s
     JOIN billing_packages bp ON bp.id = s.package_id
     LEFT JOIN devices d ON d.id = s.device_id
     ORDER BY s.created_at DESC
     LIMIT 200`
  );
  res.json(rows);
});

router.get('/sms-logs', async (_req: Request, res: Response) => {
  res.json(await query(`SELECT * FROM billing_sms_logs ORDER BY created_at DESC LIMIT 200`));
});

export default router;
