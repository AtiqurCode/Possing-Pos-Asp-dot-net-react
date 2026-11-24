import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

const links = [
  { to: '/', label: 'Register' },
  { to: '/pos', label: 'Sell' },
  { to: '/products', label: 'Stock' },
  { to: '/customers', label: 'Members' },
  { to: '/categories', label: 'Catalog', adminOnly: true },
  { to: '/sales', label: 'Receipts' },
  { to: '/reports', label: 'Reports' },
]

export default function Layout() {
  const { user, logout, isAdmin } = useAuth()
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const visible = links.filter((l) => !l.adminOnly || isAdmin)

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <div className="min-h-screen min-h-dvh flex flex-col">
      <header
        className="text-white sticky top-0 z-40"
        style={{ background: 'linear-gradient(180deg, var(--topbar) 0%, var(--topbar-2) 100%)' }}
      >
        <div className="px-3 py-2 flex items-center gap-2">
          <button
            type="button"
            className="lg:hidden btn btn-ghost !min-h-10 !px-3 !text-white !bg-white/10 !border-white/20"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? 'Close' : 'Menu'}
          </button>

          <div className="font-bold tracking-wide">POSSING</div>

          <nav className="hidden lg:flex flex-wrap gap-1 flex-1 ml-3">
            {visible.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                className={({ isActive }) =>
                  `px-3 py-2 rounded text-sm font-medium min-h-10 inline-flex items-center ${
                    isActive ? 'bg-white text-[#1b2838]' : 'text-white/85 hover:bg-white/10'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto text-sm text-white/80 flex items-center gap-2 sm:gap-3">
            <span className="hidden sm:inline truncate max-w-[140px]">
              {user?.username} · {user?.role}
            </span>
            <button onClick={logout} className="btn btn-ghost !min-h-10 !py-1 !px-3 !text-xs">
              Sign out
            </button>
          </div>
        </div>

        {/* tablet secondary nav */}
        <nav className="hidden md:flex lg:hidden gap-1 px-3 pb-2 overflow-x-auto">
          {visible.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) =>
                `px-3 py-2 rounded text-sm font-medium whitespace-nowrap min-h-10 inline-flex items-center ${
                  isActive ? 'bg-white text-[#1b2838]' : 'text-white/85 hover:bg-white/10'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </header>

      {/* mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            aria-label="Close menu overlay"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-[min(300px,86vw)] bg-[var(--topbar-2)] text-white p-4 shadow-xl flex flex-col gap-2">
            <div className="font-bold text-lg mb-2">Menu</div>
            <div className="text-xs text-white/60 mb-3 sm:hidden">
              {user?.username} · {user?.role}
            </div>
            {visible.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                className={({ isActive }) =>
                  `rounded px-3 py-3 text-sm font-medium ${
                    isActive ? 'bg-white text-[#1b2838]' : 'bg-white/5 hover:bg-white/10'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </aside>
        </div>
      )}

      <main className="flex-1 p-2 sm:p-3 md:p-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>
    </div>
  )
}
