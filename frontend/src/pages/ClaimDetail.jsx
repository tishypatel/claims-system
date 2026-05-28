import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from '../api'
import {
  ArrowLeft, Send, CheckCircle, XCircle, Clock, RefreshCw, User, MapPin,
  FileText, MessageSquare, Loader2, Shield, Upload, Paperclip, Trash2,
  Sparkles, AlertTriangle, DollarSign, X, Lock, ChevronDown, ChevronUp,
  Activity, Brain,
} from 'lucide-react'
import StatusBadge from '../components/StatusBadge'
import AITooltip from '../components/AITooltip'
import { useToast } from '../components/Toast'

const CLAIM_TYPE_LABELS = {
  motor: 'Motor / Vehicle', property: 'Property Damage', liability: 'Public Liability',
  workers_comp: "Workers' Compensation", health: 'Health / Medical', travel: 'Travel',
}

const STATUS_FLOW = [
  { key: 'pending',      label: 'Submitted',    icon: Clock },
  { key: 'under_review', label: 'Under Review', icon: RefreshCw },
  { key: 'approved',     label: 'Approved',     icon: CheckCircle },
]

const AUDIT_ICONS = {
  claim_created:     { icon: FileText,     color: 'var(--accent)' },
  status_changed:    { icon: RefreshCw,    color: 'var(--info)' },
  note_added:        { icon: MessageSquare,color: 'var(--success)' },
  document_uploaded: { icon: Paperclip,   color: 'var(--warning)' },
  payment_made:      { icon: DollarSign,  color: 'var(--success)' },
  risk_assessed:     { icon: Shield,      color: 'var(--danger)' },
  triage_completed:  { icon: Brain,       color: 'var(--info)' },
}

const TRIAGE_CONFIG = {
  simple:   { color: 'var(--success)', bg: 'var(--success-bg)', label: 'Simple' },
  moderate: { color: 'var(--warning)', bg: 'var(--warning-bg)', label: 'Moderate' },
  complex:  { color: 'var(--danger)',  bg: 'var(--danger-bg)',  label: 'Complex' },
}

const OUTCOME_CONFIG = {
  likely_approve: { color: 'var(--success)', label: 'Likely Approve' },
  likely_reject:  { color: 'var(--danger)',  label: 'Likely Reject' },
  uncertain:      { color: 'var(--warning)', label: 'Uncertain' },
}

const RISK_CONFIG = {
  low:    { color: 'var(--success)', bg: 'var(--success-bg)', border: 'var(--success-border)', label: 'Low Risk' },
  medium: { color: 'var(--warning)', bg: 'var(--warning-bg)', border: 'var(--warning-border)', label: 'Medium Risk' },
  high:   { color: 'var(--danger)',  bg: 'var(--danger-bg)',  border: 'var(--danger-border)',  label: 'High Risk' },
}

function InfoRow({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <dt style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</dt>
      <dd style={{ fontSize: '0.875rem', color: 'var(--text-1)', fontWeight: 500, fontFamily: mono ? 'monospace' : undefined }}>{value || '—'}</dd>
    </div>
  )
}

function SectionCard({ icon: Icon, title, accent = 'var(--accent)', children, badge }) {
  return (
    <div className="card" style={{ padding: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1rem', paddingBottom: '0.875rem', borderBottom: '1px solid var(--border)' }}>
        <div style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={13} color={accent} />
        </div>
        <h2 style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-2)', letterSpacing: '0.04em', textTransform: 'uppercase', flex: 1 }}>{title}</h2>
        {badge}
      </div>
      {children}
    </div>
  )
}

function AuditTimeline({ logs }) {
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? logs : logs.slice(0, 5)
  if (!logs.length) return <p style={{ fontSize: '0.8rem', color: 'var(--text-3)', textAlign: 'center', padding: '1rem 0' }}>No activity yet.</p>
  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
        {shown.map((l, i) => {
          const cfg  = AUDIT_ICONS[l.action] || { icon: Activity, color: 'var(--text-3)' }
          const Icon = cfg.icon
          return (
            <div key={l.id} style={{ display: 'flex', gap: '0.75rem', position: 'relative', paddingBottom: i < shown.length - 1 ? '0.875rem' : 0 }}>
              {/* Vertical line */}
              {i < shown.length - 1 && (
                <div style={{ position: 'absolute', left: '11px', top: '22px', bottom: 0, width: '1px', background: 'var(--border)' }} />
              )}
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 1 }}>
                <Icon size={11} color={cfg.color} />
              </div>
              <div style={{ flex: 1, paddingTop: '2px' }}>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-1)', lineHeight: 1.5 }}>{l.detail}</p>
                <p style={{ fontSize: '0.68rem', color: 'var(--text-3)', marginTop: '0.1rem' }}>
                  {l.actor} · {new Date(l.created_at).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </div>
            </div>
          )
        })}
      </div>
      {logs.length > 5 && (
        <button
          onClick={() => setExpanded(v => !v)}
          style={{ marginTop: '0.75rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem', fontFamily: 'inherit' }}
        >
          {expanded ? <><ChevronUp size={13} /> Show less</> : <><ChevronDown size={13} /> Show {logs.length - 5} more</>}
        </button>
      )}
    </div>
  )
}

