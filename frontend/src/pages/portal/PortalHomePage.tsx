import { Link, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowRight, Wifi } from 'lucide-react';
import PortalLayout from './PortalLayout';
import { formatMoney, formatPackageLimit, portalApi } from '../../services/portalApi';

export default function PortalHomePage() {
  const [params] = useSearchParams();
  const [captiveSessionId, setCaptiveSessionId] = useState<number | null>(() => {
    const stored = window.localStorage.getItem('portalCaptiveSessionId');
    return stored ? Number(stored) : null;
  });
  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['portal-packages'],
    queryFn: () => portalApi.packages().then((r) => r.data),
  });
  const createSession = useMutation({
    mutationFn: () => portalApi.createSession({
      deviceId: params.get('deviceId') ? Number(params.get('deviceId')) : undefined,
      routerId: params.get('routerId') ? Number(params.get('routerId')) : undefined,
      hotspotId: params.get('hotspotId') || undefined,
      mac: params.get('mac') || undefined,
      ip: params.get('ip') || undefined,
      loginUrl: params.get('loginUrl') || params.get('link-login') || undefined,
      originalUrl: params.get('originalUrl') || params.get('dst') || params.get('link-orig') || undefined,
    }).then((r) => r.data),
    onSuccess: (session) => {
      setCaptiveSessionId(session.id);
      window.localStorage.setItem('portalCaptiveSessionId', String(session.id));
    },
  });

  useEffect(() => {
    const hasCaptiveParams = (params.get('deviceId') || params.get('routerId')) && params.get('mac') && params.get('ip');
    if (hasCaptiveParams) createSession.mutate();
  }, []);

  const packageHref = (id: number) => {
    const next = new URLSearchParams();
    if (captiveSessionId) next.set('captiveSessionId', String(captiveSessionId));
    return `/portal/package/${id}${next.toString() ? `?${next.toString()}` : ''}`;
  };

  return (
    <PortalLayout>
      <section className="mb-5 rounded-[8px] bg-slate-950 px-5 py-6 text-white">
        <Wifi className="mb-4 h-8 w-8 text-blue-300" />
        <h1 className="text-3xl font-bold tracking-normal">Zanfibre</h1>
        <p className="mt-2 text-sm text-slate-300">Choose a package, pay with Mixx, and get connected after approval.</p>
      </section>

      {createSession.isError && (
        <div className="mb-4 rounded-[8px] bg-amber-50 p-3 text-sm text-amber-800">
          Reopen this page from the WiFi login screen so we can identify your device.
        </div>
      )}

      <h2 className="mb-3 text-sm font-bold uppercase text-slate-500">Choose your package</h2>
      <div className="space-y-3">
        {isLoading && <div className="rounded-[8px] bg-white p-4 text-sm">Loading packages...</div>}
        {packages.map((pkg) => (
          <Link key={pkg.id} to={packageHref(pkg.id)} className="block rounded-[8px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-bold">{pkg.name}</div>
                <div className="mt-1 text-sm text-slate-500">{formatPackageLimit(pkg)}</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-blue-700">{formatMoney(pkg.price, pkg.currency)}</div>
                <ArrowRight className="ml-auto mt-2 h-5 w-5 text-slate-400" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3">
        <Link to="/portal/status" className="rounded-[8px] border border-slate-200 bg-white p-4 text-sm font-bold">
          <Wifi className="mb-2 h-5 w-5 text-emerald-700" />My connection
        </Link>
      </div>
    </PortalLayout>
  );
}
