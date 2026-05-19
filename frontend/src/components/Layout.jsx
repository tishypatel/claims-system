import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, FilePlus, LogOut, ShieldCheck, Sun, Moon, Menu, X } from 'lucide-react'
import { useTheme } from '../App'

const roleConfig = {
  adjudicator: { color: 'var(--info)',    bg: 'var(--info-bg)',    label: 'Adjudicator' },
  claimant:    { color: 'var(--success)', bg: 'var(--success-bg)', label: 'Claimant' },
  manager:     { color: 'var(--warning)', bg: 'var(--warning-bg)', label: 'Manager' },
}

export default function Layout() {
  const navigate = useNavigate()
  const { dark, toggle } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const user = JSON.parse(localStorage.getItem('claims_user') || '{}')
  const rc = roleConfig[user.role] || roleConfig.claimant
  const initials = (user.name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  function logout() {
    localStorage.removeItem('claims_user')
    navigate('/login')
  }

  function closeMenu() { setMenuOpen(false) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg)' }}>

      {/* ── Top nav ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        height: '56px',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        boxShadow: 'var(--shadow-xs)',
        display: 'flex', alignItems: 'center',
        padding: '0 1.25rem',
        gap: '0.75rem',
      }}>

        {/* Logo */}
        <NavLink
          to="/dashboard"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', marginRight: '0.5rem', flexShrink: 0 }}
          onClick={closeMenu}
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

        {/* Desktop nav links */}
        <nav className="nav-desktop">
          <NavLink
            to="/dashboard"
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <LayoutDashboard size={14} /> Dashboard
          </NavLink>
          <NavLink
            to="/claims/new"
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <FilePlus size={14} /> File Claim
          </NavLink>
        </nav>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0, marginLeft: 'auto' }}>

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
          >
            {dark ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          <div className="nav-user-name" style={{ width: '1px', height: '18px', background: 'var(--border)' }} />

          {/* Avatar */}
          <div style={{
            width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
            background: rc.bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.62rem', fontWeight: 700, color: rc.color,
          }}>
            {initials}
          </div>

          {/* Name — hidden on mobile via CSS */}
          <div className="nav-user-name" style={{ lineHeight: 1.2 }}>
            <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-1)' }}>{user.name}</p>
            <p style={{ fontSize: '0.62rem', color: rc.color, fontWeight: 600 }}>{rc.label}</p>
          </div>

          {/* Logout — desktop only */}
          <button
            onClick={logout}
            title="Sign out"
            className="nav-user-name"
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

          {/* Hamburger — mobile only */}
          <button
            className="hamburger-btn"
            onClick={() => setMenuOpen(v => !v)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            {menuOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </header>

      {/* ── Mobile menu overlay ── */}
      <div className={`mobile-overlay${menuOpen ? ' open' : ''}`} onClick={closeMenu} />

      {/* ── Mobile dropdown menu ── */}
      <div className={`mobile-menu${menuOpen ? ' open' : ''}`}>
        <NavLink
          to="/dashboard"
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          onClick={closeMenu}
        >
          <LayoutDashboard size={16} /> Dashboard
        </NavLink>
        <NavLink
          to="/claims/new"
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          onClick={closeMenu}
        >
          <FilePlus size={16} /> File Claim
        </NavLink>

        <div style={{ borderTop: '1px solid var(--border)', marginTop: '0.5rem', paddingTop: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.875rem', marginBottom: '0.25rem' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
              background: rc.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.7rem', fontWeight: 700, color: rc.color,
            }}>
              {initials}
            </div>
            <div>
              <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-1)' }}>{user.name}</p>
              <p style={{ fontSize: '0.72rem', color: rc.color, fontWeight: 600 }}>{rc.label}</p>
            </div>
          </div>
          <button
            onClick={() => { closeMenu(); logout() }}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              width: '100%', padding: '0.6rem 0.875rem',
              background: 'none', border: 'none',
              borderRadius: 'var(--r-sm)',
              fontSize: '0.875rem', fontWeight: 500, color: 'var(--danger)',
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--danger-bg)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </div>

      {/* Page content */}
      <main style={{ flex: 1, overflow: 'auto' }}>
        <Outlet />
      </main>
    </div>
  )
}
