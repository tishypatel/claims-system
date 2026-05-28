import { Router } from 'express'
import { db } from '../db/database.js'
import { runTriage, runFraudAnalysis } from './ai.js'

const router = Router()

// ── Helpers ────────────────────────────────────────────────────
const SLA_DAYS = { motor: 5, property: 10, liability: 15, workers_comp: 7, health: 3, travel: 5 }
const PRIORITY_THRESHOLD = { high: 20000, medium: 5000 }

function calcPriority(amount) {
  if (amount >= PRIORITY_THRESHOLD.high) return 'high'
  if (amount >= PRIORITY_THRESHOLD.medium) return 'medium'
  return 'low'
}

function calcSlaDue(createdAt, claimType) {
  const days = SLA_DAYS[claimType] ?? 7
  const d = new Date(createdAt)
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

function writeAudit(claimId, action, actor, detail) {
  db.data.audit_logs.push({
    id: db.data.nextAuditId++,
    claim_id: claimId,
    action,
    actor: actor || 'System',
    detail,
    created_at: new Date().toISOString(),
  })
}

// ── List claims (role-based filtering) ────────────────────────
router.get('/', (req, res) => {
  const { role, email } = req.query
  let claims = [...db.data.claims]
  if (role === 'claimant' && email) {
    claims = claims.filter(c => c.claimant_email === email)
  }
  claims.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  res.json(claims)
})

// ── Get single claim ───────────────────────────────────────────
router.get('/:id', (req, res) => {
  const claim = db.data.claims.find(c => c.id === Number(req.params.id))
  if (!claim) return res.status(404).json({ error: 'Claim not found' })
  res.json(claim)
})

// ── Create claim ───────────────────────────────────────────────
router.post('/', async (req, res) => {
  const {
    claimant_name, claimant_email, claimant_phone,
    policy_number, claim_type, amount, incident_date,
    incident_description, location,
  } = req.body

  if (!claimant_name || !claimant_email || !policy_number || !claim_type || !amount || !incident_date || !incident_description || !location) {
    return res.status(400).json({ error: 'All required fields must be provided.' })
  }

  const now = new Date().toISOString()
  const claim = {
    id: db.data.nextClaimId++,
    claimant_name, claimant_email,
    claimant_phone: claimant_phone || null,
    policy_number, claim_type,
    amount: Number(amount),
    incident_date, incident_description, location,
    status: 'pending',
    decision_reason: null,
    decided_by: null,
    // Settlement fields
    approved_amount: null,
    excess: 0,
    net_payout: null,
    payment_status: null,
    paid_at: null,
    paid_by: null,
    // Risk fields
    fraud_score: null,
    fraud_flags: [],
    fraud_confidence: null,
    fraud_summary: null,
    // Meta
    priority: calcPriority(Number(amount)),
    sla_due: calcSlaDue(now, claim_type),
    created_at: now,
    updated_at: now,
  }

  db.data.claims.push(claim)
  writeAudit(claim.id, 'claim_created', claimant_name, `Claim filed: ${claim_type} for $${Number(amount).toLocaleString()} AUD`)
  await db.write()
  res.status(201).json(claim)

  // Background AI analysis — does not block the response
  const snapshot = { ...claim }
  Promise.all([
    runTriage(snapshot).catch(e => console.error('Auto-triage failed:', e.message)),
    runFraudAnalysis(snapshot).catch(e => console.error('Auto-fraud failed:', e.message)),
  ])
})

// ── Update status ──────────────────────────────────────────────
router.patch('/:id/status', async (req, res) => {
  const allowed = ['pending', 'under_review', 'approved', 'rejected', 'closed']
  const { status, reason, updated_by, approved_amount, excess } = req.body

  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status.' })

  const claim = db.data.claims.find(c => c.id === Number(req.params.id))
  if (!claim) return res.status(404).json({ error: 'Claim not found' })

  const prevStatus = claim.status
  claim.status = status
  claim.decision_reason = reason || null
  claim.decided_by = updated_by || null
  claim.updated_at = new Date().toISOString()

  // Settlement calculation on approval
  if (status === 'approved') {
    const appAmt = approved_amount != null ? Number(approved_amount) : claim.amount
    const exc    = excess != null ? Number(excess) : 0
    claim.approved_amount = appAmt
    claim.excess          = exc
    claim.net_payout      = Math.max(0, appAmt - exc)
    claim.payment_status  = 'pending_payment'
  }

  writeAudit(
    claim.id, 'status_changed', updated_by || 'System',
    `Status changed from ${prevStatus} → ${status}${reason ? ': ' + reason : ''}`,
  )
  await db.write()
  res.json(claim)
})

// ── Mark as paid ───────────────────────────────────────────────
router.patch('/:id/payment', async (req, res) => {
  const { paid_by } = req.body
  const claim = db.data.claims.find(c => c.id === Number(req.params.id))
  if (!claim) return res.status(404).json({ error: 'Claim not found' })
  if (claim.status !== 'approved') return res.status(400).json({ error: 'Claim must be approved before marking as paid.' })

  claim.payment_status = 'paid'
  claim.paid_at        = new Date().toISOString()
  claim.paid_by        = paid_by || null
  claim.updated_at     = new Date().toISOString()

  writeAudit(claim.id, 'payment_made', paid_by || 'System', `Settlement paid: $${claim.net_payout?.toLocaleString()} AUD`)
  await db.write()
  res.json(claim)
})

// ── Notes ──────────────────────────────────────────────────────
router.get('/:id/notes', (req, res) => {
  const notes = db.data.notes
    .filter(n => n.claim_id === Number(req.params.id))
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  res.json(notes)
})

router.post('/:id/notes', async (req, res) => {
  const { author, content } = req.body
  if (!author || !content) return res.status(400).json({ error: 'Author and content required.' })

  const note = {
    id: db.data.nextNoteId++,
    claim_id: Number(req.params.id),
    author, content,
    created_at: new Date().toISOString(),
  }
  db.data.notes.push(note)
  writeAudit(Number(req.params.id), 'note_added', author, content.length > 80 ? content.slice(0, 80) + '…' : content)
  await db.write()
  res.status(201).json(note)
})

// ── Audit trail ────────────────────────────────────────────────
router.get('/:id/audit', (req, res) => {
  const logs = db.data.audit_logs
    .filter(l => l.claim_id === Number(req.params.id))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  res.json(logs)
})

export default router
