import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Clock, Database, Smartphone, Zap } from 'lucide-react';
import PortalLayout from './PortalLayout';
import { formatMoney, portalApi } from '../../services/portalApi';

export default function PortalPackagePage() {
  const id = Number(useParams().id);
  const [params] = useSearchParams();
  const captiveSessionId = params.get('captiveSessionId');
  const { data: pkg, isLoading } = useQuery({
    queryKey: ['portal-package', id],
    queryFn: () => portalApi.package(id).then((r) => r.data),
    enabled: !!id,
  });

  if (isLoading || !pkg) return <PortalLayout><div className="rounded-[8px] bg-white p-4">Loading...</div></PortalLayout>;

  const data = pkg.data_limit_mb ? `${pkg.data_limit_mb >= 1024 ? `${pkg.data_limit_mb / 1024} GB` : `${pkg.data_limit_mb} MB`}` : 'Unlimited';

  return (
    <PortalLayout>
      <section className="rounded-[8px] bg-white p-5 shadow-sm">
        <h1 className="text-3xl font-bold">{pkg.name}</h1>
        <p className="mt-2 text-slate-500">{pkg.description || 'WiFi access package'}</p>
        <div className="mt-5 text-3xl font-bold text-blue-700">{formatMoney(pkg.price, pkg.currency)}</div>
        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-[8px] bg-slate-50 p-3"><Clock className="mb-2 h-5 w-5" />{pkg.duration} {pkg.duration_unit}</div>
          <div className="rounded-[8px] bg-slate-50 p-3"><Zap className="mb-2 h-5 w-5" />{pkg.speed_download || 'Best effort'}</div>
          <div className="rounded-[8px] bg-slate-50 p-3"><Database className="mb-2 h-5 w-5" />{data}</div>
          <div className="rounded-[8px] bg-slate-50 p-3"><Smartphone className="mb-2 h-5 w-5" />{pkg.device_limit} device{pkg.device_limit === 1 ? '' : 's'}</div>
        </div>
      </section>
      <Link to={`/portal/checkout?packageId=${pkg.id}${captiveSessionId ? `&captiveSessionId=${encodeURIComponent(captiveSessionId)}` : ''}`} className="mt-4 block rounded-[8px] bg-blue-700 px-4 py-3 text-center font-bold text-white">
        Buy package
      </Link>
      <Link to="/portal" className="mt-3 block text-center text-sm font-semibold text-slate-500">Back to packages</Link>
    </PortalLayout>
  );
}
