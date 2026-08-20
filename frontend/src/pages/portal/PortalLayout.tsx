import { Link } from 'react-router-dom';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f7f8fb] text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-5">
        <header className="mb-5 flex items-center justify-between">
          <Link to="/portal" className="text-lg font-bold tracking-normal">Zanfibre</Link>
          <Link to="/portal/support" className="text-sm font-semibold text-blue-700">Support</Link>
        </header>
        {children}
      </div>
    </main>
  );
}
