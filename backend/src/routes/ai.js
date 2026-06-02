import { Router } from 'express'
import { db } from '../db/database.js'
import { getNvidiaClient, getModel, getVisionModel, chat, parseJSON } from '../services/nvidia-client.js'
import multer from 'multer'
import { readFileSync, existsSync, mkdirSync } from 'fs'
import { unlink } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
// Use /tmp on Vercel (read-only fs), local uploads/ otherwise
const ocrDir = process.env.VERCEL ? '/tmp/uploads/ocr-tmp' : path.join(__dirname, '../../../uploads/ocr-tmp')
if (!existsSync(ocrDir)) mkdirSync(ocrDir, { recursive: true })

const tmpUpload = multer({
  dest: ocrDir,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('OCR supports images only.'))
  },
})

const router = Router()

// ── OCR: extract claim fields from uploaded image ─────────────
router.post('/ocr', tmpUpload.single('document'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided.' })
  try {
    const client    = getNvidiaClient()
    const fileBuffer = readFileSync(req.file.path)
    const base64    = fileBuffer.toString('base64')
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
  } finally {
    try { await unlink(req.file.path) } catch {}
  }
})

// ── Triage: full ML-style claim assessment ────────────────────
router.post('/claims/:id/triage', async (req, res) => {
  const claim = db.data.claims.find(c => c.id === Number(req.params.id))
  if (!claim) return res.status(404).json({ error: 'Claim not found' })
  try {
    const result = await runTriage(claim)
    res.json(result)
  } catch (err) {
    console.error('Triage error:', err.message)
    res.status(500).json({ error: err.message.includes('NVIDIA_API_KEY') ? 'AI service not configured.' : 'Triage failed.' })
  }
})

// ── Risk scoring: fraud analysis ──────────────────────────────
router.post('/claims/:id/risk-score', async (req, res) => {
  const claim = db.data.claims.find(c => c.id === Number(req.params.id))
  if (!claim) return res.status(404).json({ error: 'Claim not found' })
  try {
    const result = await runFraudAnalysis(claim)
    res.json(result)
  } catch (err) {
    console.error('Risk error:', err.message)
    res.status(500).json({ error: err.message.includes('NVIDIA_API_KEY') ? 'AI service not configured.' : 'Failed to assess risk.' })
  }
})

// ── AI decision suggestion with confidence + reasoning chain ──
router.post('/claims/:id/suggest-decision', async (req, res) => {
  const claim = db.data.claims.find(c => c.id === Number(req.params.id))
  if (!claim) return res.status(404).json({ error: 'Claim not found' })

  const notes = db.data.notes
    .filter(n => n.claim_id === claim.id)
    .map(n => `[${n.author}]: ${n.content}`)
    .join('\n') || 'None'

  const docs = db.data.documents.filter(d => d.claim_id === claim.id)

  try {
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
- Supporting documents: ${docs.length}
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
  "reasoning_chain": [
    "Step 1: ...",
    "Step 2: ...",
    "Step 3: ..."
  ],
  "evidence_supporting": ["string"],
  "evidence_against": ["string"],
  "risk_factors": ["string"]
}

reasoning_chain: step-by-step logic you followed (3-5 steps).
evidence_supporting: facts that support approving.
evidence_against: facts that raise concerns.
confidence_percentage: 0-100, how certain you are in this recommendation.
approval_likelihood: 0-100, probability this claim should be approved regardless of your recommendation.
Return ONLY the JSON.`,
    }], { max_tokens: 1500 })

    const suggestion = parseJSON(text)
    res.json(suggestion)
  } catch (err) {
    console.error('Suggest decision error:', err.message)
    res.status(500).json({ error: err.message.includes('NVIDIA_API_KEY') ? 'AI service not configured.' : 'Failed to generate suggestion.' })
  }
})

// ── Exported helpers for auto-analysis on claim creation ──────
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

approval_probability: 0-100 likelihood of approval based on claim characteristics.
estimated_processing_days: realistic days to resolve this type of claim.
recommended_handler: what type of adjudicator expertise is needed.
confidence: 0-100 how certain you are in this triage assessment.
Return ONLY the JSON.`,
  }], { max_tokens: 1024 })

  const result = parseJSON(text)

  // Normalise field name typo some models produce
  if (!result.recommended_handler && result.recommended_recommended_handler) {
    result.recommended_handler = result.recommended_recommended_handler
  }

  const claim_ = db.data.claims.find(c => c.id === claim.id)
  if (claim_) {
    claim_.triage = result
    claim_.updated_at = new Date().toISOString()

    db.data.audit_logs.push({
      id: db.data.nextAuditId++,
      claim_id: claim.id,
      action: 'triage_completed',
      actor: 'AI Triage System',
      detail: `Triage: ${result.complexity} complexity | ${result.predicted_outcome} | ${result.approval_probability}% approval probability`,
      created_at: new Date().toISOString(),
    })
    await db.write()
  }
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
  "reasoning_chain": [
    "Step 1: ...",
    "Step 2: ...",
    "Step 3: ..."
  ],
  "behavioral_indicators": ["string"],
  "financial_indicators": ["string"]
}

flags: specific red flags found (e.g. "Amount unusually high for claim type").
behavioral_indicators: patterns in how the claim was filed.
financial_indicators: financial anomalies.
reasoning_chain: step-by-step fraud analysis logic.
Return ONLY the JSON.`,
  }], { max_tokens: 1024 })

  const riskData = parseJSON(text)

  const claim_ = db.data.claims.find(c => c.id === claim.id)
  if (claim_) {
    claim_.fraud_score      = riskData.score
    claim_.fraud_flags      = riskData.flags || []
    claim_.fraud_confidence = riskData.confidence
    claim_.fraud_summary    = riskData.summary
    claim_.fraud_reasoning  = riskData.reasoning_chain || []
    claim_.fraud_behavioral = riskData.behavioral_indicators || []
    claim_.fraud_financial  = riskData.financial_indicators || []
    claim_.updated_at       = new Date().toISOString()

    db.data.audit_logs.push({
      id: db.data.nextAuditId++,
      claim_id: claim.id,
      action: 'risk_assessed',
      actor: 'AI Fraud System',
      detail: `Fraud risk: ${riskData.score.toUpperCase()} (${riskData.confidence}% confidence) — ${riskData.summary}`,
      created_at: new Date().toISOString(),
    })
    await db.write()
  }
  return riskData
}

export default router
