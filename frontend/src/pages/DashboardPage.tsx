import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { dashboardApi } from '../api/endpoints'
import { money, useStoreSettings } from '../hooks/useStoreSettings'

const COLORS = ['#1f6feb', '#1b7f4a', '#c47a00', '#6b7280']

export default function DashboardPage() {
  const { currency } = useStoreSettings()
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: dashboardApi.summary,
    refetchInterval: 20000,
  })

  if (isLoading) return <p>Loading register…</p>
  if (error || !data) return <p className="text-[var(--danger)]">Failed to load dashboard.</p>

  const pieData = data.todayPaymentBreakdown.map((p) => ({ name: p.name, value: Number(p.amount) }))

  return (
    <div className="page space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold">Register overview</h2>
          <p className="text-sm text-[var(--muted)]">Live sales + stock alerts</p>
        </div>
        <Link to="/pos" className="btn btn-pay w-full sm:w-auto">Open Sell screen</Link>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat">
          <div className="label">Today</div>
          <div className="value">{money(currency, data.todaySalesTotal, 0)}</div>
        </div>
        <div className="stat">
          <div className="label">Tickets</div>
          <div className="value">{data.todaySalesCount}</div>
        </div>
        <div className="stat">
          <div className="label">Last 7 days</div>
          <div className="value">{money(currency, data.weekSalesTotal, 0)}</div>
        </div>
        <div className="stat">
          <div className="label">Low stock</div>
          <div className={`value ${data.lowStockCount ? 'text-[var(--danger)]' : ''}`}>{data.lowStockCount}</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-3">
        <div className="panel p-3">
          <div className="font-semibold mb-2">Sales · last 7 days</div>
          <div className="h-48 sm:h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.last7DaysSales.map((d) => ({ ...d, value: Number(d.value) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#dbe3ea" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#1f6feb" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel p-3">
          <div className="font-semibold mb-2">Today · payment mix</div>
          <div className="h-48 sm:h-56">
            {pieData.length === 0 ? (
              <div className="h-full grid place-items-center text-[var(--muted)] text-sm">No sales yet today</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="px-3 py-2 border-b border-[var(--line)] flex justify-between bg-[#f2f5f8]">
          <span className="font-semibold">Low stock</span>
          <Link to="/products?lowStock=1" className="text-sm text-[var(--accent)]">Manage stock</Link>
        </div>
        <div className="table-wrap border-0">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Code</th>
                <th>Qty</th>
                <th>Min</th>
              </tr>
            </thead>
            <tbody>
              {data.lowStockProducts.length === 0 ? (
                <tr><td colSpan={4} className="text-[var(--muted)]">Stock levels OK</td></tr>
              ) : (
                data.lowStockProducts.map((p) => (
                  <tr key={p.id}>
                    <td className="font-medium">{p.name}</td>
                    <td className="mono text-[var(--muted)]">#{p.sequenceNumber} / {p.sku}</td>
                    <td className="mono text-[var(--danger)] font-semibold">{p.quantity}</td>
                    <td className="mono">{p.minStockLevel}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
