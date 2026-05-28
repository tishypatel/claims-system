import express from 'express'
import cors from 'cors'
import { createRequire } from 'module'

// Load .env manually (no dotenv dependency needed in Node 20+)
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, '../../.env')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const [key, ...rest] = line.split('=')
    if (key && rest.length && !process.env[key.trim()]) {
      process.env[key.trim()] = rest.join('=').trim()
    }
  }
}

import './db/seed.js'
import claimsRouter    from './routes/claims.js'
import documentsRouter from './routes/documents.js'
import aiRouter        from './routes/ai.js'
import chatRouter      from './routes/chat.js'

const app  = express()
const PORT = process.env.PORT ?? 3001

app.use(cors({ origin: process.env.ALLOWED_ORIGIN ?? '*' }))
app.use(express.json())

app.use('/api/claims',    claimsRouter)
app.use('/api/claims',    documentsRouter)
app.use('/api/documents', documentsRouter)
app.use('/api',           aiRouter)
app.use('/api',           chatRouter)
app.get('/api/health',    (_, res) => res.json({ status: 'ok' }))

app.listen(PORT, () => console.log(`ClaimsHub API running on http://localhost:${PORT}`))
