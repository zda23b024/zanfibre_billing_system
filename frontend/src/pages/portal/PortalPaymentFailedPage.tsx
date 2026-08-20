import { Link, useSearchParams } from 'react-router-dom';
import PortalLayout from './PortalLayout';

export default function PortalPaymentFailedPage() {
  const [params] = useSearchParams();
  const status = params.get('status') || 'FAILED';
  return (
    <PortalLayout>
      <section className="rounded-[8px] bg-white p-6 text-center shadow-sm">
        <h1 className="text-2xl font-bold">Payment failed</h1>
        <p className="mt-2 text-sm text-slate-500">No internet access was activated. Status: {status}. Please try again.</p>
      </section>
      <Link to="/portal" className="mt-4 block rounded-[8px] bg-blue-700 px-4 py-3 text-center font-bold text-white">Choose package</Link>
    </PortalLayout>
  );
}
