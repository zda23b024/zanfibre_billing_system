import { Link } from 'react-router-dom';
import PortalLayout from './PortalLayout';

export default function PortalSupportPage() {
  return (
    <PortalLayout>
      <section className="rounded-[8px] bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold">Support</h1>
        <p className="mt-3 text-sm text-slate-500">If payment succeeds but you cannot connect, keep this page open and contact the WiFi operator.</p>
      </section>
      <Link to="/portal" className="mt-4 block rounded-[8px] bg-blue-700 px-4 py-3 text-center font-bold text-white">Back home</Link>
    </PortalLayout>
  );
}
