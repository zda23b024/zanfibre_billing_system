import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import PortalLayout from './PortalLayout';
import { formatMoney, portalApi } from '../../services/portalApi';

export default function PortalCheckoutPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const packageId = Number(params.get('packageId'));
  const captiveSessionId = params.get('captiveSessionId')
    ? Number(params.get('captiveSessionId'))
    : Number(window.localStorage.getItem('portalCaptiveSessionId') || 0) || undefined;
  const deviceId = params.get('deviceId') ? Number(params.get('deviceId')) : undefined;
  const mac = params.get('mac') || undefined;
  const ip = params.get('ip') || undefined;
  const [phone, setPhone] = useState('');
  const [reference, setReference] = useState('');
  const { data: pkg } = useQuery({
    queryKey: ['portal-package', packageId],
    queryFn: () => portalApi.package(packageId).then((r) => r.data),
    enabled: !!packageId,
  });
  const paymentLabel = 'Manual Mixx payment';
  const mutation = useMutation({
    mutationFn: () => portalApi.checkout({
      packageId,
      phone,
      manualPaymentReference: reference,
      captiveSessionId,
      deviceId,
      mac,
      ip,
    }).then((r) => r.data),
    onSuccess: (r) => {
      const next = new URLSearchParams({ paymentId: String(r.paymentId) });
      if (r.paymentUrl) next.set('paymentUrl', r.paymentUrl);
      navigate(`/portal/payment/pending?${next.toString()}`);
    },
  });

  return (
    <PortalLayout>
      <section className="rounded-[8px] bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold">Checkout</h1>
        {!captiveSessionId && (
          <p className="mt-4 rounded-[8px] bg-amber-50 p-3 text-sm text-amber-800">
            Reopen this page from the WiFi login screen so we can connect this device after payment.
          </p>
        )}
        {pkg && <p className="mt-2 text-slate-500">{pkg.name} · {formatMoney(pkg.price, pkg.currency)}</p>}
        <label className="mt-5 block text-sm font-bold text-slate-700">Phone number</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="0712345678"
          className="mt-2 w-full rounded-[8px] border border-slate-300 px-4 py-3 text-lg outline-none focus:border-blue-700"
        />
        <label className="mt-5 block text-sm font-bold text-slate-700">Payment method</label>
        <div className="mt-2 rounded-[8px] border border-blue-200 bg-blue-50 p-4 text-blue-900">
          <div className="font-semibold">{paymentLabel}</div>
          <div className="mt-2 text-sm">Pay to Mixx merchant number:</div>
          <div className="mt-1 rounded-[8px] bg-white px-3 py-2 font-mono text-2xl font-bold">18198639</div>
          <div className="mt-2 text-xs text-blue-700">Name: Ibrahim Yahya Ally</div>
        </div>
        <label className="mt-5 block text-sm font-bold text-slate-700">Transaction reference</label>
        <input
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="Paste Mixx transaction ID"
          className="mt-2 w-full rounded-[8px] border border-slate-300 px-4 py-3 text-lg outline-none focus:border-blue-700"
        />
        {mutation.isError && (
          <p className="mt-4 rounded-[8px] bg-red-50 p-3 text-sm text-red-700">
            {(mutation.error as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Payment failed'}
          </p>
        )}
      </section>
      <button
        disabled={!phone.trim() || !reference.trim() || !packageId || !captiveSessionId || mutation.isPending}
        onClick={() => mutation.mutate()}
        className="mt-4 w-full rounded-[8px] bg-blue-700 px-4 py-3 font-bold text-white disabled:opacity-50"
      >
        {mutation.isPending ? 'Submitting...' : 'I have paid'}
      </button>
      <Link to="/portal" className="mt-3 block text-center text-sm font-semibold text-slate-500">Cancel</Link>
    </PortalLayout>
  );
}
