import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from '../api'
import { FilePlus, TrendingUp, Clock, CheckCircle, XCircle, Search, Eye, Loader2, RefreshCw } from 'lucide-react'
import StatusBadge from '../components/StatusBadge'

const CLAIM_TYPE_LABELS = {
  motor: 'Motor', property: 'Property', liability: 'Liability',
  workers_comp: "Workers' Comp", health: 'Health', travel: 'Travel',
}

const FILTERS = [
  { key: 'all',          label: 'All' },
  { key: 'pending',      label: 'Pending' },
  { key: 'under_review', label: 'Under Review' },
  { key: 'approved',     label: 'Approved' },
  { key: 'rejected',     label: 'Rejected' },
]

const STAT_CONFIG = [
  { key: 'total',        label: 'Total',        icon: TrendingUp,  color: 'var(--accent)',   bg: 'var(--accent-bg)' },
  { key: 'pending',      label: 'Pending',      icon: Clock,       color: 'var(--warning)',  bg: 'var(--warning-bg)' },
  { key: 'under_review', label: 'Under Review', icon: RefreshCw,   color: 'var(--info)',     bg: 'var(--info-bg)' },
  { key: 'approved',     label: 'Approved',     icon: CheckCircle, color: 'var(--success)',  bg: 'var(--success-bg)' },
  { key: 'rejected',     label: 'Rejected',     icon: XCircle,     color: 'var(--danger)',   bg: 'var(--danger-bg)' },
]

