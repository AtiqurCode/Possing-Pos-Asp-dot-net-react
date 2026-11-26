import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { getErrorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext'

export default function LoginPage() {
  const { login, token, ready } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('admin123')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (!ready) return <p className="p-6 text-sm text-[var(--muted)]">Checking session…</p>
  if (token) return <Navigate to="/pos" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await login(username, password)
      navigate('/pos')
    } catch (err) {
      setError(getErrorMessage(err, 'Login failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-4 bg-[#d7dde3]">
      <div className="w-full max-w-sm panel p-6">
        <div className="mb-5">
          <div className="text-xs font-semibold tracking-widest text-[var(--muted)]">TERMINAL LOGIN</div>
          <h1 className="text-2xl font-bold mt-1">Possing POS</h1>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block text-sm">
            Username
            <input className="field mt-1" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
          </label>
          <label className="block text-sm">
            Password
            <input
              type="password"
              className="field mt-1"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && <div className="text-sm text-[var(--danger)]">{error}</div>}
          <button disabled={loading} className="btn btn-primary w-full">
            {loading ? 'Signing in…' : 'Open register'}
          </button>
        </form>
        <p className="mt-4 text-xs text-[var(--muted)]">admin / admin123 · cashier / cashier123</p>
      </div>
    </div>
  )
}
