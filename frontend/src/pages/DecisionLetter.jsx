import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from '../api'
import { ArrowLeft, Printer, Loader2, ShieldCheck } from 'lucide-react'

const CLAIM_TYPE_LABELS = {
  motor: 'Motor / Vehicle', property: 'Property Damage', liability: 'Public Liability',
  workers_comp: "Workers' Compensation", health: 'Health / Medical', travel: 'Travel',
}

export default function DecisionLetter() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const [claim,   setClaim]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    axios.get(`/api/claims/${id}`)
      .then(r => setClaim(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#fff' }}>
      <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: '#c2720a' }} />
    </div>
  )

  if (!claim) return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <p>Claim not found.</p>
      <button onClick={() => navigate(-1)} style={{ marginTop: '1rem', cursor: 'pointer' }}>Go back</button>
    </div>
  )

  const isApproved = claim.status === 'approved'
  const dateStr    = new Date().toLocaleDateString('en-AU', { dateStyle: 'long' })
  const decidedDate = claim.updated_at
    ? new Date(claim.updated_at).toLocaleDateString('en-AU', { dateStyle: 'long' })
    : dateStr

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .letter-page { box-shadow: none !important; margin: 0 !important; padding: 3cm 2.5cm !important; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Controls - hidden on print */}
      <div className="no-print" style={{ background: '#f4f1ec', padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid #e8e2d9' }}>
        <button
          onClick={() => navigate(-1)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.875rem', background: 'white', border: '1.5px solid #e8e2d9', borderRadius: '8px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: '#6b6257', fontFamily: 'inherit' }}
        >
          <ArrowLeft size={13} /> Back
        </button>
        <button
          onClick={() => window.print()}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.875rem', background: '#c2720a', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, color: 'white', fontFamily: 'inherit' }}
        >
          <Printer size={13} /> Print / Save as PDF
        </button>
        <span style={{ fontSize: '0.75rem', color: '#a89e94' }}>Tip: Use "Save as PDF" in your browser's print dialog</span>
      </div>

      {/* Letter */}
      <div style={{ background: '#f4f1ec', minHeight: 'calc(100vh - 52px)', padding: '2.5rem 1.5rem', display: 'flex', justifyContent: 'center' }}>
        <div className="letter-page" style={{ background: 'white', width: '100%', maxWidth: '720px', padding: '3rem 3.5rem', boxShadow: '0 4px 24px rgba(0,0,0,0.1)', fontFamily: "'Georgia', serif" }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2.5rem', paddingBottom: '1.5rem', borderBottom: '2px solid #c2720a' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#c2720a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldCheck size={22} color="white" />
              </div>
              <div>
                <p style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1c1714', fontFamily: "'Inter', system-ui, sans-serif", letterSpacing: '-0.02em' }}>ClaimsHub</p>
                <p style={{ fontSize: '0.72rem', color: '#6b6257', fontFamily: "'Inter', system-ui, sans-serif" }}>QBE Insurance Claims System</p>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '0.82rem', color: '#6b6257', fontFamily: "'Inter', system-ui, sans-serif" }}>{dateStr}</p>
              <p style={{ fontSize: '0.75rem', color: '#a89e94', marginTop: '0.25rem', fontFamily: "'Inter', system-ui, sans-serif", fontFamily: 'monospace' }}>Ref: #{String(claim.id).padStart(5, '0')}</p>
            </div>
          </div>

          {/* Addressee */}
          <div style={{ marginBottom: '2rem' }}>
            <p style={{ fontSize: '0.95rem', color: '#1c1714', fontWeight: 600, marginBottom: '0.15rem' }}>{claim.claimant_name}</p>
            <p style={{ fontSize: '0.82rem', color: '#6b6257' }}>{claim.claimant_email}</p>
            {claim.claimant_phone && <p style={{ fontSize: '0.82rem', color: '#6b6257' }}>{claim.claimant_phone}</p>}
          </div>

          {/* Re line */}
          <div style={{ marginBottom: '1.75rem', padding: '0.75rem 1rem', background: isApproved ? '#ecfdf5' : '#fef2f2', borderLeft: `4px solid ${isApproved ? '#047857' : '#b91c1c'}`, borderRadius: '0 6px 6px 0' }}>
            <p style={{ fontSize: '0.875rem', color: isApproved ? '#065f46' : '#991b1b', fontWeight: 700, fontFamily: "'Inter', system-ui, sans-serif" }}>
              RE: Claim #{String(claim.id).padStart(5, '0')} — {CLAIM_TYPE_LABELS[claim.claim_type] || claim.claim_type} Claim
            </p>
            <p style={{ fontSize: '0.8rem', color: isApproved ? '#065f46' : '#991b1b', marginTop: '0.15rem', fontFamily: "'Inter', system-ui, sans-serif" }}>
              Decision: <strong>{isApproved ? 'APPROVED' : 'REJECTED'}</strong> · {decidedDate}
            </p>
          </div>

          {/* Salutation */}
          <p style={{ fontSize: '0.95rem', color: '#1c1714', marginBottom: '1.25rem' }}>
            Dear {claim.claimant_name.split(' ')[0]},
          </p>

          {/* Body */}
          <p style={{ fontSize: '0.9rem', color: '#1c1714', lineHeight: 1.8, marginBottom: '1rem' }}>
            Thank you for submitting your insurance claim (Reference #{String(claim.id).padStart(5, '0')}) in relation to a <strong>{CLAIM_TYPE_LABELS[claim.claim_type] || claim.claim_type}</strong> incident that occurred on <strong>{new Date(claim.incident_date).toLocaleDateString('en-AU', { dateStyle: 'long' })}</strong> at {claim.location}.
          </p>

          <p style={{ fontSize: '0.9rem', color: '#1c1714', lineHeight: 1.8, marginBottom: '1.25rem' }}>
            After a thorough review of your claim, supporting documentation, and our assessment process, we are pleased to inform you that your claim has been{' '}
            <strong style={{ color: isApproved ? '#047857' : '#b91c1c' }}>
              {isApproved ? 'approved' : 'rejected'}
            </strong>.
          </p>

          {/* Decision reason */}
          {claim.decision_reason && (
            <div style={{ margin: '1.25rem 0', padding: '1rem 1.25rem', background: '#faf9f7', border: '1px solid #e8e2d9', borderRadius: '6px' }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#a89e94', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem', fontFamily: "'Inter', system-ui, sans-serif" }}>Reason for Decision</p>
              <p style={{ fontSize: '0.875rem', color: '#1c1714', lineHeight: 1.7 }}>{claim.decision_reason}</p>
            </div>
          )}

          {/* Settlement table */}
          {isApproved && (
            <>
              <p style={{ fontSize: '0.9rem', color: '#1c1714', lineHeight: 1.8, marginBottom: '1rem', marginTop: '1rem' }}>
                The details of your approved settlement are as follows:
              </p>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.25rem', fontSize: '0.875rem' }}>
                <tbody>
                  {[
                    { label: 'Claimed Amount',      value: `$${Number(claim.amount).toLocaleString()} AUD` },
                    { label: 'Approved Amount',     value: `$${Number(claim.approved_amount ?? claim.amount).toLocaleString()} AUD` },
                    { label: 'Excess / Deductible', value: `$${Number(claim.excess ?? 0).toLocaleString()} AUD` },
                  ].map(({ label, value }) => (
                    <tr key={label}>
                      <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #e8e2d9', color: '#6b6257' }}>{label}</td>
                      <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #e8e2d9', color: '#1c1714', fontWeight: 600, textAlign: 'right' }}>{value}</td>
                    </tr>
                  ))}
                  <tr style={{ background: '#f4f1ec' }}>
                    <td style={{ padding: '0.625rem 0.75rem', color: '#1c1714', fontWeight: 700 }}>Net Payout</td>
                    <td style={{ padding: '0.625rem 0.75rem', color: '#047857', fontWeight: 800, textAlign: 'right', fontSize: '1rem' }}>
                      ${Number(claim.net_payout ?? 0).toLocaleString()} AUD
                    </td>
                  </tr>
                </tbody>
              </table>
              <p style={{ fontSize: '0.875rem', color: '#1c1714', lineHeight: 1.8, marginBottom: '1rem' }}>
                {claim.payment_status === 'paid'
                  ? `Payment of $${Number(claim.net_payout ?? 0).toLocaleString()} AUD has been processed and confirmed on ${new Date(claim.paid_at).toLocaleDateString('en-AU', { dateStyle: 'long' })}.`
                  : `Payment of $${Number(claim.net_payout ?? 0).toLocaleString()} AUD will be processed to your nominated account within 3–5 business days.`
                }
              </p>
            </>
          )}

          {!isApproved && (
            <p style={{ fontSize: '0.875rem', color: '#1c1714', lineHeight: 1.8, marginBottom: '1rem', marginTop: '1rem' }}>
              If you believe this decision is incorrect or wish to appeal, please contact our claims team within 30 days of receiving this letter. You may request a formal review by providing additional supporting documentation.
            </p>
          )}

          {/* Closing */}
          <p style={{ fontSize: '0.875rem', color: '#1c1714', lineHeight: 1.8, marginBottom: '2rem' }}>
            Should you have any questions regarding this decision, please do not hesitate to contact our claims team. We appreciate your patience throughout this process.
          </p>

          <p style={{ fontSize: '0.9rem', color: '#1c1714', marginBottom: '0.25rem' }}>Yours sincerely,</p>
          <div style={{ marginTop: '1.75rem', marginBottom: '0.25rem' }}>
            <div style={{ width: '120px', height: '1px', background: '#1c1714', marginBottom: '0.375rem' }} />
            <p style={{ fontSize: '0.875rem', color: '#1c1714', fontWeight: 600 }}>{claim.decided_by || 'Claims Adjudication Team'}</p>
            <p style={{ fontSize: '0.78rem', color: '#6b6257' }}>ClaimsHub — QBE Insurance</p>
          </div>

          {/* Footer */}
          <div style={{ marginTop: '2.5rem', paddingTop: '1rem', borderTop: '1px solid #e8e2d9' }}>
            <p style={{ fontSize: '0.68rem', color: '#a89e94', lineHeight: 1.6, fontFamily: "'Inter', system-ui, sans-serif" }}>
              This letter is an official communication from ClaimsHub. Claim Reference #{String(claim.id).padStart(5, '0')} · Policy {claim.policy_number} · Generated {dateStr}
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
