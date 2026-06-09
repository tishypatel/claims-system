import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from '../api'
import {
  ArrowLeft, ClipboardList, FileSearch, Brain, StickyNote, Gavel,
  CheckCircle, XCircle, AlertTriangle, Loader2, Upload, Paperclip,
  Trash2, Send, Sparkles, Shield, DollarSign, Activity, X,
  Check, ChevronRight, ChevronLeft, FileText, User, MapPin,
  MessageSquare, RefreshCw,
} from 'lucide-react'
import StatusBadge from '../components/StatusBadge'
import { useToast } from '../components/Toast'

/* ─── Constants ──────────────────────────────────────────────── */

const STAGES = [
  { num: 1, key: 'intake',     title: 'Intake',     icon: ClipboardList },
  { num: 2, key: 'documents',  title: 'Documents',  icon: FileSearch },
  { num: 3, key: 'ai_triage',  title: 'AI Triage',  icon: Brain },
  { num: 4, key: 'assessment', title: 'Assessment', icon: StickyNote },
  { num: 5, key: 'decision',   title: 'Decision',   icon: Gavel },
]

const CLAIM_TYPE_LABELS = {
  motor: 'Motor / Vehicle', property: 'Property Damage', liability: 'Public Liability',
  workers_comp: "Workers' Compensation", health: 'Health / Medical', travel: 'Travel',
}

const RISK_CONFIG = {
  low:    { color: 'var(--success)', bg: 'var(--success-bg)', border: 'var(--success-border)', label: 'Low Risk' },
  medium: { color: 'var(--warning)', bg: 'var(--warning-bg)', border: 'var(--warning-border)', label: 'Medium Risk' },
  high:   { color: 'var(--danger)',  bg: 'var(--danger-bg)',  border: 'var(--danger-border)',  label: 'High Risk' },
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

const AI_STEPS = [
  { icon: Activity,  label: 'Scanning claim data…' },
  { icon: Shield,    label: 'Running fraud & triage analysis (parallel)…' },
  { icon: Brain,     label: 'Processing results…' },
  { icon: Check,     label: 'Analysis complete!' },
]

/* ─── Sub-components ─────────────────────────────────────────── */

function ApprovalGauge({ value, size = 160 }) {
  const r             = size * 0.37
  const circumference = 2 * Math.PI * r
  const safeVal       = Math.min(100, Math.max(0, value ?? 0))
  const offset        = circumference * (1 - safeVal / 100)
  const color         = safeVal >= 65 ? 'var(--success)' : safeVal >= 35 ? 'var(--warning)' : 'var(--danger)'
  const cx = size / 2, cy = size / 2

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth="9" />
        <circle
          cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="9"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'stroke-dashoffset 1.2s ease, stroke 0.3s ease' }}
        />
      </svg>
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
        <div style={{ fontSize: size > 130 ? '1.75rem' : '1.25rem', fontWeight: 800, color, lineHeight: 1 }}>
          {value != null ? `${value}%` : '—'}
        </div>
        <div style={{ fontSize: '0.58rem', color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.07em', marginTop: '3px' }}>APPROVAL</div>
      </div>
    </div>
  )
}

function InfoRow({ label, value, mono }) {
  return (
    <div>
      <dt style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.2rem' }}>{label}</dt>
      <dd style={{ fontSize: '0.875rem', color: 'var(--text-1)', fontWeight: 500, fontFamily: mono ? 'monospace' : undefined }}>{value || '—'}</dd>
    </div>
  )
}

