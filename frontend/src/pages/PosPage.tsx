import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { getErrorMessage } from '../api/client'
import { customersApi, productsApi, reportsApi, salesApi } from '../api/endpoints'
import { useStoreSettings } from '../hooks/useStoreSettings'
import type { CartLine, Product, Sale } from '../types'
import PosCheckoutAside from './pos/PosCheckoutAside'
import { computePosTotals, parseQtyCode } from './pos/totals'

export default function PosPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const memberRef = useRef<HTMLInputElement>(null)
  const cartRef = useRef<CartLine[]>([])
  const payRef = useRef<'Cash' | 'Card'>('Cash')
  const discountRef = useRef(0)
  const pendingRef = useRef(false)
  const lastSaleRef = useRef<Sale | null>(null)
  const selectedRef = useRef(0)
  const customerNameRef = useRef('')
  const customerMobileRef = useRef('')

  const [code, setCode] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card'>('Cash')
  const [discountPct, setDiscountPct] = useState(0)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [customerName, setCustomerName] = useState('')
  const [customerMobile, setCustomerMobile] = useState('')
  const [memberHint, setMemberHint] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [lastSale, setLastSale] = useState<Sale | null>(null)
  const [showKeys, setShowKeys] = useState(false)

  cartRef.current = cart
  payRef.current = paymentMethod
  discountRef.current = discountPct
  lastSaleRef.current = lastSale
  selectedRef.current = selectedIdx
  customerNameRef.current = customerName
  customerMobileRef.current = customerMobile

  const { data: products = [] } = useQuery({
    queryKey: ['products-pos'],
    queryFn: () => productsApi.list(),
  })

  const { currency, vatPercent, inclusive } = useStoreSettings()

  const subTotal = useMemo(() => cart.reduce((s, l) => s + l.product.price * l.qty, 0), [cart])
  const { discountAmount, taxAmount, total } = useMemo(
    () => computePosTotals(subTotal, discountPct, vatPercent, inclusive),
    [subTotal, discountPct, vatPercent, inclusive],
  )
  const itemCount = useMemo(() => cart.reduce((s, l) => s + l.qty, 0), [cart])
  const vatLabel = inclusive ? `VAT incl. (${vatPercent}%)` : `VAT (${vatPercent}%)`
  const canCharge = cart.length > 0 && !pendingRef.current
  const quick = products.filter((p) => p.isActive && p.quantity > 0).slice(0, 12)

  function focusScan() {
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  function addProduct(product: Product, qty = 1) {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id)
      let next: CartLine[]
      if (existing) {
        next = prev.map((l) =>
          l.product.id === product.id
            ? { ...l, qty: Math.min(l.qty + qty, product.quantity) }
            : l,
        )
      } else {
        next = [...prev, { product, qty: Math.min(qty, product.quantity) }]
      }
      const idx = next.findIndex((l) => l.product.id === product.id)
      setSelectedIdx(idx >= 0 ? idx : next.length - 1)
      return next
    })
    setMessage(qty > 1 ? `${product.name} ×${qty}` : product.name)
    setError('')
    setLastSale(null)
    focusScan()
  }

  function setQty(productId: string, qty: number, max: number) {
    if (qty < 1) {
      setCart((prev) => {
        const next = prev.filter((l) => l.product.id !== productId)
        setSelectedIdx((i) => Math.max(0, Math.min(i, next.length - 1)))
        return next
      })
      return
    }
    setCart((prev) =>
      prev.map((l) => (l.product.id === productId ? { ...l, qty: Math.min(qty, max) } : l)),
    )
  }

  function bumpSelected(delta: number) {
    const list = cartRef.current
    if (list.length === 0) return
    const idx = Math.min(selectedRef.current, list.length - 1)
    const line = list[idx]
    setQty(line.product.id, line.qty + delta, line.product.quantity)
    setMessage(`${line.product.name} qty ${Math.max(0, line.qty + delta)}`)
    focusScan()
  }

  function removeSelected() {
    const list = cartRef.current
    if (list.length === 0) return
    const idx = Math.min(selectedRef.current, list.length - 1)
    const line = list[idx]
    setCart((prev) => {
      const next = prev.filter((_, i) => i !== idx)
      setSelectedIdx(Math.max(0, Math.min(idx, next.length - 1)))
      return next
    })
    setMessage(`Removed ${line.product.name}`)
    focusScan()
  }

  function clearMember() {
    setCustomerName('')
    setCustomerMobile('')
    setMemberHint('')
  }

  function clearCart() {
    setCart([])
    setDiscountPct(0)
    setSelectedIdx(0)
    clearMember()
    setMessage('Cart cleared')
    setError('')
    focusScan()
  }

  async function lookupMember() {
    const mobile = customerMobileRef.current.trim()
    if (!mobile) {
      setMemberHint('')
      return
    }
    try {
      const c = await customersApi.lookup(mobile)
      setCustomerName(c.name)
      setMemberHint(`${c.membershipCode} · ${c.visitCount} visits`)
      setMessage(`Member · ${c.name || c.mobile}`)
    } catch {
      setMemberHint('New member — saved on charge')
    }
  }

  function printLastSlip() {
    const sale = lastSaleRef.current
    if (!sale) {
      setError('No slip to print')
      focusScan()
      return
    }
    void reportsApi.download(`/reports/sales/${sale.id}/slip.pdf`, `${sale.invoiceNo}.pdf`)
    setMessage(`Printing ${sale.invoiceNo}`)
    focusScan()
  }

  async function addByCode(raw?: string) {
    const parsed = parseQtyCode(raw ?? code)
    if (!parsed) return
    if (!parsed.lookup) {
      setError('Enter product after qty*')
      return
    }

    try {
      const product = await productsApi.byCode(parsed.lookup)
      addProduct(product, parsed.qty)
      setCode('')
    } catch (err) {
      setError(getErrorMessage(err, 'Not found'))
      focusScan()
    }
  }

  const checkout = useMutation({
    mutationFn: (pay: 'Cash' | 'Card') =>
      salesApi.create({
        items: cartRef.current.map((l) => ({ productId: l.product.id, qty: l.qty })),
        discountType: 'Percent',
        discountValue: discountRef.current,
        paymentMethod: pay,
        customerName: customerNameRef.current.trim() || undefined,
        customerMobile: customerMobileRef.current.trim() || undefined,
      }),
    onMutate: () => {
      pendingRef.current = true
    },
    onSuccess: (sale) => {
      pendingRef.current = false
      setLastSale(sale)
      setCart([])
      setDiscountPct(0)
      setSelectedIdx(0)
      clearMember()
      setMessage(`Paid · ${sale.invoiceNo} · ${currency} ${sale.total.toFixed(2)}`)
      setError('')
      focusScan()
    },
    onError: (e) => {
      pendingRef.current = false
      setError(getErrorMessage(e))
      focusScan()
    },
  })

  function charge(pay: 'Cash' | 'Card' = payRef.current) {
    if (cartRef.current.length === 0 || pendingRef.current || checkout.isPending) return
    setPaymentMethod(pay)
    checkout.mutate(pay)
  }

  function onScanSubmit(e: FormEvent) {
    e.preventDefault()
    const text = code.trim()
    if (!text) {
      if (cartRef.current.length > 0) charge()
      return
    }
    void addByCode(text)
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const key = e.key
      const mod = e.ctrlKey || e.metaKey
      const typing = (e.target as HTMLElement)?.tagName === 'INPUT'

      if (key === 'F1') {
        e.preventDefault()
        setShowKeys((v) => !v)
        focusScan()
        return
      }
      if (key === 'F2') {
        e.preventDefault()
        charge('Cash')
        return
      }
      if (key === 'F3') {
        e.preventDefault()
        charge('Card')
        return
      }
      if (key === 'F4') {
        e.preventDefault()
        clearCart()
        return
      }
      if (key === 'F5') {
        e.preventDefault()
        printLastSlip()
        return
      }
      if (key === 'F6') {
        e.preventDefault()
        setPaymentMethod('Cash')
        setMessage('Pay: Cash')
        focusScan()
        return
      }
      if (key === 'F7') {
        e.preventDefault()
        setPaymentMethod('Card')
        setMessage('Pay: Card')
        focusScan()
        return
      }
      if (key === 'F8' || key === 'F9' || key === 'F10' || key === 'F11') {
        e.preventDefault()
        const map: Record<string, number> = { F8: 0, F9: 5, F10: 10, F11: 15 }
        const pct = map[key] ?? 0
        setDiscountPct(pct)
        setMessage(pct === 0 ? 'Discount off' : `Discount ${pct}%`)
        focusScan()
        return
      }
      if (key === 'F12') {
        e.preventDefault()
        memberRef.current?.focus()
        memberRef.current?.select()
        return
      }
      if (mod && key === 'Enter') {
        e.preventDefault()
        charge()
        return
      }
      if (key === 'Escape') {
        e.preventDefault()
        setCode('')
        setError('')
        focusScan()
        return
      }

      if (!mod && !e.altKey) {
        if (key === 'ArrowUp') {
          e.preventDefault()
          setSelectedIdx((i) => {
            const max = Math.max(0, cartRef.current.length - 1)
            return Math.max(0, Math.min(i, max) - 1)
          })
          focusScan()
          return
        }
        if (key === 'ArrowDown') {
          e.preventDefault()
          setSelectedIdx((i) => {
            const max = Math.max(0, cartRef.current.length - 1)
            return Math.min(max, Math.min(i, max) + 1)
          })
          focusScan()
          return
        }

        const scanEmpty = !inputRef.current?.value
        if ((key === '+' || key === '=') && (scanEmpty || !typing)) {
          e.preventDefault()
          bumpSelected(1)
          return
        }
        if (key === '-' && (scanEmpty || !typing)) {
          e.preventDefault()
          bumpSelected(-1)
          return
        }
        if (key === 'Delete' || (key === 'Backspace' && scanEmpty)) {
          e.preventDefault()
          removeSelected()
          return
        }
      }

      if (!typing && !mod && !e.altKey && key.length === 1 && !['+', '=', '-'].includes(key)) {
        inputRef.current?.focus()
      }
    }

    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [checkout])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') focusScan()
    }
    window.addEventListener('focus', focusScan)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('focus', focusScan)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  return (
    <div className="page grid lg:grid-cols-[minmax(0,1fr)_340px] gap-2 lg:h-[calc(100dvh-72px)] pb-16 lg:pb-0">
      <section className="flex flex-col gap-2 min-h-0">
        <form onSubmit={onScanSubmit} className="panel p-2">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              autoFocus
              className="field mono text-base flex-1"
              placeholder="Scan / SKU / # · Enter · 3*SKU for qty"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onBlur={() => {
                setTimeout(() => {
                  if (document.activeElement?.tagName === 'BODY') focusScan()
                }, 0)
              }}
              enterKeyHint="done"
              aria-label="Product code"
              autoComplete="off"
              spellCheck={false}
            />
            <button type="submit" className="btn btn-primary shrink-0">
              Add
            </button>
            <button
              type="button"
              className="btn btn-ghost shrink-0"
              title="Keyboard shortcuts (F1)"
              onClick={() => setShowKeys((v) => !v)}
            >
              ⌨
            </button>
          </div>
        </form>

        {(message || error) && (
          <div className={`text-sm px-1 ${error ? 'toast-err' : 'toast-ok'}`} role="status">
            {error || message}
          </div>
        )}

        {showKeys && (
          <div className="panel p-3 text-xs grid sm:grid-cols-2 gap-x-4 gap-y-1 mono">
            <div><b>Enter</b> add / empty = charge</div>
            <div><b>3*SKU</b> add qty 3</div>
            <div><b>↑ ↓</b> select line</div>
            <div><b>+ −</b> qty · <b>Del</b> remove</div>
            <div><b>F2</b> cash charge · <b>F3</b> card</div>
            <div><b>F6/F7</b> select pay only</div>
            <div><b>F4</b> clear · <b>F5</b> print slip</div>
            <div><b>F8–F11</b> disc 0/5/10/15%</div>
            <div><b>F12</b> member (right panel)</div>
            <div><b>Esc</b> clear scan</div>
            <div><b>Ctrl+Enter</b> charge</div>
          </div>
        )}

        <div className="panel flex-1 min-h-0 overflow-auto">
          {cart.length === 0 ? (
            <p className="p-8 text-center text-[var(--muted)] text-sm">
              Scan or type code · Enter · F1 for keys
            </p>
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {cart.map((line, i) => {
                const active = i === selectedIdx
                return (
                  <li
                    key={line.product.id}
                    className={`px-3 py-2 flex items-center gap-2 cursor-pointer ${
                      active ? 'bg-[#e8f0fa] ring-1 ring-inset ring-[var(--accent)]' : ''
                    }`}
                    onClick={() => {
                      setSelectedIdx(i)
                      focusScan()
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate text-sm">{line.product.name}</div>
                      <div className="mono text-xs text-[var(--muted)]">
                        {currency} {line.product.price.toFixed(2)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm !min-h-9 !px-3"
                        onClick={(ev) => {
                          ev.stopPropagation()
                          setQty(line.product.id, line.qty - 1, line.product.quantity)
                        }}
                      >
                        −
                      </button>
                      <span className="mono w-7 text-center font-semibold">{line.qty}</span>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm !min-h-9 !px-3"
                        onClick={(ev) => {
                          ev.stopPropagation()
                          setQty(line.product.id, line.qty + 1, line.product.quantity)
                        }}
                      >
                        +
                      </button>
                    </div>
                    <div className="mono font-semibold w-16 text-right text-sm">
                      {(line.product.price * line.qty).toFixed(2)}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="panel p-2">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5 max-h-36 overflow-auto">
            {quick.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => addProduct(p)}
                className="text-left border border-[var(--line)] rounded px-2 py-2 hover:bg-[#f3f7fb] active:bg-[#e8eef5] bg-white min-h-[64px]"
              >
                <div className="font-medium text-xs truncate">{p.name}</div>
                <div className="mono text-xs font-semibold mt-0.5">
                  {currency} {p.price.toFixed(0)}
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <PosCheckoutAside
        currency={currency}
        itemCount={itemCount}
        canCharge={canCharge && !checkout.isPending}
        subTotal={subTotal}
        discountPct={discountPct}
        discountAmount={discountAmount}
        vatPercent={vatPercent}
        vatLabel={vatLabel}
        inclusive={inclusive}
        taxAmount={taxAmount}
        total={total}
        paymentMethod={paymentMethod}
        checkoutPending={checkout.isPending}
        cartEmpty={cart.length === 0}
        lastSale={lastSale}
        customerName={customerName}
        customerMobile={customerMobile}
        memberHint={memberHint}
        memberRef={memberRef}
        onClearMember={clearMember}
        onCustomerMobile={(v) => {
          setCustomerMobile(v)
          setMemberHint('')
        }}
        onCustomerName={setCustomerName}
        onLookupMember={() => void lookupMember()}
        onDiscount={setDiscountPct}
        onPay={setPaymentMethod}
        onCharge={() => charge()}
        onClearCart={clearCart}
        onPrintSlip={printLastSlip}
        onFocusScan={focusScan}
      />

      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-[var(--line)] bg-white p-2.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
        <div className="flex gap-2 items-stretch">
          <div className="flex-1 min-w-0 self-center">
            <div className="text-[10px] uppercase tracking-wide text-[var(--muted)] font-semibold">Due</div>
            <div className="mono font-bold text-xl leading-tight truncate">
              {currency} {total.toFixed(2)}
            </div>
          </div>
          <button
            type="button"
            className={`btn !px-3 ${paymentMethod === 'Cash' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setPaymentMethod('Cash')}
          >
            Cash
          </button>
          <button
            type="button"
            className={`btn !px-3 ${paymentMethod === 'Card' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setPaymentMethod('Card')}
          >
            Card
          </button>
          <button
            disabled={!canCharge || checkout.isPending}
            onClick={() => charge()}
            className="btn btn-pay min-w-[120px] flex-col !gap-0 !py-2"
          >
            <span>CHARGE</span>
            <span className="mono text-[10px] opacity-90 font-normal">{total.toFixed(0)}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
