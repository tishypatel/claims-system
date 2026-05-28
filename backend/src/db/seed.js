import { db } from './database.js'

// ── Schema migration: ensure new collections/fields exist ───────
if (!db.data.documents)   { db.data.documents   = [] }
if (!db.data.audit_logs)  { db.data.audit_logs  = [] }
if (!db.data.nextDocId)   { db.data.nextDocId   = 1 }
if (!db.data.nextAuditId) { db.data.nextAuditId = 1 }

const SLA_DAYS = { motor: 5, property: 10, liability: 15, workers_comp: 7, health: 3, travel: 5 }
function calcPriority(amount) {
  if (amount >= 20000) return 'high'
  if (amount >= 5000)  return 'medium'
  return 'low'
}
for (const c of db.data.claims) {
  if (c.priority === undefined)        c.priority        = calcPriority(Number(c.amount))
  if (c.sla_due === undefined)         c.sla_due         = (() => { const d = new Date(c.created_at); d.setDate(d.getDate() + (SLA_DAYS[c.claim_type] ?? 7)); return d.toISOString() })()
  if (c.approved_amount === undefined) c.approved_amount = null
  if (c.excess === undefined)          c.excess          = 0
  if (c.net_payout === undefined)      c.net_payout      = null
  if (c.payment_status === undefined)  c.payment_status  = null
  if (c.paid_at === undefined)         c.paid_at         = null
  if (c.paid_by === undefined)         c.paid_by         = null
  if (c.fraud_score === undefined)     c.fraud_score     = null
  if (c.fraud_flags === undefined)     c.fraud_flags     = []
  if (c.fraud_confidence === undefined) c.fraud_confidence = null
  if (c.fraud_summary === undefined)   c.fraud_summary   = null
}
await db.write()

if (db.data.claims.length === 0) {
  const now = () => new Date().toISOString()

  const seedClaims = [
    {
      claimant_name: 'James Walker', claimant_email: 'claimant@qbe.com', claimant_phone: '+61 412 345 678',
      policy_number: 'QBE-2024-0012', claim_type: 'motor', amount: 8500,
      incident_date: '2026-04-15', location: 'Sydney, NSW',
      incident_description: 'Vehicle rear-ended at traffic lights on Parramatta Road. Significant boot damage and rear bumper replacement required.',
      status: 'under_review', decision_reason: null, decided_by: null,
    },
    {
      claimant_name: 'Lisa Chen', claimant_email: 'lisa.chen@email.com', claimant_phone: '+61 423 456 789',
      policy_number: 'QBE-2024-0034', claim_type: 'property', amount: 22000,
      incident_date: '2026-03-28', location: 'Melbourne, VIC',
      incident_description: 'Severe storm caused roof damage and flooding to ground floor. Water damage to kitchen and living area.',
      status: 'approved', decision_reason: 'Storm damage verified by assessor. Claim amount within policy limits.', decided_by: 'Sarah Mitchell',
    },
    {
      claimant_name: 'Robert Kim', claimant_email: 'robert.kim@email.com', claimant_phone: '+61 434 567 890',
      policy_number: 'QBE-2024-0056', claim_type: 'workers_comp', amount: 4200,
      incident_date: '2026-04-02', location: 'Brisbane, QLD',
      incident_description: 'Slipped on wet warehouse floor and injured lower back. Unable to work for three weeks.',
      status: 'pending', decision_reason: null, decided_by: null,
    },
    {
      claimant_name: 'Amira Hassan', claimant_email: 'amira.h@email.com', claimant_phone: null,
      policy_number: 'QBE-2024-0078', claim_type: 'travel', amount: 3800,
      incident_date: '2026-04-10', location: 'Bali, Indonesia',
      incident_description: 'Flight cancellation due to volcanic activity resulted in 3-day unexpected hotel stay and alternative flight costs.',
      status: 'rejected', decision_reason: 'Volcanic activity classified as a known event at time of booking. Policy excludes pre-existing travel advisories.', decided_by: 'Sarah Mitchell',
    },
    {
      claimant_name: 'Tom Nguyen', claimant_email: 'tom.n@email.com', claimant_phone: '+61 445 678 901',
      policy_number: 'QBE-2024-0091', claim_type: 'liability', amount: 15000,
      incident_date: '2026-04-20', location: 'Perth, WA',
      incident_description: 'Customer slipped at business premises and suffered fractured wrist. Pursuing public liability claim.',
      status: 'pending', decision_reason: null, decided_by: null,
    },
    {
      claimant_name: 'James Walker', claimant_email: 'claimant@qbe.com', claimant_phone: '+61 412 345 678',
      policy_number: 'QBE-2024-0012', claim_type: 'health', amount: 1200,
      incident_date: '2026-05-01', location: 'Sydney, NSW',
      incident_description: 'Emergency dental work required after sports injury. Crown replacement and root canal treatment.',
      status: 'pending', decision_reason: null, decided_by: null,
    },
  ]

  for (const c of seedClaims) {
    db.data.claims.push({ id: db.data.nextClaimId++, ...c, created_at: now(), updated_at: now() })
  }
  await db.write()
  console.log('Seed complete: 6 demo claims inserted.')
}
