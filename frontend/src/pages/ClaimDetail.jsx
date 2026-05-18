import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from '../api'
import { ArrowLeft, Send, CheckCircle, XCircle, Clock, RefreshCw, User, MapPin, FileText, MessageSquare, Loader2, Shield } from 'lucide-react'
import StatusBadge from '../components/StatusBadge'

const CLAIM_TYPE_LABELS = {
  motor: 'Motor / Vehicle', property: 'Property Damage', liability: 'Public Liability',
  workers_comp: "Workers' Compensation", health: 'Health / Medical', travel: 'Travel',
}

const STATUS_FLOW = [
  { key: 'pending',      label: 'Submitted',    icon: Clock },
  { key: 'under_review', label: 'Under Review', icon: RefreshCw },
  { key: 'approved',     label: 'Approved',     icon: CheckCircle },
]

function InfoRow({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <dt style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {label}
      </dt>
      <dd style={{ fontSize: '0.875rem', color: 'var(--text-1)', fontWeight: 500, fontFamily: mono ? 'monospace' : undefined }}>
        {value || '—'}
      </dd>
    </div>
  )
}

function SectionCard({ icon: Icon, title, accent = 'var(--accent)', children }) {
  return (
    <div className="card" style={{ padding: '1.25rem' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.625rem',
        marginBottom: '1rem', paddingBottom: '0.875rem',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{
          width: '26px', height: '26px', borderRadius: '6px',
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={13} color={accent} />
        </div>
        <h2 style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-2)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {title}
        </h2>
      </div>
      {children}
    </div>
  )
}

export default function ClaimDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('claims_user') || '{}')

  const [claim, setClaim]       = useState(null)
  const [notes, setNotes]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [note, setNote]         = useState('')
  const [reason, setReason]     = useState('')
  const [saving, setSaving]     = useState(false)
  const [sendingNote, setSendingNote] = useState(false)

  async function load() {
    try {
      const [c, n] = await Promise.all([
        axios.get(`/api/claims/${id}`),
        axios.get(`/api/claims/${id}/notes`),
      ])
      setClaim(c.data)
      setNotes(n.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  async function addNote(e) {
    e.preventDefault()
    if (!note.trim()) return
    setSendingNote(true)
    await axios.post(`/api/claims/${id}/notes`, { author: user.name, content: note })
    setNote('')
    setSendingNote(false)
    load()
  }

  async function updateStatus(status) {
    setSaving(true)
    await axios.patch(`/api/claims/${id}/status`, { status, reason, updated_by: user.name })
    setSaving(false)
    load()
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--text-3)' }}>
      <div style={{ textAlign: 'center' }}>
        <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 0.75rem' }} />
        <p style={{ fontSize: '0.875rem' }}>Loading claim…</p>
      </div>
    </div>
  )

  if (!claim) return (
    <div style={{ padding: '2rem', color: 'var(--text-2)' }}>
      <p>Claim not found.</p>
    </div>
  )

  const canAdjudicate = user.role === 'adjudicator' || user.role === 'manager'
  const isOpen = ['pending', 'under_review'].includes(claim.status)
  const pipelineIdx = STATUS_FLOW.findIndex(s => s.key === (claim.status === 'rejected' ? 'rejected' : claim.status))

  return (
    <div style={{ padding: '2rem', maxWidth: '1100px', margin: '0 auto' }}>

      {/* Back */}
      <button onClick={() => navigate(-1)} className="btn-ghost" style={{ marginBottom: '1.5rem', fontSize: '0.82rem', padding: '0.4rem 0.75rem' }}>
        <ArrowLeft size={14} /> Back
      </button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '0.25rem' }}>
            <h1 style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
              Claim <span style={{ color: 'var(--accent)', fontFamily: 'monospace' }}>#{String(claim.id).padStart(5, '0')}</span>
            </h1>
            <StatusBadge status={claim.status} size="lg" />
          </div>
          <p style={{ color: 'var(--text-3)', fontSize: '0.8rem' }}>
            Filed {new Date(claim.created_at).toLocaleDateString('en-AU', { dateStyle: 'long' })}
            {' · '}Updated {new Date(claim.updated_at).toLocaleDateString('en-AU', { dateStyle: 'medium' })}
          </p>
        </div>

        {/* Amount badge */}
        <div style={{
          padding: '0.625rem 1rem',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-md)',
          textAlign: 'right',
          boxShadow: 'var(--shadow-xs)',
        }}>
          <p style={{ fontSize: '0.62rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Claim Amount</p>
          <p style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em', marginTop: '0.1rem' }}>
            ${Number(claim.amount).toLocaleString()}
            <span style={{ fontSize: '0.7rem', color: 'var(--text-3)', fontWeight: 500, marginLeft: '0.25rem' }}>AUD</span>
          </p>
        </div>
      </div>

      {/* Status pipeline */}
      {claim.status !== 'rejected' && claim.status !== 'closed' && (
        <div className="card" style={{ padding: '1rem 1.5rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {STATUS_FLOW.map((s, i) => {
              const done   = i <= pipelineIdx
              const active = i === pipelineIdx
              return (
                <div key={s.key} style={{ display: 'flex', alignItems: 'center', flex: i < STATUS_FLOW.length - 1 ? 1 : undefined }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
                    <div style={{
                      width: '30px', height: '30px', borderRadius: '50%',
                      background: active ? 'var(--accent)' : done ? 'var(--accent-bg)' : 'var(--surface-2)',
                      border: `2px solid ${done ? 'var(--accent)' : 'var(--border)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: active ? '0 0 0 4px var(--accent-bg)' : 'none',
                      transition: 'all 0.3s ease',
                    }}>
                      <s.icon size={13} color={done ? (active ? 'white' : 'var(--accent)') : 'var(--text-3)'} />
                    </div>
                    <span style={{ fontSize: '0.65rem', fontWeight: 600, color: done ? 'var(--accent)' : 'var(--text-3)', whiteSpace: 'nowrap' }}>
                      {s.label}
                    </span>
                  </div>
                  {i < STATUS_FLOW.length - 1 && (
                    <div style={{
                      flex: 1, height: '2px', margin: '0 0.5rem', marginBottom: '1.1rem',
                      background: i < pipelineIdx ? 'var(--accent)' : 'var(--border)',
                      borderRadius: '99px', transition: 'background 0.3s ease',
                    }} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Rejected banner */}
      {claim.status === 'rejected' && (
        <div style={{
          background: 'var(--danger-bg)', border: '1px solid var(--danger-border)',
          borderRadius: 'var(--r-md)', padding: '1rem 1.25rem', marginBottom: '1.25rem',
          display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
        }}>
          <XCircle size={17} color="var(--danger)" style={{ flexShrink: 0, marginTop: '1px' }} />
          <div>
            <p style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--danger-text)' }}>Claim Rejected</p>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-2)', marginTop: '0.2rem' }}>{claim.decision_reason}</p>
            {claim.decided_by && <p style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>— {claim.decided_by}</p>}
          </div>
        </div>
      )}

      {/* Approved banner */}
      {claim.status === 'approved' && (
        <div style={{
          background: 'var(--success-bg)', border: '1px solid var(--success-border)',
          borderRadius: 'var(--r-md)', padding: '1rem 1.25rem', marginBottom: '1.25rem',
          display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
        }}>
          <CheckCircle size={17} color="var(--success)" style={{ flexShrink: 0, marginTop: '1px' }} />
          <div>
            <p style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--success-text)' }}>Claim Approved</p>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-2)', marginTop: '0.2rem' }}>{claim.decision_reason}</p>
            {claim.decided_by && <p style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>— {claim.decided_by}</p>}
          </div>
        </div>
      )}

      {/* Body */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 308px', gap: '1rem', alignItems: 'start' }}>

        {/* Left */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          <SectionCard icon={User} title="Claimant Information">
            <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem 1.5rem' }}>
              <InfoRow label="Full Name"     value={claim.claimant_name} />
              <InfoRow label="Email"         value={claim.claimant_email} />
              <InfoRow label="Phone"         value={claim.claimant_phone} />
              <InfoRow label="Policy Number" value={claim.policy_number} mono />
            </dl>
          </SectionCard>

          <SectionCard icon={MapPin} title="Incident Details" accent="var(--warning)">
            <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem 1.5rem', marginBottom: '0.875rem' }}>
              <InfoRow label="Claim Type"    value={CLAIM_TYPE_LABELS[claim.claim_type] || claim.claim_type} />
              <InfoRow label="Incident Date" value={new Date(claim.incident_date).toLocaleDateString('en-AU', { dateStyle: 'long' })} />
              <InfoRow label="Location"      value={claim.location} />
            </dl>
            <div>
              <dt style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                Description
              </dt>
              <dd style={{
                fontSize: '0.875rem', color: 'var(--text-2)', lineHeight: 1.7,
                background: 'var(--surface-2)',
                borderRadius: 'var(--r-sm)', padding: '0.75rem 1rem',
                border: '1px solid var(--border)',
              }}>
                {claim.incident_description}
              </dd>
            </div>
          </SectionCard>

          <SectionCard icon={MessageSquare} title="Activity & Notes" accent="var(--success)">
            <div style={{ marginBottom: '1rem', maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {notes.length === 0 ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-3)', textAlign: 'center', padding: '1.25rem 0' }}>
                  No notes yet. Be the first to add one.
                </p>
              ) : notes.map(n => (
                <div key={n.id} style={{ display: 'flex', gap: '0.75rem' }}>
                  <div style={{
                    width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-2)',
                  }}>
                    {n.author.charAt(0)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-1)' }}>{n.author}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>
                        {new Date(n.created_at).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-2)', lineHeight: 1.6 }}>{n.content}</p>
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={addNote} style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                id="note-input"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Add a note or comment…"
                className="input-field"
                style={{ flex: 1 }}
              />
              <button
                type="submit"
                disabled={sendingNote || !note.trim()}
                style={{
                  padding: '0.6rem 0.875rem',
                  background: 'var(--accent)',
                  border: 'none', borderRadius: 'var(--r-sm)',
                  cursor: 'pointer', color: 'white',
                  display: 'flex', alignItems: 'center', gap: '0.375rem',
                  fontSize: '0.8rem', fontWeight: 600,
                  opacity: (!note.trim() || sendingNote) ? 0.45 : 1,
                  transition: 'opacity 0.15s ease',
                  fontFamily: 'inherit', flexShrink: 0,
                }}
              >
                {sendingNote ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={13} />}
                Send
              </button>
            </form>
          </SectionCard>
        </div>

        {/* Right */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Adjudication panel */}
          {canAdjudicate && isOpen && (
            <SectionCard icon={Shield} title="Adjudication">
              {claim.status === 'pending' && (
                <button
                  id="mark-review-btn"
                  onClick={() => updateStatus('under_review')}
                  disabled={saving}
                  style={{
                    width: '100%', padding: '0.575rem',
                    background: 'var(--info-bg)', border: '1.5px solid var(--info-border)',
                    borderRadius: 'var(--r-sm)', color: 'var(--info-text)',
                    fontSize: '0.8rem', fontWeight: 600,
                    cursor: 'pointer', marginBottom: '1rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                    transition: 'all 0.15s ease', opacity: saving ? 0.5 : 1,
                    fontFamily: 'inherit',
                  }}
                >
                  <RefreshCw size={13} /> Mark Under Review
                </button>
              )}

              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-3)', marginBottom: '0.4rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Decision Reason *
              </label>
              <textarea
                id="decision-reason"
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Provide a reason for your decision…"
                className="input-field"
                style={{ minHeight: '88px', resize: 'none', marginBottom: '0.75rem', lineHeight: 1.6, fontSize: '0.82rem' }}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <button
                  id="approve-btn"
                  onClick={() => updateStatus('approved')}
                  disabled={saving || !reason.trim()}
                  className="btn-success"
                  style={{ fontSize: '0.8rem', padding: '0.55rem 0.75rem' }}
                >
                  {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle size={13} />}
                  Approve
                </button>
                <button
                  id="reject-btn"
                  onClick={() => updateStatus('rejected')}
                  disabled={saving || !reason.trim()}
                  className="btn-danger"
                  style={{ fontSize: '0.8rem', padding: '0.55rem 0.75rem' }}
                >
                  {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <XCircle size={13} />}
                  Reject
                </button>
              </div>
              {!reason.trim() && (
                <p style={{ fontSize: '0.7rem', color: 'var(--text-3)', textAlign: 'center', marginTop: '0.625rem' }}>
                  A reason is required to approve or reject
                </p>
              )}
            </SectionCard>
          )}

          {/* Summary */}
          <SectionCard icon={FileText} title="Claim Summary" accent="var(--text-3)">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {[
                { label: 'Status',     value: <StatusBadge status={claim.status} /> },
                { label: 'Claim Type', value: CLAIM_TYPE_LABELS[claim.claim_type] || claim.claim_type },
                { label: 'Amount',     value: `$${Number(claim.amount).toLocaleString()} AUD` },
                { label: 'Policy',     value: claim.policy_number, mono: true },
                { label: 'Filed',      value: new Date(claim.created_at).toLocaleDateString('en-AU') },
              ].map(({ label, value, mono }) => (
                <div key={label} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.55rem 0',
                  borderBottom: '1px solid var(--border)',
                }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-3)', fontWeight: 500 }}>{label}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-1)', fontWeight: 600, fontFamily: mono ? 'monospace' : undefined }}>
                    {value}
                  </span>
                </div>
              ))}
              {claim.decided_by && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.55rem 0' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-3)', fontWeight: 500 }}>Decided By</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-1)', fontWeight: 600 }}>{claim.decided_by}</span>
                </div>
              )}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
