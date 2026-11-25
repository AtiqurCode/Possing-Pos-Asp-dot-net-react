import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getErrorMessage } from '../api/client'
import { settingsApi } from '../api/endpoints'
import type { TaxMode } from '../types'

export default function SettingsPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['store-settings'],
    queryFn: settingsApi.store,
  })

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [currency, setCurrency] = useState('BDT')
  const [vatPercent, setVatPercent] = useState(0)
  const [taxMode, setTaxMode] = useState<TaxMode>('Exclusive')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!data) return
    setName(data.name)
    setAddress(data.address)
    setPhone(data.phone)
    setCurrency(data.currency)
    setVatPercent(data.vatPercent)
    setTaxMode(data.taxMode)
  }, [data])

  const save = useMutation({
    mutationFn: () =>
      settingsApi.updateStore({
        name,
        address,
        phone,
        currency,
        vatPercent: Number(vatPercent) || 0,
        taxMode,
      }),
    onSuccess: (s) => {
      qc.setQueryData(['store-settings'], s)
      setMsg('Settings saved')
      setErr('')
    },
    onError: (e) => {
      setErr(getErrorMessage(e))
      setMsg('')
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    save.mutate()
  }

  if (isLoading) return <p className="p-4">Loading…</p>

  return (
    <div className="page max-w-xl space-y-3">
      <div>
        <h2 className="text-xl font-bold">Settings</h2>
        <p className="text-sm text-[var(--muted)]">
          Store identity, currency, and how VAT is applied at the register
        </p>
      </div>

      <form onSubmit={onSubmit} className="panel p-4 space-y-3">
        <div>
          <label className="field-label" htmlFor="set-name">Store name</label>
          <input id="set-name" className="field" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="field-label" htmlFor="set-address">Address</label>
          <input id="set-address" className="field" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="set-phone">Phone</label>
          <input id="set-phone" className="field" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label" htmlFor="set-currency">Currency</label>
            <input
              id="set-currency"
              className="field mono uppercase"
              maxLength={8}
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              required
            />
          </div>
          <div>
            <label className="field-label" htmlFor="set-vat">VAT / tax %</label>
            <input
              id="set-vat"
              type="number"
              min={0}
              max={100}
              step={0.01}
              className="field mono"
              value={vatPercent}
              onChange={(e) => setVatPercent(Number(e.target.value) || 0)}
            />
          </div>
        </div>

        <div>
          <div className="field-label">Tax calculation</div>
          <div className="flex flex-col gap-2">
            <label className="flex gap-2 items-start border border-[var(--line)] rounded p-3 cursor-pointer has-[:checked]:border-[var(--accent)]">
              <input
                type="radio"
                name="taxMode"
                className="mt-1"
                checked={taxMode === 'Exclusive'}
                onChange={() => setTaxMode('Exclusive')}
              />
              <span>
                <span className="font-medium block">Exclusive — add VAT on sale</span>
                <span className="text-xs text-[var(--muted)]">
                  Shelf price is net. Register adds VAT% to the bill.
                </span>
              </span>
            </label>
            <label className="flex gap-2 items-start border border-[var(--line)] rounded p-3 cursor-pointer has-[:checked]:border-[var(--accent)]">
              <input
                type="radio"
                name="taxMode"
                className="mt-1"
                checked={taxMode === 'Inclusive'}
                onChange={() => setTaxMode('Inclusive')}
              />
              <span>
                <span className="font-medium block">Inclusive — tax already in price</span>
                <span className="text-xs text-[var(--muted)]">
                  Product prices include VAT. Charge the shelf total; VAT is only shown on the slip.
                </span>
              </span>
            </label>
          </div>
        </div>

        {(msg || err) && (
          <div className={`text-sm ${err ? 'toast-err' : 'toast-ok'}`}>{err || msg}</div>
        )}

        <button type="submit" className="btn btn-primary" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save settings'}
        </button>
      </form>
    </div>
  )
}
