import { Router } from 'express'
import { supabase } from '../db/supabase.js'
import { getNvidiaClient, getModel, getVisionModel, chat, parseJSON } from '../services/nvidia-client.js'
import multer from 'multer'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const router = Router()

// OCR uses temp memory storage (file is not persisted)
const tmpUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('OCR supports images only.'))
  },
})

// ── OCR: extract claim fields from uploaded image ─────────────
router.post('/ocr', tmpUpload.single('document'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided.' })
  try {
    const client   = getNvidiaClient()
    const base64   = req.file.buffer.toString('base64')
    const mediaType = req.file.mimetype

    const completion = await client.chat.completions.create({
      model: getVisionModel(),
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mediaType};base64,${base64}` } },
          { type: 'text', text: `You are an insurance document analyser. Extract information from this document and return ONLY a valid JSON object. Use null for any field you cannot find.

Return this exact JSON structure:
{
  "claimant_name": string | null,
  "claimant_email": string | null,
  "claimant_phone": string | null,
  "policy_number": string | null,
  "claim_type": "motor" | "property" | "liability" | "workers_comp" | "health" | "travel" | null,
  "amount": number | null,
  "incident_date": "YYYY-MM-DD" | null,
  "location": string | null,
  "incident_description": string | null,
  "confidence": number
}

confidence is 0-100 reflecting how clearly you could read the document.
For claim_type infer from context (car accident=motor, storm damage=property).
Return ONLY the JSON. No markdown, no explanation.` },
        ],
      }],
      temperature: 0.1,
      max_tokens: 1024,
    })

    const text = completion.choices[0].message.content.trim()
    res.json(parseJSON(text))
  } catch (err) {
    console.error('OCR error:', err.message)
    res.status(500).json({ error: err.message.includes('NVIDIA_API_KEY') ? 'AI service not configured.' : 'Failed to extract document data.' })
  }
})

// ── Triage endpoint ───────────────────────────────────────────
router.post('/claims/:id/triage', async (req, res) => {
  try {
    const { data: claim } = await supabase.from('claims').select('*').eq('id', Number(req.params.id)).single()
    if (!claim) return res.status(404).json({ error: 'Claim not found' })
    const result = await runTriage(claim)
    res.json(result)
  } catch (err) {
    console.error('Triage error:', err.message)
    res.status(500).json({ error: 'Triage failed.' })
  }
})

// ── Risk scoring endpoint ─────────────────────────────────────
router.post('/claims/:id/risk-score', async (req, res) => {
  try {
    const { data: claim } = await supabase.from('claims').select('*').eq('id', Number(req.params.id)).single()
    if (!claim) return res.status(404).json({ error: 'Claim not found' })
    const result = await runFraudAnalysis(claim)
    res.json(result)
  } catch (err) {
    console.error('Risk error:', err.message)
    res.status(500).json({ error: 'Failed to assess risk.' })
  }
})

// ── Start analysis: runs fraud + triage in parallel, holds connection ──
router.post('/claims/:id/start-analysis', async (req, res) => {
  const { data: claim } = await supabase.from('claims').select('*').eq('id', Number(req.params.id)).single()
  if (!claim) return res.status(404).json({ error: 'Claim not found' })

  await supabase.from('claims').update({
    ai_analysis_status: 'running',
    ai_analysis_started: new Date().toISOString(),
    ai_analysis_error: null,
  }).eq('id', claim.id)

  try {
    await Promise.all([runFraudAnalysis(claim), runTriage(claim)])
    await supabase.from('claims').update({
      ai_analysis_status: 'complete',
      ai_analysis_completed: new Date().toISOString(),
    }).eq('id', claim.id)
    res.json({ status: 'complete' })
  } catch (err) {
    console.error('[start-analysis] error:', err.message)
    await supabase.from('claims').update({
      ai_analysis_status: 'error',
      ai_analysis_error: err.message,
    }).eq('id', claim.id)
    res.status(500).json({ status: 'error', error: err.message })
  }
})

// ── AI decision suggestion ────────────────────────────────────
router.post('/claims/:id/suggest-decision', async (req, res) => {
  try {
    const { data: claim } = await supabase.from('claims').select('*').eq('id', Number(req.params.id)).single()
    if (!claim) return res.status(404).json({ error: 'Claim not found' })

    const { data: notesRows } = await supabase.from('notes')
      .select('author, content').eq('claim_id', claim.id).order('created_at', { ascending: true })
    const { data: docs } = await supabase.from('documents')
      .select('id').eq('claim_id', claim.id)

    const notes = notesRows?.map(n => `[${n.author}]: ${n.content}`).join('\n') || 'None'

    const text = await chat([{
      role: 'user',
      content: `You are a senior insurance adjudicator AI assistant. Analyse this claim and provide a structured recommendation.

CLAIM DETAILS:
- ID: #${String(claim.id).padStart(5,'0')}
- Type: ${claim.claim_type}
- Claimed Amount: $${claim.amount} AUD
- Incident Date: ${claim.incident_date}
- Location: ${claim.location}
- Description: ${claim.incident_description}
- Days since filed: ${Math.floor((Date.now() - new Date(claim.created_at)) / 86400000)}
- Supporting documents: ${docs?.length || 0}
- Fraud risk: ${claim.fraud_score || 'not assessed'}
- Fraud flags: ${claim.fraud_flags?.join(', ') || 'none'}
- Triage complexity: ${claim.triage?.complexity || 'not assessed'}
- Prior triage prediction: ${claim.triage?.predicted_outcome || 'n/a'}

ADJUDICATOR NOTES:
${notes}

Return ONLY this JSON:
{
  "recommendation": "approve" | "reject" | "investigate_further",
  "confidence_percentage": number,
  "approval_likelihood": number,
  "suggested_approved_amount": number | null,
  "suggested_excess": number | null,
  "reason": "string (2-3 sentences, suitable for claimant)",
  "key_considerations": ["string"],
  "reasoning_chain": ["Step 1: ...", "Step 2: ...", "Step 3: ..."],
  "evidence_supporting": ["string"],
  "evidence_against": ["string"],
  "risk_factors": ["string"]
}

confidence_percentage and approval_likelihood are 0-100 integers.
Return ONLY the JSON.`,
    }], { max_tokens: 2048 })

    res.json(parseJSON(text))
  } catch (err) {
    console.error('Suggest decision error:', err.message)
    res.status(500).json({ error: err.message.includes('NVIDIA_API_KEY') ? 'AI service not configured.' : 'Failed to generate suggestion.' })
  }
})

// ── Exported helpers ──────────────────────────────────────────

export async function runTriage(claim) {
  const text = await chat([{
    role: 'user',
    content: `You are an expert insurance claims triage system. Analyse this claim and produce a structured triage assessment.

CLAIM:
- Type: ${claim.claim_type}
- Amount: $${claim.amount} AUD
- Incident: ${claim.incident_date} at ${claim.location}
- Description: ${claim.incident_description}
- Policy: ${claim.policy_number}
- Filed: ${claim.created_at}
- Days between incident and filing: ${Math.floor((new Date(claim.created_at) - new Date(claim.incident_date)) / 86400000)}

Return ONLY this JSON:
{
  "complexity": "simple" | "moderate" | "complex",
  "predicted_outcome": "likely_approve" | "likely_reject" | "uncertain",
  "approval_probability": number,
  "estimated_processing_days": number,
  "recommended_handler": "standard" | "specialist" | "legal_review",
  "auto_risk": "low" | "medium" | "high",
  "key_factors": ["string"],
  "reasoning": "string (2-3 sentences summarising triage decision)",
  "confidence": number
}

approval_probability: 0-100 integer likelihood of approval.
confidence: 0-100 integer certainty in this triage assessment.
Return ONLY the JSON.`,
  }], { max_tokens: 2048 })

  const result = parseJSON(text)

  // Normalise field name typo some models produce
  if (!result.recommended_handler && result.recommended_recommended_handler) {
    result.recommended_handler = result.recommended_recommended_handler
  }
  // Normalise 0-1 decimals → 0-100 integers (some models ignore the 0-100 spec)
  if (result.approval_probability != null && result.approval_probability < 1) {
    result.approval_probability = Math.round(result.approval_probability * 100)
  }
  if (result.confidence != null && result.confidence < 1) {
    result.confidence = Math.round(result.confidence * 100)
  }

  await supabase.from('claims').update({ triage: result }).eq('id', claim.id)
  await supabase.from('audit_logs').insert({
    claim_id: claim.id,
    action: 'triage_completed',
    actor: 'AI Triage System',
    detail: `Triage: ${result.complexity} complexity | ${result.predicted_outcome} | ${result.approval_probability}% approval probability`,
  })
  return result
}

export async function runFraudAnalysis(claim) {
  const incidentToFileDays = Math.floor((new Date(claim.created_at) - new Date(claim.incident_date)) / 86400000)

  const text = await chat([{
    role: 'user',
    content: `You are a senior insurance fraud analyst AI. Analyse this claim for fraud indicators.

CLAIM:
- Type: ${claim.claim_type}
- Amount: $${claim.amount} AUD
- Incident: ${claim.incident_date} at ${claim.location}
- Description: ${claim.incident_description}
- Days between incident and filing: ${incidentToFileDays}
- Claimant: ${claim.claimant_name} (${claim.claimant_email})
- Policy: ${claim.policy_number}

Return ONLY this JSON:
{
  "score": "low" | "medium" | "high",
  "confidence": number,
  "flags": ["string"],
  "summary": "string (one sentence)",
  "recommended_action": "string (one sentence for adjudicator)",
  "reasoning_chain": ["Step 1: ...", "Step 2: ...", "Step 3: ..."],
  "behavioral_indicators": ["string"],
  "financial_indicators": ["string"]
}

confidence is a 0-100 integer.
Return ONLY the JSON.`,
  }], { max_tokens: 2048 })

  const riskData = parseJSON(text)

  // Normalise 0-1 confidence → 0-100
  if (riskData.confidence != null && riskData.confidence < 1) {
    riskData.confidence = Math.round(riskData.confidence * 100)
  }

  await supabase.from('claims').update({
    fraud_score:      riskData.score,
    fraud_flags:      riskData.flags || [],
    fraud_confidence: riskData.confidence,
    fraud_summary:    riskData.summary,
    fraud_reasoning:  riskData.reasoning_chain || [],
    fraud_behavioral: riskData.behavioral_indicators || [],
    fraud_financial:  riskData.financial_indicators || [],
  }).eq('id', claim.id)

  await supabase.from('audit_logs').insert({
    claim_id: claim.id,
    action: 'risk_assessed',
    actor: 'AI Fraud System',
    detail: `Fraud risk: ${riskData.score.toUpperCase()} (${riskData.confidence}% confidence) — ${riskData.summary}`,
  })
  return riskData
}

export default router
