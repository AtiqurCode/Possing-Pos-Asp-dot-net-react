import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { getErrorMessage } from '../api/client'
import { productsApi, subCategoriesApi } from '../api/endpoints'
import { useAuth } from '../auth/AuthContext'
import { useStoreSettings } from '../hooks/useStoreSettings'
import { mediaUrl } from '../lib/media'
import type { Product } from '../types'

const emptyForm = {
  sku: '',
  name: '',
  description: '',
  price: 0,
  quantity: 0,
  minStockLevel: 5,
  subCategoryId: '',
  isActive: true,
}

type Draft = { price: string; quantity: string }

export default function ProductsPage() {
  const { isAdmin } = useAuth()
  const { currency } = useStoreSettings()
  const qc = useQueryClient()
  const [params] = useSearchParams()
  const [search, setSearch] = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(params.get('lowStock') === '1')
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [pendingImage, setPendingImage] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [savingId, setSavingId] = useState<string | null>(null)

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', search, lowStockOnly],
    queryFn: () => productsApi.list({ search: search || undefined, lowStockOnly: lowStockOnly || undefined }),
  })

  const { data: subCategories = [] } = useQuery({
    queryKey: ['subcategories'],
    queryFn: () => subCategoriesApi.list(),
  })

  useEffect(() => {
    const next: Record<string, Draft> = {}
    for (const p of products) {
      next[p.id] = {
        price: String(p.price),
        quantity: String(p.quantity),
      }
    }
    setDrafts(next)
  }, [products])

  useEffect(() => {
    if (!pendingImage) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(pendingImage)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [pendingImage])

  const saveMutation = useMutation({
    mutationFn: async () => {
      let product: Product
      if (editing) {
        product = await productsApi.update(editing.id, {
          sku: form.sku,
          name: form.name,
          description: form.description,
          price: Number(form.price),
          quantity: Number(form.quantity),
          minStockLevel: Number(form.minStockLevel),
          subCategoryId: form.subCategoryId,
          isActive: form.isActive,
        })
      } else {
        product = await productsApi.create({
          sku: form.sku || undefined,
          name: form.name,
          description: form.description,
          price: Number(form.price),
          quantity: Number(form.quantity),
          minStockLevel: Number(form.minStockLevel),
          subCategoryId: form.subCategoryId,
          isActive: form.isActive,
        })
      }
      if (pendingImage) {
        product = await productsApi.uploadImage(product.id, pendingImage)
      }
      return product
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['products-pos'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      setShowForm(false)
      setEditing(null)
      setForm(emptyForm)
      setPendingImage(null)
    },
    onError: (e) => setError(getErrorMessage(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => productsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['products-pos'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (e) => setError(getErrorMessage(e)),
  })

  const title = useMemo(() => (editing ? 'Edit product' : 'New product'), [editing])

  function openCreate() {
    setEditing(null)
    setForm({ ...emptyForm, subCategoryId: subCategories[0]?.id || '' })
    setPendingImage(null)
    setShowForm(true)
    setError('')
  }

  function openEdit(p: Product) {
    setEditing(p)
    setForm({
      sku: p.sku,
      name: p.name,
      description: p.description,
      price: p.price,
      quantity: p.quantity,
      minStockLevel: p.minStockLevel,
      subCategoryId: p.subCategoryId,
      isActive: p.isActive,
    })
    setPendingImage(null)
    setShowForm(true)
    setError('')
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    saveMutation.mutate()
  }

  function draftFor(p: Product): Draft {
    return drafts[p.id] ?? { price: String(p.price), quantity: String(p.quantity) }
  }

  function isDirty(p: Product) {
    const d = draftFor(p)
    return Number(d.price) !== Number(p.price) || Number(d.quantity) !== Number(p.quantity)
  }

  async function saveStock(p: Product) {
    if (!isAdmin) return
    const d = draftFor(p)
    const price = Number(d.price)
    const quantity = Number(d.quantity)
    if (Number.isNaN(price) || Number.isNaN(quantity) || price < 0 || quantity < 0) {
      setError('Price and quantity must be valid numbers >= 0')
      return
    }
    if (!isDirty(p)) return

    setSavingId(p.id)
    setError('')
    try {
      await productsApi.patchStock(p.id, price, quantity)
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['products'] }),
        qc.invalidateQueries({ queryKey: ['products-pos'] }),
        qc.invalidateQueries({ queryKey: ['dashboard'] }),
      ])
    } catch (e) {
      setError(getErrorMessage(e))
      setDrafts((prev) => ({
        ...prev,
        [p.id]: { price: String(p.price), quantity: String(p.quantity) },
      }))
    } finally {
      setSavingId(null)
    }
  }

  function onStockKey(e: KeyboardEvent<HTMLInputElement>, p: Product) {
    if (e.key === 'Enter') {
      e.currentTarget.blur()
      void saveStock(p)
    }
    if (e.key === 'Escape') {
      setDrafts((prev) => ({
        ...prev,
        [p.id]: { price: String(p.price), quantity: String(p.quantity) },
      }))
      e.currentTarget.blur()
    }
  }

  async function onRowImage(p: Product, file?: File | null) {
    if (!file || !isAdmin) return
    setError('')
    try {
      await productsApi.uploadImage(p.id, file)
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['products-pos'] })
    } catch (e) {
      setError(getErrorMessage(e))
    }
  }

  const formPreview = previewUrl || (editing ? mediaUrl(editing.imageUrl) : null)

  return (
    <div className="page space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Products</h2>
          <p className="text-sm text-[var(--muted)]">
            Catalog + on-hand qty · inline price/qty ·{' '}
            <Link to="/inventory" className="text-[var(--accent)] hover:underline">
              Inventory ledger
            </Link>
          </p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <Link to="/inventory" className="btn btn-ghost w-full sm:w-auto">Receive / Missing</Link>
            <button onClick={openCreate} className="btn btn-primary w-full sm:w-auto">Add product</button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          className="field max-w-sm"
          placeholder="Search name / SKU / sequence"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label className="inline-flex items-center gap-2 text-sm panel px-3">
          <input type="checkbox" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} />
          Low stock only
        </label>
      </div>

      {error && <div className="text-sm text-[var(--danger)]">{error}</div>}

      {showForm && isAdmin && (
        <form onSubmit={onSubmit} className="panel p-3 grid md:grid-cols-2 gap-3">
          <h3 className="md:col-span-2 font-semibold">{title}</h3>

          <label className="block text-sm font-medium">
            SKU
            <input
              className="field mt-1"
              placeholder={editing ? undefined : 'Auto if empty'}
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              required={!!editing}
            />
          </label>

          <label className="block text-sm font-medium">
            Product name
            <input
              className="field mt-1"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </label>

          <label className="block text-sm font-medium md:col-span-2">
            Description
            <input
              className="field mt-1"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>

          <label className="block text-sm font-medium">
            Price ({currency})
            <input
              type="number"
              min={0}
              step="0.01"
              className="field mt-1"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
              required
            />
          </label>

          <label className="block text-sm font-medium">
            Quantity
            <input
              type="number"
              min={0}
              className="field mt-1"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
              required
            />
          </label>

          <label className="block text-sm font-medium">
            Min stock level
            <input
              type="number"
              min={0}
              className="field mt-1"
              value={form.minStockLevel}
              onChange={(e) => setForm({ ...form, minStockLevel: Number(e.target.value) })}
              required
            />
          </label>

          <label className="block text-sm font-medium">
            Subcategory
            <select
              className="field mt-1"
              value={form.subCategoryId}
              onChange={(e) => setForm({ ...form, subCategoryId: e.target.value })}
              required
            >
              <option value="">Select subcategory</option>
              {subCategories.map((s) => (
                <option key={s.id} value={s.id}>{s.categoryName} / {s.name}</option>
              ))}
            </select>
          </label>

          <label className="inline-flex items-center gap-2 text-sm font-medium self-end pb-2">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
            Active
          </label>

          <div className="md:col-span-2">
            <div className="text-sm font-medium mb-1">Product image</div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="btn btn-ghost cursor-pointer">
                Choose image
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => setPendingImage(e.target.files?.[0] ?? null)}
                />
              </label>
              {formPreview && (
                <img src={formPreview} alt="" className="h-16 w-16 object-cover border border-[var(--line)] rounded" />
              )}
              <span className="text-xs text-[var(--muted)]">jpg/png/webp/gif · max 5MB</span>
            </div>
          </div>

          <div className="md:col-span-2 flex gap-2">
            <button className="btn btn-primary">Save</button>
            <button type="button" onClick={() => { setShowForm(false); setPendingImage(null) }} className="btn btn-ghost">Cancel</button>
          </div>
        </form>
      )}

      <div className="table-wrap">
        {isLoading ? (
          <p className="p-4">Loading…</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Img</th>
                <th>Seq</th>
                <th>SKU</th>
                <th>Name</th>
                <th>Category</th>
                <th>Price</th>
                <th>Qty</th>
                <th>Status</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const d = draftFor(p)
                const dirty = isDirty(p)
                const img = mediaUrl(p.imageUrl)
                return (
                  <tr key={p.id} className={dirty ? 'bg-[#fff8e8]' : undefined}>
                    <td>
                      <label className={`block h-12 w-12 border border-[var(--line)] rounded overflow-hidden bg-[#f3f6f9] ${isAdmin ? 'cursor-pointer' : ''}`}>
                        {img ? (
                          <img src={img} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="h-full w-full grid place-items-center text-[10px] text-[var(--muted)]">N/A</span>
                        )}
                        {isAdmin && (
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/gif"
                            className="hidden"
                            onChange={(e) => onRowImage(p, e.target.files?.[0])}
                          />
                        )}
                      </label>
                    </td>
                    <td className="mono">#{p.sequenceNumber}</td>
                    <td className="mono">{p.sku}</td>
                    <td className="font-medium">{p.name}</td>
                    <td className="text-[var(--muted)]">{p.categoryName} / {p.subCategoryName}</td>
                    <td>
                      {isAdmin ? (
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          className={`field !py-1 w-24 mono ${dirty ? 'border-[var(--warn)]' : ''}`}
                          value={d.price}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [p.id]: { ...draftFor(p), price: e.target.value },
                            }))
                          }
                          onBlur={() => void saveStock(p)}
                          onKeyDown={(e) => onStockKey(e, p)}
                          disabled={savingId === p.id}
                        />
                      ) : (
                        <span className="mono">{p.price.toFixed(2)}</span>
                      )}
                    </td>
                    <td>
                      {isAdmin ? (
                        <input
                          type="number"
                          min={0}
                          className={`field !py-1 w-20 mono ${dirty ? 'border-[var(--warn)]' : ''} ${p.isLowStock ? 'text-[var(--danger)] font-semibold' : ''}`}
                          value={d.quantity}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [p.id]: { ...draftFor(p), quantity: e.target.value },
                            }))
                          }
                          onBlur={() => void saveStock(p)}
                          onKeyDown={(e) => onStockKey(e, p)}
                          disabled={savingId === p.id}
                        />
                      ) : (
                        <span className={`mono ${p.isLowStock ? 'text-[var(--danger)] font-semibold' : ''}`}>{p.quantity}</span>
                      )}
                    </td>
                    <td>
                      {savingId === p.id
                        ? 'Saving…'
                        : dirty
                          ? <span className="text-[var(--warn)]">Unsaved</span>
                          : p.isLowStock
                            ? <span className="text-[var(--warn)]">Low</span>
                            : p.isActive
                              ? 'Active'
                              : 'Inactive'}
                    </td>
                    {isAdmin && (
                      <td className="space-x-2">
                        {dirty && (
                          <button onClick={() => void saveStock(p)} className="text-[var(--pay)] hover:underline">Save</button>
                        )}
                        <button onClick={() => openEdit(p)} className="text-[var(--accent)] hover:underline">Edit</button>
                        <button onClick={() => deleteMutation.mutate(p.id)} className="text-[var(--danger)] hover:underline">Deactivate</button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
