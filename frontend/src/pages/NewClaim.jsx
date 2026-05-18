import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from '../api'
import { ArrowLeft, FileText, User, MapPin, Loader2 } from 'lucide-react'

const CLAIM_TYPES = [
  { value: 'motor',        label: 'Motor / Vehicle' },
  { value: 'property',     label: 'Property Damage' },
  { value: 'liability',    label: 'Public Liability' },
  { value: 'workers_comp', label: "Workers' Compensation" },
  { value: 'health',       label: 'Health / Medical' },
  { value: 'travel',       label: 'Travel' },
]

function FormSection({ icon: Icon, title, children }) {
  return (
    <div className="card" style={{ padding: '1.375rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1.25rem', paddingBottom: '0.875rem', borderBottom: '1px solid var(--border)' }}>
        <div style={{
          width: '26px', height: '26px', borderRadius: '6px',
          background: 'var(--accent-bg)',
          border: '1px solid var(--accent-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={13} color="var(--accent)" />
        </div>
        <h2 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-2)', letterSpacing: '0.03em' }}>{title}</h2>
      </div>
      {children}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-2)', marginBottom: '0.375rem', letterSpacing: '0.02em' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

export default function NewClaim() {
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('claims_user') || '{}')

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
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState('')

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const res = await axios.post('/api/claims', form)
      navigate(`/claims/${res.data.id}`)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit claim. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '760px', margin: '0 auto' }}>

      <button
        onClick={() => navigate(-1)}
        className="btn-ghost"
        style={{ marginBottom: '1.5rem', fontSize: '0.82rem', padding: '0.4rem 0.75rem' }}
      >
        <ArrowLeft size={14} /> Back
      </button>

      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
          File a New Claim
        </h1>
        <p style={{ color: 'var(--text-3)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
          Complete all required fields to submit your insurance claim.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* Claimant info */}
        <FormSection icon={User} title="Claimant Information">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
            <Field label="Full Name *">
              <input id="field-name" className="input-field" value={form.claimant_name} onChange={set('claimant_name')} required />
            </Field>
            <Field label="Email Address *">
              <input id="field-email" type="email" className="input-field" value={form.claimant_email} onChange={set('claimant_email')} required />
            </Field>
            <Field label="Phone Number">
              <input id="field-phone" type="tel" className="input-field" value={form.claimant_phone} onChange={set('claimant_phone')} placeholder="+61 4xx xxx xxx" />
            </Field>
            <Field label="Policy Number *">
              <input id="field-policy" className="input-field" value={form.policy_number} onChange={set('policy_number')} placeholder="QBE-XXXX-XXXX" required />
            </Field>
          </div>
        </FormSection>

        {/* Claim details */}
        <FormSection icon={FileText} title="Claim Details">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
            <Field label="Claim Type *">
              <select id="field-type" className="input-field" value={form.claim_type} onChange={set('claim_type')}>
                {CLAIM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="Claim Amount (AUD) *">
              <input id="field-amount" type="number" min="0" step="0.01" className="input-field" value={form.amount} onChange={set('amount')} placeholder="0.00" required />
            </Field>
          </div>
        </FormSection>

        {/* Incident details */}
        <FormSection icon={MapPin} title="Incident Details">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem', marginBottom: '0.875rem' }}>
            <Field label="Incident Date *">
              <input id="field-date" type="date" className="input-field" value={form.incident_date} onChange={set('incident_date')} required />
            </Field>
            <Field label="Location *">
              <input id="field-location" className="input-field" value={form.location} onChange={set('location')} placeholder="City, State" required />
            </Field>
          </div>
          <Field label="Incident Description *">
            <textarea
              id="field-description"
              className="input-field"
              value={form.incident_description}
              onChange={set('incident_description')}
              placeholder="Describe what happened — include timeline, parties involved, and the nature of the loss or damage…"
              style={{ minHeight: '115px', lineHeight: 1.65 }}
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
            ⚠ {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.625rem', paddingTop: '0.25rem' }}>
          <button id="submit-claim-btn" type="submit" disabled={submitting} className="btn-primary">
            {submitting
              ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Submitting…</>
              : 'Submit Claim'
            }
          </button>
          <button type="button" onClick={() => navigate(-1)} className="btn-ghost">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
