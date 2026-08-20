import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import PortalLayout from './PortalLayout';
import { portalApi } from '../../services/portalApi';

export default function PortalStatusPage() {
  const [phone, setPhone] = useState('');
  const [lookup, setLookup] = useState('');
  const { data, isError, isFetching } = useQuery({
    queryKey: ['portal-status', lookup],
    queryFn: () => portalApi.status(lookup).then((r) => r.data as Record<string, string | number | null>),
    enabled: !!lookup,
  });
  return (
    <PortalLayout>
      <section className="rounded-[8px] bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold">My connection</h1>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0712345678" className="mt-5 w-full rounded-[8px] border border-slate-300 px-4 py-3 outline-none focus:border-blue-700" />
        {data && (
          <div className="mt-5 space-y-2 rounded-[8px] bg-slate-50 p-4 text-sm">
            <div><b>Status:</b> {String(data.status)}</div>
            <div><b>Package:</b> {String(data.package_name)}</div>
            <div><b>Connection:</b> {String(data.activation_status || data.status)}</div>
            <div><b>Expires:</b> {data.expires_at ? new Date(String(data.expires_at)).toLocaleString() : 'N/A'}</div>
            <div><b>Data used:</b> {String(data.data_used_mb || 0)} MB</div>
          </div>
        )}
        {isError && <p className="mt-4 rounded-[8px] bg-red-50 p-3 text-sm text-red-700">No connection found for that phone.</p>}
      </section>
      <button disabled={!phone.trim() || isFetching} onClick={() => setLookup(phone)} className="mt-4 w-full rounded-[8px] bg-blue-700 px-4 py-3 font-bold text-white disabled:opacity-50">Check status</button>
    </PortalLayout>
  );
}
