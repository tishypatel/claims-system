import express from 'express'
import cors from 'cors'

// Routes & seed — imported statically (env vars come from Vercel dashboard in prod,
// or from index.js .env loader in local dev before this module is imported)
import './db/seed.js'
import claimsRouter    from './routes/claims.js'
import documentsRouter from './routes/documents.js'
import aiRouter        from './routes/ai.js'
import chatRouter      from './routes/chat.js'

const app = express()

// Strip the Vercel experimentalServices route prefix if present
// e.g. /_/backend/api/claims → /api/claims
app.use((req, _res, next) => {
  if (req.url.startsWith('/_/backend')) {
    req.url = req.url.slice('/_/backend'.length) || '/'
  }
  next()
})

app.use(cors({ origin: process.env.ALLOWED_ORIGIN ?? '*' }))
app.use(express.json())

app.use('/api/claims',    claimsRouter)
app.use('/api/claims',    documentsRouter)
app.use('/api/documents', documentsRouter)
app.use('/api',           aiRouter)
app.use('/api',           chatRouter)
app.get('/api/health',    (_, res) => res.json({ status: 'ok' }))

export default app
