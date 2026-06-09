import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from '../api'
import {
  FilePlus, Clock, CheckCircle, XCircle, RefreshCw, ChevronRight,
  AlertTriangle, DollarSign, Loader2, MessageSquare, FileText,
  Brain, Shield, Eye,
} from 'lucide-react'
import StatusBadge from '../components/StatusBadge'

const CLAIM_TYPE_LABELS = {
  motor: 'Motor / Vehicle', property: 'Property Damage', liability: 'Public Liability',
  workers_comp: "Workers' Compensation", health: 'Health / Medical', travel: 'Travel',
}

// Claimant-friendly stage labels derived from claim data
function deriveStage(claim) {
  if (['approved', 'rejected', 'closed'].includes(claim.status)) return 5
  if (claim.workflow_stage) return Math.min(5, claim.workflow_stage)
  if (claim.triage) return 4
  if (claim.status === 'under_review') return 3
  return 2
}

const CLAIMANT_STAGES = [
  { num: 1, label: 'Received' },
  { num: 2, label: 'Docs Review' },
  { num: 3, label: 'Assessment' },
  { num: 4, label: 'Final Review' },
  { num: 5, label: 'Decision' },
]

function ClaimCard({ claim, onClick }) {
  const stage       = deriveStage(claim)
  const isDecided   = ['approved', 'rejected', 'closed'].includes(claim.status)
  const hasDocReq   = claim._hasDocRequest
  const stageColor  = isDecided
    ? (claim.status === 'approved' ? 'var(--success)' : 'var(--danger)')
    : 'var(--accent)'

  return (
    <div
      className="card"
      onClick={onClick}
      style={{ padding: '1.25rem', cursor: 'pointer', transition: 'all 0.2s ease', position: 'relative' }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.transform = 'none' }}
    >
      {/* Doc request badge */}
      {hasDocReq && (
        <div style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.5rem', background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', borderRadius: '99px', fontSize: '0.65rem', fontWeight: 700, color: 'var(--warning-text)' }}>
          <AlertTriangle size={9} /> Action needed
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.875rem', gap: '0.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 800, color: 'var(--accent)' }}>
              #{String(claim.id).padStart(5, '0')}
            </span>
            <StatusBadge status={claim.status} />
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-2)', fontWeight: 500 }}>
            {CLAIM_TYPE_LABELS[claim.claim_type] || claim.claim_type}
          </p>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
            ${Number(claim.amount).toLocaleString()}
          </p>
          <p style={{ fontSize: '0.65rem', color: 'var(--text-3)', fontWeight: 500 }}>AUD claimed</p>
        </div>
      </div>

      {/* Stage progress bar */}
      <div style={{ marginBottom: '0.875rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Progress</span>
          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: stageColor }}>{CLAIMANT_STAGES[stage - 1]?.label}</span>
        </div>
        <div style={{ height: '5px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(stage / 5) * 100}%`, background: stageColor, borderRadius: '99px', transition: 'width 0.6s ease' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.3rem' }}>
          {CLAIMANT_STAGES.map(s => (
            <span key={s.num} style={{ fontSize: '0.55rem', color: s.num <= stage ? stageColor : 'var(--text-3)', fontWeight: s.num === stage ? 700 : 500 }}>
              {s.num}
            </span>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>
          Filed {new Date(claim.created_at).toLocaleDateString('en-AU', { dateStyle: 'medium' })}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.72rem', fontWeight: 600, color: 'var(--accent)' }}>
          View details <ChevronRight size={12} />
        </div>
      </div>

      {/* Approved payout */}
      {claim.status === 'approved' && claim.net_payout != null && (
        <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.625rem', background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 'var(--r-sm)' }}>
          <DollarSign size={12} color="var(--success)" />
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--success-text)' }}>
            ${Number(claim.net_payout).toLocaleString()} AUD net payout
            {claim.payment_status === 'paid' ? ' · Paid' : ' · Payment pending'}
          </span>
        </div>
      )}
    </div>
  )
}

