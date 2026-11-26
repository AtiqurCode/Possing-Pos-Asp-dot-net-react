import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { reportsApi } from '../api/endpoints'
import { money, useStoreSettings } from '../hooks/useStoreSettings'

const COLORS = ['#1f6feb', '#1b7f4a', '#c47a00', '#7c3aed', '#0891b2', '#be123c', '#4b5563', '#0f766e']

export default function ReportsPage() {
  const { currency } = useStoreSettings()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['analytics', year, month],
    queryFn: () => reportsApi.analytics(year, month),
  })

  return (
    <div className="page space-y-3">
      <div className="flex flex-col lg:flex-row lg:flex-wrap lg:items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Sales reports</h2>
          <p className="text-sm text-[var(--muted)]">Charts on screen · PDF export optional</p>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 items-end w-full lg:w-auto">
          <label className="text-sm font-medium col-span-1">
            Year
            <input type="number" className="field mt-1 w-full sm:w-24" value={year} onChange={(e) => setYear(Number(e.target.value))} />
          </label>
          <label className="text-sm font-medium col-span-1">
            Month
            <select className="field mt-1 w-full sm:w-24" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>
          <button className="btn btn-ghost col-span-1" onClick={() => refetch()} disabled={isFetching}>
            Refresh
          </button>
          <button
            className="btn btn-primary col-span-1"
            onClick={() =>
              reportsApi.download(
                `/reports/monthly?year=${year}&month=${month}`,
                `monthly-${year}-${String(month).padStart(2, '0')}.pdf`,
              )
            }
          >
            Download PDF
          </button>
        </div>
      </div>

      {isLoading && <p>Loading analytics…</p>}
      {error && <p className="text-[var(--danger)]">Failed to load analytics.</p>}

      {data && (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="stat"><div className="label">Total sales</div><div className="value">{money(currency, Number(data.totalSales), 0)}</div></div>
            <div className="stat"><div className="label">Transactions</div><div className="value">{data.transactionCount}</div></div>
            <div className="stat"><div className="label">Avg ticket</div><div className="value">{money(currency, Number(data.averageTicket), 0)}</div></div>
            <div className="stat"><div className="label">Discounts given</div><div className="value">{money(currency, Number(data.totalDiscount), 0)}</div></div>
          </div>

          <div className="panel p-3">
            <div className="font-semibold mb-2">Daily sales trend</div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.dailySales.map((d) => ({ ...d, value: Number(d.value) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#dbe3ea" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={2} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="#1f6feb" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-3">
            <div className="panel p-3">
              <div className="font-semibold mb-2">Payment mix</div>
              <div className="h-64">
                {data.paymentBreakdown.length === 0 ? (
                  <Empty />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.paymentBreakdown.map((p) => ({ name: p.name, value: Number(p.amount) }))}
                        dataKey="value"
                        nameKey="name"
                        outerRadius={90}
                        label
                      >
                        {data.paymentBreakdown.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="panel p-3">
              <div className="font-semibold mb-2">Sales by category</div>
              <div className="h-64">
                {data.categoryBreakdown.length === 0 ? (
                  <Empty />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.categoryBreakdown.map((p) => ({ name: p.name, value: Number(p.amount) }))}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={40}
                        outerRadius={90}
                      >
                        {data.categoryBreakdown.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          <div className="panel p-3">
            <div className="font-semibold mb-2">Top products</div>
            <div className="h-72">
              {data.topProducts.length === 0 ? (
                <Empty />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={data.topProducts.map((p) => ({ name: p.name, amount: Number(p.amount), qty: p.count }))}
                    margin={{ left: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#dbe3ea" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="amount" fill="#1b7f4a" name={`Amount (${currency})`} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Empty() {
  return <div className="h-full grid place-items-center text-sm text-[var(--muted)]">No data for this month</div>
}
