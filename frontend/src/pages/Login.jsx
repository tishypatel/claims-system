import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, Eye, EyeOff, ArrowRight, Sun, Moon } from 'lucide-react'
import { useTheme } from '../App'

const DEMO_USERS = [
  { email: 'adjudicator@qbe.com', password: 'demo123', name: 'Sarah Mitchell', role: 'adjudicator' },
  { email: 'claimant@qbe.com',    password: 'demo123', name: 'James Walker',   role: 'claimant' },
  { email: 'manager@qbe.com',     password: 'demo123', name: 'Priya Nair',     role: 'manager' },
]

const roleConfig = {
  adjudicator: { label: 'Adjudicator', color: 'var(--info)',    bg: 'var(--info-bg)' },
  claimant:    { label: 'Claimant',    color: 'var(--success)', bg: 'var(--success-bg)' },
  manager:     { label: 'Manager',     color: 'var(--warning)', bg: 'var(--warning-bg)' },
}

export default function Login() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const navigate = useNavigate()
  const { dark, toggle } = useTheme()

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    await new Promise(r => setTimeout(r, 350))
    const user = DEMO_USERS.find(u => u.email === email && u.password === password)
    if (!user) { setError('Invalid email or password.'); setLoading(false); return }
    localStorage.setItem('claims_user', JSON.stringify(user))
    navigate('/dashboard')
  }

  function quickLogin(user) {
    localStorage.setItem('claims_user', JSON.stringify(user))
    navigate('/dashboard')
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1.5rem',
      transition: 'background 0.2s ease',
    }}>
      {/* Theme toggle */}
      <button
        onClick={toggle}
        style={{
          position: 'fixed', top: '1rem', right: '1rem',
          width: '36px', height: '36px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--surface)',
          border: '1.5px solid var(--border)',
          borderRadius: '8px',
          cursor: 'pointer', color: 'var(--text-2)',
          boxShadow: 'var(--shadow-sm)',
          transition: 'all 0.15s ease',
        }}
        title={dark ? 'Light mode' : 'Dark mode'}
      >
        {dark ? <Sun size={15} /> : <Moon size={15} />}
      </button>

      <div style={{ width: '100%', maxWidth: '392px' }} className="animate-fade-in-up">
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{
            width: '50px', height: '50px', borderRadius: '13px',
            background: 'var(--accent)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '0.875rem',
            boxShadow: '0 6px 20px var(--accent-border)',
          }}>
            <ShieldCheck size={24} color="white" />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
            ClaimsHub
          </h1>
          <p style={{ color: 'var(--text-2)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            QBE Insurance Claims Portal
          </p>
        </div>

        {/* Sign in card */}
        <div className="card" style={{ padding: '1.625rem', marginBottom: '0.75rem' }}>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-2)', marginBottom: '0.375rem' }}>
                Email address
              </label>
              <input
                id="login-email"
                type="email"
                className="input-field"
                value={email}
                onChange={e => { setEmail(e.target.value); setError('') }}
                placeholder="you@qbe.com"
                required
                autoFocus
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-2)', marginBottom: '0.375rem' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="login-password"
                  type={showPw ? 'text' : 'password'}
                  className="input-field"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }}
                  placeholder="••••••••"
                  style={{ paddingRight: '2.75rem' }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  style={{
                    position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-3)', padding: '0.2rem',
                    display: 'flex', alignItems: 'center',
                  }}
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div style={{
                background: 'var(--danger-bg)', border: '1px solid var(--danger-border)',
                borderRadius: '6px', padding: '0.6rem 0.875rem',
                fontSize: '0.8rem', color: 'var(--danger-text)',
              }}>
                {error}
              </div>
            )}

            <button
              id="login-submit"
              type="submit"
              className="btn-primary"
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center', padding: '0.65rem', marginTop: '0.125rem' }}
            >
              {loading
                ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.35)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.6s linear infinite', display: 'inline-block' }} />
                : <><span>Sign in</span><ArrowRight size={15} /></>
              }
            </button>
          </form>
        </div>

        {/* Demo accounts */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.75rem' }}>
            Demo accounts
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {DEMO_USERS.map(u => {
              const rc = roleConfig[u.role]
              return (
                <button
                  key={u.email}
                  id={`quick-login-${u.role}`}
                  onClick={() => quickLogin(u)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.6rem 0.75rem',
                    background: 'var(--surface-2)',
                    border: '1.5px solid var(--border)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    textAlign: 'left', fontFamily: 'inherit',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.borderColor = 'var(--border-2)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.borderColor = 'var(--border)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '50%',
                      background: rc.bg, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.65rem', fontWeight: 700, color: rc.color,
                    }}>
                      {u.name.charAt(0)}
                    </div>
                    <div>
                      <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-1)', lineHeight: 1.3 }}>{u.name}</p>
                      <p style={{ fontSize: '0.68rem', color: 'var(--text-3)' }}>{u.email}</p>
                    </div>
                  </div>
                  <span style={{
                    fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
                    color: rc.color, background: rc.bg,
                    padding: '0.18rem 0.5rem', borderRadius: '99px', flexShrink: 0,
                  }}>
                    {rc.label}
                  </span>
                </button>
              )
            })}
          </div>
          <p style={{ fontSize: '0.68rem', color: 'var(--text-3)', textAlign: 'center', marginTop: '0.75rem' }}>
            Password for all accounts: <code style={{ fontFamily: 'monospace', color: 'var(--text-2)', fontWeight: 600 }}>demo123</code>
          </p>
        </div>
      </div>
    </div>
  )
}
