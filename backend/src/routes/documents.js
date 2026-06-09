import { Router } from 'express'
import { supabase } from '../db/supabase.js'
import { writeAudit } from './claims.js'
import multer from 'multer'

const BUCKET = 'claim-documents'

// Memory storage — we stream straight to Supabase Storage, no local disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Only images and PDFs are allowed.'))
  },
})

const router = Router()

// ── List documents for a claim ────────────────────────────────
router.get('/:id/documents', async (req, res) => {
  try {
    const { data, error } = await supabase.from('documents')
      .select('*').eq('claim_id', Number(req.params.id))
      .order('created_at', { ascending: false })
    if (error) throw error
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Upload document ───────────────────────────────────────────
router.post('/:id/documents', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided.' })

  const { uploaded_by, label } = req.body
  const claimId = Number(req.params.id)

  // Sanitise filename and build storage path
  const safeName    = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `claims/${claimId}/${Date.now()}-${safeName}`

  try {
    // Upload buffer to Supabase Storage
    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, req.file.buffer, {
        contentType:  req.file.mimetype,
        cacheControl: '3600',
        upsert: false,
      })
    if (uploadErr) throw uploadErr

    // Get permanent public URL
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)

    // Save metadata to DB
    const { data: doc, error: dbErr } = await supabase.from('documents').insert({
      claim_id:      claimId,
      storage_path:  storagePath,
      public_url:    urlData.publicUrl,
      original_name: req.file.originalname,
      label:         label || req.file.originalname,
      mimetype:      req.file.mimetype,
      size:          req.file.size,
      uploaded_by:   uploaded_by || 'Unknown',
    }).select().single()
    if (dbErr) throw dbErr

    await writeAudit(claimId, 'document_uploaded', uploaded_by || 'Unknown',
      `Uploaded: ${req.file.originalname} (${(req.file.size / 1024).toFixed(1)} KB)`)

    res.status(201).json(doc)
  } catch (err) {
    console.error('Upload error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── Serve / redirect to a stored file ─────────────────────────
// The path param is the full storage_path encoded as a URL param
router.get('/file/:storagePath(*)', async (req, res) => {
  try {
    const storagePath = decodeURIComponent(req.params.storagePath)
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
    res.redirect(data.publicUrl)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Delete a document ─────────────────────────────────────────
router.delete('/doc/:docId', async (req, res) => {
  try {
    const { data: doc, error: fetchErr } = await supabase.from('documents')
      .select('storage_path, claim_id').eq('id', Number(req.params.docId)).single()
    if (fetchErr) return res.status(404).json({ error: 'Document not found.' })

    // Delete from Storage first
    await supabase.storage.from(BUCKET).remove([doc.storage_path])

    // Delete metadata row
    const { error: delErr } = await supabase.from('documents')
      .delete().eq('id', Number(req.params.docId))
    if (delErr) throw delErr

    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
