import { supabase } from './supabase.js'

// Only seed if the claims table is empty
const { count } = await supabase
  .from('claims')
  .select('*', { count: 'exact', head: true })

if (count === 0) {
  const SLA_DAYS = { motor: 5, property: 10, liability: 15, workers_comp: 7, health: 3, travel: 5 }

  function calcPriority(amount) {
    if (amount >= 20000) return 'high'
    if (amount >= 5000)  return 'medium'
    return 'low'
  }

  function calcSlaDue(claimType) {
    const days = SLA_DAYS[claimType] ?? 7
    const d = new Date()
    d.setDate(d.getDate() + days)
    return d.toISOString()
  }

  const seedClaims = [
    {
      claimant_name: 'James Walker', claimant_email: 'claimant@qbe.com', claimant_phone: '+61 412 345 678',
      policy_number: 'QBE-2024-0012', claim_type: 'motor', amount: 8500,
      incident_date: '2026-04-15', location: 'Sydney, NSW',
      incident_description: 'Vehicle rear-ended at traffic lights on Parramatta Road. Significant boot damage and rear bumper replacement required.',
      status: 'under_review', fraud_flags: [],
    },
    {
      claimant_name: 'Lisa Chen', claimant_email: 'lisa.chen@email.com', claimant_phone: '+61 423 456 789',
      policy_number: 'QBE-2024-0034', claim_type: 'property', amount: 22000,
      incident_date: '2026-03-28', location: 'Melbourne, VIC',
      incident_description: 'Severe storm caused roof damage and flooding to ground floor. Water damage to kitchen and living area.',
      status: 'approved', decision_reason: 'Storm damage verified by assessor. Claim amount within policy limits.', decided_by: 'Sarah Mitchell',
      fraud_flags: [], approved_amount: 22000, excess: 500, net_payout: 21500, payment_status: 'pending_payment',
    },
    {
      claimant_name: 'Robert Kim', claimant_email: 'robert.kim@email.com', claimant_phone: '+61 434 567 890',
      policy_number: 'QBE-2024-0056', claim_type: 'workers_comp', amount: 4200,
      incident_date: '2026-04-02', location: 'Brisbane, QLD',
      incident_description: 'Slipped on wet warehouse floor and injured lower back. Unable to work for three weeks.',
      status: 'pending', fraud_flags: [],
    },
    {
      claimant_name: 'Amira Hassan', claimant_email: 'amira.h@email.com', claimant_phone: null,
      policy_number: 'QBE-2024-0078', claim_type: 'travel', amount: 3800,
      incident_date: '2026-04-10', location: 'Bali, Indonesia',
      incident_description: 'Flight cancellation due to volcanic activity resulted in 3-day unexpected hotel stay and alternative flight costs.',
      status: 'rejected', decision_reason: 'Volcanic activity classified as a known event at time of booking. Policy excludes pre-existing travel advisories.', decided_by: 'Sarah Mitchell',
      fraud_flags: [],
    },
    {
      claimant_name: 'Tom Nguyen', claimant_email: 'tom.n@email.com', claimant_phone: '+61 445 678 901',
      policy_number: 'QBE-2024-0091', claim_type: 'liability', amount: 15000,
      incident_date: '2026-04-20', location: 'Perth, WA',
      incident_description: 'Customer slipped at business premises and suffered fractured wrist. Pursuing public liability claim.',
      status: 'pending', fraud_flags: [],
    },
    {
      claimant_name: 'James Walker', claimant_email: 'claimant@qbe.com', claimant_phone: '+61 412 345 678',
      policy_number: 'QBE-2024-0012', claim_type: 'health', amount: 1200,
      incident_date: '2026-05-01', location: 'Sydney, NSW',
      incident_description: 'Emergency dental work required after sports injury. Crown replacement and root canal treatment.',
      status: 'pending', fraud_flags: [],
    },
  ].map(c => ({
    ...c,
    priority: calcPriority(Number(c.amount)),
    sla_due: calcSlaDue(c.claim_type),
  }))

  const { error } = await supabase.from('claims').insert(seedClaims)
  if (error) {
    console.error('Seed failed:', error.message)
  } else {
    console.log('Seed complete: 6 demo claims inserted into Supabase.')
  }
}