export default function Dashboard() {
  const [claims, setClaims]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [filter, setFilter]         = useState('all')
  const [search, setSearch]         = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('claims_user') || '{}')

  async function fetchClaims(silent = false) {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const r = await axios.get('/api/claims')
      setClaims(r.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { fetchClaims() }, [])

  const counts = {
    total:        claims.length,
    pending:      claims.filter(c => c.status === 'pending').length,
    under_review: claims.filter(c => c.status === 'under_review').length,
    approved:     claims.filter(c => c.status === 'approved').length,
    rejected:     claims.filter(c => c.status === 'rejected').length,
  }

  const totalAmount = claims.reduce((s, c) => s + Number(c.amount), 0)

  const filtered = claims
    .filter(c => filter === 'all' || c.status === filter)
    .filter(c => {
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return (
        c.claimant_name.toLowerCase().includes(q) ||
        c.policy_number.toLowerCase().includes(q) ||
        c.claim_type.toLowerCase().includes(q) ||
        String(c.id).includes(q)
      )
    })

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  })()

  return (
    <div style={{ padding: '2rem', maxWidth: '1300px', margin: '0 auto' }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
            {greeting}{user.name ? `, ${user.name.split(' ')[0]}` : ''}
          </h1>
          <p style={{ color: 'var(--text-3)', fontSize: '0.82rem', marginTop: '0.2rem' }}>
            {new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            id="refresh-btn"
            onClick={() => fetchClaims(true)}
            disabled={refreshing}
            className="btn-ghost"
            style={{ padding: '0.5rem', width: '36px', height: '36px', justifyContent: 'center' }}
          >
            <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          <button
            id="new-claim-btn"
            onClick={() => navigate('/claims/new')}
            className="btn-primary"
          >
            <FilePlus size={14} /> New Claim
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {STAT_CONFIG.map(s => (
          <div
            key={s.key}
            className="card"
            onClick={() => setFilter(s.key === 'total' ? 'all' : s.key)}
            style={{
              padding: '1rem 1.125rem',
              cursor: 'pointer',
              borderLeft: `3px solid ${s.color}`,
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.transform = 'none' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.625rem' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {s.label}
              </span>
              <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <s.icon size={12} color={s.color} />
              </div>
            </div>
            <p style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.03em', lineHeight: 1 }}>
              {loading ? '—' : counts[s.key]}
            </p>
          </div>
        ))}
      </div>

      {/* Toolbar: exposure + filters + search */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', gap: '0.75rem', flexWrap: 'wrap' }}>
        {/* Total exposure pill */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.4rem 0.875rem',
          background: 'var(--accent-bg)',
          border: '1px solid var(--accent-border)',
          borderRadius: '99px',
        }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
          <span style={{ fontSize: '0.78rem', color: 'var(--text-2)', fontWeight: 500 }}>Total Exposure</span>
          <span style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--accent-text)' }}>
            {loading ? '…' : `$${totalAmount.toLocaleString()} AUD`}
          </span>
        </div>

        {/* Filter tabs + search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex', gap: '0.15rem',
            background: 'var(--surface-2)',
            padding: '0.2rem',
            borderRadius: '8px',
            border: '1px solid var(--border)',
          }}>
            {FILTERS.map(f => (
              <button
                key={f.key}
                id={`filter-${f.key}`}
                onClick={() => setFilter(f.key)}
                style={{
                  padding: '0.28rem 0.7rem',
                  borderRadius: '6px',
                  fontSize: '0.78rem', fontWeight: 600,
                  border: 'none', cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  fontFamily: 'inherit',
                  ...(filter === f.key
                    ? { background: 'var(--surface)', color: 'var(--accent)', boxShadow: 'var(--shadow-xs)' }
                    : { background: 'transparent', color: 'var(--text-3)' }),
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
            <input
              id="search-claims"
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search claims…"
              className="input-field"
              style={{ paddingLeft: '2rem', width: '195px', fontSize: '0.82rem' }}
            />
          </div>
        </div>
      </div>

      {/* Claims table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-3)' }}>
            <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 0.75rem' }} />
            <p style={{ fontSize: '0.875rem' }}>Loading claims…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '4rem', textAlign: 'center' }}>
            <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-2)', marginBottom: '0.375rem' }}>No claims found</p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>Try adjusting your filters or search</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                {['Claim ID', 'Claimant', 'Type', 'Amount', 'Incident Date', 'Status', ''].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr
                  key={c.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/claims/${c.id}`)}
                >
                  <td>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 700 }}>
                      #{String(c.id).padStart(5, '0')}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <div style={{
                        width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                        background: 'var(--accent-bg)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.65rem', fontWeight: 700, color: 'var(--accent-text)',
                      }}>
                        {c.claimant_name.charAt(0)}
                      </div>
                      <div>
                        <p style={{ fontWeight: 600, color: 'var(--text-1)', fontSize: '0.875rem' }}>{c.claimant_name}</p>
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-3)', fontFamily: 'monospace' }}>{c.policy_number}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span style={{
                      padding: '0.18rem 0.55rem',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      borderRadius: '99px',
                      fontSize: '0.72rem', color: 'var(--text-2)', fontWeight: 500,
                    }}>
                      {CLAIM_TYPE_LABELS[c.claim_type] || c.claim_type}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 700, color: 'var(--text-1)' }}>${Number(c.amount).toLocaleString()}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginLeft: '0.2rem' }}>AUD</span>
                  </td>
                  <td style={{ color: 'var(--text-2)', fontSize: '0.82rem' }}>
                    {new Date(c.incident_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td><StatusBadge status={c.status} /></td>
                  <td>
                    <button
                      onClick={e => { e.stopPropagation(); navigate(`/claims/${c.id}`) }}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                        padding: '0.3rem 0.65rem',
                        background: 'var(--surface-2)',
                        border: '1.5px solid var(--border)',
                        borderRadius: '6px',
                        fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-2)',
                        cursor: 'pointer', transition: 'all 0.15s ease',
                        fontFamily: 'inherit',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-2)' }}
                    >
                      <Eye size={12} /> View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!loading && (
        <p style={{ fontSize: '0.73rem', color: 'var(--text-3)', marginTop: '0.75rem', textAlign: 'right' }}>
          Showing {filtered.length} of {claims.length} claims
        </p>
      )}
    </div>
  )
}
