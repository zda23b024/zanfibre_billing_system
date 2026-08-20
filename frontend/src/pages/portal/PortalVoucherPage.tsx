import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import PortalLayout from './PortalLayout';
import { portalApi } from '../../services/portalApi';

export default function PortalVoucherPage() {
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const mutation = useMutation({ mutationFn: () => portalApi.voucher(code, phone || undefined).then((r) => r.data) });
  return (
    <PortalLayout>
      <section className="rounded-[8px] bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold">Enter voucher</h1>
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="K8FD-73PQ" className="mt-5 w-full rounded-[8px] border border-slate-300 px-4 py-3 text-center font-mono text-xl outline-none focus:border-blue-700" />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number optional" className="mt-3 w-full rounded-[8px] border border-slate-300 px-4 py-3 outline-none focus:border-blue-700" />
        {mutation.isSuccess && <p className="mt-4 rounded-[8px] bg-emerald-50 p-3 text-sm text-emerald-700">Voucher found. Use it on the hotspot login page.</p>}
        {mutation.isError && <p className="mt-4 rounded-[8px] bg-red-50 p-3 text-sm text-red-700">Voucher not found or expired.</p>}
      </section>
      <button disabled={!code.trim() || mutation.isPending} onClick={() => mutation.mutate()} className="mt-4 w-full rounded-[8px] bg-blue-700 px-4 py-3 font-bold text-white disabled:opacity-50">Continue</button>
    </PortalLayout>
  );
}
