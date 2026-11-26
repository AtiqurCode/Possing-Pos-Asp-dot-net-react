import type { RefObject } from 'react'
import type { Sale } from '../../types'

const DISCOUNTS = [0, 5, 10, 15] as const

type Props = {
  currency: string
  itemCount: number
  canCharge: boolean
  subTotal: number
  discountPct: number
  discountAmount: number
  vatPercent: number
  vatLabel: string
  inclusive: boolean
  taxAmount: number
  total: number
  paymentMethod: 'Cash' | 'Card'
  checkoutPending: boolean
  cartEmpty: boolean
  lastSale: Sale | null
  customerName: string
  customerMobile: string
  memberHint: string
  memberRef: RefObject<HTMLInputElement | null>
  onClearMember: () => void
  onCustomerMobile: (v: string) => void
  onCustomerName: (v: string) => void
  onLookupMember: () => void
  onDiscount: (pct: number) => void
  onPay: (m: 'Cash' | 'Card') => void
  onCharge: () => void
  onClearCart: () => void
  onPrintSlip: () => void
  onFocusScan: () => void
}

export default function PosCheckoutAside({
  currency,
  itemCount,
  canCharge,
  subTotal,
  discountPct,
  discountAmount,
  vatPercent,
  vatLabel,
  inclusive,
  taxAmount,
  total,
  paymentMethod,
  checkoutPending,
  cartEmpty,
  lastSale,
  customerName,
  customerMobile,
  memberHint,
  memberRef,
  onClearMember,
  onCustomerMobile,
  onCustomerName,
  onLookupMember,
  onDiscount,
  onPay,
  onCharge,
  onClearCart,
  onPrintSlip,
  onFocusScan,
}: Props) {
  return (
    <aside className="panel hidden lg:flex flex-col min-h-0 overflow-y-auto">
      <div
        className="px-4 pt-4 pb-3 border-b border-[var(--line)] shrink-0"
        style={{
          background: canCharge
            ? 'linear-gradient(180deg, #e8f5ee 0%, #ffffff 100%)'
            : 'linear-gradient(180deg, #f2f5f8 0%, #ffffff 100%)',
        }}
      >
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">
            Amount due
          </span>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--chip)] text-[var(--muted)]">
            {itemCount} item{itemCount === 1 ? '' : 's'}
          </span>
        </div>
        <div className="mono text-[2.35rem] font-bold leading-none tracking-tight text-[var(--ink)]">
          <span className="text-lg font-semibold text-[var(--muted)] mr-1">{currency}</span>
          {total.toFixed(2)}
        </div>
      </div>

      <div className="px-4 py-3 border-b border-[var(--line)] space-y-2 shrink-0 bg-[#f7fafc]">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">
            Member <span className="font-normal normal-case">(optional · F12)</span>
          </div>
          {(customerMobile || customerName) && (
            <button type="button" className="text-[10px] text-[var(--muted)] hover:underline" onClick={onClearMember}>
              Clear
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <input
            ref={memberRef}
            className="field !min-h-10 !py-1.5 mono text-sm flex-1"
            inputMode="tel"
            placeholder="Mobile"
            value={customerMobile}
            onChange={(e) => onCustomerMobile(e.target.value)}
            onBlur={onLookupMember}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                onLookupMember()
              }
            }}
            aria-label="Member mobile"
          />
          <button type="button" className="btn btn-ghost btn-sm shrink-0" onClick={onLookupMember}>
            Find
          </button>
        </div>
        <input
          className="field !min-h-10 !py-1.5 text-sm"
          placeholder="Name (optional)"
          value={customerName}
          onChange={(e) => onCustomerName(e.target.value)}
          aria-label="Member name"
        />
        {memberHint && <div className="text-[11px] text-[var(--muted)]">{memberHint}</div>}
      </div>

      <div className="px-4 py-3 space-y-1.5 text-sm border-b border-[var(--line)] shrink-0">
        <div className="flex justify-between gap-3">
          <span className="text-[var(--muted)]">Subtotal</span>
          <span className="mono">
            {currency} {subTotal.toFixed(2)}
          </span>
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between gap-3 text-[var(--warn)]">
            <span>Discount (−{discountPct}%)</span>
            <span className="mono">
              −{currency} {discountAmount.toFixed(2)}
            </span>
          </div>
        )}
        {vatPercent > 0 && (
          <div className="flex justify-between gap-3">
            <span className="text-[var(--muted)]">{vatLabel}</span>
            <span className="mono">
              {inclusive ? '' : '+'}
              {currency} {taxAmount.toFixed(2)}
            </span>
          </div>
        )}
        <div className="flex justify-between gap-3 pt-1.5 border-t border-dashed border-[var(--line)] font-semibold">
          <span>Total</span>
          <span className="mono">
            {currency} {total.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="px-4 py-3 border-b border-[var(--line)] shrink-0">
        <div className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-2">
          Discount <span className="font-normal normal-case">(F8–F11)</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {DISCOUNTS.map((p) => (
            <button
              key={p}
              type="button"
              className={`btn btn-sm ${discountPct === p ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => {
                onDiscount(p)
                onFocusScan()
              }}
            >
              {p === 0 ? 'None' : `${p}%`}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-3 flex flex-col gap-3 flex-1">
        <div>
          <div className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-2">
            Pay with
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(['Cash', 'Card'] as const).map((m) => (
              <button
                key={m}
                type="button"
                className={`btn flex-col !h-auto !py-3 gap-0.5 ${
                  paymentMethod === m ? 'btn-primary' : 'btn-ghost'
                }`}
                onClick={() => {
                  onPay(m)
                  onFocusScan()
                }}
              >
                <span className="text-base">{m}</span>
                <span
                  className={`text-[10px] font-normal ${
                    paymentMethod === m ? 'opacity-80' : 'text-[var(--muted)]'
                  }`}
                >
                  {m === 'Cash' ? 'F2 charge · F6' : 'F3 charge · F7'}
                </span>
              </button>
            ))}
          </div>
        </div>

        <button
          disabled={!canCharge}
          onClick={onCharge}
          className="btn btn-pay w-full !min-h-[64px] !py-4 flex-col gap-0.5 shadow-[0_4px_0_#145a34]"
        >
          {checkoutPending ? (
            <span className="text-lg">Processing…</span>
          ) : (
            <>
              <span className="text-lg tracking-wide">CHARGE · {paymentMethod}</span>
              <span className="mono text-sm opacity-90">
                {currency} {total.toFixed(2)} · Enter
              </span>
            </>
          )}
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn btn-ghost btn-sm" disabled={cartEmpty} onClick={onClearCart}>
            Clear · F4
          </button>
          {lastSale ? (
            <button type="button" className="btn btn-ghost btn-sm text-[var(--accent)]" onClick={onPrintSlip}>
              Print · F5
            </button>
          ) : (
            <div className="btn btn-ghost btn-sm opacity-40 pointer-events-none">Print · F5</div>
          )}
        </div>

        {lastSale && (
          <div className="rounded border border-[#b7e0c5] bg-[#eef8f1] px-3 py-2 text-xs">
            <div className="font-semibold text-[var(--pay)]">Last sale paid</div>
            <div className="mono text-[var(--muted)] mt-0.5">
              {lastSale.invoiceNo} · {currency} {lastSale.total.toFixed(2)}
            </div>
          </div>
        )}

        <p className="mt-auto pt-2 text-[10px] text-[var(--muted)] leading-relaxed">
          F1 shortcuts · scan stays focused for full keyboard sell
        </p>
      </div>
    </aside>
  )
}
