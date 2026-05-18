import { Router } from 'express'
import { db } from '../db/database.js'

const router = Router()

router.get('/', (req, res) => {
  const claims = [...db.data.claims].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  res.json(claims)
})

router.get('/:id', (req, res) => {
  const claim = db.data.claims.find(c => c.id === Number(req.params.id))
  if (!claim) return res.status(404).json({ error: 'Claim not found' })
  res.json(claim)
})

router.post('/', async (req, res) => {
  const { claimant_name, claimant_email, claimant_phone, policy_number, claim_type, amount, incident_date, incident_description, location } = req.body
  if (!claimant_name || !claimant_email || !policy_number || !claim_type || !amount || !incident_date || !incident_description || !location) {
    return res.status(400).json({ error: 'All required fields must be provided.' })
  }
  const claim = {
    id: db.data.nextClaimId++,
    claimant_name, claimant_email, claimant_phone: claimant_phone || null,
    policy_number, claim_type, amount: Number(amount),
    incident_date, incident_description, location,
    status: 'pending', decision_reason: null, decided_by: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }
  db.data.claims.push(claim)
  await db.write()
  res.status(201).json(claim)
})

router.patch('/:id/status', async (req, res) => {
  const allowed = ['pending', 'under_review', 'approved', 'rejected', 'closed']
  const { status, reason, updated_by } = req.body
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status.' })

  const claim = db.data.claims.find(c => c.id === Number(req.params.id))
  if (!claim) return res.status(404).json({ error: 'Claim not found' })

  claim.status = status
  claim.decision_reason = reason || null
  claim.decided_by = updated_by || null
  claim.updated_at = new Date().toISOString()
  await db.write()
  res.json(claim)
})

router.get('/:id/notes', (req, res) => {
  const notes = db.data.notes
    .filter(n => n.claim_id === Number(req.params.id))
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  res.json(notes)
})

router.post('/:id/notes', async (req, res) => {
  const { author, content } = req.body
  if (!author || !content) return res.status(400).json({ error: 'Author and content required.' })

  const note = { id: db.data.nextNoteId++, claim_id: Number(req.params.id), author, content, created_at: new Date().toISOString() }
  db.data.notes.push(note)
  await db.write()
  res.status(201).json(note)
})

export default router
