import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getErrorMessage } from '../api/client'
import { inventoryApi, productsApi } from '../api/endpoints'
import { useAuth } from '../auth/AuthContext'
import type { StockMovementType } from '../types'

const TYPES: Array<StockMovementType | 'All'> = ['All', 'Received', 'Sold', 'Missing', 'Adjustment']

export default function InventoryPage() {
  const { isAdmin } = useAuth()
  const qc = useQueryClient()
  const [type, setType] = useState<(typeof TYPES)[number]>('All')
  const [productId, setProductId] = useState('')
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  const [formProductId, setFormProductId] = useState('')
  const [formQty, setFormQty] = useState(1)
  const [formNote, setFormNote] = useState('')
  const [formMode, setFormMode] = useState<'receive' | 'missing'>('receive')

  const { data: products = [] } = useQuery({
    queryKey: ['products-pos'],
    queryFn: () => productsApi.list(),
  })

  const { data: summary } = useQuery({
    queryKey: ['inventory-summary', productId],
    queryFn: () => inventoryApi.summary(productId || undefined),
  })

  const { data: movements = [], isLoading } = useQuery({
    queryKey: ['inventory-movements', productId, type],
    queryFn: () =>
      inventoryApi.movements({
        productId: productId || undefined,
        type: type === 'All' ? undefined : type,
        take: 200,
      }),
  })

  const activeProducts = useMemo(
    () => products.filter((p) => p.isActive).sort((a, b) => a.sequenceNumber - b.sequenceNumber),
    [products],
  )

  const changeMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        productId: formProductId,
        quantity: Number(formQty) || 0,
        note: formNote.trim() || undefined,
      }
      return formMode === 'receive'
        ? inventoryApi.receive(payload)
        : inventoryApi.missing(payload)
    },
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ['inventory-movements'] })
      qc.invalidateQueries({ queryKey: ['inventory-summary'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['products-pos'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      setMsg(
        formMode === 'receive'
          ? `Received into ${p.name} · on hand ${p.quantity}`
          : `Marked missing from ${p.name} · on hand ${p.quantity}`,
      )
      setError('')
      setFormQty(1)
      setFormNote('')
    },
    onError: (e) => {
      setError(getErrorMessage(e))
      setMsg('')
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!formProductId) {
      setError('Pick a product')
      return
    }
    changeMutation.mutate()
  }

  function typeClass(t: string) {
    if (t === 'Received') return 'text-[var(--pay)]'
    if (t === 'Sold') return 'text-[var(--accent)]'
    if (t === 'Missing') return 'text-[var(--danger)]'
    return 'text-[var(--warn)]'
  }

  return (
    <div className="page space-y-3">
      <div>
        <h2 className="text-xl font-bold">Inventory history</h2>
        <p className="text-sm text-[var(--muted)]">
          Ledger of stock in, sold, missing, and adjustments — keeps a future-proof audit trail
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
        {[
          { label: 'Received', value: summary?.received ?? 0, cls: 'text-[var(--pay)]' },
          { label: 'Sold', value: summary?.sold ?? 0, cls: 'text-[var(--accent)]' },
          { label: 'Missing', value: summary?.missing ?? 0, cls: 'text-[var(--danger)]' },
          { label: 'On hand', value: summary?.onHand ?? 0, cls: '' },
          { label: 'Net (ledger)', value: summary?.netChange ?? 0, cls: 'text-[var(--muted)]' },
        ].map((c) => (
          <div key={c.label} className="panel p-3">
            <div className="text-xs text-[var(--muted)] uppercase tracking-wide">{c.label}</div>
            <div className={`mono text-2xl font-bold ${c.cls}`}>{c.value}</div>
          </div>
        ))}
      </div>

      {isAdmin && (
        <form onSubmit={onSubmit} className="panel p-3 grid md:grid-cols-[1fr_100px_1fr_auto_auto] gap-2 items-end">
          <div>
            <label className="field-label" htmlFor="inv-product">Product</label>
            <select
              id="inv-product"
              className="field"
              value={formProductId}
              onChange={(e) => setFormProductId(e.target.value)}
              required
            >
              <option value="">Select…</option>
              {activeProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  #{p.sequenceNumber} {p.name} ({p.quantity})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="inv-qty">Qty</label>
            <input
              id="inv-qty"
              type="number"
              min={1}
              className="field mono"
              value={formQty}
              onChange={(e) => setFormQty(Number(e.target.value) || 0)}
              required
            />
          </div>
          <div>
            <label className="field-label" htmlFor="inv-note">Note</label>
            <input
              id="inv-note"
              className="field"
              placeholder="Supplier / damage / count…"
              value={formNote}
              onChange={(e) => setFormNote(e.target.value)}
            />
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              className={`btn flex-1 ${formMode === 'receive' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setFormMode('receive')}
            >
              + In
            </button>
            <button
              type="button"
              className={`btn flex-1 ${formMode === 'missing' ? 'btn-danger' : 'btn-ghost'}`}
              onClick={() => setFormMode('missing')}
            >
              Missing
            </button>
          </div>
          <button type="submit" className="btn btn-pay" disabled={changeMutation.isPending}>
            {changeMutation.isPending ? '…' : formMode === 'receive' ? 'Receive' : 'Mark missing'}
          </button>
        </form>
      )}

      {(msg || error) && (
        <div className={`text-sm ${error ? 'toast-err' : 'toast-ok'}`}>{error || msg}</div>
      )}

      <div className="panel p-3 flex flex-wrap gap-2 items-end">
        <div className="min-w-[200px] flex-1">
          <label className="field-label" htmlFor="filter-product">Filter product</label>
          <select
            id="filter-product"
            className="field"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
          >
            <option value="">All products</option>
            {activeProducts.map((p) => (
              <option key={p.id} value={p.id}>
                #{p.sequenceNumber} {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-1">
          {TYPES.map((t) => (
            <button
              key={t}
              type="button"
              className={`btn btn-sm ${type === t ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setType(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="table-wrap">
        {isLoading ? (
          <p className="p-4">Loading…</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Product</th>
                <th>Type</th>
                <th>Qty</th>
                <th>Before → After</th>
                <th>Note</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap">{new Date(m.createdAt).toLocaleString()}</td>
                  <td>
                    <div className="font-medium">{m.productName}</div>
                    <div className="mono text-xs text-[var(--muted)]">
                      #{m.sequenceNumber} · {m.sku}
                    </div>
                  </td>
                  <td className={`font-semibold ${typeClass(m.type)}`}>{m.type}</td>
                  <td className="mono font-semibold">
                    {m.type === 'Received' || (m.type === 'Adjustment' && m.quantityAfter > m.quantityBefore)
                      ? '+'
                      : '−'}
                    {m.quantity}
                  </td>
                  <td className="mono text-sm">
                    {m.quantityBefore} → {m.quantityAfter}
                  </td>
                  <td className="text-sm text-[var(--muted)]">{m.note || '—'}</td>
                  <td className="text-sm">{m.userName || '—'}</td>
                </tr>
              ))}
              {movements.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-[var(--muted)]">
                    No movements yet — sell, receive stock, or mark missing to build history
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
