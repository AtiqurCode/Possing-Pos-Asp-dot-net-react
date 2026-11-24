import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getErrorMessage } from '../api/client'
import { customersApi } from '../api/endpoints'

export default function CustomersPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [name, setName] = useState('')
  const [mobile, setMobile] = useState('')
  const [error, setError] = useState('')

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers', search],
    queryFn: () => customersApi.list(search || undefined),
  })

  const save = useMutation({
    mutationFn: () => customersApi.upsert(name, mobile),
    onSuccess: () => {
      setName('')
      setMobile('')
      setError('')
      qc.invalidateQueries({ queryKey: ['customers'] })
    },
    onError: (e) => setError(getErrorMessage(e)),
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    save.mutate()
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-xl font-bold">Members</h2>
        <p className="text-sm text-[var(--muted)]">Optional customer profiles linked by mobile</p>
      </div>

      <form onSubmit={onSubmit} className="panel p-3 grid md:grid-cols-[1fr_1fr_auto] gap-2 items-end">
        <label className="text-sm">
          Name
          <input className="field mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional display name" />
        </label>
        <label className="text-sm">
          Mobile
          <input className="field mt-1" value={mobile} onChange={(e) => setMobile(e.target.value)} required placeholder="01XXXXXXXXX" />
        </label>
        <button className="btn btn-primary">Save member</button>
      </form>
      {error && <div className="text-sm text-[var(--danger)]">{error}</div>}

      <div className="flex gap-2">
        <input
          className="field max-w-sm"
          placeholder="Search name / mobile / membership"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="table-wrap">
        {isLoading ? (
          <p className="p-4">Loading…</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Mobile</th>
                <th>Visits</th>
                <th>Total spent</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id}>
                  <td className="mono font-medium">{c.membershipCode}</td>
                  <td>{c.name}</td>
                  <td className="mono">{c.mobile}</td>
                  <td className="mono">{c.visitCount}</td>
                  <td className="mono">BDT {c.totalSpent.toFixed(2)}</td>
                  <td>{new Date(c.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr><td colSpan={6} className="text-[var(--muted)]">No members yet</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
