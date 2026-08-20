import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Package, RefreshCw, Users, Wifi } from 'lucide-react';
import { billingApi } from '../services/api';

function money(value: unknown) {
  return new Intl.NumberFormat('en-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 }).format(Number(value || 0));
}

export default function BillingPage() {
  const qc = useQueryClient();
  const { data: stats } = useQuery({ queryKey: ['billing-stats'], queryFn: () => billingApi.stats().then((r) => r.data) });
  const { data: packages = [] } = useQuery({ queryKey: ['billing-packages'], queryFn: () => billingApi.packages().then((r) => r.data) });
  const { data: payments = [] } = useQuery({ queryKey: ['billing-payments'], queryFn: () => billingApi.payments().then((r) => r.data) });
  const { data: sessions = [] } = useQuery({ queryKey: ['billing-sessions'], queryFn: () => billingApi.sessions().then((r) => r.data) });
  const refresh = useMutation({
    mutationFn: (id: number) => billingApi.refreshPayment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billing-payments'] });
      qc.invalidateQueries({ queryKey: ['billing-sessions'] });
      qc.invalidateQueries({ queryKey: ['billing-stats'] });
    },
  });
  const retryActivation = useMutation({
    mutationFn: (id: number) => billingApi.retryActivation(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billing-payments'] });
      qc.invalidateQueries({ queryKey: ['billing-sessions'] });
      qc.invalidateQueries({ queryKey: ['billing-stats'] });
    },
  });
  const approveManual = useMutation({
    mutationFn: (id: number) => billingApi.approveManualPayment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billing-payments'] });
      qc.invalidateQueries({ queryKey: ['billing-sessions'] });
      qc.invalidateQueries({ queryKey: ['billing-stats'] });
    },
  });
  const rejectManual = useMutation({
    mutationFn: (id: number) => billingApi.rejectManualPayment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billing-payments'] });
      qc.invalidateQueries({ queryKey: ['billing-sessions'] });
      qc.invalidateQueries({ queryKey: ['billing-stats'] });
    },
  });

  const cards = [
    { label: "Today's revenue", value: money(stats?.today_revenue), icon: CreditCard },
    { label: 'Successful payments', value: String(stats?.successful_today ?? 0), icon: Package },
    { label: 'Active paid customers', value: String(stats?.active_paid_customers ?? 0), icon: Users },
    { label: 'Failed payments', value: String(stats?.failed_today ?? 0), icon: Wifi },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--ink)' }}>Billing</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--ink-3)' }}>Customer portal packages, payments, and paid WiFi sessions.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="card p-4">
            <Icon className="w-5 h-5 mb-3" style={{ color: 'var(--accent)' }} />
            <div className="text-xs" style={{ color: 'var(--ink-3)' }}>{label}</div>
            <div className="text-xl font-semibold mt-1" style={{ color: 'var(--ink)' }}>{value}</div>
          </div>
        ))}
      </div>

      <section className="card p-4">
        <h2 className="font-semibold mb-3" style={{ color: 'var(--ink)' }}>Packages</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ color: 'var(--ink-3)' }}><tr><th className="text-left py-2">Name</th><th className="text-left">Price</th><th className="text-left">Duration</th><th className="text-left">Speed</th><th className="text-left">Active</th></tr></thead>
            <tbody>
              {packages.map((p) => (
                <tr key={p.id} className="border-t" style={{ borderColor: 'var(--line)' }}>
                  <td className="py-2">{p.name}</td><td>{money(p.price)}</td><td>{p.duration} {p.duration_unit}</td><td>{p.speed_download || 'Best effort'}</td><td>{p.is_active ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="card p-4">
          <h2 className="font-semibold mb-3" style={{ color: 'var(--ink)' }}>Recent Payments</h2>
          <div className="space-y-2">
            {payments.slice(0, 8).map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 text-sm border-t pt-2" style={{ borderColor: 'var(--line)' }}>
                <span>
                  {p.phone} · {p.package_name}
                  <span className="block text-xs" style={{ color: 'var(--ink-3)' }}>
                    {p.provider} {p.provider_reference || p.provider_order_id || ''}
                  </span>
                  {(p.mac_address || p.ip_address) && (
                    <span className="block text-xs" style={{ color: 'var(--ink-3)' }}>
                      {p.mac_address || ''} {p.ip_address || ''}
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <b>{p.status}</b>
                  {p.provider === 'manual_mixx' && p.status === 'PENDING' && (
                    <>
                      <button
                        className="btn btn-secondary px-2 py-1"
                        disabled={approveManual.isPending}
                        onClick={() => approveManual.mutate(Number(p.id))}
                        title="Approve manual Mixx payment"
                      >
                        Approve
                      </button>
                      <button
                        className="btn btn-secondary px-2 py-1"
                        disabled={rejectManual.isPending}
                        onClick={() => rejectManual.mutate(Number(p.id))}
                        title="Reject manual Mixx payment"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {p.provider !== 'manual_mixx' && ['PENDING', 'PROCESSING'].includes(String(p.status)) && (
                    <button
                      className="btn btn-secondary px-2 py-1"
                      disabled={refresh.isPending}
                      onClick={() => refresh.mutate(Number(p.id))}
                      title="Refresh Selcom status"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  )}
                  {p.status === 'SUCCESS' && p.fulfillment_status === 'FULFILLMENT_PENDING' && (
                    <button
                      className="btn btn-secondary px-2 py-1"
                      disabled={retryActivation.isPending}
                      onClick={() => retryActivation.mutate(Number(p.id))}
                      title="Retry internet activation"
                    >
                      Activate
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card p-4">
          <h2 className="font-semibold mb-3" style={{ color: 'var(--ink)' }}>Recent Sessions</h2>
          <div className="space-y-2">
            {sessions.slice(0, 8).map((s) => (
              <div key={s.id} className="flex justify-between gap-3 text-sm border-t pt-2" style={{ borderColor: 'var(--line)' }}>
                <span>{s.phone || s.voucher_code} · {s.package_name}</span>
                <b>{s.status}</b>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
