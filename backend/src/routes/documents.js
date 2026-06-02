import { Router } from 'express'
import { db } from '../db/database.js'
import multer from 'multer'
import { existsSync, mkdirSync, createReadStream } from 'fs'
import { unlink } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
// Use /tmp on Vercel (read-only fs), local uploads/ otherwise
const uploadsDir = process.env.VERCEL ? '/tmp/uploads' : path.join(__dirname, '../../../uploads')
if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true })

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    cb(null, `${unique}${path.extname(file.originalname)}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Only images and PDFs are allowed.'))
  },
})

const router = Router()

// List documents for a claim
router.get('/:id/documents', (req, res) => {
  const docs = db.data.documents
    .filter(d => d.claim_id === Number(req.params.id))
    .sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at))
  res.json(docs)
})

// Upload document to a claim
router.post('/:id/documents', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided.' })

  const { uploaded_by, label } = req.body
  const doc = {
    id: db.data.nextDocId++,
    claim_id: Number(req.params.id),
    filename:      req.file.filename,
    original_name: req.file.originalname,
    mimetype:      req.file.mimetype,
    size:          req.file.size,
    label:         label || req.file.originalname,
    uploaded_by:   uploaded_by || 'Unknown',
    uploaded_at:   new Date().toISOString(),
  }

  db.data.documents.push(doc)
  db.data.audit_logs.push({
    id: db.data.nextAuditId++,
    claim_id: Number(req.params.id),
    action: 'document_uploaded',
    actor: uploaded_by || 'Unknown',
    detail: `Uploaded: ${req.file.originalname} (${(req.file.size / 1024).toFixed(1)} KB)`,
    created_at: new Date().toISOString(),
  })
  await db.write()
  res.status(201).json(doc)
})

// Serve a stored file
router.get('/file/:filename', (req, res) => {
  const filePath = path.join(uploadsDir, path.basename(req.params.filename))
  if (!existsSync(filePath)) return res.status(404).json({ error: 'File not found.' })
  res.sendFile(filePath)
})

// Delete a document
router.delete('/doc/:docId', async (req, res) => {
  const idx = db.data.documents.findIndex(d => d.id === Number(req.params.docId))
  if (idx === -1) return res.status(404).json({ error: 'Document not found.' })

  const doc = db.data.documents[idx]
  try { await unlink(path.join(uploadsDir, doc.filename)) } catch {}

  db.data.documents.splice(idx, 1)
  await db.write()
  res.json({ ok: true })
})

export default router
