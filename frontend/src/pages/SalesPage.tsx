import { useQuery } from '@tanstack/react-query'
import { reportsApi, salesApi } from '../api/endpoints'

export default function SalesPage() {
  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['sales'],
    queryFn: () => salesApi.list(),
  })

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-xl font-bold">Receipts</h2>
        <p className="text-sm text-[var(--muted)]">Sale history with customer + discount</p>
      </div>

      <div className="table-wrap">
        {isLoading ? (
          <p className="p-4">Loading…</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>When</th>
                <th>Cashier</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Discount</th>
                <th>Pay</th>
                <th>Total</th>
                <th>Slip</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id}>
                  <td className="mono font-medium">{s.invoiceNo}</td>
                  <td>{new Date(s.createdAt).toLocaleString()}</td>
                  <td>{s.cashier}</td>
                  <td>
                    {s.customerName || s.customerMobile ? (
                      <div>
                        <div>{s.customerName || '—'}</div>
                        <div className="mono text-xs text-[var(--muted)]">{s.customerMobile}</div>
                      </div>
                    ) : (
                      <span className="text-[var(--muted)]">Walk-in</span>
                    )}
                  </td>
                  <td className="mono">{s.itemCount}</td>
                  <td className="mono">{Number(s.discount).toFixed(2)}</td>
                  <td>{s.paymentMethod}</td>
                  <td className="mono font-semibold">BDT {s.total.toFixed(2)}</td>
                  <td>
                    <button
                      className="text-[var(--accent)] hover:underline"
                      onClick={() => reportsApi.download(`/reports/sales/${s.id}/slip.pdf`, `${s.invoiceNo}.pdf`)}
                    >
                      PDF
                    </button>
                  </td>
                </tr>
              ))}
              {sales.length === 0 && (
                <tr><td colSpan={9} className="text-[var(--muted)]">No receipts yet</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
