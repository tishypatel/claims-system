import { Router } from 'express'
import { supabase } from '../db/supabase.js'
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

export async function writeAudit(claimId, action, actor, detail) {
  await supabase.from('audit_logs').insert({
    claim_id: claimId,
    action,
    actor: actor || 'System',
    detail,
  })
}

// ── List claims (role-based filtering) ────────────────────────
router.get('/', async (req, res) => {
  try {
    const { role, email } = req.query
    let query = supabase.from('claims').select('*').order('created_at', { ascending: false })
    if (role === 'claimant' && email) query = query.eq('claimant_email', email)
    const { data, error } = await query
    if (error) throw error
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Get single claim ───────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('claims').select('*')
      .eq('id', Number(req.params.id)).single()
    if (error) return res.status(404).json({ error: 'Claim not found' })
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.setHeader('Pragma', 'no-cache')
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Create claim ───────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const {
      claimant_name, claimant_email, claimant_phone,
      policy_number, claim_type, amount, incident_date,
      incident_description, location,
    } = req.body

    if (!claimant_name || !claimant_email || !policy_number || !claim_type || !amount || !incident_date || !incident_description || !location) {
      return res.status(400).json({ error: 'All required fields must be provided.' })
    }

    const now = new Date().toISOString()
    const { data: claim, error } = await supabase.from('claims').insert({
      claimant_name, claimant_email,
      claimant_phone: claimant_phone || null,
      policy_number, claim_type,
      amount: Number(amount),
      incident_date, incident_description, location,
      status: 'pending',
      fraud_flags: [],
      priority: calcPriority(Number(amount)),
      sla_due: calcSlaDue(now, claim_type),
    }).select().single()
    if (error) throw error

    await writeAudit(claim.id, 'claim_created', claimant_name,
      `Claim filed: ${claim_type} for $${Number(amount).toLocaleString()} AUD`)

    res.status(201).json(claim)

    // Background AI analysis — does not block the response
    Promise.all([
      runTriage(claim).catch(e => console.error('Auto-triage failed:', e.message)),
      runFraudAnalysis(claim).catch(e => console.error('Auto-fraud failed:', e.message)),
    ])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Update status ──────────────────────────────────────────────
router.patch('/:id/status', async (req, res) => {
  try {
    const allowed = ['pending', 'under_review', 'approved', 'rejected', 'closed']
    const { status, reason, updated_by, approved_amount, excess } = req.body
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status.' })

    const { data: existing, error: fetchErr } = await supabase
      .from('claims').select('status, amount').eq('id', Number(req.params.id)).single()
    if (fetchErr) return res.status(404).json({ error: 'Claim not found' })

    const updates = {
      status,
      decision_reason: reason || null,
      decided_by: updated_by || null,
    }

    if (status === 'approved') {
      const appAmt = approved_amount != null ? Number(approved_amount) : existing.amount
      const exc    = excess != null ? Number(excess) : 0
      updates.approved_amount = appAmt
      updates.excess          = exc
      updates.net_payout      = Math.max(0, appAmt - exc)
      updates.payment_status  = 'pending_payment'
    }

    const { data: claim, error } = await supabase
      .from('claims').update(updates)
      .eq('id', Number(req.params.id)).select().single()
    if (error) throw error

    await writeAudit(claim.id, 'status_changed', updated_by || 'System',
      `Status changed from ${existing.status} → ${status}${reason ? ': ' + reason : ''}`)
    res.json(claim)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Mark as paid ───────────────────────────────────────────────
router.patch('/:id/payment', async (req, res) => {
  try {
    const { paid_by } = req.body
    const { data: existing, error: fetchErr } = await supabase
      .from('claims').select('status, net_payout').eq('id', Number(req.params.id)).single()
    if (fetchErr) return res.status(404).json({ error: 'Claim not found' })
    if (existing.status !== 'approved') {
      return res.status(400).json({ error: 'Claim must be approved before marking as paid.' })
    }

    const { data: claim, error } = await supabase.from('claims')
      .update({ payment_status: 'paid', paid_at: new Date().toISOString(), paid_by: paid_by || null })
      .eq('id', Number(req.params.id)).select().single()
    if (error) throw error

    await writeAudit(claim.id, 'payment_made', paid_by || 'System',
      `Settlement paid: $${Number(existing.net_payout || 0).toLocaleString()} AUD`)
    res.json(claim)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Notes ──────────────────────────────────────────────────────
router.get('/:id/notes', async (req, res) => {
  try {
    const { data, error } = await supabase.from('notes')
      .select('*').eq('claim_id', Number(req.params.id))
      .order('created_at', { ascending: true })
    if (error) throw error
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/:id/notes', async (req, res) => {
  try {
    const { author, content, is_doc_request, author_role } = req.body
    if (!author || !content) return res.status(400).json({ error: 'Author and content required.' })

    const { data: note, error } = await supabase.from('notes').insert({
      claim_id: Number(req.params.id),
      author, content,
      author_role: author_role || 'adjudicator',
      is_doc_request: !!is_doc_request,
    }).select().single()
    if (error) throw error

    await writeAudit(Number(req.params.id), 'note_added', author,
      (is_doc_request ? '[DOC REQUEST] ' : '') + (content.length > 80 ? content.slice(0, 80) + '…' : content))
    res.status(201).json(note)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Workflow stage ─────────────────────────────────────────────
router.patch('/:id/workflow-stage', async (req, res) => {
  try {
    const { stage, updated_by } = req.body
    const updates = { workflow_stage: Number(stage) }

    // Auto-move to under_review when adjudicator starts stage 2+
    const { data: existing } = await supabase
      .from('claims').select('status').eq('id', Number(req.params.id)).single()
    if (Number(stage) >= 2 && existing?.status === 'pending') {
      updates.status = 'under_review'
      await writeAudit(Number(req.params.id), 'status_changed', updated_by || 'System',
        'Status changed from pending → under_review')
    }

    const { data, error } = await supabase.from('claims')
      .update(updates).eq('id', Number(req.params.id)).select().single()
    if (error) throw error
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Audit trail ────────────────────────────────────────────────
router.get('/:id/audit', async (req, res) => {
  try {
    const { data, error } = await supabase.from('audit_logs')
      .select('*').eq('claim_id', Number(req.params.id))
      .order('created_at', { ascending: false })
    if (error) throw error
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
