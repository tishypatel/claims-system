import { JSONFilePreset } from 'lowdb/node'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { copyFileSync, existsSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const srcPath = join(__dirname, '../../db.json')

// On Vercel the deployment directory is read-only — use /tmp which is always writable.
// For local dev, write directly next to the source so changes persist across restarts.
const isVercel = !!process.env.VERCEL
const dbPath   = isVercel ? '/tmp/db.json' : srcPath

// Seed /tmp with the committed db.json so demo data is available on first run.
if (isVercel && !existsSync(dbPath) && existsSync(srcPath)) {
  copyFileSync(srcPath, dbPath)
}

const defaultData = {
  claims: [], notes: [], documents: [], audit_logs: [],
  nextClaimId: 1, nextNoteId: 1, nextDocId: 1, nextAuditId: 1,
}
export const db = await JSONFilePreset(dbPath, defaultData)
