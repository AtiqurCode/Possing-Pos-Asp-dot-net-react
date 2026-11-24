import { useMemo, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { getErrorMessage } from '../api/client'
import { customersApi, productsApi, reportsApi, salesApi } from '../api/endpoints'
import { mediaUrl } from '../lib/media'
import type { CartLine, DiscountType, Product, Sale } from '../types'

const QUICK_PCT = [5, 10, 15, 20]

export default function PosPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [code, setCode] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [discountType, setDiscountType] = useState<DiscountType>('Percent')
  const [discountValue, setDiscountValue] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState('Cash')
  const [customerName, setCustomerName] = useState('')
  const [customerMobile, setCustomerMobile] = useState('')
  const [memberHint, setMemberHint] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [lastSale, setLastSale] = useState<Sale | null>(null)
  const [checkoutOpen, setCheckoutOpen] = useState(false)

  const { data: products = [] } = useQuery({
    queryKey: ['products-pos'],
    queryFn: () => productsApi.list(),
  })

  const subTotal = useMemo(() => cart.reduce((s, l) => s + l.product.price * l.qty, 0), [cart])
  const discountAmount = useMemo(() => {
    if (discountType === 'Percent') return Math.round(subTotal * (discountValue / 100) * 100) / 100
    return Math.min(discountValue, subTotal)
  }, [discountType, discountValue, subTotal])
  const total = Math.max(0, subTotal - discountAmount)
  const itemCount = useMemo(() => cart.reduce((s, l) => s + l.qty, 0), [cart])

  function addProduct(product: Product) {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id)
      if (existing) {
        return prev.map((l) =>
          l.product.id === product.id ? { ...l, qty: Math.min(l.qty + 1, product.quantity) } : l,
        )
      }
      return [...prev, { product, qty: 1 }]
    })
    setMessage(`${product.name} added`)
    setError('')
  }

  function setQty(productId: string, qty: number, max: number) {
    const next = Math.max(1, Math.min(qty, max))
    setCart((prev) => prev.map((l) => (l.product.id === productId ? { ...l, qty: next } : l)))
  }

  async function addByCode(e: FormEvent) {
    e.preventDefault()
    if (!code.trim()) return
    try {
      const product = await productsApi.byCode(code.trim())
      addProduct(product)
      setCode('')
      inputRef.current?.focus()
    } catch (err) {
      setError(getErrorMessage(err, 'Product not found'))
    }
  }

  async function lookupMember() {
    setMemberHint('')
    if (!customerMobile.trim()) return
    try {
      const c = await customersApi.lookup(customerMobile.trim())
      setCustomerName(c.name)
      setMemberHint(`${c.membershipCode} · ${c.visitCount} visits · spent BDT ${c.totalSpent.toFixed(0)}`)
    } catch {
      setMemberHint('New member — will be created on checkout')
    }
  }

  const checkout = useMutation({
    mutationFn: () =>
      salesApi.create({
        items: cart.map((l) => ({ productId: l.product.id, qty: l.qty })),
        discountType,
        discountValue: Number(discountValue) || 0,
        paymentMethod,
        customerName: customerName.trim() || undefined,
        customerMobile: customerMobile.trim() || undefined,
      }),
    onSuccess: (sale) => {
      setLastSale(sale)
      setCart([])
      setDiscountValue(0)
      setCustomerName('')
      setCustomerMobile('')
      setMemberHint('')
      setCheckoutOpen(false)
      setMessage(`Paid · ${sale.invoiceNo} · BDT ${sale.total.toFixed(2)}`)
      setError('')
      inputRef.current?.focus()
    },
    onError: (e) => setError(getErrorMessage(e)),
  })

  const checkoutPanel = (
    <>
      <div className="px-3 py-2 border-b border-[var(--line)] font-semibold bg-[#f2f5f8] flex items-center justify-between">
        <span>Checkout</span>
        <button
          type="button"
          className="lg:hidden btn btn-ghost btn-sm"
          onClick={() => setCheckoutOpen(false)}
        >
          Close
        </button>
      </div>

      <div className="p-3 space-y-3 border-b border-[var(--line)]">
        <div className="text-xs font-semibold text-[var(--muted)] tracking-wide">MEMBER (optional)</div>
        <div>
          <label className="field-label" htmlFor="pos-mobile">Mobile number</label>
          <div className="flex gap-2">
            <input
              id="pos-mobile"
              className="field"
              inputMode="tel"
              placeholder="01XXXXXXXXX"
              value={customerMobile}
              onChange={(e) => setCustomerMobile(e.target.value)}
              onBlur={lookupMember}
            />
            <button type="button" className="btn btn-ghost shrink-0" onClick={lookupMember}>
              Find
            </button>
          </div>
        </div>
        <div>
          <label className="field-label" htmlFor="pos-name">Customer name</label>
          <input
            id="pos-name"
            className="field"
            placeholder="Optional"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />
        </div>
        {memberHint && <div className="text-xs text-[var(--muted)]">{memberHint}</div>}
      </div>

      <div className="p-3 space-y-3 border-b border-[var(--line)]">
        <div className="text-xs font-semibold text-[var(--muted)] tracking-wide">DISCOUNT</div>
        <div className="flex gap-1">
          {(['Percent', 'Amount'] as DiscountType[]).map((t) => (
            <button
              key={t}
              type="button"
              className={`btn flex-1 btn-sm ${discountType === t ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setDiscountType(t)}
            >
              {t === 'Percent' ? '% Off' : 'BDT Off'}
            </button>
          ))}
        </div>
        {discountType === 'Percent' && (
          <div className="grid grid-cols-4 gap-1">
            {QUICK_PCT.map((p) => (
              <button
                key={p}
                type="button"
                className={`btn btn-sm ${discountValue === p ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setDiscountValue(p)}
              >
                {p}%
              </button>
            ))}
          </div>
        )}
        <div>
          <label className="field-label" htmlFor="pos-discount">
            {discountType === 'Percent' ? 'Discount percent' : 'Discount amount (BDT)'}
          </label>
          <input
            id="pos-discount"
            type="number"
            min={0}
            max={discountType === 'Percent' ? 100 : undefined}
            step={discountType === 'Percent' ? 1 : 0.01}
            className="field mono"
            value={discountValue}
            onChange={(e) => setDiscountValue(Number(e.target.value) || 0)}
          />
        </div>
      </div>

      <div className="p-3 space-y-2 border-b border-[var(--line)] text-sm">
        <div className="flex justify-between"><span>Subtotal</span><span className="mono">{subTotal.toFixed(2)}</span></div>
        <div className="flex justify-between text-[var(--warn)]">
          <span>Discount {discountType === 'Percent' ? `(${discountValue}%)` : ''}</span>
          <span className="mono">−{discountAmount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-xl font-bold pt-1">
          <span>TOTAL</span>
          <span className="mono">BDT {total.toFixed(2)}</span>
        </div>
      </div>

      <div className="p-3 space-y-2">
        <div className="text-xs font-semibold text-[var(--muted)] tracking-wide">PAYMENT</div>
        <div className="flex gap-1">
          {['Cash', 'Card'].map((m) => (
            <button
              key={m}
              type="button"
              className={`btn flex-1 ${paymentMethod === m ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setPaymentMethod(m)}
            >
              {m}
            </button>
          ))}
        </div>
        <button
          disabled={cart.length === 0 || checkout.isPending}
          onClick={() => checkout.mutate()}
          className="btn btn-pay w-full py-3 text-base"
        >
          {checkout.isPending ? 'Processing…' : `CHARGE ${total.toFixed(2)}`}
        </button>
        {lastSale && (
          <button
            className="btn btn-ghost w-full"
            onClick={() => reportsApi.download(`/reports/sales/${lastSale.id}/slip.pdf`, `${lastSale.invoiceNo}.pdf`)}
          >
            Print slip · {lastSale.invoiceNo}
          </button>
        )}
      </div>
    </>
  )

  return (
    <div className="page grid lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_380px] gap-3 lg:h-[calc(100dvh-72px)] pb-20 lg:pb-0">
      <section className="flex flex-col gap-3 min-h-0">
        <form onSubmit={addByCode} className="panel p-2 sm:p-3">
          <label className="field-label" htmlFor="pos-code">Scan / product code</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="pos-code"
              ref={inputRef}
              autoFocus
              className="field mono text-base flex-1"
              placeholder="SKU or sequence # then Enter"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              enterKeyHint="done"
            />
            <div className="flex gap-2">
              <button className="btn btn-primary flex-1 sm:flex-none">Add</button>
              <button
                type="button"
                className="btn btn-ghost flex-1 sm:flex-none"
                onClick={() => {
                  setCart([])
                  setMessage('Cart cleared')
                }}
              >
                Clear
              </button>
            </div>
          </div>
        </form>

        {(message || error) && (
          <div className={`text-sm px-1 ${error ? 'toast-err' : 'toast-ok'}`} role="status">
            {error || message}
          </div>
        )}

        {/* Mobile cart cards */}
        <div className="panel md:hidden">
          <div className="px-3 py-2 border-b border-[var(--line)] bg-[#f2f5f8] font-semibold text-sm flex justify-between">
            <span>Cart</span>
            <span className="text-[var(--muted)] font-normal">{itemCount} item{itemCount === 1 ? '' : 's'}</span>
          </div>
          {cart.length === 0 ? (
            <p className="p-6 text-center text-[var(--muted)] text-sm">Scan or tap a product below</p>
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {cart.map((line) => (
                <li key={line.product.id} className="p-3 flex gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{line.product.name}</div>
                    <div className="mono text-xs text-[var(--muted)]">
                      #{line.product.sequenceNumber} · BDT {line.product.price.toFixed(2)}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm !min-h-9 !px-3"
                        onClick={() => setQty(line.product.id, line.qty - 1, line.product.quantity)}
                      >
                        −
                      </button>
                      <span className="mono w-8 text-center font-semibold">{line.qty}</span>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm !min-h-9 !px-3"
                        onClick={() => setQty(line.product.id, line.qty + 1, line.product.quantity)}
                      >
                        +
                      </button>
                      <span className="mono font-semibold ml-auto">
                        {(line.product.price * line.qty).toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm self-start"
                    aria-label={`Remove ${line.product.name}`}
                    onClick={() => setCart((prev) => prev.filter((l) => l.product.id !== line.product.id))}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Desktop/tablet table */}
        <div className="panel hidden md:block flex-1 min-h-0 overflow-auto">
          <table className="data-table !min-w-0">
            <thead>
              <tr>
                <th>Item</th>
                <th className="hidden lg:table-cell">Code</th>
                <th>Price</th>
                <th>Qty</th>
                <th>Line</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cart.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-[var(--muted)] py-10">
                    Scan an item or tap a product below
                  </td>
                </tr>
              ) : (
                cart.map((line) => (
                  <tr key={line.product.id}>
                    <td className="font-medium">{line.product.name}</td>
                    <td className="mono text-[var(--muted)] hidden lg:table-cell">
                      #{line.product.sequenceNumber} / {line.product.sku}
                    </td>
                    <td className="mono">{line.product.price.toFixed(2)}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm !min-h-8 !px-2"
                          onClick={() => setQty(line.product.id, line.qty - 1, line.product.quantity)}
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={line.product.quantity}
                          className="field w-14 !py-1 !min-h-8 text-center"
                          value={line.qty}
                          onChange={(e) =>
                            setQty(line.product.id, Number(e.target.value) || 1, line.product.quantity)
                          }
                        />
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm !min-h-8 !px-2"
                          onClick={() => setQty(line.product.id, line.qty + 1, line.product.quantity)}
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="mono font-semibold">{(line.product.price * line.qty).toFixed(2)}</td>
                    <td>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => setCart((prev) => prev.filter((l) => l.product.id !== line.product.id))}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="panel p-2 sm:p-3">
          <div className="text-xs font-semibold text-[var(--muted)] mb-2 tracking-wide">QUICK PICK</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2 max-h-52 sm:max-h-56 md:max-h-44 overflow-auto">
            {products
              .filter((p) => p.isActive && p.quantity > 0)
              .map((p) => {
                const img = mediaUrl(p.imageUrl)
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addProduct(p)}
                    className="text-left border border-[var(--line)] rounded px-2 py-2 hover:bg-[#f3f7fb] active:bg-[#e8eef5] bg-white min-h-[88px]"
                  >
                    {img ? (
                      <img src={img} alt="" className="h-14 sm:h-12 w-full object-cover rounded mb-1 bg-[#eef2f6]" />
                    ) : (
                      <div className="h-14 sm:h-12 w-full rounded mb-1 bg-[#eef2f6] grid place-items-center text-[10px] text-[var(--muted)]">
                        No img
                      </div>
                    )}
                    <div className="font-medium text-sm truncate">{p.name}</div>
                    <div className="mono text-xs text-[var(--muted)]">#{p.sequenceNumber}</div>
                    <div className="mono text-sm font-semibold mt-1">BDT {p.price.toFixed(0)}</div>
                  </button>
                )
              })}
          </div>
        </div>
      </section>

      {/* Desktop checkout sidebar */}
      <aside className="panel hidden lg:flex flex-col min-h-0 overflow-auto">
        {checkoutPanel}
      </aside>

      {/* Mobile/tablet sticky pay bar */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-[var(--line)] bg-white p-2 sm:p-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
        <div className="flex gap-2 items-center max-w-3xl mx-auto">
          <div className="flex-1 min-w-0">
            <div className="text-xs text-[var(--muted)]">{itemCount} items</div>
            <div className="mono font-bold text-lg truncate">BDT {total.toFixed(2)}</div>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setCheckoutOpen(true)}
          >
            Options
          </button>
          <button
            disabled={cart.length === 0 || checkout.isPending}
            onClick={() => checkout.mutate()}
            className="btn btn-pay min-w-[140px]"
          >
            {checkout.isPending ? '…' : 'CHARGE'}
          </button>
        </div>
      </div>

      {/* Mobile checkout sheet */}
      {checkoutOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close checkout"
            onClick={() => setCheckoutOpen(false)}
          />
          <div className="absolute bottom-0 inset-x-0 max-h-[88dvh] overflow-auto rounded-t-xl bg-white shadow-2xl">
            <div className="sticky top-0 h-1.5 w-12 bg-[var(--line)] rounded-full mx-auto mt-2 mb-1" />
            {checkoutPanel}
          </div>
        </div>
      )}
    </div>
  )
}
