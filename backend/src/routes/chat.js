import { Router } from 'express'
import { supabase } from '../db/supabase.js'
import { chat, getChatModel } from '../services/nvidia-client.js'

const router = Router()
const HISTORY_DAYS = 30   // how far back to load chat history
const MAX_HISTORY  = 50   // max messages to load per session

// ── GET history for a session ─────────────────────────────────
router.get('/chat/history', async (req, res) => {
  const { session_id } = req.query
  if (!session_id) return res.status(400).json({ error: 'session_id required.' })

  try {
    const cutoff = new Date(Date.now() - HISTORY_DAYS * 86400000).toISOString()
    const { data, error } = await supabase
      .from('chat_history')
      .select('role, content, created_at')
      .eq('session_id', session_id)
      .gte('created_at', cutoff)
      .order('created_at', { ascending: true })
      .limit(MAX_HISTORY)
    if (error) throw error
    res.json(data || [])
  } catch (err) {
    console.error('Chat history fetch error:', err.message)
    res.status(500).json({ error: 'Could not load chat history.' })
  }
})

// ── POST a message and get a reply ────────────────────────────
router.post('/chat', async (req, res) => {
  const { messages, role, email, claim_id, session_id } = req.body
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required.' })
  }

  // Limit to last 12 for token budget
  const recent = messages.slice(-12)
  const systemPrompt = await buildSystemPrompt(role, email, claim_id)

  try {
    const reply = await chat(
      [{ role: 'system', content: systemPrompt }, ...recent],
      { max_tokens: 200, temperature: 0.3, model: getChatModel() },
    )

    // Persist the last user message + this reply (fire-and-forget)
    if (session_id) {
      const lastUser = [...recent].reverse().find(m => m.role === 'user')
      if (lastUser) {
        supabase.from('chat_history').insert([
          {
            session_id, user_email: email || null, user_role: role || 'guest',
            claim_id: claim_id || null, role: 'user', content: lastUser.content,
          },
          {
            session_id, user_email: email || null, user_role: role || 'guest',
            claim_id: claim_id || null, role: 'assistant', content: reply,
          },
        ]).then(({ error }) => {
          if (error) console.error('Chat history save error:', error.message)
        })
      }
    }

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

// ── System prompt builder ─────────────────────────────────────
async function buildSystemPrompt(role, email, claim_id) {
  const isGuest = !role || role === 'guest'

  if (isGuest) {
    return `You are ClaimsHub Assistant, an AI helper for an insurance claims system.

RULES:
- Answer in 1-3 sentences max. Stop when the question is answered.
- Only address exactly what was asked. Do not add extra tips or related info.
- If asked a vague question, give one short sentence and ask what specifically they want.
- If a user wants to file a claim, tell them to log in first (one sentence).`
  }

  if (role === 'claimant') {
    let claimList = 'No claims on file.'
    if (email) {
      const { data } = await supabase.from('claims')
        .select('id, claim_type, amount, status, net_payout, decision_reason')
        .eq('claimant_email', email)
        .order('created_at', { ascending: false })
      if (data?.length) {
        claimList = data.map(c =>
          `- Claim #${String(c.id).padStart(5, '0')}: ${c.claim_type} | $${Number(c.amount).toLocaleString()} AUD | Status: ${c.status}` +
          (c.status === 'approved' ? ` | Net payout: $${Number(c.net_payout ?? 0).toLocaleString()} AUD` : '') +
          (c.decision_reason ? ` | Note: ${c.decision_reason}` : ''),
        ).join('\n')
      }
    }
    return `You are ClaimsHub Assistant helping a claimant with their insurance claims.

CLAIMANT: ${email || 'Unknown'}

THEIR CLAIMS:
${claimList}

RULES:
- Answer in 1-3 sentences max. Stop when the question is answered.
- Only address exactly what was asked. Do not volunteer related information.
- If asked a vague question, give one short answer and ask what specifically they want.
- Never share information about other claimants.`
  }

  if (role === 'adjudicator' || role === 'manager') {
    const { data: all } = await supabase.from('claims')
      .select('id, status, sla_due, fraud_score, amount')
    const claims = all || []

    const pending    = claims.filter(c => c.status === 'pending').length
    const underReview = claims.filter(c => c.status === 'under_review').length
    const approved   = claims.filter(c => c.status === 'approved').length
    const rejected   = claims.filter(c => c.status === 'rejected').length
    const overdue    = claims.filter(c =>
      !['approved', 'rejected', 'closed'].includes(c.status) &&
      c.sla_due && new Date(c.sla_due) < new Date()
    ).length
    const highRisk   = claims.filter(c => c.fraud_score === 'high').length
    const totalExposure = claims.reduce((s, c) => s + Number(c.amount || 0), 0)

    let specificClaimCtx = ''
    if (claim_id) {
      const { data: sc } = await supabase.from('claims').select('*')
        .eq('id', Number(claim_id)).single()
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
- Total claims: ${claims.length} | Total exposure: $${totalExposure.toLocaleString()} AUD
- Pending: ${pending} | Under review: ${underReview} | Approved: ${approved} | Rejected: ${rejected}
- SLA overdue: ${overdue} | High fraud risk: ${highRisk}
${specificClaimCtx}
RULES:
- Answer in 1-3 sentences max. Stop when the question is answered.
- Only address exactly what was asked. Do not volunteer related information.
- If asked a broad question (e.g. "portfolio summary"), give a 2-sentence overview and stop.
- Use the data above only when it's directly relevant to what was asked.`
  }

  return 'You are ClaimsHub Assistant. Answer in 1-3 sentences max. Only address exactly what was asked.'
}

export default router
