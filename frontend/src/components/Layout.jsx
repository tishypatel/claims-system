import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, FilePlus, LogOut, ShieldCheck, Sun, Moon } from 'lucide-react'
import { useTheme } from '../App'

const roleConfig = {
  adjudicator: { color: 'var(--info)',    bg: 'var(--info-bg)',    label: 'Adjudicator' },
  claimant:    { color: 'var(--success)', bg: 'var(--success-bg)', label: 'Claimant' },
  manager:     { color: 'var(--warning)', bg: 'var(--warning-bg)', label: 'Manager' },
}

export default function Layout() {
  const navigate = useNavigate()
  const { dark, toggle } = useTheme()
  const user = JSON.parse(localStorage.getItem('claims_user') || '{}')
  const rc = roleConfig[user.role] || roleConfig.claimant
  const initials = (user.name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  function logout() {
    localStorage.removeItem('claims_user')
    navigate('/login')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Top nav */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        height: '56px',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        boxShadow: 'var(--shadow-xs)',
        display: 'flex', alignItems: 'center',
        padding: '0 1.5rem',
        gap: '0.75rem',
      }}>
        {/* Logo */}
        <NavLink
          to="/dashboard"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', marginRight: '1rem', flexShrink: 0 }}
        >
          <div style={{
            width: '28px', height: '28px', borderRadius: '7px',
            background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ShieldCheck size={15} color="white" />
          </div>
          <span style={{ fontWeight: 800, fontSize: '0.925rem', color: 'var(--text-1)', letterSpacing: '-0.01em' }}>
            ClaimsHub
          </span>
        </NavLink>

        {/* Nav links */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '0.15rem', flex: 1 }}>
          <NavLink
            to="/dashboard"
            id="nav-dashboard"
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <LayoutDashboard size={14} /> Dashboard
          </NavLink>
          <NavLink
            to="/claims/new"
            id="nav-new-claim"
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <FilePlus size={14} /> File Claim
          </NavLink>
        </nav>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          {/* Theme toggle */}
          <button
            onClick={toggle}
            style={{
              width: '32px', height: '32px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--surface-2)',
              border: '1.5px solid var(--border)',
              borderRadius: '7px',
              cursor: 'pointer', color: 'var(--text-2)',
              transition: 'all 0.15s ease', flexShrink: 0,
            }}
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-2)'; e.currentTarget.style.color = 'var(--text-1)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-2)' }}
          >
            {dark ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          <div style={{ width: '1px', height: '18px', background: 'var(--border)' }} />

          {/* Avatar */}
          <div style={{
            width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
            background: rc.bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.62rem', fontWeight: 700, color: rc.color,
          }}>
            {initials}
          </div>

          {/* Name */}
          <div style={{ lineHeight: 1.2 }}>
            <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-1)' }}>{user.name}</p>
            <p style={{ fontSize: '0.62rem', color: rc.color, fontWeight: 600 }}>{rc.label}</p>
          </div>

          {/* Logout */}
          <button
            id="logout-btn"
            onClick={logout}
            title="Sign out"
            style={{
              width: '28px', height: '28px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: 'none',
              cursor: 'pointer', color: 'var(--text-3)',
              borderRadius: '6px', transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.background = 'var(--danger-bg)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.background = 'none' }}
          >
            <LogOut size={14} />
          </button>
        </div>
      </header>

      {/* Page content */}
      <main style={{ flex: 1, overflow: 'auto' }}>
        <Outlet />
      </main>
    </div>
  )
}
