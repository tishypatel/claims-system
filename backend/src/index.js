import express from 'express'
import cors from 'cors'
import './db/seed.js'
import claimsRouter from './routes/claims.js'

const app = express()
const PORT = 3001

app.use(cors({ origin: process.env.ALLOWED_ORIGIN ?? '*' }))
app.use(express.json())
app.use('/api/claims', claimsRouter)
app.get('/api/health', (_, res) => res.json({ status: 'ok' }))

app.listen(PORT, () => console.log(`ClaimsHub API running on http://localhost:${PORT}`))