export default function ClaimDetail() {
  const { id }    = useParams()
  const navigate  = useNavigate()
  const toast     = useToast()
  const user      = JSON.parse(localStorage.getItem('claims_user') || '{}')
  const docFileRef = useRef(null)

  const [claim, setClaim]           = useState(null)
  const [notes, setNotes]           = useState([])
  const [auditLogs, setAuditLogs]   = useState([])
  const [documents, setDocuments]   = useState([])
  const [loading, setLoading]       = useState(true)

  const [note, setNote]             = useState('')
  const [reason, setReason]         = useState('')
  const [approvedAmt, setApprovedAmt] = useState('')
  const [excess, setExcess]         = useState('0')
  const [saving, setSaving]         = useState(false)
  const [sendingNote, setSendingNote] = useState(false)

  // AI states
  const [riskLoading, setRiskLoading]   = useState(false)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [suggestion, setSuggestion]     = useState(null)

  // Document upload
  const [docUploading, setDocUploading] = useState(false)
  const [docLabel, setDocLabel]         = useState('')

  // Payment
  const [paymentSaving, setPaymentSaving] = useState(false)

  async function load() {
    try {
      const [c, n, a, d] = await Promise.all([
        axios.get(`/api/claims/${id}`),
        axios.get(`/api/claims/${id}/notes`),
        axios.get(`/api/claims/${id}/audit`),
        axios.get(`/api/claims/${id}/documents`),
      ])
      setClaim(c.data)
      setNotes(n.data)
      setAuditLogs(a.data)
      setDocuments(d.data)
      if (c.data.approved_amount != null) setApprovedAmt(String(c.data.approved_amount))
      if (c.data.excess != null) setExcess(String(c.data.excess))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  async function addNote(e) {
    e.preventDefault()
    if (!note.trim()) return
    setSendingNote(true)
    try {
      await axios.post(`/api/claims/${id}/notes`, { author: user.name, content: note })
      setNote('')
      toast('Note added.', 'success')
      load()
    } catch { toast('Failed to add note.', 'error') }
    finally { setSendingNote(false) }
  }

  async function updateStatus(status) {
    setSaving(true)
    try {
      await axios.patch(`/api/claims/${id}/status`, {
        status, reason, updated_by: user.name,
        approved_amount: approvedAmt ? Number(approvedAmt) : undefined,
        excess: Number(excess),
      })
      toast(`Claim ${status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'updated'} successfully.`, status === 'rejected' ? 'warning' : 'success')
      setReason('')
      setSuggestion(null)
      load()
    } catch (err) { toast(err.response?.data?.error || 'Failed to update status.', 'error') }
    finally { setSaving(false) }
  }

  async function markUnderReview() {
    setSaving(true)
    try {
      await axios.patch(`/api/claims/${id}/status`, { status: 'under_review', updated_by: user.name })
      toast('Claim moved to Under Review.', 'info')
      load()
    } catch { toast('Failed to update status.', 'error') }
    finally { setSaving(false) }
  }

  async function markPaid() {
    setPaymentSaving(true)
    try {
      await axios.patch(`/api/claims/${id}/payment`, { paid_by: user.name })
      toast('Payment recorded successfully.', 'success')
      load()
    } catch (err) { toast(err.response?.data?.error || 'Failed to record payment.', 'error') }
    finally { setPaymentSaving(false) }
  }

  async function closeClaim() {
    setSaving(true)
    try {
      await axios.patch(`/api/claims/${id}/status`, { status: 'closed', reason: 'Claim closed after settlement.', updated_by: user.name })
      toast('Claim closed.', 'info')
      load()
    } catch { toast('Failed to close claim.', 'error') }
    finally { setSaving(false) }
  }

  async function runRiskScore() {
    setRiskLoading(true)
    try {
      const res = await axios.post(`/api/claims/${id}/risk-score`)
      toast(`Risk assessment complete: ${res.data.score.toUpperCase()} risk`, res.data.score === 'low' ? 'success' : res.data.score === 'medium' ? 'warning' : 'error')
      load()
    } catch (err) { toast(err.response?.data?.error || 'Risk assessment failed.', 'error') }
    finally { setRiskLoading(false) }
  }

  async function getAISuggestion() {
    setSuggestLoading(true)
    try {
      const res = await axios.post(`/api/claims/${id}/suggest-decision`)
      setSuggestion(res.data)
      if (res.data.recommended_action !== 'investigate_further' && res.data.reason) {
        setReason(res.data.reason)
      }
      if (res.data.suggested_approved_amount != null) setApprovedAmt(String(res.data.suggested_approved_amount))
      if (res.data.suggested_excess != null) setExcess(String(res.data.suggested_excess))
      toast('AI suggestion generated.', 'info')
    } catch (err) { toast(err.response?.data?.error || 'Failed to generate suggestion.', 'error') }
    finally { setSuggestLoading(false) }
  }

  async function uploadDocument(file) {
    if (!file) return
    setDocUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('uploaded_by', user.name || 'Unknown')
      fd.append('label', docLabel || file.name)
      await axios.post(`/api/claims/${id}/documents`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setDocLabel('')
      if (docFileRef.current) docFileRef.current.value = ''
      toast('Document uploaded.', 'success')
      load()
    } catch (err) { toast(err.response?.data?.error || 'Upload failed.', 'error') }
    finally { setDocUploading(false) }
  }

  async function deleteDocument(docId) {
    try {
      await axios.delete(`/api/documents/doc/${docId}`)
      toast('Document removed.', 'info')
      load()
    } catch { toast('Failed to remove document.', 'error') }
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
    <div style={{ padding: '2rem', color: 'var(--text-2)' }}><p>Claim not found.</p></div>
  )

  const canAdjudicate = user.role === 'adjudicator' || user.role === 'manager'
  const isOpen        = ['pending', 'under_review'].includes(claim.status)
  const pipelineIdx   = STATUS_FLOW.findIndex(s => s.key === claim.status)
  const riskCfg       = claim.fraud_score ? RISK_CONFIG[claim.fraud_score] : null
  const netPayout     = approvedAmt ? Math.max(0, Number(approvedAmt) - Number(excess || 0)) : null

  return (
    <div className="page-container-md">

      <button onClick={() => navigate(-1)} className="btn-ghost" style={{ marginBottom: '1.5rem', fontSize: '0.82rem', padding: '0.4rem 0.75rem' }}>
        <ArrowLeft size={14} /> Back
      </button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
              Claim <span style={{ color: 'var(--accent)', fontFamily: 'monospace' }}>#{String(claim.id).padStart(5, '0')}</span>
            </h1>
            <StatusBadge status={claim.status} size="lg" />
            {riskCfg && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.25rem 0.6rem', borderRadius: '99px', fontSize: '0.72rem', fontWeight: 700, color: riskCfg.color, background: riskCfg.bg, border: `1px solid ${riskCfg.border}` }}>
                <Shield size={10} /> {riskCfg.label}
              </span>
            )}
          </div>
          <p style={{ color: 'var(--text-3)', fontSize: '0.8rem' }}>
            Filed {new Date(claim.created_at).toLocaleDateString('en-AU', { dateStyle: 'long' })}
            {' · '}Updated {new Date(claim.updated_at).toLocaleDateString('en-AU', { dateStyle: 'medium' })}
            {claim.sla_due && isOpen && (() => {
              const days = Math.ceil((new Date(claim.sla_due) - Date.now()) / 86400000)
              return <span style={{ color: days < 0 ? 'var(--danger)' : days <= 1 ? 'var(--warning)' : 'var(--text-3)' }}>
                {' · '}SLA: {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d remaining`}
              </span>
            })()}
          </p>
        </div>
        <div style={{ padding: '0.625rem 1rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', textAlign: 'right', boxShadow: 'var(--shadow-xs)' }}>
          <p style={{ fontSize: '0.62rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Claim Amount</p>
          <p style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em', marginTop: '0.1rem' }}>
            ${Number(claim.amount).toLocaleString()}
            <span style={{ fontSize: '0.7rem', color: 'var(--text-3)', fontWeight: 500, marginLeft: '0.25rem' }}>AUD</span>
          </p>
        </div>
      </div>

      {/* Status pipeline */}
      {!['rejected', 'closed'].includes(claim.status) && (
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
                    <span style={{ fontSize: '0.65rem', fontWeight: 600, color: done ? 'var(--accent)' : 'var(--text-3)', whiteSpace: 'nowrap' }}>{s.label}</span>
                  </div>
                  {i < STATUS_FLOW.length - 1 && (
                    <div style={{ flex: 1, height: '2px', margin: '0 0.5rem', marginBottom: '1.1rem', background: i < pipelineIdx ? 'var(--accent)' : 'var(--border)', borderRadius: '99px', transition: 'background 0.3s ease' }} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Decision banners */}
      {claim.status === 'rejected' && (
        <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 'var(--r-md)', padding: '1rem 1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
          <XCircle size={17} color="var(--danger)" style={{ flexShrink: 0, marginTop: '1px' }} />
          <div>
            <p style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--danger-text)' }}>Claim Rejected</p>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-2)', marginTop: '0.2rem' }}>{claim.decision_reason}</p>
            {claim.decided_by && <p style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>— {claim.decided_by}</p>}
          </div>
        </div>
      )}

      {claim.status === 'approved' && (
        <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 'var(--r-md)', padding: '1rem 1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
          <CheckCircle size={17} color="var(--success)" style={{ flexShrink: 0, marginTop: '1px' }} />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--success-text)' }}>Claim Approved</p>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-2)', marginTop: '0.2rem' }}>{claim.decision_reason}</p>
            {claim.decided_by && <p style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>— {claim.decided_by}</p>}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <p style={{ fontSize: '0.65rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Net Payout</p>
            <p style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--success)', letterSpacing: '-0.02em' }}>
              ${Number(claim.net_payout ?? 0).toLocaleString()} AUD
            </p>
            <p style={{ fontSize: '0.68rem', color: 'var(--text-3)', marginTop: '0.1rem' }}>
              Payment: {claim.payment_status === 'paid' ? `Paid ${new Date(claim.paid_at).toLocaleDateString('en-AU')}` : 'Pending'}
            </p>
          </div>
        </div>
      )}

      {claim.status === 'closed' && (
        <div style={{ background: 'var(--muted-bg)', border: '1px solid var(--muted-border)', borderRadius: 'var(--r-md)', padding: '1rem 1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Lock size={16} color="var(--muted)" style={{ flexShrink: 0 }} />
          <p style={{ fontSize: '0.82rem', color: 'var(--muted-text)', fontWeight: 600 }}>This claim is closed. No further actions can be taken.</p>
        </div>
      )}

      {/* Body */}
      <div className="detail-body">

        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Claimant info */}
          <SectionCard icon={User} title="Claimant Information">
            <dl className="info-grid-2">
              <InfoRow label="Full Name"     value={claim.claimant_name} />
              <InfoRow label="Email"         value={claim.claimant_email} />
              <InfoRow label="Phone"         value={claim.claimant_phone} />
              <InfoRow label="Policy Number" value={claim.policy_number} mono />
            </dl>
          </SectionCard>

          {/* Incident details */}
          <SectionCard icon={MapPin} title="Incident Details" accent="var(--warning)">
            <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem 1.5rem', marginBottom: '0.875rem' }}>
              <InfoRow label="Claim Type"    value={CLAIM_TYPE_LABELS[claim.claim_type] || claim.claim_type} />
              <InfoRow label="Incident Date" value={new Date(claim.incident_date).toLocaleDateString('en-AU', { dateStyle: 'long' })} />
              <InfoRow label="Location"      value={claim.location} />
            </dl>
            <div>
              <dt style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Description</dt>
              <dd style={{ fontSize: '0.875rem', color: 'var(--text-2)', lineHeight: 1.7, background: 'var(--surface-2)', borderRadius: 'var(--r-sm)', padding: '0.75rem 1rem', border: '1px solid var(--border)' }}>
                {claim.incident_description}
              </dd>
            </div>
          </SectionCard>

          {/* Documents */}
          <SectionCard icon={Paperclip} title="Supporting Documents" accent="var(--info)">
            {documents.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-3)', textAlign: 'center', padding: '0.75rem 0' }}>No documents attached yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                {documents.map(doc => (
                  <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.55rem 0.75rem', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)' }}>
                    <FileText size={14} color="var(--accent)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <a
                        href={`${import.meta.env.VITE_API_URL || ''}/api/claims/file/${doc.filename}`}
                        target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent)', textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      >
                        {doc.label || doc.original_name}
                      </a>
                      <p style={{ fontSize: '0.68rem', color: 'var(--text-3)' }}>
                        {(doc.size / 1024).toFixed(1)} KB · {doc.uploaded_by} · {new Date(doc.uploaded_at).toLocaleDateString('en-AU')}
                      </p>
                    </div>
                    {canAdjudicate && (
                      <button onClick={() => deleteDocument(doc.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: '0.2rem' }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Upload area */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '160px' }}>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-3)', marginBottom: '0.3rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Document Label</label>
                <input
                  className="input-field"
                  value={docLabel}
                  onChange={e => setDocLabel(e.target.value)}
                  placeholder="e.g. Police Report"
                  style={{ fontSize: '0.8rem' }}
                />
              </div>
              <div style={{ flexShrink: 0 }}>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-3)', marginBottom: '0.3rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>File</label>
                <label style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.55rem 0.875rem',
                  background: 'var(--surface-2)', border: '1.5px solid var(--border)',
                  borderRadius: 'var(--r-sm)', cursor: 'pointer',
                  fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-2)',
                  transition: 'all 0.15s ease',
                }}>
                  {docUploading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={13} />}
                  {docUploading ? 'Uploading…' : 'Choose file'}
                  <input ref={docFileRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={e => uploadDocument(e.target.files?.[0])} disabled={docUploading} />
                </label>
              </div>
            </div>
          </SectionCard>

          {/* Notes */}
          <SectionCard icon={MessageSquare} title="Activity & Notes" accent="var(--success)">
            <div style={{ marginBottom: '1rem', maxHeight: '260px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {notes.length === 0 ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-3)', textAlign: 'center', padding: '1.25rem 0' }}>No notes yet. Be the first to add one.</p>
              ) : notes.map(n => (
                <div key={n.id} style={{ display: 'flex', gap: '0.75rem' }}>
                  <div style={{ width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-2)' }}>
                    {n.author.charAt(0)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-1)' }}>{n.author}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>{new Date(n.created_at).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    </div>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-2)', lineHeight: 1.6 }}>{n.content}</p>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={addNote} style={{ display: 'flex', gap: '0.5rem' }}>
              <input
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
                  padding: '0.6rem 0.875rem', background: 'var(--accent)', border: 'none', borderRadius: 'var(--r-sm)',
                  cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', gap: '0.375rem',
                  fontSize: '0.8rem', fontWeight: 600, opacity: (!note.trim() || sendingNote) ? 0.45 : 1,
                  transition: 'opacity 0.15s ease', fontFamily: 'inherit', flexShrink: 0,
                }}
              >
                {sendingNote ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={13} />}
                Send
              </button>
            </form>
          </SectionCard>

          {/* Full audit trail */}
          <SectionCard icon={Activity} title="Full Audit Trail" accent="var(--text-3)">
            <AuditTimeline logs={auditLogs} />
          </SectionCard>

        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Adjudication */}
          {canAdjudicate && isOpen && (
            <SectionCard icon={Shield} title="Adjudication">

              {/* Risk score row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', padding: '0.625rem 0.875rem', background: 'var(--surface-2)', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <p style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fraud Risk</p>
                    <AITooltip
                      title="Fraud Analysis"
                      sections={[
                        { label: 'Reasoning', items: claim.fraud_reasoning, numbered: true, color: 'var(--accent)' },
                        { label: 'Behavioural Indicators', items: claim.fraud_behavioral, color: 'var(--warning)' },
                        { label: 'Financial Indicators', items: claim.fraud_financial, color: 'var(--danger)' },
                      ]}
                    />
                  </div>
                  {riskCfg ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.15rem' }}>
                      <p style={{ fontSize: '0.82rem', fontWeight: 700, color: riskCfg.color }}>{riskCfg.label}</p>
                      {claim.fraud_confidence != null && (
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-3)' }}>{claim.fraud_confidence}% conf.</span>
                      )}
                    </div>
                  ) : (
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-3)', marginTop: '0.1rem' }}>Not assessed</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={runRiskScore}
                  disabled={riskLoading}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                    padding: '0.35rem 0.7rem',
                    background: 'var(--surface)', border: '1.5px solid var(--border)',
                    borderRadius: 'var(--r-sm)', fontSize: '0.72rem', fontWeight: 600,
                    color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit',
                    opacity: riskLoading ? 0.6 : 1,
                  }}
                >
                  {riskLoading ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Shield size={11} />}
                  {claim.fraud_score ? 'Re-assess' : 'Assess'}
                </button>
              </div>

              {/* Risk flags */}
              {claim.fraud_flags?.length > 0 && (
                <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {claim.fraud_flags.map((flag, i) => (
                    <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', fontSize: '0.75rem', color: 'var(--text-2)' }}>
                      <AlertTriangle size={11} color="var(--warning)" style={{ flexShrink: 0, marginTop: '2px' }} />
                      {flag}
                    </div>
                  ))}
                </div>
              )}

              {/* Mark under review */}
              {claim.status === 'pending' && (
                <button
                  onClick={markUnderReview}
                  disabled={saving}
                  style={{
                    width: '100%', padding: '0.575rem',
                    background: 'var(--info-bg)', border: '1.5px solid var(--info-border)',
                    borderRadius: 'var(--r-sm)', color: 'var(--info-text)',
                    fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', marginBottom: '1rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                    transition: 'all 0.15s ease', opacity: saving ? 0.5 : 1, fontFamily: 'inherit',
                  }}
                >
                  <RefreshCw size={13} /> Mark Under Review
                </button>
              )}

              {/* AI suggestion */}
              <button
                type="button"
                onClick={getAISuggestion}
                disabled={suggestLoading}
                style={{
                  width: '100%', padding: '0.525rem',
                  background: 'var(--accent-bg)', border: '1.5px solid var(--accent-border)',
                  borderRadius: 'var(--r-sm)', color: 'var(--accent-text)',
                  fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', marginBottom: '1rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  transition: 'all 0.15s ease', opacity: suggestLoading ? 0.5 : 1, fontFamily: 'inherit',
                }}
              >
                {suggestLoading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={12} />}
                {suggestion ? 'Refresh AI Suggestion' : 'Get AI Decision Suggestion'}
              </button>

              {/* AI suggestion result */}
              {suggestion && (
                <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--surface-2)', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', flex: 1 }}>AI Recommendation</span>
                    <AITooltip
                      title="AI Reasoning"
                      sections={[
                        { label: 'Reasoning Chain', items: suggestion.reasoning_chain, numbered: true, color: 'var(--accent)' },
                        { label: 'Supporting Evidence', items: suggestion.evidence_supporting, color: 'var(--success)' },
                        { label: 'Concerns', items: suggestion.evidence_against, color: 'var(--danger)' },
                        { label: 'Risk Factors', items: suggestion.risk_factors, color: 'var(--warning)' },
                      ]}
                    />
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '99px',
                      ...(suggestion.recommendation === 'approve'
                        ? { color: 'var(--success)', background: 'var(--success-bg)' }
                        : suggestion.recommendation === 'reject'
                        ? { color: 'var(--danger)', background: 'var(--danger-bg)' }
                        : { color: 'var(--warning)', background: 'var(--warning-bg)' }),
                    }}>
                      {suggestion.recommendation === 'approve' ? 'Approve' : suggestion.recommendation === 'reject' ? 'Reject' : 'Investigate'}
                    </span>
                  </div>

                  {/* Confidence bar */}
                  {suggestion.confidence_percentage != null && (
                    <div style={{ marginBottom: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-3)', fontWeight: 600 }}>AI CONFIDENCE</span>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent)' }}>{suggestion.confidence_percentage}%</span>
                      </div>
                      <div style={{ height: '4px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${suggestion.confidence_percentage}%`, background: 'var(--accent)', borderRadius: '99px', transition: 'width 0.6s ease' }} />
                      </div>
                    </div>
                  )}

                  {suggestion.key_considerations?.length > 0 && (
                    <ul style={{ margin: '0 0 0 0.5rem', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      {suggestion.key_considerations.map((c, i) => (
                        <li key={i} style={{ fontSize: '0.75rem', color: 'var(--text-2)', display: 'flex', gap: '0.4rem', alignItems: 'flex-start' }}>
                          <span style={{ color: 'var(--accent)', flexShrink: 0 }}>·</span> {c}
                        </li>
                      ))}
                    </ul>
                  )}
                  <button onClick={() => setSuggestion(null)} style={{ marginTop: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: '0.7rem', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <X size={10} /> Dismiss
                  </button>
                </div>
              )}

              {/* Partial approval amount */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-3)', marginBottom: '0.3rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Approved Amount</label>
                  <input
                    type="number" min="0" step="0.01"
                    value={approvedAmt}
                    onChange={e => setApprovedAmt(e.target.value)}
                    placeholder={String(claim.amount)}
                    className="input-field"
                    style={{ fontSize: '0.82rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-3)', marginBottom: '0.3rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Excess / Deductible</label>
                  <input
                    type="number" min="0" step="0.01"
                    value={excess}
                    onChange={e => setExcess(e.target.value)}
                    className="input-field"
                    style={{ fontSize: '0.82rem' }}
                  />
                </div>
              </div>

              {netPayout !== null && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 'var(--r-sm)', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--success-text)', fontWeight: 600 }}>Net Payout</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--success)' }}>${netPayout.toLocaleString()} AUD</span>
                </div>
              )}

              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-3)', marginBottom: '0.4rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Decision Reason *
              </label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Provide a reason for your decision…"
                className="input-field"
                style={{ minHeight: '80px', resize: 'none', marginBottom: '0.75rem', lineHeight: 1.6, fontSize: '0.82rem' }}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <button
                  onClick={() => updateStatus('approved')}
                  disabled={saving || !reason.trim()}
                  className="btn-success"
                  style={{ fontSize: '0.8rem', padding: '0.55rem 0.75rem' }}
                >
                  {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle size={13} />}
                  Approve
                </button>
                <button
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

          {/* Settlement panel */}
          {claim.status === 'approved' && canAdjudicate && (
            <SectionCard icon={DollarSign} title="Settlement" accent="var(--success)">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                {[
                  { label: 'Claimed Amount',   value: `$${Number(claim.amount).toLocaleString()} AUD` },
                  { label: 'Approved Amount',  value: `$${Number(claim.approved_amount ?? claim.amount).toLocaleString()} AUD` },
                  { label: 'Excess / Deductible', value: `$${Number(claim.excess ?? 0).toLocaleString()} AUD` },
                  { label: 'Net Payout',       value: `$${Number(claim.net_payout ?? 0).toLocaleString()} AUD`, bold: true },
                ].map(({ label, value, bold }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.55rem 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-3)', fontWeight: 500 }}>{label}</span>
                    <span style={{ fontSize: bold ? '0.9rem' : '0.8rem', color: bold ? 'var(--success)' : 'var(--text-1)', fontWeight: bold ? 800 : 600 }}>{value}</span>
                  </div>
                ))}
              </div>

              {claim.payment_status === 'paid' ? (
                <div style={{ marginTop: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 0.875rem', background: 'var(--success-bg)', borderRadius: 'var(--r-sm)', border: '1px solid var(--success-border)' }}>
                  <CheckCircle size={14} color="var(--success)" />
                  <div>
                    <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--success-text)' }}>Payment Confirmed</p>
                    <p style={{ fontSize: '0.68rem', color: 'var(--text-3)' }}>
                      Paid by {claim.paid_by} on {new Date(claim.paid_at).toLocaleDateString('en-AU', { dateStyle: 'long' })}
                    </p>
                  </div>
                </div>
              ) : (
                <button
                  onClick={markPaid}
                  disabled={paymentSaving}
                  className="btn-success"
                  style={{ width: '100%', justifyContent: 'center', marginTop: '0.875rem', padding: '0.6rem' }}
                >
                  {paymentSaving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <DollarSign size={13} />}
                  {paymentSaving ? 'Recording…' : 'Mark as Paid'}
                </button>
              )}

              {claim.payment_status === 'paid' && claim.status !== 'closed' && (
                <button
                  onClick={closeClaim}
                  disabled={saving}
                  style={{
                    width: '100%', padding: '0.55rem', marginTop: '0.5rem',
                    background: 'var(--surface-2)', border: '1.5px solid var(--border)',
                    borderRadius: 'var(--r-sm)', color: 'var(--text-2)',
                    fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                    fontFamily: 'inherit', transition: 'all 0.15s ease',
                  }}
                >
                  <Lock size={12} /> Close Claim
                </button>
              )}
            </SectionCard>
          )}

          {/* Close rejected claim */}
          {claim.status === 'rejected' && canAdjudicate && (
            <SectionCard icon={Lock} title="Finalise" accent="var(--text-3)">
              <p style={{ fontSize: '0.78rem', color: 'var(--text-2)', marginBottom: '0.875rem', lineHeight: 1.6 }}>
                Once reviewed and finalised, close this claim to archive it.
              </p>
              <button
                onClick={closeClaim}
                disabled={saving}
                style={{
                  width: '100%', padding: '0.55rem',
                  background: 'var(--surface-2)', border: '1.5px solid var(--border)',
                  borderRadius: 'var(--r-sm)', color: 'var(--text-2)',
                  fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                  fontFamily: 'inherit', transition: 'all 0.15s ease',
                }}
              >
                <Lock size={12} /> Close Claim
              </button>
            </SectionCard>
          )}

          {/* Triage assessment */}
          {claim.triage && (
            <SectionCard icon={Brain} title="AI Triage Assessment" accent="var(--info)"
              badge={canAdjudicate && (
                <AITooltip
                  title="Triage Reasoning"
                  sections={[
                    { label: 'Key Factors', items: claim.triage.key_factors, color: 'var(--accent)' },
                    { label: 'Assessment', items: claim.triage.reasoning ? [claim.triage.reasoning] : [], color: 'var(--info)' },
                  ]}
                />
              )}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                {[
                  {
                    label: 'Complexity',
                    value: (() => {
                      const tc = TRIAGE_CONFIG[claim.triage.complexity]
                      return tc ? (
                        <span style={{ padding: '0.15rem 0.5rem', borderRadius: '99px', fontSize: '0.72rem', fontWeight: 700, color: tc.color, background: tc.bg }}>
                          {tc.label}
                        </span>
                      ) : '—'
                    })(),
                  },
                  {
                    label: 'Predicted Outcome',
                    value: (() => {
                      const oc = OUTCOME_CONFIG[claim.triage.predicted_outcome]
                      return oc ? <span style={{ fontSize: '0.78rem', fontWeight: 700, color: oc.color }}>{oc.label}</span> : '—'
                    })(),
                  },
                  { label: 'Approval Probability', value: claim.triage.approval_probability != null ? `${claim.triage.approval_probability}%` : '—' },
                  { label: 'Est. Processing', value: claim.triage.estimated_processing_days != null ? `${claim.triage.estimated_processing_days} days` : '—' },
                  ...(canAdjudicate ? [{ label: 'Recommended Handler', value: claim.triage.recommended_handler || '—' }] : []),
                  ...(canAdjudicate ? [{ label: 'Triage Confidence', value: claim.triage.confidence != null ? `${claim.triage.confidence}%` : '—' }] : []),
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-3)', fontWeight: 500 }}>{label}</span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-1)', fontWeight: 600 }}>{value}</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Claim summary */}
          <SectionCard icon={FileText} title="Claim Summary" accent="var(--text-3)">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {[
                { label: 'Status',     value: <StatusBadge status={claim.status} /> },
                { label: 'Claim Type', value: CLAIM_TYPE_LABELS[claim.claim_type] || claim.claim_type },
                { label: 'Amount',     value: `$${Number(claim.amount).toLocaleString()} AUD` },
                { label: 'Policy',     value: claim.policy_number, mono: true },
                { label: 'Priority',   value: claim.priority ? claim.priority.charAt(0).toUpperCase() + claim.priority.slice(1) : '—' },
                { label: 'Filed',      value: new Date(claim.created_at).toLocaleDateString('en-AU') },
                ...(claim.decided_by ? [{ label: 'Decided By', value: claim.decided_by }] : []),
              ].map(({ label, value, mono }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.55rem 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-3)', fontWeight: 500 }}>{label}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-1)', fontWeight: 600, fontFamily: mono ? 'monospace' : undefined }}>{value}</span>
                </div>
              ))}
            </div>
          </SectionCard>

        </div>
      </div>
    </div>
  )
}
