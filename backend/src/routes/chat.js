import { Router } from 'express'
import { db } from '../db/database.js'
import { chat, getChatModel } from '../services/nvidia-client.js'

const router = Router()

router.post('/chat', async (req, res) => {
  const { messages, role, email, claim_id } = req.body
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required.' })
  }

  // Limit conversation history to last 12 messages to stay within token budget
  const recent = messages.slice(-12)

  const systemPrompt = buildSystemPrompt(role, email, claim_id, recent)

  try {
    const reply = await chat(
      [{ role: 'system', content: systemPrompt }, ...recent],
      { max_tokens: 512, temperature: 0.3, model: getChatModel() },
    )
    res.json({ reply })
  } catch (err) {
    console.error('Chat error:', err.message)
    res.status(500).json({
      error: err.message.includes('NVIDIA_API_KEY')
        ? 'AI service not configured.'
        : 'Chat service unavailable.',
    })
  }
})

function buildSystemPrompt(role, email, claim_id, messages) {
  const isGuest = !role || role === 'guest'

  if (isGuest) {
    const claimContext = extractGuestClaimContext(messages)
    return `You are ClaimsHub Assistant, a friendly AI helper for an insurance claims management system.

You are in GUEST MODE. You can:
- Help users check the status of an existing claim when they provide a reference number
- Answer general questions about the claims process and required documents
- Guide users to log in if they want to file a claim or see their full history

You CANNOT access personal account details without a reference number, file claims for users, or make claim decisions.

If a user asks to file a new claim, tell them to log in first.

${claimContext}

Keep responses concise (2-4 sentences where possible). Be empathetic — people filing claims are often stressed.`
  }

  if (role === 'claimant') {
    const userClaims = email
      ? db.data.claims.filter(c => c.claimant_email === email)
      : []
    const claimList = userClaims.length
      ? userClaims.map(c =>
          `- Claim #${String(c.id).padStart(5, '0')}: ${c.claim_type} | $${Number(c.amount).toLocaleString()} AUD | Status: ${c.status}` +
          (c.status === 'approved' ? ` | Net payout: $${Number(c.net_payout ?? 0).toLocaleString()} AUD` : '') +
          (c.decision_reason ? ` | Note: ${c.decision_reason}` : ''),
        ).join('\n')
      : 'No claims on file.'

    return `You are ClaimsHub Assistant helping a claimant with their insurance claims.

CLAIMANT: ${email || 'Unknown'}

THEIR CLAIMS:
${claimList}

Help them understand:
- Status of their specific claims
- What each status means (pending → under review → approved/rejected → closed)
- What to do next for their claim type
- Documents they may need to provide

Be empathetic, clear, and concise. Never share information about other claimants.`
  }

  if (role === 'adjudicator' || role === 'manager') {
    const all = db.data.claims
    const pending = all.filter(c => c.status === 'pending').length
    const underReview = all.filter(c => c.status === 'under_review').length
    const approved = all.filter(c => c.status === 'approved').length
    const rejected = all.filter(c => c.status === 'rejected').length
    const overdue = all.filter(c =>
      !['approved', 'rejected', 'closed'].includes(c.status) &&
      c.sla_due && new Date(c.sla_due) < new Date(),
    ).length
    const highRisk = all.filter(c => c.fraud_score === 'high').length
    const totalExposure = all.reduce((s, c) => s + Number(c.amount), 0)

    let specificClaimCtx = ''
    if (claim_id) {
      const sc = all.find(c => c.id === Number(claim_id))
      if (sc) {
        specificClaimCtx = `
CURRENT CLAIM CONTEXT (#${String(sc.id).padStart(5, '0')}):
- ${sc.claim_type} | $${Number(sc.amount).toLocaleString()} AUD | ${sc.status} | Priority: ${sc.priority}
- Fraud risk: ${sc.fraud_score || 'not assessed'}${sc.fraud_summary ? ' — ' + sc.fraud_summary : ''}
- Triage: ${sc.triage?.complexity || 'not assessed'} complexity | ${sc.triage?.predicted_outcome || 'n/a'}
- Filed: ${new Date(sc.created_at).toLocaleDateString('en-AU')} | SLA due: ${sc.sla_due ? new Date(sc.sla_due).toLocaleDateString('en-AU') : 'n/a'}
`
      }
    }

    return `You are ClaimsHub Assistant — an AI advisor for insurance ${role === 'manager' ? 'managers' : 'adjudicators'}.

ROLE: ${role.charAt(0).toUpperCase() + role.slice(1)}${email ? ` | USER: ${email}` : ''}

PORTFOLIO SNAPSHOT:
- Total claims: ${all.length} | Total exposure: $${totalExposure.toLocaleString()} AUD
- Pending: ${pending} | Under review: ${underReview} | Approved: ${approved} | Rejected: ${rejected}
- SLA overdue: ${overdue} | High fraud risk: ${highRisk}
${specificClaimCtx}
You can help with claim assessment, fraud pattern analysis, SLA prioritisation, adjudication guidance, and process questions.
Be professional and analytical. Provide actionable, concise insights.`
  }

  return 'You are ClaimsHub Assistant. Help the user with their insurance claims questions.'
}

function extractGuestClaimContext(messages) {
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content || ''
  // Match patterns: "00001", "#1", "claim 5", "reference 00003"
  const refMatch = lastUserMsg.match(/(?:claim|ref(?:erence)?|#|number)?\s*#?\s*0*(\d{1,5})\b/i)
  if (!refMatch) return ''

  const claimId = parseInt(refMatch[1], 10)
  const claim = db.data.claims.find(c => c.id === claimId)
  if (!claim) {
    return `\nCLAIM LOOKUP: No claim found with reference #${String(claimId).padStart(5, '0')}.`
  }

  const daysAgo = Math.floor((Date.now() - new Date(claim.updated_at)) / 86400000)
  return `
CLAIM STATUS (reference #${String(claim.id).padStart(5, '0')}):
- Type: ${claim.claim_type} | Status: ${claim.status}
- Filed: ${new Date(claim.created_at).toLocaleDateString('en-AU')} | Last updated: ${daysAgo === 0 ? 'today' : `${daysAgo}d ago`}
${claim.status === 'approved' ? `- Approved payout: $${Number(claim.net_payout ?? 0).toLocaleString()} AUD | Payment: ${claim.payment_status || 'pending'}` : ''}
${claim.decision_reason ? `- Note: ${claim.decision_reason}` : ''}
Use this information to answer the user's status question.`
}

export default router
