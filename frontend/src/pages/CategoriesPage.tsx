import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { categoriesApi, subCategoriesApi } from '../api/endpoints'
import { getErrorMessage } from '../api/client'

export default function CategoriesPage() {
  const qc = useQueryClient()
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.list })
  const { data: subCategories = [] } = useQuery({ queryKey: ['subcategories'], queryFn: () => subCategoriesApi.list() })

  const [catName, setCatName] = useState('')
  const [subName, setSubName] = useState('')
  const [subCategoryId, setSubCategoryId] = useState('')
  const [error, setError] = useState('')

  const createCat = useMutation({
    mutationFn: () => categoriesApi.create(catName),
    onSuccess: () => {
      setCatName('')
      qc.invalidateQueries({ queryKey: ['categories'] })
    },
    onError: (e) => setError(getErrorMessage(e)),
  })

  const createSub = useMutation({
    mutationFn: () => subCategoriesApi.create(subCategoryId, subName),
    onSuccess: () => {
      setSubName('')
      qc.invalidateQueries({ queryKey: ['subcategories'] })
      qc.invalidateQueries({ queryKey: ['categories'] })
    },
    onError: (e) => setError(getErrorMessage(e)),
  })

  const deleteCat = useMutation({
    mutationFn: (id: string) => categoriesApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] })
      qc.invalidateQueries({ queryKey: ['subcategories'] })
    },
    onError: (e) => setError(getErrorMessage(e)),
  })

  const deleteSub = useMutation({
    mutationFn: (id: string) => subCategoriesApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subcategories'] })
      qc.invalidateQueries({ queryKey: ['categories'] })
    },
    onError: (e) => setError(getErrorMessage(e)),
  })

  return (
    <div className="page space-y-3">
      <div>
        <h2 className="text-xl font-bold">Catalog</h2>
        <p className="text-sm text-[var(--muted)]">Categories and subcategories</p>
      </div>
      {error && <div className="text-sm text-[var(--danger)]">{error}</div>}

      <div className="grid lg:grid-cols-2 gap-3">
        <section className="panel p-3 space-y-3">
          <h3 className="font-semibold">Categories</h3>
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault()
              setError('')
              createCat.mutate()
            }}
            className="flex gap-2"
          >
            <input className="field flex-1" placeholder="New category" value={catName} onChange={(e) => setCatName(e.target.value)} required />
            <button className="btn btn-primary">Add</button>
          </form>
          <ul className="divide-y divide-[var(--line)]">
            {categories.map((c) => (
              <li key={c.id} className="py-2 flex justify-between gap-3">
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-[var(--muted)]">{c.subCategoryCount} subcategories</div>
                </div>
                <button onClick={() => deleteCat.mutate(c.id)} className="text-sm text-[var(--danger)]">Delete</button>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel p-3 space-y-3">
          <h3 className="font-semibold">Subcategories</h3>
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault()
              setError('')
              createSub.mutate()
            }}
            className="grid gap-2"
          >
            <select className="field" value={subCategoryId} onChange={(e) => setSubCategoryId(e.target.value)} required>
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <input className="field flex-1" placeholder="New subcategory" value={subName} onChange={(e) => setSubName(e.target.value)} required />
              <button className="btn btn-primary">Add</button>
            </div>
          </form>
          <ul className="divide-y divide-[var(--line)]">
            {subCategories.map((s) => (
              <li key={s.id} className="py-2 flex justify-between gap-3">
                <div>
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-[var(--muted)]">{s.categoryName} · {s.productCount} products</div>
                </div>
                <button onClick={() => deleteSub.mutate(s.id)} className="text-sm text-[var(--danger)]">Delete</button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
