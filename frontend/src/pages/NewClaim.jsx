import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from '../api'
import { ArrowLeft, FileText, User, MapPin, Loader2, Upload, Sparkles, X, CheckCircle, AlertTriangle } from 'lucide-react'
import { useToast } from '../components/Toast'

const CLAIM_TYPES = [
  { value: 'motor',        label: 'Motor / Vehicle' },
  { value: 'property',     label: 'Property Damage' },
  { value: 'liability',    label: 'Public Liability' },
  { value: 'workers_comp', label: "Workers' Compensation" },
  { value: 'health',       label: 'Health / Medical' },
  { value: 'travel',       label: 'Travel' },
]

function FormSection({ icon: Icon, title, children, accent = 'var(--accent)' }) {
  return (
    <div className="card" style={{ padding: '1.375rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1.25rem', paddingBottom: '0.875rem', borderBottom: '1px solid var(--border)' }}>
        <div style={{
          width: '26px', height: '26px', borderRadius: '6px',
          background: 'var(--accent-bg)', border: '1px solid var(--accent-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={13} color={accent} />
        </div>
        <h2 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-2)', letterSpacing: '0.03em' }}>{title}</h2>
      </div>
      {children}
    </div>
  )
}

function Field({ label, children, highlight }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-2)', marginBottom: '0.375rem', letterSpacing: '0.02em' }}>
        {label}
        {highlight && <span style={{ marginLeft: '0.4rem', fontSize: '0.65rem', color: 'var(--success)', fontWeight: 700 }}>✦ AI filled</span>}
      </label>
      {children}
    </div>
  )
}

