import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle } from 'lucide-react';
import PortalLayout from './PortalLayout';
import { formatMoney, portalApi } from '../../services/portalApi';

export default function PortalPaymentSuccessPage() {
  const [params] = useSearchParams();
  const paymentId = Number(params.get('paymentId'));
  const { data } = useQuery({
    queryKey: ['portal-payment-status', paymentId],
    queryFn: () => portalApi.paymentStatus(paymentId).then((r) => r.data),
    enabled: !!paymentId,
  });
  return (
    <PortalLayout>
      <section className="rounded-[8px] bg-white p-6 text-center shadow-sm">
        <CheckCircle className="mx-auto h-12 w-12 text-emerald-600" />
        <h1 className="mt-4 text-2xl font-bold">Connected</h1>
        <p className="mt-2 text-sm text-slate-500">Your internet is active.</p>
        {data && (
          <div className="mt-4 text-left text-sm text-slate-600">
            <div className="flex justify-between border-t py-2"><span>Package</span><b>{data.package_name}</b></div>
            <div className="flex justify-between border-t py-2"><span>Amount</span><b>{formatMoney(data.amount, data.currency)}</b></div>
            <div className="flex justify-between border-t py-2"><span>Duration</span><b>{data.duration} {data.duration_unit}</b></div>
            <div className="flex justify-between border-t py-2"><span>Speed</span><b>{data.speed_download || 'Best effort'}</b></div>
          </div>
        )}
        <a href="/" className="mt-5 block rounded-[8px] bg-slate-950 p-4 text-center font-bold text-white">Start browsing</a>
      </section>
      <Link to="/portal/status" className="mt-4 block rounded-[8px] bg-blue-700 px-4 py-3 text-center font-bold text-white">Check status</Link>
    </PortalLayout>
  );
}