export default function ClaimantPortal() {
  const [claims,     setClaims]     = useState([])
  const [notes,      setNotes]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('claims_user') || '{}')

  async function fetchData(silent = false) {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const r = await axios.get('/api/claims', {
        params: { role: 'claimant', email: user.email },
      })
      const claimList = r.data

      // Fetch doc requests for each claim (check notes with is_doc_request)
      const noteResults = await Promise.all(
        claimList.map(c => axios.get(`/api/claims/${c.id}/notes`).then(res => ({ id: c.id, notes: res.data })).catch(() => ({ id: c.id, notes: [] })))
      )
      const noteMap = Object.fromEntries(noteResults.map(n => [n.id, n.notes]))

      // Attach doc request flag to each claim
      const enriched = claimList.map(c => ({
        ...c,
        _hasDocRequest: (noteMap[c.id] || []).some(n => n.is_doc_request),
      }))

      setClaims(enriched)
      setNotes(noteMap)
    } catch (e) { console.error(e) }
    finally { setLoading(false); setRefreshing(false) }
  }

  useEffect(() => { fetchData() }, [])

  const counts = {
    total:    claims.length,
    pending:  claims.filter(c => ['pending', 'under_review'].includes(c.status)).length,
    approved: claims.filter(c => c.status === 'approved').length,
    rejected: claims.filter(c => c.status === 'rejected').length,
  }
  const totalClaimed   = claims.reduce((s, c) => s + Number(c.amount), 0)
  const totalApproved  = claims.filter(c => c.status === 'approved').reduce((s, c) => s + Number(c.net_payout ?? 0), 0)
  const docRequests    = claims.filter(c => c._hasDocRequest).length

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  })()

  return (
    <div className="page-container">

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
            {greeting}{user.name ? `, ${user.name.split(' ')[0]}` : ''}
          </h1>
          <p style={{ color: 'var(--text-3)', fontSize: '0.82rem', marginTop: '0.2rem' }}>
            {new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="page-header-actions">
          <button onClick={() => fetchData(true)} disabled={refreshing} className="btn-ghost" style={{ padding: '0.5rem', width: '36px', height: '36px', justifyContent: 'center' }}>
            <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          <button onClick={() => navigate('/claims/new')} className="btn-primary">
            <FilePlus size={14} /> New Claim
          </button>
        </div>
      </div>

      {/* Doc request alert */}
      {!loading && docRequests > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.75rem 1rem', background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', borderRadius: 'var(--r-md)', marginBottom: '1rem', fontSize: '0.82rem', color: 'var(--warning-text)' }}>
          <AlertTriangle size={15} color="var(--warning)" style={{ flexShrink: 0 }} />
          <span>
            <strong>{docRequests} claim{docRequests > 1 ? 's' : ''}</strong> require{docRequests === 1 ? 's' : ''} additional documents from you.
          </span>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Total Claims',   value: counts.total,    color: 'var(--accent)',   bg: 'var(--accent-bg)',   icon: FileText },
          { label: 'In Progress',    value: counts.pending,  color: 'var(--info)',     bg: 'var(--info-bg)',     icon: Clock },
          { label: 'Approved',       value: counts.approved, color: 'var(--success)',  bg: 'var(--success-bg)', icon: CheckCircle },
          { label: 'Rejected',       value: counts.rejected, color: 'var(--danger)',   bg: 'var(--danger-bg)',  icon: XCircle },
        ].map(({ label, value, color, bg, icon: Icon }) => (
          <div key={label} className="card" style={{ padding: '1rem', borderLeft: `3px solid ${color}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
              <div style={{ width: '22px', height: '22px', borderRadius: '5px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={11} color={color} />
              </div>
            </div>
            <p style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.03em', lineHeight: 1 }}>
              {loading ? '—' : value}
            </p>
          </div>
        ))}
      </div>

      {/* Total exposure strip */}
      {!loading && claims.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '0.625rem 1rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-3)', fontWeight: 500 }}>Total claimed</span>
            <span style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--accent-text)' }}>${totalClaimed.toLocaleString()} AUD</span>
          </div>
          {totalApproved > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success)', flexShrink: 0 }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-3)', fontWeight: 500 }}>Total approved payout</span>
              <span style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--success)' }}>${totalApproved.toLocaleString()} AUD</span>
            </div>
          )}
        </div>
      )}

      {/* Claims grid */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4rem', color: 'var(--text-3)' }}>
          <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', marginBottom: '0.75rem' }} />
          <p style={{ fontSize: '0.875rem' }}>Loading your claims…</p>
        </div>
      ) : claims.length === 0 ? (
        <div className="card" style={{ padding: '4rem', textAlign: 'center' }}>
          <FileText size={36} color="var(--text-3)" style={{ margin: '0 auto 0.875rem', display: 'block', opacity: 0.5 }} />
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-2)', marginBottom: '0.35rem' }}>No claims yet</h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-3)', marginBottom: '1.25rem' }}>File your first claim to get started.</p>
          <button onClick={() => navigate('/claims/new')} className="btn-primary">
            <FilePlus size={13} /> File a Claim
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
          {claims.map(claim => (
            <ClaimCard
              key={claim.id}
              claim={claim}
              onClick={() => navigate(`/claims/${claim.id}/view`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