function StageCard({ title, icon: Icon, accent = 'var(--accent)', children }) {
  return (
    <div className="card" style={{ padding: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1rem', paddingBottom: '0.875rem', borderBottom: '1px solid var(--border)' }}>
        <div style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={13} color={accent} />
        </div>
        <h3 style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-2)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{title}</h3>
      </div>
      {children}
    </div>
  )
}

/* ─── Main component ─────────────────────────────────────────── */

export default function AdjusterWorkflow() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const toast    = useToast()
  const user     = JSON.parse(localStorage.getItem('claims_user') || '{}')
  const docFileRef = useRef(null)

  // Core data
  const [claim,     setClaim]     = useState(null)
  const [notes,     setNotes]     = useState([])
  const [documents, setDocuments] = useState([])
  const [loading,   setLoading]   = useState(true)

  // Workflow progress
  const [currentStage, setCurrentStage] = useState(1)
  const [completed,    setCompleted]    = useState(new Set())

  // Stage 2 — documents
  const [docVerified,  setDocVerified]  = useState({})
  const [docLabel,     setDocLabel]     = useState('')
  const [docUploading, setDocUploading] = useState(false)

  // Stage 2 — doc request note
  const [docReqText,   setDocReqText]   = useState('')
  const [sendingDocReq, setSendingDocReq] = useState(false)

  // Stage 3 — AI triage
  const [aiStep,    setAiStep]    = useState(-1)   // -1 not started, 0-3 step index
  const [aiRunning, setAiRunning] = useState(false)
  const [triageRan, setTriageRan] = useState(false)
  const [aiElapsed, setAiElapsed] = useState(0)    // seconds elapsed while running
  const aiTimerRef = useRef(null)

  // Stage 4 — assessment
  const [assessmentNote, setAssessmentNote] = useState('')
  const [note,           setNote]           = useState('')
  const [sendingNote,    setSendingNote]    = useState(false)
  const [suggestion,     setSuggestion]     = useState(null)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [approvedAmt,    setApprovedAmt]    = useState('')
  const [excess,         setExcess]         = useState('0')

  // Stage 5 — decision
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  /* ── Data loading ──────────────────────────────────────────── */

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
      if (c.data.approved_amount != null) setApprovedAmt(String(c.data.approved_amount))
      if (c.data.excess != null) setExcess(String(c.data.excess))
      if (c.data.triage || c.data.fraud_score) setTriageRan(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const savedStage     = localStorage.getItem(`wf_stage_${id}`)
    const savedCompleted = localStorage.getItem(`wf_completed_${id}`)
    if (savedStage)     setCurrentStage(Number(savedStage))
    if (savedCompleted) setCompleted(new Set(JSON.parse(savedCompleted)))
  }, [id])

  /* ── Workflow navigation ───────────────────────────────────── */

  function saveWF(stage, comp) {
    localStorage.setItem(`wf_stage_${id}`, String(stage))
    localStorage.setItem(`wf_completed_${id}`, JSON.stringify([...comp]))
    // Persist to backend (non-blocking)
    axios.patch(`/api/claims/${id}/workflow-stage`, { stage, updated_by: user.name }).catch(() => {})
  }

  function advanceStage() {
    const next = currentStage + 1
    const comp = new Set([...completed, currentStage])
    setCompleted(comp)
    setCurrentStage(next)
    saveWF(next, comp)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function goBack() {
    if (currentStage <= 1) return
    const prev = currentStage - 1
    setCurrentStage(prev)
    saveWF(prev, completed)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function goToStage(n) {
    if (n === currentStage) return
    if (n < currentStage || completed.has(n - 1) || completed.has(n)) {
      setCurrentStage(n)
      saveWF(n, completed)
    }
  }

  function canAdvance() {
    if (currentStage === 1) return true
    if (currentStage === 2) return true
    // Use actual claim data — not triageRan — so navigating back still allows advance
    if (currentStage === 3) return !!(claim?.triage || claim?.fraud_score) || triageRan
    if (currentStage === 4) return assessmentNote.trim().length > 0
    return false
  }

  /* ── AI calls ──────────────────────────────────────────────── */

  async function runAIAnalysis() {
    setAiRunning(true)
    setAiElapsed(0)
    setAiStep(0)

    let secs = 0
    aiTimerRef.current = setInterval(() => { secs += 1; setAiElapsed(secs) }, 1000)

    try {
      await new Promise(r => setTimeout(r, 400))
      setAiStep(1)

      // Hold the connection open until the AI finishes (both calls run in parallel
      // on the server). 5-minute axios timeout — no browser limit on fetch duration.
      const { data: result } = await axios.post(
        `/api/claims/${id}/start-analysis`,
        {},
        { timeout: 300000 },   // 5 minutes
      )

      if (result.status === 'error') {
        throw new Error(result.error || 'Server-side analysis error.')
      }

      setAiStep(2)
      // Cache-bust the reload so we always get fresh data
      await axios.get(`/api/claims/${id}?_t=${Date.now()}`)
      await load(true)
      setAiStep(4)   // 4 > 3 so all steps show green checkmarks
      setTriageRan(true)
      toast('AI analysis complete!', 'success')
    } catch (err) {
      const msg = err.code === 'ECONNABORTED'
        ? 'The analysis is taking longer than expected. Please wait a moment and try again.'
        : (err.message || 'AI analysis failed. Please try again.')
      toast(msg, 'error')
      setAiStep(-1)
    } finally {
      clearInterval(aiTimerRef.current)
      setAiRunning(false)
    }
  }

  async function getAISuggestion() {
    setSuggestLoading(true)
    try {
      const res = await axios.post(`/api/claims/${id}/suggest-decision`)
      setSuggestion(res.data)
      if (res.data.reason) setReason(res.data.reason)
      if (res.data.suggested_approved_amount != null) setApprovedAmt(String(res.data.suggested_approved_amount))
      if (res.data.suggested_excess != null) setExcess(String(res.data.suggested_excess))
      toast('AI suggestion ready.', 'info')
    } catch (err) {
      toast(err.response?.data?.error || 'AI suggestion failed.', 'error')
    } finally {
      setSuggestLoading(false)
    }
  }

  /* ── Notes & Documents ─────────────────────────────────────── */

  async function sendDocRequest(e) {
    e.preventDefault()
    if (!docReqText.trim()) return
    setSendingDocReq(true)
    try {
      await axios.post(`/api/claims/${id}/notes`, {
        author: user.name || 'Adjudicator',
        content: docReqText,
        is_doc_request: true,
      })
      setDocReqText('')
      load(true)
      toast('Document request sent to claimant.', 'success')
    } catch { toast('Failed to send request.', 'error') }
    finally { setSendingDocReq(false) }
  }

  async function addNote(e) {
    e.preventDefault()
    if (!note.trim()) return
    setSendingNote(true)
    try {
      await axios.post(`/api/claims/${id}/notes`, { author: user.name || 'Adjudicator', content: note })
      setNote('')
      load(true)
      toast('Note added.', 'success')
    } catch { toast('Failed to add note.', 'error') }
    finally { setSendingNote(false) }
  }

  async function uploadDocument(file) {
    if (!file) return
    setDocUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('uploaded_by', user.name || 'Adjudicator')
      fd.append('label', docLabel || file.name)
      await axios.post(`/api/claims/${id}/documents`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setDocLabel('')
      if (docFileRef.current) docFileRef.current.value = ''
      load(true)
      toast('Document uploaded.', 'success')
    } catch { toast('Upload failed.', 'error') }
    finally { setDocUploading(false) }
  }

  async function deleteDocument(docId) {
    try {
      await axios.delete(`/api/documents/doc/${docId}`)
      load(true)
      toast('Document removed.', 'info')
    } catch { toast('Failed to remove.', 'error') }
  }

  /* ── Decision ──────────────────────────────────────────────── */

  async function submitDecision(status) {
    if (!reason.trim() || saving) return
    setSaving(true)
    try {
      await axios.patch(`/api/claims/${id}/status`, {
        status, reason, updated_by: user.name || 'Adjudicator',
        approved_amount: approvedAmt ? Number(approvedAmt) : undefined,
        excess: Number(excess || 0),
      })
      const comp = new Set([...completed, 5])
      setCompleted(comp)
      localStorage.removeItem(`wf_stage_${id}`)
      localStorage.removeItem(`wf_completed_${id}`)
      toast(
        `Claim ${status === 'approved' ? 'approved' : 'rejected'} successfully.`,
        status === 'approved' ? 'success' : 'warning',
      )
      load(true)
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to submit decision.', 'error')
    } finally {
      setSaving(false)
    }
  }

  /* ══════════════════════════════════════════════════════════════
     STAGE RENDERERS
  ══════════════════════════════════════════════════════════════ */

  function renderStage1() {
    const checks = [
      { label: 'Claimant name & contact info', ok: !!(claim.claimant_name && claim.claimant_email) },
      { label: 'Policy number provided',       ok: !!claim.policy_number },
      { label: 'Incident details complete',    ok: !!(claim.incident_date && claim.location && claim.incident_description) },
      { label: 'Claim amount specified',       ok: claim.amount > 0 },
    ]
    const allOk = checks.every(c => c.ok)

    return (
      <div className="two-col-grid">
        {/* Left: claim info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <StageCard title="Claimant Information" icon={User}>
            <dl className="info-grid-2">
              <InfoRow label="Full Name"     value={claim.claimant_name} />
              <InfoRow label="Email"         value={claim.claimant_email} />
              <InfoRow label="Phone"         value={claim.claimant_phone} />
              <InfoRow label="Policy Number" value={claim.policy_number} mono />
            </dl>
          </StageCard>

          <StageCard title="Incident Details" icon={MapPin} accent="var(--warning)">
            <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem 1.25rem', marginBottom: '0.875rem' }}>
              <InfoRow label="Claim Type"    value={CLAIM_TYPE_LABELS[claim.claim_type] || claim.claim_type} />
              <InfoRow label="Incident Date" value={new Date(claim.incident_date).toLocaleDateString('en-AU', { dateStyle: 'long' })} />
              <InfoRow label="Location"      value={claim.location} />
              <InfoRow label="Amount"        value={`$${Number(claim.amount).toLocaleString()} AUD`} />
            </dl>
            <div>
              <p style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>Description</p>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-2)', lineHeight: 1.7, padding: '0.75rem', background: 'var(--surface-2)', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)' }}>
                {claim.incident_description}
              </p>
            </div>
          </StageCard>
        </div>

        {/* Right: validation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <StageCard title="Intake Validation" icon={CheckCircle} accent={allOk ? 'var(--success)' : 'var(--warning)'}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
              {checks.map((c, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '0.625rem',
                  padding: '0.575rem 0.75rem',
                  background: c.ok ? 'var(--success-bg)' : 'var(--danger-bg)',
                  border: `1px solid ${c.ok ? 'var(--success-border)' : 'var(--danger-border)'}`,
                  borderRadius: 'var(--r-sm)',
                }}>
                  {c.ok
                    ? <CheckCircle size={13} color="var(--success)" style={{ flexShrink: 0 }} />
                    : <XCircle    size={13} color="var(--danger)"  style={{ flexShrink: 0 }} />
                  }
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: c.ok ? 'var(--success-text)' : 'var(--danger-text)' }}>
                    {c.label}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ padding: '0.75rem', background: allOk ? 'var(--success-bg)' : 'var(--warning-bg)', border: `1px solid ${allOk ? 'var(--success-border)' : 'var(--warning-border)'}`, borderRadius: 'var(--r-sm)' }}>
              <p style={{ fontSize: '0.78rem', fontWeight: 700, color: allOk ? 'var(--success-text)' : 'var(--warning-text)' }}>
                {allOk ? '✓ All fields validated — ready to proceed' : '⚠ Some fields require attention before proceeding'}
              </p>
            </div>
          </StageCard>

          <StageCard title="Claim Meta" icon={FileText} accent="var(--text-3)">
            {[
              { label: 'Claim ID',  value: `#${String(claim.id).padStart(5, '0')}` },
              { label: 'Priority',  value: claim.priority ? claim.priority.charAt(0).toUpperCase() + claim.priority.slice(1) : '—' },
              { label: 'Filed',     value: new Date(claim.created_at).toLocaleDateString('en-AU', { dateStyle: 'long' }) },
              {
                label: 'SLA Due',
                value: claim.sla_due ? (() => {
                  const days = Math.ceil((new Date(claim.sla_due) - Date.now()) / 86400000)
                  return (
                    <span style={{ color: days < 0 ? 'var(--danger)' : days <= 2 ? 'var(--warning)' : 'var(--success)', fontWeight: 700 }}>
                      {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d remaining`}
                    </span>
                  )
                })() : '—',
              },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{label}</span>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-1)', fontWeight: 600 }}>{value}</span>
              </div>
            ))}
          </StageCard>
        </div>
      </div>
    )
  }

  function renderStage2() {
    const verifiedCount = Object.values(docVerified).filter(Boolean).length

    return (
      <div className="two-col-grid">
        {/* Left: doc list */}
        <StageCard title="Supporting Documents" icon={Paperclip} accent="var(--info)">
          {documents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
              <Paperclip size={28} color="var(--text-3)" style={{ margin: '0 auto 0.625rem', display: 'block' }} />
              <p style={{ fontSize: '0.82rem', color: 'var(--text-2)', fontWeight: 600 }}>No documents attached</p>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>Upload documents using the panel on the right.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {documents.map(doc => (
                <div key={doc.id} style={{
                  display: 'flex', alignItems: 'center', gap: '0.625rem',
                  padding: '0.625rem 0.75rem',
                  background: docVerified[doc.id] ? 'var(--success-bg)' : 'var(--surface-2)',
                  border: `1px solid ${docVerified[doc.id] ? 'var(--success-border)' : 'var(--border)'}`,
                  borderRadius: 'var(--r-sm)', transition: 'all 0.2s ease',
                }}>
                  <FileText size={13} color={docVerified[doc.id] ? 'var(--success)' : 'var(--accent)'} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {doc.label || doc.original_name}
                    </p>
                    <p style={{ fontSize: '0.68rem', color: 'var(--text-3)' }}>{(doc.size / 1024).toFixed(1)} KB · {doc.uploaded_by}</p>
                  </div>
                  <button
                    onClick={() => setDocVerified(prev => ({ ...prev, [doc.id]: !prev[doc.id] }))}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
                      padding: '0.22rem 0.5rem', borderRadius: '99px',
                      fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                      background: docVerified[doc.id] ? 'var(--success-bg)' : 'var(--surface)',
                      color: docVerified[doc.id] ? 'var(--success)' : 'var(--text-3)',
                      border: `1px solid ${docVerified[doc.id] ? 'var(--success-border)' : 'var(--border)'}`,
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {docVerified[doc.id] ? <><Check size={10} /> Verified</> : 'Verify'}
                  </button>
                  <button
                    onClick={() => deleteDocument(doc.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: '0.2rem', flexShrink: 0 }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {documents.length > 0 && (
            <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: 'var(--surface-2)', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>Verified</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: verifiedCount === documents.length && documents.length > 0 ? 'var(--success)' : 'var(--accent)' }}>
                {verifiedCount} / {documents.length}
              </span>
            </div>
          )}
        </StageCard>

        {/* Right: upload + status */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <StageCard title="Upload Document" icon={Upload} accent="var(--accent)">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-3)', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Document Label</label>
                <input className="input-field" value={docLabel} onChange={e => setDocLabel(e.target.value)} placeholder="e.g. Police Report, Medical Certificate" style={{ fontSize: '0.82rem' }} />
              </div>
              <label
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  padding: '0.875rem', cursor: 'pointer',
                  background: 'var(--surface-2)', border: '2px dashed var(--border)',
                  borderRadius: 'var(--r-md)', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-2)',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-2)' }}
              >
                {docUploading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={14} />}
                {docUploading ? 'Uploading…' : 'Choose file to upload'}
                <input ref={docFileRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={e => uploadDocument(e.target.files?.[0])} disabled={docUploading} />
              </label>
            </div>
          </StageCard>

          <StageCard title="Review Status" icon={CheckCircle} accent={verifiedCount === documents.length && documents.length > 0 ? 'var(--success)' : 'var(--warning)'}>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-2)', lineHeight: 1.6, marginBottom: '0.875rem' }}>
              Review all supporting documents and mark each as verified. You can proceed even if some documents are pending.
            </p>
            {[
              { label: 'Total documents',  value: documents.length, color: 'var(--text-1)' },
              { label: 'Verified',         value: verifiedCount, color: 'var(--success)' },
              { label: 'Pending review',   value: documents.length - verifiedCount, color: documents.length - verifiedCount > 0 ? 'var(--warning)' : 'var(--success)' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.45rem 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{label}</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color }}>{value}</span>
              </div>
            ))}
          </StageCard>

          <StageCard title="Request Missing Documents" icon={MessageSquare} accent="var(--warning)">
            <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: '0.625rem', lineHeight: 1.5 }}>
              Send a document request to the claimant. They'll see it highlighted in their portal.
            </p>
            {notes.filter(n => n.is_doc_request).length > 0 && (
              <div style={{ marginBottom: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {notes.filter(n => n.is_doc_request).map(n => (
                  <div key={n.id} style={{ padding: '0.5rem 0.75rem', background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', borderRadius: 'var(--r-sm)', fontSize: '0.75rem', color: 'var(--warning-text)' }}>
                    <span style={{ fontWeight: 600 }}>{n.author}:</span> {n.content}
                  </div>
                ))}
              </div>
            )}
            <form onSubmit={sendDocRequest} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <textarea
                value={docReqText}
                onChange={e => setDocReqText(e.target.value)}
                placeholder="e.g. Please upload a copy of the police report dated after the incident…"
                className="input-field"
                style={{ minHeight: '70px', resize: 'none', fontSize: '0.8rem', lineHeight: 1.5 }}
              />
              <button type="submit" disabled={sendingDocReq || !docReqText.trim()}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.5rem', background: 'var(--warning-bg)', border: '1.5px solid var(--warning-border)', borderRadius: 'var(--r-sm)', color: 'var(--warning-text)', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: !docReqText.trim() ? 0.4 : 1 }}
              >
                {sendingDocReq ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={12} />}
                Send Request to Claimant
              </button>
            </form>
          </StageCard>
        </div>
      </div>
    )
  }

  function renderStage3() {
    const riskCfg    = claim.fraud_score ? RISK_CONFIG[claim.fraud_score] : null
    const triageCfg  = claim.triage?.complexity ? TRIAGE_CONFIG[claim.triage.complexity] : null
    const outcomeCfg = claim.triage?.predicted_outcome ? OUTCOME_CONFIG[claim.triage.predicted_outcome] : null
    const prob       = claim.triage?.approval_probability

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* AI pipeline card */}
        <div className="card" style={{ padding: '1.375rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: aiStep >= 0 || triageRan ? '1.25rem' : 0 }}>
            <div>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-1)', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Brain size={15} color="var(--accent)" /> AI Analysis Pipeline
              </h3>
              <div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-3)', marginBottom: '0.25rem' }}>
                  {triageRan
                    ? 'Analysis complete — results shown below. Re-run to refresh.'
                    : 'Run fraud detection + triage assessment powered by NVIDIA AI.'}
                </p>
                {aiRunning && (
                  <p style={{ fontSize: '0.72rem', color: 'var(--warning)', fontWeight: 600 }}>
                    ⏳ NVIDIA AI running analysis… {aiElapsed > 0 ? `(${aiElapsed}s elapsed)` : ''}
                  </p>
                )}
                {!aiRunning && !triageRan && (
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>
                    ℹ️ Analysis runs in the background — results appear automatically when ready.
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={runAIAnalysis}
              disabled={aiRunning}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.6rem 1.1rem',
                background: aiRunning ? 'var(--surface-2)' : 'var(--accent)',
                border: 'none', borderRadius: 'var(--r-sm)',
                color: aiRunning ? 'var(--text-3)' : 'white',
                fontSize: '0.82rem', fontWeight: 700, cursor: aiRunning ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', transition: 'all 0.15s ease', flexShrink: 0,
              }}
            >
              {aiRunning ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Brain size={13} />}
              {aiRunning ? `Running… ${aiElapsed > 0 ? `(${aiElapsed}s)` : ''}` : triageRan ? 'Re-run Analysis' : 'Run AI Analysis'}
            </button>
          </div>

          {/* Step progress */}
          {aiStep >= 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              {AI_STEPS.map((step, i) => {
                const isActive = aiStep === i
                const isDone   = aiStep > i
                const Icon     = step.icon
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.575rem 0.875rem',
                    background: isDone ? 'var(--success-bg)' : isActive ? 'var(--accent-bg)' : 'var(--surface-2)',
                    border: `1px solid ${isDone ? 'var(--success-border)' : isActive ? 'var(--accent-border)' : 'var(--border)'}`,
                    borderRadius: 'var(--r-sm)', transition: 'all 0.3s ease',
                    opacity: !isDone && !isActive ? 0.4 : 1,
                  }}>
                    <div style={{
                      width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: isDone ? 'var(--success)' : isActive ? 'var(--accent)' : 'var(--surface)',
                      border: `1.5px solid ${isDone ? 'var(--success)' : isActive ? 'var(--accent)' : 'var(--border)'}`,
                    }}>
                      {isDone
                        ? <Check size={11} color="white" />
                        : isActive
                        ? <Loader2 size={11} color="white" style={{ animation: 'spin 1s linear infinite' }} />
                        : <Icon size={11} color="var(--text-3)" />
                      }
                    </div>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: isDone ? 'var(--success-text)' : isActive ? 'var(--accent-text)' : 'var(--text-3)' }}>
                      {step.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Results grid — show whenever claim has analysis data (persists across navigation) */}
        {(claim.triage || claim.fraud_score) && (
          <div className="two-col-grid">
            {/* Left: fraud + triage */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <StageCard title="Fraud Detection" icon={Shield} accent={riskCfg?.color || 'var(--text-3)'}>
                {riskCfg ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem', background: riskCfg.bg, border: `1px solid ${riskCfg.border}`, borderRadius: 'var(--r-sm)', marginBottom: '0.875rem' }}>
                      <Shield size={20} color={riskCfg.color} style={{ flexShrink: 0 }} />
                      <div>
                        <p style={{ fontSize: '1rem', fontWeight: 800, color: riskCfg.color }}>{riskCfg.label}</p>
                        {claim.fraud_confidence != null && (
                          <p style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginTop: '0.1rem' }}>{claim.fraud_confidence}% model confidence</p>
                        )}
                      </div>
                    </div>
                    {claim.fraud_summary && (
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-2)', lineHeight: 1.6, marginBottom: '0.75rem' }}>{claim.fraud_summary}</p>
                    )}
                    {claim.fraud_flags?.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <p style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>Flags</p>
                        {claim.fraud_flags.map((f, i) => (
                          <div key={i} style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-start' }}>
                            <AlertTriangle size={11} color="var(--warning)" style={{ flexShrink: 0, marginTop: '2px' }} />
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>{f}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-3)', textAlign: 'center', padding: '1rem' }}>Fraud analysis not available.</p>
                )}
              </StageCard>

              {claim.triage && (
                <StageCard title="Triage Assessment" icon={Brain} accent="var(--info)">
                  {[
                    { label: 'Complexity',   value: triageCfg ? <span style={{ padding: '0.15rem 0.5rem', borderRadius: '99px', fontSize: '0.72rem', fontWeight: 700, color: triageCfg.color, background: triageCfg.bg }}>{triageCfg.label}</span> : '—' },
                    { label: 'Outcome',      value: outcomeCfg ? <span style={{ fontSize: '0.82rem', fontWeight: 700, color: outcomeCfg.color }}>{outcomeCfg.label}</span> : '—' },
                    { label: 'Est. Days',    value: claim.triage.estimated_processing_days ? `${claim.triage.estimated_processing_days} days` : '—' },
                    { label: 'Handler',      value: claim.triage.recommended_handler || '—' },
                    { label: 'Confidence',   value: claim.triage.confidence != null ? `${claim.triage.confidence}%` : '—' },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.45rem 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{label}</span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-1)', fontWeight: 600 }}>{value}</span>
                    </div>
                  ))}
                  {claim.triage.reasoning && (
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-2)', lineHeight: 1.6, marginTop: '0.75rem', padding: '0.625rem 0.75rem', background: 'var(--info-bg)', borderRadius: 'var(--r-sm)', border: '1px solid var(--info-border)' }}>
                      {claim.triage.reasoning}
                    </p>
                  )}
                </StageCard>
              )}
            </div>

            {/* Right: gauge + reasoning */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <StageCard title="Approval Probability" icon={Activity} accent={prob >= 65 ? 'var(--success)' : prob >= 35 ? 'var(--warning)' : 'var(--danger)'}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '0.5rem 0' }}>
                  <ApprovalGauge value={prob} size={170} />
                  {claim.triage?.key_factors?.length > 0 && (
                    <div style={{ width: '100%' }}>
                      <p style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Key Factors</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        {claim.triage.key_factors.map((f, i) => (
                          <div key={i} style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-start' }}>
                            <span style={{ color: 'var(--accent)', fontWeight: 700, flexShrink: 0, fontSize: '0.8rem' }}>·</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>{f}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </StageCard>

              {claim.fraud_reasoning?.length > 0 && (
                <StageCard title="Fraud Reasoning Chain" icon={Activity} accent="var(--text-3)">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {claim.fraud_reasoning.map((step, i) => (
                      <div key={i} style={{ display: 'flex', gap: '0.625rem', alignItems: 'flex-start' }}>
                        <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: 'var(--accent-text)' }}>{i + 1}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-2)', lineHeight: 1.5 }}>{step}</span>
                      </div>
                    ))}
                  </div>
                </StageCard>
              )}
            </div>
          </div>
        )}

        {!claim.triage && !claim.fraud_score && aiStep < 0 && (
          <div className="card" style={{ padding: '3.5rem', textAlign: 'center' }}>
            <Brain size={40} color="var(--text-3)" style={{ margin: '0 auto 0.875rem', display: 'block', opacity: 0.5 }} />
            <p style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-2)', marginBottom: '0.35rem' }}>No AI analysis yet</p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>Click "Run AI Analysis" above to start the automated fraud and triage assessment.</p>
          </div>
        )}
      </div>
    )
  }

  function renderStage4() {
    return (
      <div className="two-col-grid">
        {/* Left: AI suggestion + settlement */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <StageCard title="AI Decision Suggestion" icon={Sparkles} accent="var(--accent)">
            <button
              onClick={getAISuggestion}
              disabled={suggestLoading}
              style={{
                width: '100%', padding: '0.6rem',
                background: 'var(--accent-bg)', border: '1.5px solid var(--accent-border)',
                borderRadius: 'var(--r-sm)', color: 'var(--accent-text)',
                fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', marginBottom: suggestion ? '0.875rem' : 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                opacity: suggestLoading ? 0.6 : 1, fontFamily: 'inherit',
              }}
            >
              {suggestLoading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={13} />}
              {suggestion ? 'Refresh AI Suggestion' : 'Get AI Decision Suggestion'}
            </button>

            {suggestion && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-3)', flex: 1 }}>Recommendation</span>
                  <span style={{
                    fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.55rem', borderRadius: '99px',
                    ...(suggestion.recommendation === 'approve'
                      ? { color: 'var(--success)', background: 'var(--success-bg)' }
                      : suggestion.recommendation === 'reject'
                      ? { color: 'var(--danger)', background: 'var(--danger-bg)' }
                      : { color: 'var(--warning)', background: 'var(--warning-bg)' }),
                  }}>
                    {suggestion.recommendation === 'approve' ? '✓ Approve' : suggestion.recommendation === 'reject' ? '✗ Reject' : '⚠ Investigate'}
                  </span>
                </div>

                {suggestion.confidence_percentage != null && (
                  <div style={{ marginBottom: '0.625rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                      <span style={{ fontSize: '0.62rem', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI Confidence</span>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent)' }}>{suggestion.confidence_percentage}%</span>
                    </div>
                    <div style={{ height: '4px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${suggestion.confidence_percentage}%`, background: 'var(--accent)', borderRadius: '99px', transition: 'width 0.8s ease' }} />
                    </div>
                  </div>
                )}

                {suggestion.reason && (
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-2)', lineHeight: 1.6, padding: '0.625rem 0.75rem', background: 'var(--surface-2)', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', marginBottom: '0.625rem' }}>
                    {suggestion.reason}
                  </p>
                )}

                {suggestion.key_considerations?.length > 0 && (
                  <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '0.5rem' }}>
                    {suggestion.key_considerations.map((c, i) => (
                      <li key={i} style={{ fontSize: '0.75rem', color: 'var(--text-2)', display: 'flex', gap: '0.35rem', alignItems: 'flex-start' }}>
                        <span style={{ color: 'var(--accent)', flexShrink: 0, fontWeight: 700 }}>·</span>{c}
                      </li>
                    ))}
                  </ul>
                )}

                <button onClick={() => setSuggestion(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: '0.7rem', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <X size={10} /> Dismiss
                </button>
              </div>
            )}

            {!suggestion && !suggestLoading && (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', textAlign: 'center', padding: '0.75rem 0', marginTop: '0.5rem' }}>
                AI will analyse all claim data, fraud scores, and triage results to generate a recommendation.
              </p>
            )}
          </StageCard>

          <StageCard title="Recommended Settlement" icon={DollarSign} accent="var(--success)">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.625rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-3)', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Approved Amount</label>
                <input type="number" min="0" step="0.01" value={approvedAmt} onChange={e => setApprovedAmt(e.target.value)} placeholder={String(claim.amount)} className="input-field" style={{ fontSize: '0.82rem' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-3)', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Excess / Deductible</label>
                <input type="number" min="0" step="0.01" value={excess} onChange={e => setExcess(e.target.value)} className="input-field" style={{ fontSize: '0.82rem' }} />
              </div>
            </div>
            {approvedAmt && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 'var(--r-sm)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--success-text)', fontWeight: 600 }}>Net Payout</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--success)' }}>
                  ${Math.max(0, Number(approvedAmt) - Number(excess || 0)).toLocaleString()} AUD
                </span>
              </div>
            )}
          </StageCard>
        </div>

        {/* Right: assessment + notes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <StageCard title="Adjudicator Assessment" icon={StickyNote} accent="var(--warning)">
            <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: '0.5rem', lineHeight: 1.5 }}>
              Write your professional assessment. This is required to proceed to the decision stage.
            </p>
            <textarea
              value={assessmentNote}
              onChange={e => setAssessmentNote(e.target.value)}
              placeholder="Document your assessment — key observations, concerns, supporting evidence, and professional judgement…"
              className="input-field"
              style={{ minHeight: '130px', resize: 'none', fontSize: '0.82rem', lineHeight: 1.6, marginBottom: '0.5rem' }}
            />
            {assessmentNote.trim() ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.72rem', color: 'var(--success)', fontWeight: 600 }}>
                <Check size={12} /> Assessment recorded — ready for Stage 5
              </div>
            ) : (
              <p style={{ fontSize: '0.72rem', color: 'var(--warning)', fontWeight: 600 }}>⚠ Required to advance to Decision stage</p>
            )}
          </StageCard>

          <StageCard title="Internal Notes" icon={MessageSquare} accent="var(--info)">
            <div style={{ maxHeight: '180px', overflowY: 'auto', marginBottom: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {notes.length === 0 ? (
                <p style={{ fontSize: '0.78rem', color: 'var(--text-3)', textAlign: 'center', padding: '0.75rem 0' }}>No notes yet.</p>
              ) : notes.map(n => (
                <div key={n.id} style={{ display: 'flex', gap: '0.625rem' }}>
                  <div style={{ width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-2)' }}>
                    {n.author.charAt(0)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginBottom: '0.15rem' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-1)' }}>{n.author}</span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-3)' }}>{new Date(n.created_at).toLocaleString('en-AU', { dateStyle: 'short', timeStyle: 'short' })}</span>
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-2)', lineHeight: 1.5 }}>{n.content}</p>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={addNote} style={{ display: 'flex', gap: '0.4rem' }}>
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="Add a note…" className="input-field" style={{ flex: 1, fontSize: '0.8rem' }} />
              <button type="submit" disabled={sendingNote || !note.trim()} style={{ padding: '0.6rem 0.75rem', background: 'var(--accent)', border: 'none', borderRadius: 'var(--r-sm)', cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', fontFamily: 'inherit', opacity: !note.trim() ? 0.4 : 1, flexShrink: 0 }}>
                {sendingNote ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={13} />}
              </button>
            </form>
          </StageCard>
        </div>
      </div>
    )
  }

  function renderStage5() {
    const isDecidedFinal = ['approved', 'rejected', 'closed'].includes(claim.status)

    if (isDecidedFinal) {
      const isApproved = claim.status === 'approved'
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', alignItems: 'center', padding: '2rem 0' }}>
          <div className="card" style={{ padding: '2.5rem', textAlign: 'center', maxWidth: '520px', width: '100%' }}>
            {isApproved
              ? <CheckCircle size={52} color="var(--success)" style={{ margin: '0 auto 1rem', display: 'block' }} />
              : <XCircle    size={52} color="var(--danger)"  style={{ margin: '0 auto 1rem', display: 'block' }} />
            }
            <h2 style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--text-1)', marginBottom: '0.5rem' }}>
              Claim {claim.status.charAt(0).toUpperCase() + claim.status.slice(1)}
            </h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-2)', lineHeight: 1.7, marginBottom: '1rem' }}>{claim.decision_reason}</p>
            {claim.decided_by && <p style={{ fontSize: '0.78rem', color: 'var(--text-3)', marginBottom: '1rem' }}>— {claim.decided_by}</p>}
            {isApproved && claim.net_payout != null && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1.25rem', background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 'var(--r-md)' }}>
                <DollarSign size={15} color="var(--success)" />
                <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--success)' }}>${Number(claim.net_payout).toLocaleString()} AUD net payout</span>
              </div>
            )}
          </div>
          <button onClick={() => navigate('/dashboard')} className="btn-primary">
            <ArrowLeft size={13} /> Back to Dashboard
          </button>
        </div>
      )
    }

    const riskCfg    = claim.fraud_score ? RISK_CONFIG[claim.fraud_score] : null
    const triageCfg  = claim.triage?.complexity ? TRIAGE_CONFIG[claim.triage.complexity] : null
    const outcomeCfg = claim.triage?.predicted_outcome ? OUTCOME_CONFIG[claim.triage.predicted_outcome] : null
    const prob       = claim.triage?.approval_probability
    const netPayout  = approvedAmt ? Math.max(0, Number(approvedAmt) - Number(excess || 0)) : null

    return (
      <div className="two-col-grid">
        {/* Left: summary + settlement */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <StageCard title="Case Summary" icon={FileText} accent="var(--text-3)">
            {[
              { label: 'Claim ID',   value: `#${String(claim.id).padStart(5, '0')}` },
              { label: 'Claimant',   value: claim.claimant_name },
              { label: 'Type',       value: CLAIM_TYPE_LABELS[claim.claim_type] || claim.claim_type },
              { label: 'Amount',     value: `$${Number(claim.amount).toLocaleString()} AUD` },
              { label: 'Fraud Risk', value: riskCfg ? <span style={{ fontWeight: 700, color: riskCfg.color }}>{riskCfg.label}</span> : <span style={{ color: 'var(--text-3)' }}>Not assessed</span> },
              { label: 'Triage',     value: triageCfg ? <span style={{ padding: '0.15rem 0.5rem', borderRadius: '99px', fontSize: '0.72rem', fontWeight: 700, color: triageCfg.color, background: triageCfg.bg }}>{triageCfg.label}</span> : <span style={{ color: 'var(--text-3)' }}>—</span> },
              { label: 'AI Outlook', value: outcomeCfg ? <span style={{ fontWeight: 700, color: outcomeCfg.color }}>{outcomeCfg.label}</span> : <span style={{ color: 'var(--text-3)' }}>—</span> },
              { label: 'Documents',  value: `${documents.length} attached` },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{label}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-1)', fontWeight: 600 }}>{value}</span>
              </div>
            ))}
          </StageCard>

          <StageCard title="Settlement Amounts" icon={DollarSign} accent="var(--success)">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.625rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-3)', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Approved Amount</label>
                <input type="number" min="0" step="0.01" value={approvedAmt} onChange={e => setApprovedAmt(e.target.value)} placeholder={String(claim.amount)} className="input-field" style={{ fontSize: '0.82rem' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-3)', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Excess</label>
                <input type="number" min="0" step="0.01" value={excess} onChange={e => setExcess(e.target.value)} className="input-field" style={{ fontSize: '0.82rem' }} />
              </div>
            </div>
            {netPayout !== null && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 'var(--r-sm)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--success-text)', fontWeight: 600 }}>Net Payout</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--success)' }}>${netPayout.toLocaleString()} AUD</span>
              </div>
            )}
          </StageCard>
        </div>

        {/* Right: gauge + decision */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <StageCard title="AI Approval Probability" icon={Activity} accent={prob >= 65 ? 'var(--success)' : prob >= 35 ? 'var(--warning)' : 'var(--danger)'}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.875rem', padding: '0.5rem 0' }}>
              <ApprovalGauge value={prob} size={170} />
              {suggestion?.recommendation && (
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-3)', fontWeight: 500 }}>AI recommends: </span>
                  <span style={{
                    fontSize: '0.82rem', fontWeight: 800,
                    color: suggestion.recommendation === 'approve' ? 'var(--success)' : suggestion.recommendation === 'reject' ? 'var(--danger)' : 'var(--warning)',
                  }}>
                    {suggestion.recommendation === 'approve' ? 'Approve' : suggestion.recommendation === 'reject' ? 'Reject' : 'Investigate'}
                  </span>
                  {suggestion.confidence_percentage != null && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}> ({suggestion.confidence_percentage}% conf.)</span>
                  )}
                </div>
              )}
              {!suggestion && (
                <p style={{ fontSize: '0.72rem', color: 'var(--text-3)', textAlign: 'center' }}>
                  Go back to Stage 4 to get an AI recommendation.
                </p>
              )}
            </div>
          </StageCard>

          <StageCard title="Final Decision" icon={Gavel} accent="var(--accent)">
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-3)', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Decision Reason *
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Provide a clear reason for your decision. This will be communicated to the claimant…"
              className="input-field"
              style={{ minHeight: '95px', resize: 'none', marginBottom: '0.875rem', lineHeight: 1.6, fontSize: '0.82rem' }}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <button
                onClick={() => submitDecision('approved')}
                disabled={saving || !reason.trim()}
                className="btn-success"
                style={{ fontSize: '0.82rem', padding: '0.625rem', justifyContent: 'center', opacity: !reason.trim() || saving ? 0.45 : 1 }}
              >
                {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle size={13} />}
                Approve
              </button>
              <button
                onClick={() => submitDecision('rejected')}
                disabled={saving || !reason.trim()}
                className="btn-danger"
                style={{ fontSize: '0.82rem', padding: '0.625rem', justifyContent: 'center', opacity: !reason.trim() || saving ? 0.45 : 1 }}
              >
                {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <XCircle size={13} />}
                Reject
              </button>
            </div>
            {!reason.trim() && (
              <p style={{ fontSize: '0.7rem', color: 'var(--text-3)', textAlign: 'center', marginTop: '0.5rem' }}>
                A reason is required before deciding
              </p>
            )}
          </StageCard>
        </div>
      </div>
    )
  }

  /* ─── Loading / not found ────────────────────────────────────── */

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center', color: 'var(--text-3)' }}>
        <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 0.75rem', display: 'block' }} />
        <p style={{ fontSize: '0.875rem' }}>Loading claim…</p>
      </div>
    </div>
  )

  if (!claim) return <div style={{ padding: '2rem' }}><p>Claim not found.</p></div>

  const isDecided  = ['approved', 'rejected', 'closed'].includes(claim.status)

  /* ─── Page ───────────────────────────────────────────────────── */

  return (
    <div className="page-container-md">

      {/* Back */}
      <button onClick={() => navigate('/dashboard')} className="btn-ghost" style={{ marginBottom: '1.25rem', fontSize: '0.82rem', padding: '0.4rem 0.75rem' }}>
        <ArrowLeft size={14} /> Dashboard
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
              {claim.claimant_name} · Filed {new Date(claim.created_at).toLocaleDateString('en-AU', { dateStyle: 'medium' })}
            </span>
          </div>
        </div>
        <div style={{ padding: '0.625rem 1rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', textAlign: 'right', boxShadow: 'var(--shadow-xs)' }}>
          <p style={{ fontSize: '0.62rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Claim Amount</p>
          <p style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em', marginTop: '0.1rem' }}>
            ${Number(claim.amount).toLocaleString()}
            <span style={{ fontSize: '0.7rem', color: 'var(--text-3)', fontWeight: 500, marginLeft: '0.25rem' }}>AUD</span>
          </p>
        </div>
      </div>

      {/* ── Stage stepper ── */}
      <div className="card" style={{ padding: '1rem 1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {STAGES.map((stage, i) => {
            const isActive    = currentStage === stage.num
            const isCompleted = completed.has(stage.num) || (isDecided && stage.num === 5)
            const isClickable = stage.num < currentStage || completed.has(stage.num)
            const Icon = stage.icon
            return (
              <div key={stage.num} style={{ display: 'flex', alignItems: 'center', flex: i < STAGES.length - 1 ? 1 : undefined }}>
                <div
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem', cursor: isClickable ? 'pointer' : 'default' }}
                  onClick={() => isClickable && goToStage(stage.num)}
                >
                  <div style={{
                    width: '34px', height: '34px', borderRadius: '50%',
                    background: isActive || isCompleted ? 'var(--accent)' : 'var(--surface-2)',
                    border: `2px solid ${isActive || isCompleted ? 'var(--accent)' : 'var(--border)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: isActive ? '0 0 0 4px var(--accent-bg)' : 'none',
                    transition: 'all 0.25s ease',
                  }}>
                    {isCompleted && !isActive
                      ? <Check size={14} color="white" />
                      : <Icon size={14} color={isActive || isCompleted ? 'white' : 'var(--text-3)'} />
                    }
                  </div>
                  <span style={{ fontSize: '0.6rem', fontWeight: 700, color: isActive || isCompleted ? 'var(--accent)' : 'var(--text-3)', whiteSpace: 'nowrap', letterSpacing: '0.02em' }}>
                    {stage.title}
                  </span>
                </div>
                {i < STAGES.length - 1 && (
                  <div style={{
                    flex: 1, height: '2px', margin: '0 0.375rem', marginBottom: '1.1rem',
                    background: completed.has(stage.num) ? 'var(--accent)' : 'var(--border)',
                    borderRadius: '99px', transition: 'background 0.3s ease',
                  }} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Stage label */}
      {(() => {
        const s = STAGES[currentStage - 1]
        const Icon = s.icon
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={14} color="var(--accent)" />
            </div>
            <div>
              <p style={{ fontSize: '0.62rem', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Stage {currentStage} of 5</p>
              <h2 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-1)', marginTop: '0.1rem' }}>
                {s.title === 'AI Triage' ? 'AI Triage & Fraud Analysis' : s.title === 'Assessment' ? 'Assessment & Notes' : s.title === 'Decision' ? 'Final Decision' : s.title === 'Intake' ? 'Intake & Validation' : 'Document Review'}
              </h2>
            </div>
          </div>
        )
      })()}

      {/* Stage content */}
      <div style={{ marginBottom: '1.5rem' }}>
        {currentStage === 1 && renderStage1()}
        {currentStage === 2 && renderStage2()}
        {currentStage === 3 && renderStage3()}
        {currentStage === 4 && renderStage4()}
        {currentStage === 5 && renderStage5()}
      </div>

      {/* Navigation bar — only stages 1–4, not when decided */}
      {currentStage < 5 && !isDecided && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.875rem 1.25rem',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-sm)',
        }}>
          <button
            onClick={goBack}
            disabled={currentStage === 1}
            className="btn-ghost"
            style={{ opacity: currentStage === 1 ? 0.3 : 1, fontSize: '0.82rem' }}
          >
            <ChevronLeft size={14} /> Back
          </button>

          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-3)', fontWeight: 600 }}>
              Stage {currentStage} of 5
            </span>
            {currentStage === 3 && !claim?.triage && !claim?.fraud_score && !triageRan && (
              <p style={{ fontSize: '0.68rem', color: 'var(--warning)', fontWeight: 600, marginTop: '0.1rem' }}>Run AI Analysis to continue</p>
            )}
            {currentStage === 4 && !assessmentNote.trim() && (
              <p style={{ fontSize: '0.68rem', color: 'var(--warning)', fontWeight: 600, marginTop: '0.1rem' }}>Assessment required to continue</p>
            )}
          </div>

          <button
            onClick={advanceStage}
            disabled={!canAdvance()}
            className="btn-primary"
            style={{ opacity: !canAdvance() ? 0.4 : 1, fontSize: '0.82rem', cursor: !canAdvance() ? 'not-allowed' : 'pointer' }}
          >
            {currentStage === 4 ? 'Proceed to Decision' : 'Next'}
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
