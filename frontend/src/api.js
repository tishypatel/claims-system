import axios from 'axios'

// With Vercel experimentalServices, the backend is always at /_/backend.
// Hardcoded so the Vite build never depends on an env var being injected.
const api = axios.create({
  baseURL: typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? '/_/backend'
    : '',
})

export default api
