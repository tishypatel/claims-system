// Vercel serverless entry point.
// vercel.json rewrites /api/:path* → here, so Express handles all API calls
// on the same domain — no VITE_API_URL env var needed.
import app from '../backend/src/app.js'
export default app
