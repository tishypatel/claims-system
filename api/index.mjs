// Vercel serverless entry point — wraps the Express app.
// All requests to /api/* are forwarded here by vercel.json rewrites.
import app from '../backend/src/app.js'
export default app
