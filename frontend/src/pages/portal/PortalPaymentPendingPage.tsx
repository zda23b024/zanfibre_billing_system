import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import PortalLayout from './PortalLayout';
import { portalApi } from '../../services/portalApi';

export default function PortalPaymentPendingPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const paymentId = Number(params.get('paymentId'));
  const paymentUrl = params.get('paymentUrl');
  const { data } = useQuery({
    queryKey: ['portal-payment-status', paymentId],
    queryFn: () => portalApi.paymentStatus(paymentId).then((r) => r.data),
    enabled: !!paymentId,
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (!data) return;
    if (data.status === 'SUCCESS' && data.activation_status === 'ACTIVE') {
      navigate(`/portal/payment/success?paymentId=${paymentId}`, { replace: true });
    }
    if (['FAILED', 'CANCELLED', 'EXPIRED'].includes(data.status)) {
      navigate(`/portal/payment/failed?paymentId=${paymentId}&status=${data.status}`, { replace: true });
    }
  }, [data, navigate, paymentId]);

  return (
    <PortalLayout>
      <section className="rounded-[8px] bg-white p-6 text-center shadow-sm">
        <h1 className="text-2xl font-bold">Waiting for payment</h1>
        <p className="mt-2 text-sm text-slate-500">We received your payment details. An admin will confirm the Mixx payment and activate your internet.</p>
        {paymentUrl && (
          <a
            href={paymentUrl}
            className="mt-5 block rounded-[8px] bg-blue-700 px-4 py-3 font-bold text-white"
            rel="noreferrer"
            target="_blank"
          >
            Open payment
          </a>
        )}
        <div className="mt-5 rounded-[8px] bg-slate-100 p-3 text-sm font-semibold text-slate-700">
          {data?.status === 'SUCCESS'
            ? `Activating internet: ${data.activation_status || 'ACTIVATING'}`
            : `Admin approval: ${data?.status || 'PENDING'}`}
        </div>
        {data?.activation_error && (
          <p className="mt-3 rounded-[8px] bg-amber-50 p-3 text-sm text-amber-800">
            Payment received. We are still activating your internet.
          </p>
        )}
      </section>
      <Link to="/portal" className="mt-4 block text-center text-sm font-semibold text-slate-500">Back</Link>
    </PortalLayout>
  );
}