export default function NewClaim() {
  const navigate  = useNavigate()
  const toast     = useToast()
  const fileRef   = useRef(null)
  const user      = JSON.parse(localStorage.getItem('claims_user') || '{}')

  const [form, setForm] = useState({
    claimant_name:        user.name  || '',
    claimant_email:       user.email || '',
    claimant_phone:       '',
    claim_type:           'motor',
    policy_number:        '',
    incident_date:        '',
    incident_description: '',
    amount:               '',
    location:             '',
  })
  const [highlighted, setHighlighted] = useState({})
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState('')

  // OCR state
  const [ocrFile, setOcrFile]         = useState(null)
  const [ocrLoading, setOcrLoading]   = useState(false)
  const [ocrResult, setOcrResult]     = useState(null)
  const [dragOver, setDragOver]       = useState(false)

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  function handleFileDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer?.files?.[0] || e.target?.files?.[0]
    if (file) setOcrFile(file)
  }

  async function runOcr() {
    if (!ocrFile) return
    setOcrLoading(true)
    setOcrResult(null)
    try {
      const fd = new FormData()
      fd.append('document', ocrFile)
      const res = await axios.post('/api/ocr', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      const extracted = res.data
      setOcrResult(extracted)

      const newHighlights = {}
      const updates = {}
      const FIELDS = ['claimant_name', 'claimant_email', 'claimant_phone', 'policy_number', 'claim_type', 'incident_date', 'location', 'incident_description']
      for (const f of FIELDS) {
        if (extracted[f] != null && extracted[f] !== '') {
          updates[f] = String(extracted[f])
          newHighlights[f] = true
        }
      }
      if (extracted.amount != null) { updates.amount = String(extracted.amount); newHighlights.amount = true }

      setForm(prev => ({ ...prev, ...updates }))
      setHighlighted(newHighlights)
      const filled = Object.keys(newHighlights).length
      toast(`AI extracted ${filled} field${filled !== 1 ? 's' : ''} from your document (confidence: ${extracted.confidence ?? '?'}%)`, 'success')
    } catch (err) {
      toast(err.response?.data?.error || 'Could not read document. Please fill in fields manually.', 'error')
    } finally {
      setOcrLoading(false)
    }
  }

  function clearOcr() {
    setOcrFile(null)
    setOcrResult(null)
    setHighlighted({})
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const res = await axios.post('/api/claims', form)
      toast('Claim submitted successfully!', 'success')
      navigate(`/claims/${res.data.id}`)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit claim. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="page-container-sm">

      <button onClick={() => navigate(-1)} className="btn-ghost" style={{ marginBottom: '1.5rem', fontSize: '0.82rem', padding: '0.4rem 0.75rem' }}>
        <ArrowLeft size={14} /> Back
      </button>

      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
          File a New Claim
        </h1>
        <p style={{ color: 'var(--text-3)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
          Complete all required fields, or upload a document to auto-fill with AI.
        </p>
      </div>

      {/* ── OCR upload section ── */}
      <FormSection icon={Sparkles} title="AI Document Extraction — optional" accent="var(--info)">
        <p style={{ fontSize: '0.8rem', color: 'var(--text-2)', marginBottom: '1rem', lineHeight: 1.6 }}>
          Upload a police report, repair quote, medical bill, or any relevant document and our AI will automatically extract the claim details for you.
        </p>

        {!ocrFile ? (
          <div
            onDrop={handleFileDrop}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 'var(--r-md)',
              padding: '2rem',
              textAlign: 'center',
              cursor: 'pointer',
              background: dragOver ? 'var(--accent-bg)' : 'var(--surface-2)',
              transition: 'all 0.2s ease',
            }}
          >
            <Upload size={22} color="var(--text-3)" style={{ margin: '0 auto 0.75rem' }} />
            <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-2)' }}>
              Drop a file here or <span style={{ color: 'var(--accent)' }}>browse</span>
            </p>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>
              Supports JPEG, PNG, WEBP — max 10 MB
            </p>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileDrop} />
          </div>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            padding: '0.75rem 1rem',
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)',
          }}>
            <FileText size={18} color="var(--accent)" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ocrFile.name}
              </p>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>
                {(ocrFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
            {ocrResult ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>
                <CheckCircle size={13} /> Extracted
              </span>
            ) : (
              <button
                type="button"
                onClick={runOcr}
                disabled={ocrLoading}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                  padding: '0.4rem 0.875rem',
                  background: 'var(--accent)', color: 'white',
                  border: 'none', borderRadius: 'var(--r-sm)',
                  fontSize: '0.78rem', fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                  opacity: ocrLoading ? 0.65 : 1,
                }}
              >
                {ocrLoading
                  ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Extracting…</>
                  : <><Sparkles size={12} /> Auto-fill with AI</>
                }
              </button>
            )}
            <button type="button" onClick={clearOcr} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: '0.25rem' }}>
              <X size={15} />
            </button>
          </div>
        )}

        {ocrResult && (
          <div style={{
            marginTop: '0.75rem', padding: '0.625rem 0.875rem',
            background: 'var(--success-bg)', border: '1px solid var(--success-border)',
            borderRadius: 'var(--r-sm)',
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            fontSize: '0.78rem', color: 'var(--success-text)',
          }}>
            <CheckCircle size={13} color="var(--success)" />
            Fields highlighted with <strong>✦ AI filled</strong> were extracted from your document. Review and edit as needed.
          </div>
        )}
      </FormSection>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* Claimant info */}
        <FormSection icon={User} title="Claimant Information">
          <div className="form-grid-2">
            <Field label="Full Name *" highlight={highlighted.claimant_name}>
              <input id="field-name" className="input-field" value={form.claimant_name} onChange={set('claimant_name')}
                style={highlighted.claimant_name ? { borderColor: 'var(--success)', background: 'var(--success-bg)' } : {}} required />
            </Field>
            <Field label="Email Address *" highlight={highlighted.claimant_email}>
              <input id="field-email" type="email" className="input-field" value={form.claimant_email} onChange={set('claimant_email')}
                style={highlighted.claimant_email ? { borderColor: 'var(--success)', background: 'var(--success-bg)' } : {}} required />
            </Field>
            <Field label="Phone Number" highlight={highlighted.claimant_phone}>
              <input id="field-phone" type="tel" className="input-field" value={form.claimant_phone} onChange={set('claimant_phone')}
                placeholder="+61 4xx xxx xxx"
                style={highlighted.claimant_phone ? { borderColor: 'var(--success)', background: 'var(--success-bg)' } : {}} />
            </Field>
            <Field label="Policy Number *" highlight={highlighted.policy_number}>
              <input id="field-policy" className="input-field" value={form.policy_number} onChange={set('policy_number')}
                placeholder="QBE-XXXX-XXXX"
                style={highlighted.policy_number ? { borderColor: 'var(--success)', background: 'var(--success-bg)' } : {}} required />
            </Field>
          </div>
        </FormSection>

        {/* Claim details */}
        <FormSection icon={FileText} title="Claim Details">
          <div className="form-grid-2">
            <Field label="Claim Type *" highlight={highlighted.claim_type}>
              <select id="field-type" className="input-field" value={form.claim_type} onChange={set('claim_type')}
                style={highlighted.claim_type ? { borderColor: 'var(--success)', background: 'var(--success-bg)' } : {}}>
                {CLAIM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="Claim Amount (AUD) *" highlight={highlighted.amount}>
              <input id="field-amount" type="number" min="0" step="0.01" className="input-field"
                value={form.amount} onChange={set('amount')} placeholder="0.00"
                style={highlighted.amount ? { borderColor: 'var(--success)', background: 'var(--success-bg)' } : {}} required />
            </Field>
          </div>
        </FormSection>

        {/* Incident details */}
        <FormSection icon={MapPin} title="Incident Details" accent="var(--warning)">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem', marginBottom: '0.875rem' }}>
            <Field label="Incident Date *" highlight={highlighted.incident_date}>
              <input id="field-date" type="date" className="input-field" value={form.incident_date} onChange={set('incident_date')}
                style={highlighted.incident_date ? { borderColor: 'var(--success)', background: 'var(--success-bg)' } : {}} required />
            </Field>
            <Field label="Location *" highlight={highlighted.location}>
              <input id="field-location" className="input-field" value={form.location} onChange={set('location')}
                placeholder="City, State"
                style={highlighted.location ? { borderColor: 'var(--success)', background: 'var(--success-bg)' } : {}} required />
            </Field>
          </div>
          <Field label="Incident Description *" highlight={highlighted.incident_description}>
            <textarea
              id="field-description"
              className="input-field"
              value={form.incident_description}
              onChange={set('incident_description')}
              placeholder="Describe what happened — include timeline, parties involved, and the nature of the loss or damage…"
              style={{ minHeight: '115px', lineHeight: 1.65, ...(highlighted.incident_description ? { borderColor: 'var(--success)', background: 'var(--success-bg)' } : {}) }}
              required
            />
          </Field>
        </FormSection>

        {error && (
          <div style={{
            background: 'var(--danger-bg)', border: '1px solid var(--danger-border)',
            borderRadius: 'var(--r-sm)', padding: '0.75rem 1rem',
            fontSize: '0.82rem', color: 'var(--danger-text)',
            display: 'flex', alignItems: 'center', gap: '0.5rem',
          }}>
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.625rem', paddingTop: '0.25rem' }}>
          <button id="submit-claim-btn" type="submit" disabled={submitting} className="btn-primary">
            {submitting
              ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Submitting…</>
              : 'Submit Claim'
            }
          </button>
          <button type="button" onClick={() => navigate(-1)} className="btn-ghost">Cancel</button>
        </div>
      </form>
    </div>
  )
}
