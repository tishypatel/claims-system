import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from '../api'
import {
  ArrowLeft, CheckCircle, XCircle, Clock, Loader2,
  Upload, Paperclip, FileText, AlertTriangle, DollarSign,
  MessageSquare, Printer, RefreshCw, Send, Trash2,
} from 'lucide-react'
import StatusBadge from '../components/StatusBadge'
import { useToast } from '../components/Toast'

/* ─── Constants ──────────────────────────────────────────────── */

const CLAIM_TYPE_LABELS = {
  motor: 'Motor / Vehicle', property: 'Property Damage', liability: 'Public Liability',
  workers_comp: "Workers' Compensation", health: 'Health / Medical', travel: 'Travel',
}

// Claimant-facing stage labels (friendly, non-technical)
const CLAIMANT_STAGES = [
  { num: 1, label: 'Received',     desc: 'Your claim has been received and is in our system.' },
  { num: 2, label: 'Docs Review',  desc: 'Our team is reviewing your supporting documents.' },
  { num: 3, label: 'Assessment',   desc: 'Your claim is being assessed by our AI and specialist team.' },
  { num: 4, label: 'Final Review', desc: 'A senior adjudicator is completing the final review.' },
  { num: 5, label: 'Decision',     desc: 'A decision has been made on your claim.' },
]

function deriveStage(claim) {
  if (['approved', 'rejected', 'closed'].includes(claim.status)) return 5
  if (claim.workflow_stage) return Math.min(5, claim.workflow_stage)
  if (claim.triage) return 4
  if (claim.status === 'under_review') return 3
  return 2
}

/* ─── Component ──────────────────────────────────────────────── */

export default function ClaimantClaimView() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const toast    = useToast()
  const user     = JSON.parse(localStorage.getItem('claims_user') || '{}')
  const docFileRef = useRef(null)

  const [claim,     setClaim]     = useState(null)
  const [notes,     setNotes]     = useState([])
  const [documents, setDocuments] = useState([])
  const [loading,   setLoading]   = useState(true)

  const [docLabel,     setDocLabel]     = useState('')
  const [docUploading, setDocUploading] = useState(false)
  const [note,         setNote]         = useState('')
  const [sendingNote,  setSendingNote]  = useState(false)

  async function load(silent = false) {
    if (!silent) setLoading(true)
    try {
      const [c, n, d] = await Promise.all([
        axios.get(`/api/claims/${id}`),
        axios.get(`/api/claims/${id}/notes`),
        axios.get(`/api/claims/${id}/documents`),
      ])
      setClaim(c.data)
      setNotes(n.data)
      setDocuments(d.data)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [id])

  async function uploadDocument(file) {
    if (!file) return
    setDocUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('uploaded_by', user.name || 'Claimant')
      fd.append('label', docLabel || file.name)
      await axios.post(`/api/claims/${id}/documents`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setDocLabel('')
      if (docFileRef.current) docFileRef.current.value = ''
      load(true)
      toast('Document uploaded.', 'success')
    } catch { toast('Upload failed.', 'error') }
    finally { setDocUploading(false) }
  }

  async function addNote(e) {
    e.preventDefault()
    if (!note.trim()) return
    setSendingNote(true)
    try {
      await axios.post(`/api/claims/${id}/notes`, { author: user.name || 'Claimant', content: note })
      setNote('')
      load(true)
      toast('Message sent.', 'success')
    } catch { toast('Failed.', 'error') }
    finally { setSendingNote(false) }
  }

  /* ─── Loading ──────────────────────────────────────────────── */

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center', color: 'var(--text-3)' }}>
        <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 0.75rem', display: 'block' }} />
        <p style={{ fontSize: '0.875rem' }}>Loading your claim…</p>
      </div>
    </div>
  )

  if (!claim) return <div style={{ padding: '2rem' }}><p>Claim not found.</p></div>

  const stage       = deriveStage(claim)
  const stageInfo   = CLAIMANT_STAGES[stage - 1]
  const isDecided   = ['approved', 'rejected', 'closed'].includes(claim.status)
  const isApproved  = claim.status === 'approved'
  const docRequests = notes.filter(n => n.is_doc_request)
  const adjNotes    = notes.filter(n => !n.is_doc_request && n.author !== (user.name || 'Claimant'))
  const stageColor  = isDecided
    ? (isApproved ? 'var(--success)' : 'var(--danger)')
    : 'var(--accent)'

  return (
    <div className="page-container-md">

      {/* Back */}
      <button onClick={() => navigate('/dashboard')} className="btn-ghost" style={{ marginBottom: '1.25rem', fontSize: '0.82rem', padding: '0.4rem 0.75rem' }}>
        <ArrowLeft size={14} /> My Claims
      </button>

      {/* Claim header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em', marginBottom: '0.3rem' }}>
            Claim <span style={{ color: 'var(--accent)', fontFamily: 'monospace' }}>#{String(claim.id).padStart(5, '0')}</span>
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
            <StatusBadge status={claim.status} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
              {CLAIM_TYPE_LABELS[claim.claim_type] || claim.claim_type} · Filed {new Date(claim.created_at).toLocaleDateString('en-AU', { dateStyle: 'medium' })}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          {isDecided && (
            <button
              onClick={() => navigate(`/claims/${id}/letter`)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.875rem', background: 'var(--surface-2)', border: '1.5px solid var(--border)', borderRadius: 'var(--r-sm)', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s ease' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-2)' }}
            >
              <Printer size={13} /> Decision Letter
            </button>
          )}
          <div style={{ padding: '0.625rem 1rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', textAlign: 'right', boxShadow: 'var(--shadow-xs)' }}>
            <p style={{ fontSize: '0.62rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Claimed</p>
            <p style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em', marginTop: '0.1rem' }}>
              ${Number(claim.amount).toLocaleString()}
              <span style={{ fontSize: '0.65rem', color: 'var(--text-3)', fontWeight: 500, marginLeft: '0.2rem' }}>AUD</span>
            </p>
          </div>
        </div>
      </div>

      {/* ── Stage progress tracker ── */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
        {/* Stage dots */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
          {CLAIMANT_STAGES.map((s, i) => {
            const done    = stage > s.num
            const active  = stage === s.num
            const pending = stage < s.num
            return (
              <div key={s.num} style={{ display: 'flex', alignItems: 'center', flex: i < CLAIMANT_STAGES.length - 1 ? 1 : undefined }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
                  <div style={{
                    width: '30px', height: '30px', borderRadius: '50%',
                    background: done ? stageColor : active ? stageColor : 'var(--surface-2)',
                    border: `2px solid ${done || active ? stageColor : 'var(--border)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: active ? `0 0 0 4px ${isDecided ? (isApproved ? 'var(--success-bg)' : 'var(--danger-bg)') : 'var(--accent-bg)'}` : 'none',
                    transition: 'all 0.25s ease',
                  }}>
                    {done
                      ? <CheckCircle size={13} color="white" />
                      : active
                      ? (isDecided && !isApproved ? <XCircle size={13} color="white" /> : <Clock size={13} color="white" />)
                      : <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-3)' }}>{s.num}</span>
                    }
                  </div>
                  <span style={{ fontSize: '0.58rem', fontWeight: 700, color: done || active ? stageColor : 'var(--text-3)', whiteSpace: 'nowrap', letterSpacing: '0.02em' }}>
                    {s.label}
                  </span>
                </div>
                {i < CLAIMANT_STAGES.length - 1 && (
                  <div style={{ flex: 1, height: '2px', margin: '0 0.375rem', marginBottom: '1.1rem', background: done ? stageColor : 'var(--border)', borderRadius: '99px', transition: 'background 0.3s ease' }} />
                )}
              </div>
            )
          })}
        </div>

        {/* Current status message */}
        <div style={{ padding: '0.75rem 1rem', background: isDecided ? (isApproved ? 'var(--success-bg)' : 'var(--danger-bg)') : 'var(--accent-bg)', border: `1px solid ${isDecided ? (isApproved ? 'var(--success-border)' : 'var(--danger-border)') : 'var(--accent-border)'}`, borderRadius: 'var(--r-sm)' }}>
          <p style={{ fontSize: '0.82rem', fontWeight: 700, color: isDecided ? (isApproved ? 'var(--success-text)' : 'var(--danger-text)') : 'var(--accent-text)', marginBottom: '0.15rem' }}>
            {stageInfo.label}
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-2)', lineHeight: 1.5 }}>{stageInfo.desc}</p>
        </div>
      </div>

      {/* ── Document requests ── */}
      {docRequests.length > 0 && (
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <AlertTriangle size={15} color="var(--warning)" />
            <h2 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-1)' }}>
              Documents Requested ({docRequests.length})
            </h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {docRequests.map(req => (
              <div key={req.id} className="card" style={{ padding: '1rem 1.25rem', borderLeft: '3px solid var(--warning)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', marginBottom: '0.875rem' }}>
                  <AlertTriangle size={14} color="var(--warning)" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--warning-text)', marginBottom: '0.2rem' }}>
                      Document requested by {req.author}
                    </p>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-2)', lineHeight: 1.5 }}>{req.content}</p>
                    <p style={{ fontSize: '0.68rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>
                      {new Date(req.created_at).toLocaleDateString('en-AU', { dateStyle: 'medium' })}
                    </p>
                  </div>
                </div>
                {/* Inline upload for this request */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
                  <div style={{ flex: 1, minWidth: '140px' }}>
                    <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-3)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Label</label>
                    <input className="input-field" value={docLabel} onChange={e => setDocLabel(e.target.value)} placeholder={req.content.slice(0, 30) + '…'} style={{ fontSize: '0.78rem' }} />
                  </div>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.6rem 0.875rem', background: 'var(--warning-bg)', border: '1.5px solid var(--warning-border)', borderRadius: 'var(--r-sm)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, color: 'var(--warning-text)', flexShrink: 0 }}>
                    {docUploading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={12} />}
                    Upload
                    <input ref={docFileRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={e => uploadDocument(e.target.files?.[0])} disabled={docUploading} />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Decision banner ── */}
      {isDecided && (
        <div style={{ marginBottom: '1.25rem', padding: '1.25rem', background: isApproved ? 'var(--success-bg)' : 'var(--danger-bg)', border: `1px solid ${isApproved ? 'var(--success-border)' : 'var(--danger-border)'}`, borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'flex-start', gap: '0.875rem', flexWrap: 'wrap' }}>
          {isApproved
            ? <CheckCircle size={20} color="var(--success)" style={{ flexShrink: 0, marginTop: '2px' }} />
            : <XCircle    size={20} color="var(--danger)"  style={{ flexShrink: 0, marginTop: '2px' }} />
          }
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '0.9rem', fontWeight: 800, color: isApproved ? 'var(--success-text)' : 'var(--danger-text)', marginBottom: '0.25rem' }}>
              {isApproved ? 'Claim Approved' : 'Claim Rejected'}
            </p>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-2)', lineHeight: 1.6 }}>{claim.decision_reason}</p>
            {claim.decided_by && (
              <p style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>— {claim.decided_by}</p>
            )}
          </div>
          {isApproved && claim.net_payout != null && (
            <div style={{ flexShrink: 0, textAlign: 'right' }}>
              <p style={{ fontSize: '0.62rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: '0.2rem' }}>Net Payout</p>
              <p style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--success)', letterSpacing: '-0.02em' }}>
                ${Number(claim.net_payout).toLocaleString()} AUD
              </p>
              <p style={{ fontSize: '0.68rem', color: 'var(--text-3)', marginTop: '0.1rem' }}>
                {claim.payment_status === 'paid'
                  ? `Paid ${new Date(claim.paid_at).toLocaleDateString('en-AU', { dateStyle: 'medium' })}`
                  : 'Payment in progress'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Main body ── */}
      <div className="two-col-grid">

        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Claim details */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1rem', paddingBottom: '0.875rem', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileText size={13} color="var(--accent)" />
              </div>
              <h2 style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-2)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Claim Details</h2>
            </div>
            <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem 1.5rem', marginBottom: '0.875rem' }}>
              {[
                { label: 'Claim Type',    value: CLAIM_TYPE_LABELS[claim.claim_type] || claim.claim_type },
                { label: 'Incident Date', value: new Date(claim.incident_date).toLocaleDateString('en-AU', { dateStyle: 'long' }) },
                { label: 'Location',      value: claim.location },
                { label: 'Policy Number', value: claim.policy_number },
              ].map(({ label, value }) => (
                <div key={label}>
                  <dt style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.2rem' }}>{label}</dt>
                  <dd style={{ fontSize: '0.875rem', color: 'var(--text-1)', fontWeight: 500 }}>{value || '—'}</dd>
                </div>
              ))}
            </dl>
            <div>
              <p style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>Description</p>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-2)', lineHeight: 1.7, padding: '0.75rem', background: 'var(--surface-2)', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)' }}>
                {claim.incident_description}
              </p>
            </div>
          </div>

          {/* Your documents */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1rem', paddingBottom: '0.875rem', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Paperclip size={13} color="var(--info)" />
              </div>
              <h2 style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-2)', letterSpacing: '0.04em', textTransform: 'uppercase', flex: 1 }}>Your Documents</h2>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-3)' }}>{documents.length}</span>
            </div>

            {documents.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-3)', textAlign: 'center', padding: '0.75rem 0' }}>No documents uploaded yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem' }}>
                {documents.map(doc => (
                  <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.5rem 0.625rem', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)' }}>
                    <FileText size={13} color="var(--accent)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {doc.label || doc.original_name}
                      </p>
                      <p style={{ fontSize: '0.65rem', color: 'var(--text-3)' }}>
                        {(doc.size / 1024).toFixed(1)} KB · {new Date(doc.uploaded_at).toLocaleDateString('en-AU')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Upload section */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: 1, minWidth: '140px' }}>
                <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-3)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Label</label>
                <input className="input-field" value={docLabel} onChange={e => setDocLabel(e.target.value)} placeholder="e.g. Medical Certificate" style={{ fontSize: '0.8rem' }} />
              </div>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.6rem 0.875rem', background: 'var(--surface-2)', border: '1.5px solid var(--border)', borderRadius: 'var(--r-sm)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-2)', flexShrink: 0, transition: 'all 0.15s ease' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-2)' }}
              >
                {docUploading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={13} />}
                {docUploading ? 'Uploading…' : 'Upload'}
                <input ref={docFileRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={e => uploadDocument(e.target.files?.[0])} disabled={docUploading} />
              </label>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Approved settlement card */}
          {isApproved && (
            <div className="card" style={{ padding: '1.25rem', borderLeft: '3px solid var(--success)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1rem', paddingBottom: '0.875rem', borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'var(--success-bg)', border: '1px solid var(--success-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <DollarSign size={13} color="var(--success)" />
                </div>
                <h2 style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-2)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Settlement</h2>
              </div>
              {[
                { label: 'Claimed Amount',      value: `$${Number(claim.amount).toLocaleString()} AUD` },
                { label: 'Approved Amount',     value: `$${Number(claim.approved_amount ?? claim.amount).toLocaleString()} AUD` },
                { label: 'Excess / Deductible', value: `$${Number(claim.excess ?? 0).toLocaleString()} AUD` },
                { label: 'Net Payout',          value: `$${Number(claim.net_payout ?? 0).toLocaleString()} AUD`, bold: true, color: 'var(--success)' },
              ].map(({ label, value, bold, color }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}>{label}</span>
                  <span style={{ fontSize: bold ? '0.9rem' : '0.82rem', fontWeight: bold ? 800 : 600, color: color || 'var(--text-1)' }}>{value}</span>
                </div>
              ))}
              <div style={{ marginTop: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem', background: claim.payment_status === 'paid' ? 'var(--success-bg)' : 'var(--warning-bg)', borderRadius: 'var(--r-sm)', border: `1px solid ${claim.payment_status === 'paid' ? 'var(--success-border)' : 'var(--warning-border)'}` }}>
                {claim.payment_status === 'paid'
                  ? <><CheckCircle size={13} color="var(--success)" /><span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--success-text)' }}>Payment confirmed on {new Date(claim.paid_at).toLocaleDateString('en-AU', { dateStyle: 'medium' })}</span></>
                  : <><Clock size={13} color="var(--warning)" /><span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--warning-text)' }}>Payment is being processed</span></>
                }
              </div>
            </div>
          )}

          {/* Messages / notes */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1rem', paddingBottom: '0.875rem', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MessageSquare size={13} color="var(--info)" />
              </div>
              <h2 style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-2)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Messages</h2>
            </div>
            <div style={{ maxHeight: '220px', overflowY: 'auto', marginBottom: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {notes.filter(n => !n.is_doc_request).length === 0 ? (
                <p style={{ fontSize: '0.78rem', color: 'var(--text-3)', textAlign: 'center', padding: '0.875rem 0' }}>No messages yet.</p>
              ) : notes.filter(n => !n.is_doc_request).map(n => {
                const isMe = n.author === (user.name || 'Claimant')
                return (
                  <div key={n.id} style={{ display: 'flex', gap: '0.625rem', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                    {!isMe && (
                      <div style={{ width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-2)' }}>
                        {n.author.charAt(0)}
                      </div>
                    )}
                    <div style={{ maxWidth: '75%' }}>
                      <div style={{
                        padding: '0.5rem 0.75rem', borderRadius: isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                        background: isMe ? 'var(--accent)' : 'var(--surface-2)',
                        border: isMe ? 'none' : '1px solid var(--border)',
                      }}>
                        <p style={{ fontSize: '0.8rem', color: isMe ? 'white' : 'var(--text-1)', lineHeight: 1.5 }}>{n.content}</p>
                      </div>
                      <p style={{ fontSize: '0.62rem', color: 'var(--text-3)', marginTop: '0.15rem', textAlign: isMe ? 'right' : 'left' }}>
                        {n.author} · {new Date(n.created_at).toLocaleString('en-AU', { dateStyle: 'short', timeStyle: 'short' })}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
            <form onSubmit={addNote} style={{ display: 'flex', gap: '0.4rem' }}>
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="Send a message to your adjudicator…" className="input-field" style={{ flex: 1, fontSize: '0.8rem' }} />
              <button type="submit" disabled={sendingNote || !note.trim()} style={{ padding: '0.6rem 0.75rem', background: 'var(--accent)', border: 'none', borderRadius: 'var(--r-sm)', cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', fontFamily: 'inherit', opacity: !note.trim() ? 0.4 : 1, flexShrink: 0 }}>
                {sendingNote ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={13} />}
              </button>
            </form>
          </div>

          {/* Claim summary */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1rem', paddingBottom: '0.875rem', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileText size={13} color="var(--text-3)" />
              </div>
              <h2 style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-2)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Summary</h2>
            </div>
            {[
              { label: 'Reference',   value: `#${String(claim.id).padStart(5, '0')}` },
              { label: 'Status',      value: <StatusBadge status={claim.status} /> },
              { label: 'Filed',       value: new Date(claim.created_at).toLocaleDateString('en-AU', { dateStyle: 'long' }) },
              { label: 'Last Update', value: new Date(claim.updated_at).toLocaleDateString('en-AU', { dateStyle: 'medium' }) },
              { label: 'Documents',   value: `${documents.length} uploaded` },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{label}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-1)', fontWeight: 600 }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
